import { AxiosError, CanceledError, type AxiosResponse } from "axios";
import type { LoginSuccessResponse as JwtPayload } from "../pages/Login/interfaces/LoginSuccessResponse";

interface SessionAdapter {
	read: () => { accessToken: string | null; tokenType: string | null } | undefined;
	refresh: () => Promise<AxiosResponse<JwtPayload>>;
	apply: (data: JwtPayload) => void;
	clear: () => void;
	closed: () => boolean;
	version?: () => string | null;
	mark: (closed: boolean) => void;
	broadcast: () => void;
	lock: <T>(task: () => Promise<T>) => Promise<T>;
}

export class SessionCoordinator {
	epoch = 0;
	private flight: Promise<AxiosResponse<JwtPayload>> | null = null;
	private logoutAuthorization: string | undefined;
	private closed = false;
	private version: string | null;
	private queue: Promise<unknown> = Promise.resolve();
	private readonly adapter: SessionAdapter;
	get refreshing() { return this.flight !== null; }
	constructor(adapter: SessionAdapter) {
		this.adapter = adapter;
		this.version = adapter.version?.() ?? null;
	}
	private lock<T>(task: () => Promise<T>): Promise<T> {
		const result = this.queue.then(() => this.adapter.lock(task));
		this.queue = result.catch(() => {});
		return result;
	}

	assertCurrent(epoch: number) {
		if (epoch !== this.epoch) throw new CanceledError("Session changed");
		if (this.version !== (this.adapter.version?.() ?? null)) {
			this.invalidate(false);
			throw new CanceledError("Session changed in another renderer");
		}
	}

	observeBoundary() {
		if (this.version !== (this.adapter.version?.() ?? null)) this.invalidate(false);
	}

	invalidate(broadcast = true) {
		const user = this.adapter.read();
		this.logoutAuthorization = user?.accessToken ? `${user.tokenType} ${user.accessToken}` : undefined;
		this.epoch++;
		this.closed = true;
		this.flight = null;
		if (broadcast) {
			this.adapter.mark(true);
		}
		this.version = this.adapter.version?.() ?? null;
		if (broadcast) this.adapter.broadcast();
		this.adapter.clear();
	}

	refresh() {
		try { this.assertCurrent(this.epoch); } catch (error) { return Promise.reject(error); }
		if (this.closed || this.adapter.closed()) return Promise.reject(new CanceledError("Session is logged out"));
		if (this.flight) return this.flight;
		const epoch = this.epoch;
		const flight = this.lock(async () => {
			this.assertCurrent(epoch);
			if (this.closed || this.adapter.closed()) throw new CanceledError("Session is logged out");
			try {
				const response = await this.adapter.refresh();
				this.assertCurrent(epoch);
				if (this.closed || this.adapter.closed()) throw new CanceledError("Session is logged out");
				this.adapter.apply(response.data);
				return response;
			} catch (error) {
				if (epoch === this.epoch && error instanceof AxiosError && (error.response?.status === 401 ||
					(error.response?.status === 400 && error.response.data?.message === 'Refresh token not transferred'))) this.invalidate();
				throw error;
			}
		});
		this.flight = flight;
		void flight.finally(() => { if (this.flight === flight) this.flight = null; }).catch(() => {});
		return flight;
	}

	async authenticate<T>(task: () => Promise<T>): Promise<T> {
		this.invalidate();
		const epoch = this.epoch;
		return this.lock(async () => {
			this.assertCurrent(epoch);
			const result = await task();
			this.assertCurrent(epoch);
			this.adapter.mark(false);
			this.closed = false;
			return result;
		});
	}

	logout<T>(task: (authorization: string | undefined) => Promise<T>) {
		const authorization = this.logoutAuthorization;
		const epoch = this.epoch;
		return this.lock(() => {
			this.assertCurrent(epoch);
			return task(authorization);
		});
	}
}
