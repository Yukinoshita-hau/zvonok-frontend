import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { JwtPayload } from "../JwtPayload";
import type { User } from "../../entities/user";

export interface UserState {
	accessToken: string | null;
	tokenType: string | null;
	expiresIn: number | null;
	expiresAt: number | null;
	isAuthChecked: boolean;
	myUser: User | null;
}

const initialState: UserState = {
	accessToken: null,
	tokenType: null,
	expiresIn: null,
	expiresAt: null,
	isAuthChecked: false,
	myUser: null
};

export const userSlice = createSlice({
	name: "user",
	initialState: initialState,
	reducers: {
		addJwt: (previousState, action: PayloadAction<JwtPayload>) => {
			previousState.accessToken = action.payload.accessToken;
			previousState.tokenType = action.payload.tokenType;
			previousState.expiresIn = action.payload.expiresIn;
			previousState.expiresAt = Date.now() + action.payload.expiresIn;
		},
		logout: (previousState) => {
			previousState.accessToken = null;
			previousState.tokenType = null;
			previousState.expiresIn = null;
			previousState.expiresAt = null;
		},
		setAuthChecked: (previousState, action: PayloadAction<boolean>) => {
			previousState.isAuthChecked = action.payload;
		},
		addUser: (previousState, action: PayloadAction<User>) => {
			previousState.myUser = action.payload;	
		}
	}
});

export default userSlice.reducer;
export const userActions = userSlice.actions;
