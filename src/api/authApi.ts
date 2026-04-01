import type { LoginSuccessResponse } from "../pages/Login/interfaces/LoginSuccessResponse";
import { api } from "./api";
import type { AuthApiInterface } from "./interfaces/AuthApiInterface";
import type { LoginDto } from "./interfaces/LoginDto";
import type { LogoutDto } from "./interfaces/LogoutDto";
import type { LogoutSuccessResponse } from "./interfaces/LogoutSuccessResponse";
import type { RegisterDto } from "./interfaces/RegisterDto";

const AUTH_API_PREFIX = "/auth";

export const authApi: AuthApiInterface = {
	register: (body: RegisterDto) => api.post<LoginSuccessResponse>(`${AUTH_API_PREFIX}/register`, body),
	login: (body: LoginDto) => api.post<LoginSuccessResponse>(`${AUTH_API_PREFIX}/login`, body),	
	refresh: () => api.post<LoginSuccessResponse>(`${AUTH_API_PREFIX}/refresh`),
	logout: (body: LogoutDto) => api.post<LogoutSuccessResponse>(`${AUTH_API_PREFIX}/logout`, body)
}

export default authApi;
