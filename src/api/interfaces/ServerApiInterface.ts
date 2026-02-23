import type { AxiosResponse } from "axios";
import type { Server } from "../../entities/server";

export interface ServerApiInterface {
	myServers: () => Promise<AxiosResponse<Server[]>>
}
