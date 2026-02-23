import { Client } from "@stomp/stompjs";

export const WS_CONNECT_PATH = "ws://127.0.0.1:8080/api/ws-raw"

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
