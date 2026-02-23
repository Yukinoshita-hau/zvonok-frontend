export interface LoginSuccessResponse {
	accessToken: string;
	tokenType: "Bearer";
	expiresIn: number;
}
