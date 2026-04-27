import { Client } from "@stomp/stompjs";
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8080/api";

export const WS_CONNECT_PATH = `${API_URL}/ws-raw`

export const createWebSocketClient = (token: string) => {
	const client = new Client({
		brokerURL: `${WS_CONNECT_PATH}?token=${token}`,
		reconnectDelay: 5000,
		heartbeatIncoming: 4000,
		heartbeatOutgoing: 4000,
		debug: (str) => {
			console.log("WebSocket debug: ", str)
		}
	})

	return client;
}
