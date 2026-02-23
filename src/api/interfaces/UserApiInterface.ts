import type { AxiosResponse } from "axios";
import type { User } from "../../entities/user";


export interface UserApiInterface {
	getUserById: (id: number) => Promise<AxiosResponse<User>>;
	getMyUser: () => Promise<AxiosResponse<User>>;
}
