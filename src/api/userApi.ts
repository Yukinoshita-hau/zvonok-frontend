import type { User } from "../entities/user";
import { api } from "./api";
import type { UserApiInterface } from "./interfaces/UserApiInterface";

export const USER_API_PREFIX = "/users";

export const userApi: UserApiInterface = {
	getUserById: (id: number) => api.get<User>(`${USER_API_PREFIX}/${id}`),
	getMyUser: () => api.get<User>(`${USER_API_PREFIX}/my`)
}
