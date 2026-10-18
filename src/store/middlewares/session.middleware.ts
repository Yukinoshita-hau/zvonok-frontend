import type { Middleware } from "@reduxjs/toolkit";
import { session } from "../../api/api";

export const sessionMiddleware: Middleware = () => {
	const requests = new Map<string, number>();
	return next => action => {
		const event = action as { type: string; meta?: { requestId?: string } };
		if (event.type === "user/logout" || event.type === "user/logoutUser/pending") {
			session.invalidate();
			return action;
		}
		// Auth transport has its own epoch guard. All other thunks are scoped to this session.
		if (!/^user\/(loginUser|registerUser|logoutUser)\//.test(event.type)) {
			const id = event.meta?.requestId;
			if (id && event.type.endsWith("/pending")) requests.set(id, session.epoch);
			if (id && /\/(fulfilled|rejected)$/.test(event.type)) {
				const epoch = requests.get(id);
				requests.delete(id);
				if (epoch !== undefined && epoch !== session.epoch) return action;
			}
		}
		// Logout already cleared state at intent time. A delayed result must not clear a new login.
		if (/^user\/logoutUser\/(fulfilled|rejected)$/.test(event.type)) return action;
		return next(action);
	};
};
