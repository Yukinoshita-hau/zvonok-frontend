import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios";
import type { AppDispatch, RootState } from "../store/store";
import type { LoginSuccessResponse } from "../pages/Login/interfaces/LoginSuccessResponse";
import { SessionCoordinator } from "./sessionCoordinator";

export const TOKEN_REFRESH_THRESHOLD_MS = 60_000;
export const refreshThreshold = (expiresIn: number | null | undefined) =>
	Math.min(TOKEN_REFRESH_THRESHOLD_MS, expiresIn ? expiresIn / 2 : TOKEN_REFRESH_THRESHOLD_MS);
let boundStore: { getState: () => RootState; dispatch: AppDispatch } | null = null;
const API_URL = import.meta.env.VITE_API_URL || "/api";
export const authTransport = axios.create({ baseURL: API_URL, withCredentials: true });
export const api = axios.create({ baseURL: API_URL, withCredentials: true });
const marker = "zvonok.session.closed";
const boundary = "zvonok.session.version";
const channel = typeof window !== "undefined" && typeof BroadcastChannel !== "undefined"
	? new BroadcastChannel("zvonok.auth") : null;
export const session = new SessionCoordinator({
	read: () => boundStore?.getState().user,
	refresh: () => authTransport.post<LoginSuccessResponse>("/auth/refresh"),
	apply: data => boundStore?.dispatch({ type: "user/addJwt", payload: data }),
	clear: () => boundStore?.dispatch({ type: "user/sessionCleared" }),
	closed: () => { try { return localStorage.getItem(marker) === "true"; } catch { return false; } },
	version: () => { try { return localStorage.getItem(boundary); } catch { return null; } },
	mark: closed => {
		try {
			localStorage.setItem(marker, String(closed));
			if (closed) localStorage.setItem(boundary, globalThis.crypto?.randomUUID?.() ?? `${Date.now()}:${Math.random()}`);
		} catch { /* In-memory session invalidation remains available without renderer storage. */ }
	},
	broadcast: () => channel?.postMessage("boundary"),
	lock: withCookieLock,
});
channel?.addEventListener("message", () => session.observeBoundary());
if (typeof window !== "undefined") window.addEventListener("storage", event => {
	if (event.key === boundary) session.observeBoundary();
});
export const setStore = (store: NonNullable<typeof boundStore>) => { boundStore = store; };

async function withCookieLock<T>(task: () => Promise<T>): Promise<T> {
	if (typeof navigator !== "undefined" && navigator.locks) {
		return await navigator.locks.request("zvonok.auth.cookie", task);
	}
	return await task();
}

type SessionRequest = InternalAxiosRequestConfig & { sessionEpoch?: number; retried?: boolean };
api.interceptors.request.use(async (config: SessionRequest) => {
	const epoch = config.sessionEpoch ?? session.epoch;
	session.assertCurrent(epoch);
	config.sessionEpoch = epoch;
	let user = boundStore?.getState().user;
	if (user?.accessToken && user.expiresAt && user.expiresAt - Date.now() <= refreshThreshold(user.expiresIn)) {
		await session.refresh();
		user = boundStore?.getState().user;
	}
	session.assertCurrent(epoch);
	if (user?.accessToken) config.headers.Authorization = `${user.tokenType} ${user.accessToken}`;
	return config;
});
api.interceptors.response.use(response => {
	session.assertCurrent((response.config as SessionRequest).sessionEpoch!);
	return response;
}, async (error: unknown) => {
	if (!(error instanceof AxiosError)) throw error;
	const config = error.config as SessionRequest | undefined;
	// A request interceptor can reject with an error from the separate auth transport.
	// That error belongs to /auth/refresh and must retain its original identity/message.
	if (!config || config.sessionEpoch === undefined) throw error;
	session.assertCurrent(config.sessionEpoch!);
	if (error.response?.status !== 401 || !boundStore?.getState().user.accessToken) throw error;
	if (config.retried) {
		session.invalidate();
		throw error;
	}
	config.retried = true;
	const user = boundStore.getState().user;
	if (config.headers.Authorization === `${user.tokenType} ${user.accessToken}`) await session.refresh();
	session.assertCurrent(config.sessionEpoch!);
	return api.request(config);
});
