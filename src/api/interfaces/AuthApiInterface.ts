import type { AxiosResponse } from "axios";
import type { LoginSuccessResponse } from "../../pages/Login/interfaces/LoginSuccessResponse";
import type { LoginDto } from "./LoginDto";
import type { RegisterDto } from "./RegisterDto";
import type { LogoutSuccessResponse } from "./LogoutSuccessResponse";
import type { LogoutDto } from "./LogoutDto";


export interface AuthApiInterface {
	register: (body: RegisterDto) => Promise<AxiosResponse<LoginSuccessResponse>>;
	login: (body: LoginDto) => Promise<AxiosResponse<LoginSuccessResponse>>;
	refresh: () => Promise<AxiosResponse<LoginSuccessResponse>>;
	logout: (body: LogoutDto) => Promise<AxiosResponse<LogoutSuccessResponse>>
}
