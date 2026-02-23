import type { Server } from "../entities/server";
import { api } from "./api";
import type { ServerApiInterface } from "./interfaces/ServerApiInterface";

const SERVER_API_PREFIX = "/servers";

export const serverApi: ServerApiInterface = {
	myServers: () => api.get<Server[]>(`${SERVER_API_PREFIX}/my`),
}
