import { describe, it, expect, vi } from "vitest";
import { SessionCoordinator } from "../src/api/sessionCoordinator";

// Two independent renderer contexts share a cookie and the origin-wide Web Lock.
function contexts() {
	let cookie = 0;
	let closed = false;
	let lockQueue = Promise.resolve();
	const calls: number[] = [];
	const nodes: Array<{ session: SessionCoordinator; state: any }> = [];
	const create = () => {
		const node = { session: null as unknown as SessionCoordinator, state: { accessToken: "old", tokenType: "Bearer" } as any };
		node.session = new SessionCoordinator({
			read: () => node.state,
			apply: token => { node.state = token; },
			clear: () => { node.state = { accessToken: null }; },
			closed: () => closed,
			mark: value => { closed = value; },
			broadcast: () => { for (const other of nodes) if (other !== node) other.session.invalidate(false); },
			lock: task => {
				const result = lockQueue.then(task);
				lockQueue = result.then(() => undefined, () => undefined);
				return result;
			},
			refresh: async () => {
				const consumed = cookie;
				await Promise.resolve();
				expect(cookie).toBe(consumed);
				calls.push(consumed); cookie++;
				return { data: { accessToken: `jwt-${cookie}`, tokenType: "Bearer", expiresIn: 600000 } } as any;
			},
		});
		nodes.push(node);
		return node;
	};
	return { create, calls };
}

describe("shared-cookie renderer coordination", () => {
	it("two independent tabs serialize cookie rotations and each context coalesces ten waiters", async () => {
		const { create, calls } = contexts();
		const a = create(), b = create();
		await Promise.all([...Array.from({ length: 10 }, () => a.session.refresh()), ...Array.from({ length: 10 }, () => b.session.refresh())]);
		expect(calls).toEqual([0, 1]);
		expect(a.state.accessToken).toBe("jwt-1");
		expect(b.state.accessToken).toBe("jwt-2");
	});
	it("logout propagates a session boundary to the other renderer and prevents refresh", async () => {
		const { create } = contexts();
		const a = create(), b = create();
		a.session.invalidate();
		expect(b.state.accessToken).toBeNull();
		await expect(b.session.refresh()).rejects.toThrow("logged out");
	});
	it("logout waits for the in-flight cookie rotation before sending its revoke request", async () => {
		let release!: () => void;
		const gate = new Promise<void>(resolve => { release = resolve; });
		let cookie = 0;
		const refresh = vi.fn(async () => {
			await gate;
			cookie++;
			return { data: { accessToken: "new", tokenType: "Bearer", expiresIn: 600000 } } as any;
		});
		const apply = vi.fn();
		const session = new SessionCoordinator({
			read: () => ({ accessToken: "old", tokenType: "Bearer" }),
			refresh, apply, clear: () => {}, closed: () => false,
			mark: () => {}, broadcast: () => {}, lock: task => task(),
		});
		const pending = session.refresh().catch(() => {});
		await vi.waitFor(() => expect(refresh).toHaveBeenCalledOnce());
		session.invalidate();
		const revoke = vi.fn(async authorization => {
			expect(cookie).toBe(1);
			expect(authorization).toBe("Bearer old");
		});
		const logout = session.logout(revoke);
		await Promise.resolve();
		expect(revoke).not.toHaveBeenCalled();
		release();
		await Promise.all([pending, logout]);
		expect(revoke).toHaveBeenCalledOnce();
		expect(apply).not.toHaveBeenCalled();
	});
	it("logout cannot restore a session even when renderer storage is unavailable", async () => {
		const refresh = vi.fn();
		const session = new SessionCoordinator({
			read: () => ({ accessToken: "old", tokenType: "Bearer" }),
			refresh, apply: vi.fn(), clear: vi.fn(), closed: () => false,
			mark: () => {}, broadcast: () => {}, lock: task => task(),
		});
		session.invalidate();
		await expect(session.refresh()).rejects.toThrow("logged out");
		expect(refresh).not.toHaveBeenCalled();
	});
	it("a persisted boundary blocks stale refresh even before BroadcastChannel delivery", async () => {
		let version = "initial";
		let closed = false;
		const create = () => {
			const state = { accessToken: "old" as string | null };
			const refresh = vi.fn(async () => ({ data: { accessToken: "wrong-user", tokenType: "Bearer", expiresIn: 600000 } } as any));
			const session = new SessionCoordinator({
				read: () => ({ ...state, tokenType: "Bearer" }), refresh,
				apply: value => { state.accessToken = value.accessToken; }, clear: () => { state.accessToken = null; },
				closed: () => closed, version: () => version,
				mark: value => { closed = value; if (value) version += "changed"; },
				broadcast: () => {}, lock: task => task(),
			});
			return { session, state, refresh };
		};
		const a = create(), b = create();
		await b.session.authenticate(async () => null);
		await expect(a.session.refresh()).rejects.toThrow("another renderer");
		expect(a.state.accessToken).toBeNull();
		expect(a.refresh).not.toHaveBeenCalled();
	});
});
