import { beforeEach, describe, expect, it, vi } from "vitest";
import { AxiosError, AxiosHeaders } from "axios";
import { api, authTransport, session, setStore } from "../src/api/api";

const jwt = { accessToken: "new", tokenType: "Bearer", expiresIn: 600000 };
const response = (config: any, data: any, status = 200) => ({ data, status, statusText: String(status), headers: {}, config });
const deferred = () => { let resolve!: (value: any) => void; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
let state: any;
let events: any[];
beforeEach(async () => {
	const storage = new Map<string, string>();
	vi.stubGlobal("localStorage", { getItem: (k: string) => storage.get(k), setItem: (k: string, v: string) => storage.set(k, v) });
	session.invalidate(false);
	events = [];
	state = { user: { accessToken: "old", tokenType: "Bearer", expiresAt: Date.now() + 1000 } };
	setStore({ getState: () => state, dispatch: ((action: any) => {
		events.push(action);
		if (action.type === "user/addJwt") state.user = { ...action.payload, expiresAt: Date.now() + action.payload.expiresIn };
		if (action.type === "user/sessionCleared") state.user = { accessToken: null };
	}) as any });
	await session.authenticate(async () => null);
	state.user = { accessToken: "old", tokenType: "Bearer", expiresAt: Date.now() + 1000 };
	events = [];
});

describe("HTTP refresh", () => {
	it('missing refresh cookie follows the existing backend 400 contract and terminates the session', async () => {
		const error = new AxiosError('Missing cookie', 'ERR_BAD_REQUEST', undefined, undefined, response({}, { message: 'Refresh token not transferred' }, 400));
		authTransport.defaults.adapter = async () => { throw error; };
		await expect(session.refresh()).rejects.toBe(error);
		expect(state.user.accessToken).toBeNull();
		await expect(session.refresh()).rejects.toThrow('logged out');
	});
	it('403 is a permissions failure and does not rotate or clear credentials', async () => {
		state.user.expiresAt = Date.now() + 600000;
		const refresh = vi.fn(); authTransport.defaults.adapter = refresh;
		api.defaults.adapter = async config => { throw new AxiosError('Forbidden', 'ERR_BAD_REQUEST', config, undefined, response(config, {}, 403)); };
		await expect(api.get('/protected')).rejects.toThrow('Forbidden');
		expect(refresh).not.toHaveBeenCalled(); expect(state.user.accessToken).toBe('old');
	});
	it('an unrelated refresh 400 preserves the session rather than treating it as a missing cookie', async () => {
		const error = new AxiosError('Bad request', 'ERR_BAD_REQUEST', undefined, undefined, response({}, { message: 'Different problem' }, 400));
		authTransport.defaults.adapter = async () => { throw error; };
		await expect(session.refresh()).rejects.toBe(error);
		expect(state.user.accessToken).toBe('old');
	});
	it("ten concurrent requests share one refresh and all use the new access token", async () => {
		const gate = deferred();
		const refresh = vi.fn(async config => { await gate.promise; return response(config, jwt); });
		authTransport.defaults.adapter = refresh;
		const tokens: string[] = [];
		api.defaults.adapter = async config => { tokens.push(String(config.headers.Authorization)); return response(config, {}); };
		const pending = Array.from({ length: 10 }, () => api.get("/rooms/all"));
		await vi.waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
		gate.resolve(null);
		await Promise.all(pending);
		expect(refresh).toHaveBeenCalledTimes(1);
		expect(tokens).toEqual(Array(10).fill("Bearer new"));
	});
	it('parallel 401 responses share a rotation and retry each original request once', async () => {
		state.user.expiresAt = Date.now() + 600000;
		const gate = deferred();
		const refresh = vi.fn(async config => { await gate.promise; return response(config, jwt); });
		authTransport.defaults.adapter = refresh;
		const request = vi.fn(async config => {
			if (config.headers.Authorization === 'Bearer old') throw new AxiosError('Unauthorized', 'ERR_BAD_REQUEST', config, undefined, response(config, {}, 401));
			return response(config, {});
		});
		api.defaults.adapter = request;
		const pending = Array.from({ length: 10 }, () => api.get('/protected'));
		await vi.waitFor(() => expect(refresh).toHaveBeenCalledTimes(1)); gate.resolve(null);
		await Promise.all(pending);
		expect(refresh).toHaveBeenCalledTimes(1); expect(request).toHaveBeenCalledTimes(20);
	});
	it("logout during refresh rejects every waiter and cannot restore the old session", async () => {
		const gate = deferred();
		authTransport.defaults.adapter = async config => { await gate.promise; return response(config, jwt); };
		const waiters = Promise.allSettled(Array.from({ length: 10 }, () => session.refresh()));
		await Promise.resolve(); await Promise.resolve();
		session.invalidate();
		gate.resolve(null);
		expect((await waiters).every(result => result.status === "rejected")).toBe(true);
		expect(state.user.accessToken).toBeNull();
		await expect(session.refresh()).rejects.toThrow("logged out");
		expect(events.filter(e => e.type === "user/addJwt")).toHaveLength(0);
	});
	it("preserves the original network exception and session without TypeError", async () => {
		const error = new AxiosError("Network Error", "ERR_NETWORK", { url: "/auth/refresh", headers: new AxiosHeaders() });
		authTransport.defaults.adapter = async () => { throw error; };
		await expect(api.get("/rooms/all")).rejects.toBe(error);
		expect(state.user.accessToken).toBe("old");
	});
	it("invalid refresh clears the session once and rejects with the original 401", async () => {
		const error = new AxiosError("Refresh revoked", "ERR_BAD_REQUEST", undefined, undefined, response({ headers: new AxiosHeaders() }, {}, 401));
		authTransport.defaults.adapter = async () => { throw error; };
		await expect(session.refresh()).rejects.toBe(error);
		expect(state.user.accessToken).toBeNull();
		expect(events.filter(e => e.type === "user/sessionCleared")).toHaveLength(1);
	});
	it("401 retries only once, then terminates the session", async () => {
		state.user.expiresAt = Date.now() + 600000;
		const refresh = vi.fn(async config => response(config, jwt));
		authTransport.defaults.adapter = refresh;
		const request = vi.fn(async config => { throw new AxiosError("Unauthorized", "ERR_BAD_REQUEST", config, undefined, response(config, {}, 401)); });
		api.defaults.adapter = request;
		await expect(api.get("/protected")).rejects.toThrow("Unauthorized");
		expect(refresh).toHaveBeenCalledTimes(1);
		expect(request).toHaveBeenCalledTimes(2);
		expect(state.user.accessToken).toBeNull();
	});
	it("late HTTP responses are rejected after account/session change", async () => {
		state.user.expiresAt = Date.now() + 600000;
		const gate = deferred();
		api.defaults.adapter = async config => { await gate.promise; return response(config, { private: true }); };
		const pending = api.get("/private");
		const assertion = expect(pending).rejects.toThrow("Session changed");
		await Promise.resolve(); await Promise.resolve();
		session.invalidate(); gate.resolve(null);
		await assertion;
	});
});
