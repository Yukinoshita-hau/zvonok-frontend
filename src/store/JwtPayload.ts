import type { User } from "../entities/user";

export interface JwtPayload {
	accessToken: string;
	tokenType: string;
	expiresIn: number;
}
