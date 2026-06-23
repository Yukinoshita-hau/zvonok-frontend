import type { Client, StompSubscription } from "@stomp/stompjs";
import type { MiddlewareAPI } from "@reduxjs/toolkit";
import type { AppDispatch, RootState } from "../../interfaces/rootState.interface";

export type WebSocketStoreApi = MiddlewareAPI<AppDispatch, RootState>;
export type SubscriptionRegistry = Record<string, StompSubscription>;

export interface WebSocketPublishContext {
	client: Client | null;
	subscriptions: SubscriptionRegistry;
	storeApi: WebSocketStoreApi;
}

export type PublishActionResult = "handled" | "blocked" | "not-handled";
