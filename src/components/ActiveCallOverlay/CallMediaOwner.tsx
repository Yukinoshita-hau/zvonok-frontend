import { useRoomContext } from "@livekit/components-react";
import { useEffect, useState } from "react";
import { useDispatch, useStore } from "react-redux";
import { callApi } from "../../api/callApi";
import { api } from "../../api/api";
import { mediaHeaders } from "../../api/mediaClient";
import { callActions } from "../../store/slices/call.slice";
import type { AppDispatch, RootState } from "../../store/store";

export const mediaRenewRetryDelay = (attempt: number) => Math.min(2000 * 2 ** Math.min(attempt, 3), 15000);
export const isMediaRenewRelease = (status: number, data: unknown) => status === 200 && data === "RELEASE";

export function CallMediaOwner({ callId, generation }: { callId: number; generation: number }) {
	const room = useRoomContext();
	const dispatch = useDispatch<AppDispatch>();
	const store = useStore<RootState>();
	const [backendUnavailable, setBackendUnavailable] = useState(false);
	useEffect(() => {
		const headers = mediaHeaders, clientId = headers["X-Media-Client-Id"];
		let stopped = false, released = false, timer: ReturnType<typeof setTimeout> | undefined, failures = 0;
		const release = async () => {
			if (released) return;
			released = true;
			stopped = true;
			if (timer) clearTimeout(timer);
			await room.disconnect();
			dispatch(callActions.mediaOwnershipLost({ callId, generation }));
			for (let attempt = 0; attempt < 5; attempt++) {
				try { await callApi.releaseMedia(callId, clientId); return; } catch {
					await new Promise(resolve => setTimeout(resolve, 500));
				}
			}
			for (let attempt = 0; attempt < 5; attempt++) {
				try { await callApi.releaseMedia(callId, clientId); return; } catch {
					await new Promise(resolve => setTimeout(resolve, 500));
				}
			}
		};
		const check = async () => {
			if (stopped) return;
			try {
				const { data, status } = await callApi.renewMedia(callId, clientId);
				if (stopped) return;
				if (isMediaRenewRelease(status, data)) { await release(); return; }
				if (status !== 200 || data !== "OWNED") throw new Error("Unexpected media renew response");
				failures = 0;
				setBackendUnavailable(false);
				timer = setTimeout(() => void check(), 5000);
			} catch (error) {
				if (stopped) return;
				setBackendUnavailable(true);
				timer = setTimeout(() => void check(), mediaRenewRetryDelay(failures++));
			}
		};
		const onPageHide = () => {
			void room.disconnect();
			const user = store.getState().user;
			// Start synchronously: unload may discard any continuation after await.
			void fetch(api.getUri({ url: `/calls/${callId}/media/release` }), {
				method: "POST", keepalive: true, credentials: "include",
				headers: { ...headers, Authorization: `${user.tokenType} ${user.accessToken}` },
			}).catch(() => {});
		};
		window.addEventListener("pagehide", onPageHide);
		void check();
		return () => {
			stopped = true;
			if (timer) clearTimeout(timer);
			window.removeEventListener("pagehide", onPageHide);
			void release();
		};
	}, [room, callId, generation, dispatch, store]);
	return backendUnavailable ? <span role="status" style={{ position: "fixed", right: 16, top: 16, zIndex: 1205, padding: "8px 12px", borderRadius: 8, background: "var(--bg-secondary)", color: "var(--text-primary)", pointerEvents: "none" }}>Сервис временно недоступен. Голосовая связь продолжается.</span> : null;
}
