import type { LoginSuccessResponse } from "../pages/Login/interfaces/LoginSuccessResponse";
import { authTransport, session } from "./api";
import type { AuthApiInterface } from "./interfaces/AuthApiInterface";
import type { LoginDto } from "./interfaces/LoginDto";
import type { LogoutDto } from "./interfaces/LogoutDto";
import type { LogoutSuccessResponse } from "./interfaces/LogoutSuccessResponse";
import type { RegisterDto } from "./interfaces/RegisterDto";

const AUTH_API_PREFIX = "/auth";

export const authApi: AuthApiInterface = {
	register: (body: RegisterDto) => session.authenticate(() => authTransport.post<LoginSuccessResponse>(`${AUTH_API_PREFIX}/register`, body)),
	login: (body: LoginDto) => session.authenticate(() => authTransport.post<LoginSuccessResponse>(`${AUTH_API_PREFIX}/login`, body)),
	refresh: () => session.refresh(),
	logout: (body: LogoutDto) => session.logout(authorization => authTransport.post<LogoutSuccessResponse>(`${AUTH_API_PREFIX}/logout`, body, { headers: { Authorization: authorization } }))
}

export default authApi;
