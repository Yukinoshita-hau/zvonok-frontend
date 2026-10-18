import type { Middleware } from "@reduxjs/toolkit";
import type { Client, StompSubscription } from "@stomp/stompjs";
import type { Actions } from "../interfaces/actions.interface";
import type { AppDispatch, RootState } from "../store";
import { createWebSocketClient, configureWebSocketToken } from "../../services/websocket.service";
import { session, refreshThreshold } from "../../api/api";
import { websocketActions } from "../slices/websocket.slice";
import { handleWebSocketPublishAction } from "./websocket/publishActions";
import { registerWebSocketSubscriptions } from "./websocket/subscriptions";
import { fetchRoomMessages, messageActions } from "../slices/message.slice";
import { fetchMyRooms } from "../slices/room.slice";
import { fetchIncomingRequests, fetchMyFriends, fetchOutgoingRequests } from "../slices/friend.slice";
import { restoreCallSession } from "../slices/call.slice";
import { getActiveCall } from "../slices/activeCall.slice";

export const websocketMiddleware: Middleware<{}, RootState, AppDispatch> = storeApi => {
	let client: Client | null = null;
	let subscriptions: Record<string, StompSubscription> = {};
	let timer: ReturnType<typeof setTimeout> | undefined;
	let connection = 0;
	let lifecycle = Promise.resolve();
	let connectedToken: string | null = null;
	let replacing = false;

	const scheduleRefresh = () => {
		clearTimeout(timer);
		const { expiresAt, expiresIn } = storeApi.getState().user;
		if (!expiresAt || !client) return;
		const epoch = session.epoch;
		const current = client;
		timer = setTimeout(() => {
			void session.refresh().catch(() => {
				if (session.epoch === epoch && client === current) storeApi.dispatch(websocketActions.connectError("Не удалось обновить сессию. Проверьте соединение."));
			});
		}, Math.max(0, expiresAt - Date.now() - refreshThreshold(expiresIn)));
	};

	const start = () => {
		if (client || !storeApi.getState().user.accessToken) return;
		const current = createWebSocketClient(storeApi.getState().user.accessToken!);
		client = current;
		const epoch = session.epoch;
		const valid = () => client === current && session.epoch === epoch;
		const subscribe = current.subscribe.bind(current);
		current.subscribe = (path, callback, headers) => {
			const generation = connection;
			return subscribe(path, message => {
				if (valid() && connection === generation && current.connected) callback(message);
			}, headers);
		};
		current.beforeConnect = async () => {
			try {
				const user = storeApi.getState().user;
				if (!user.expiresAt || user.expiresAt - Date.now() <= refreshThreshold(user.expiresIn)) await session.refresh();
				if (!valid()) { void current.deactivate({ force: true }); return; }
				const token = storeApi.getState().user.accessToken;
				if (!token) { void current.deactivate({ force: true }); return; }
				connectedToken = token;
				configureWebSocketToken(current, token);
			} catch {
				if (valid()) storeApi.dispatch(websocketActions.connectError("Не удалось авторизовать WebSocket"));
				// STOMP does not reschedule a failed beforeConnect. Resume on online or explicit connect.
				void current.deactivate({ force: true });
			}
		};
		current.onConnect = () => {
			if (!valid()) return;
			connection++;
			subscriptions = {};
			const generation = connection;
			const active = () => valid() && connection === generation && current.connected;
			const guardedStore = { ...storeApi, dispatch: ((action: Parameters<AppDispatch>[0]) => {
				if (active()) return storeApi.dispatch(action);
			}) as AppDispatch };
			registerWebSocketSubscriptions(current, guardedStore, subscriptions);
			storeApi.dispatch(websocketActions.connectSuccess());
			scheduleRefresh();
			void (async () => {
				const roomResult = await storeApi.dispatch(fetchMyRooms());
				if (!active()) return;
				const roomId = storeApi.getState().message.activeRoomId;
				if (fetchMyRooms.fulfilled.match(roomResult) && roomId !== null) {
					if (roomResult.payload.some(room => room.id === roomId)) {
						storeApi.dispatch(fetchRoomMessages({ roomId, resync: true }));
						storeApi.dispatch(getActiveCall(roomId));
					} else storeApi.dispatch(messageActions.setActiveRoom(null));
				}
				storeApi.dispatch(fetchMyFriends());
				storeApi.dispatch(fetchIncomingRequests());
				storeApi.dispatch(fetchOutgoingRequests());
				const restored = await storeApi.dispatch(restoreCallSession());
				if (!active()) return;
				if (!fetchMyRooms.fulfilled.match(roomResult) || !restoreCallSession.fulfilled.match(restored)) {
					storeApi.dispatch(websocketActions.syncError("Не удалось синхронизировать состояние сессии"));
				}
			})();
		};
		current.onStompError = () => {
			if (valid()) storeApi.dispatch(websocketActions.connectError("WebSocket: доступ отклонён"));
		};
		current.onWebSocketError = () => {
			if (valid()) storeApi.dispatch(websocketActions.connectError("WebSocket connection error"));
		};
		current.onWebSocketClose = () => {
			if (!valid()) return;
			connection++;
			subscriptions = {};
			if (!replacing) storeApi.dispatch(websocketActions.connectError("Соединение потеряно. Переподключение…"));
		};
		current.activate();
	};

	const reconnect = () => {
		const current = client;
		if (!current || replacing) return;
		replacing = true;
		connection++;
		subscriptions = {};
		storeApi.dispatch(websocketActions.connectStart());
		lifecycle = lifecycle.then(async () => {
			await current.deactivate({ force: true });
			replacing = false;
			if (client === current && storeApi.getState().user.accessToken) current.activate();
		});
	};
	if (typeof window !== "undefined") window.addEventListener("online", () => {
		if (!client) return;
		const { expiresAt, expiresIn } = storeApi.getState().user;
		if (expiresAt && expiresAt - Date.now() <= refreshThreshold(expiresIn)) {
			void session.refresh().catch(() => storeApi.dispatch(websocketActions.connectError("Не удалось обновить сессию")));
		} else if (!client.connected) reconnect();
	});

	return next => action => {
		const event = action as Actions;
		if ((action as { type: string }).type === "user/sessionCleared") {
			clearTimeout(timer);
			connection++;
			const previous = client;
			client = null;
			connectedToken = null;
			subscriptions = {};
			lifecycle = lifecycle.then(async () => { await previous?.deactivate({ force: true }); });
			return next(action);
		}
		const oldToken = storeApi.getState().user.accessToken;
		if (event.type === "websocket/connectStart") {
			if (replacing) return next(action);
			if (client?.active) return action;
			const result = next(action);
			if (client) reconnect();
			else { void lifecycle.then(start); }
			return result;
		}
		const result = handleWebSocketPublishAction({ client, subscriptions, storeApi }, event);
		if (result === "blocked") return action;
		const returned = next(action);
		const token = storeApi.getState().user.accessToken;
		if (token && token !== oldToken) {
			scheduleRefresh();
			if (client && (!client.active || (client.connected && token !== connectedToken))) reconnect();
		}
		return returned;
	};
};
