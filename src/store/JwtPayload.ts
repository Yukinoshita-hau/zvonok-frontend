export interface JwtPayload {
	accessToken: string;
	tokenType: string;
	expiresIn: number;
}
