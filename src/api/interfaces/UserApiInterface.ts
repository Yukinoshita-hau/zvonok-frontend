import type { AxiosResponse } from "axios";
import type { User } from "../../entities/user";
import type { UpdateUserDto } from "./UpdateUserDto";
import type { UserMiniProfileDto } from "./UserMiniProfileDto";


export interface UserApiInterface {
	getUserById: (id: number) => Promise<AxiosResponse<User>>;
	getMyUser: () => Promise<AxiosResponse<User>>;
	updateMyUser: (body: UpdateUserDto) => Promise<AxiosResponse<User>>
	uploadAvatar: (file: File) => Promise<AxiosResponse<void>>;
	getMiniProfile: (userId: number) => Promise<AxiosResponse<UserMiniProfileDto>>;
}
