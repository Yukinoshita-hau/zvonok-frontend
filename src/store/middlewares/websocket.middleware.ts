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
			client.onConnect = (frame) => {
				console.log("CONNECTED:", frame.command);
				storeApi.dispatch(websocketActions.connectSuccess());

				if (client) {
					registerWebSocketSubscriptions(client, storeApi, subscriptions);
				}
			};

			client.activate();
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
