import type { User } from "../entities/user";
import { api } from "./api";
import type { UpdateUserDto } from "./interfaces/UpdateUserDto";
import type { UserApiInterface } from "./interfaces/UserApiInterface";

export const USER_API_PREFIX = "/users";

export const userApi: UserApiInterface = {
	getUserById: (id: number) => api.get<User>(`${USER_API_PREFIX}/${id}`),
	getMyUser: () => api.get<User>(`${USER_API_PREFIX}/my`),
	updateMyUser: (body: UpdateUserDto) => api.put<User>(`${USER_API_PREFIX}/my`, body)
}
