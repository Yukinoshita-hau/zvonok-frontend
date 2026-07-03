import { Client } from "@stomp/stompjs";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8080/api";
const CONFIGURED_WS_URL = import.meta.env.VITE_WS_URL;

export const WS_CONNECT_PATH = resolveWebSocketConnectPath();

export const createWebSocketClient = (token: string) => {
	const brokerURL = `${WS_CONNECT_PATH}?token=${encodeURIComponent(token)}`;

	const client = new Client({
		brokerURL,
		reconnectDelay: 5000,
		heartbeatIncoming: 4000,
		heartbeatOutgoing: 4000,
		debug: (str) => {
			console.log("WebSocket debug: ", str)
		}
	})

	console.info("WebSocket endpoint:", WS_CONNECT_PATH);

	return client;
}

function resolveWebSocketConnectPath() {
	const configuredUrl = CONFIGURED_WS_URL?.trim();

	if (configuredUrl) {
		return normalizeWebSocketUrl(configuredUrl);
	}

	return normalizeWebSocketUrl(joinUrl(API_URL, "ws-raw"));
}

function normalizeWebSocketUrl(url: string) {
	const withEndpoint = hasWebSocketEndpoint(url) ? url : joinUrl(url, "ws-raw");

	if (withEndpoint.startsWith("https://")) {
		return `wss://${withEndpoint.slice("https://".length)}`;
	}

	if (withEndpoint.startsWith("http://")) {
		return `ws://${withEndpoint.slice("http://".length)}`;
	}

	return withEndpoint;
}

function hasWebSocketEndpoint(url: string) {
	const normalized = url.split("?")[0].replace(/\/+$/, "");
	return normalized.endsWith("/ws") || normalized.endsWith("/ws-raw");
}

function joinUrl(baseUrl: string, path: string) {
	return `${baseUrl.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;
}
