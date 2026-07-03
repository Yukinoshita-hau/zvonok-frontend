import type { Middleware } from "@reduxjs/toolkit";
import { Client, type StompSubscription } from "@stomp/stompjs";
import type { Actions } from "../interfaces/actions.interface";
import type { AppDispatch, RootState } from "../interfaces/rootState.interface";
import { createWebSocketClient } from "../../services/websocket.service";
import { websocketActions } from "../slices/websocket.slice";
import { handleWebSocketPublishAction } from "./websocket/publishActions";
import { registerWebSocketSubscriptions } from "./websocket/subscriptions";

export const websocketMiddleware: Middleware<{}, RootState, AppDispatch> = (storeApi) => {
	let client: Client | null = null;
	let subscriptions: Record<string, StompSubscription> = {};

	return (next) => (action) => {
		const myAction = action as Actions;

		if (myAction.type === "websocket/connectStart") {
			const token = storeApi.getState().user.accessToken;

			if (!token) {
				storeApi.dispatch(websocketActions.connectError("No token available"));
				return;
			}

			if (client !== null) {
				client.deactivate();
				subscriptions = {};
			}

			client = createWebSocketClient(token);
			const currentClient = client;

			currentClient.onConnect = (frame) => {
				console.log("CONNECTED:", frame.command);
				storeApi.dispatch(websocketActions.connectSuccess());

				if (currentClient === client) {
					registerWebSocketSubscriptions(currentClient, storeApi, subscriptions);
				}
			};

			currentClient.onStompError = (frame) => {
				const message = frame.headers.message || "STOMP connection error";
				console.error("STOMP connection error", frame.headers, frame.body);
				storeApi.dispatch(websocketActions.connectError(message));
			};

			currentClient.onWebSocketError = (event) => {
				console.error("WebSocket connection error", event);
				storeApi.dispatch(websocketActions.connectError("WebSocket connection error"));
			};

			currentClient.onWebSocketClose = (event) => {
				if (currentClient !== client || currentClient.connected) return;
				const reason = event.reason ? ` ${event.reason}` : "";
				console.warn("WebSocket closed", { code: event.code, reason: event.reason, wasClean: event.wasClean });
				storeApi.dispatch(websocketActions.connectError(`WebSocket closed: ${event.code || "unknown"}${reason}`));
			};

			currentClient.activate();
			return;
		}

		const publishResult = handleWebSocketPublishAction(
			{ client, subscriptions, storeApi },
			myAction
		);

		if (publishResult === "blocked") return;

		return next(action);
	};
};
