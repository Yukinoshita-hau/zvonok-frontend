import type { AxiosResponse } from "axios";
import type { LoginSuccessResponse } from "../../pages/Login/interfaces/LoginSuccessResponse";
import type { LoginDto } from "./LoginDto";
import type { RegisterDto } from "./RegisterDto";


export interface AuthApiInterface {
	register: (body: RegisterDto) => Promise<AxiosResponse<LoginSuccessResponse>>;
	login: (body: LoginDto) => Promise<AxiosResponse<LoginSuccessResponse>>;
	refresh: () => Promise<AxiosResponse<LoginSuccessResponse>>;
}
