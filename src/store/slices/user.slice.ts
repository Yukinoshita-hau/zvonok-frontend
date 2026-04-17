import { createAsyncThunk, createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { JwtPayload } from "../JwtPayload";
import type { User } from "../../entities/user";
import type { UpdateUserDto } from "../../api/interfaces/UpdateUserDto";
import { userApi } from "../../api/userApi";
import type { LogoutDto } from "../../api/interfaces/LogoutDto";
import type { LoginDto } from "../../api/interfaces/LoginDto";
import type { RegisterDto } from "../../api/interfaces/RegisterDto";
import authApi from "../../api/authApi";

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

export const updateUser = createAsyncThunk(
	"user/updateUser",
	async (body: UpdateUserDto, thunkAPI) => {
		try {
			const updateUserData = (await userApi.updateMyUser(body)).data;
			const refreshTokenData = (await authApi.refresh()).data;
			return {
				user: updateUserData,
				token: refreshTokenData
			};
		} catch (e: any) {
			return thunkAPI.rejectWithValue(e?.message ?? "Failed to load user");
		}
	}
)

export const logoutUser = createAsyncThunk(
	"user/logoutUser",
	async (body: LogoutDto, thunkAPI) => {
		try {
			const { data } = await authApi.logout(body);
			return data;
		} catch (e: any) {
			return thunkAPI.rejectWithValue(e?.message ?? "Failed to load user");
		}
	}
)

export const loginUser = createAsyncThunk(
	"user/loginUser",
	async (body: LoginDto, thunkAPI) => {
		try {
			const { data } = await authApi.login(body);
			return data;
		} catch (e: any) {
			return thunkAPI.rejectWithValue(e?.message ?? "Failed to load user");
		}
	}
)

export const registerUser = createAsyncThunk(
	"user/registerUser",
	async (body: RegisterDto, thunkAPI) => {
		try {
			const { data } = await authApi.register(body);
			return data;
		} catch (e: any) {
			thunkAPI.rejectWithValue(e?.message ?? "Failed to load user")
		}
	}
)

export const getMyUser = createAsyncThunk(
	"user/getMyUser",
	async (_, thunkAPI) => {
		try {
			const { data } = await userApi.getMyUser();
			return data;
		} catch (e: any) {
			return thunkAPI.rejectWithValue(e?.message ?? "Failed to load user");
		}
	}
)

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
		login: (previousState, action: PayloadAction<JwtPayload>) => {
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
			previousState.myUser = null;
			previousState.isAuthChecked = false;
		},
		setAuthChecked: (previousState, action: PayloadAction<boolean>) => {
			previousState.isAuthChecked = action.payload;
		},
		addUser: (previousState, action: PayloadAction<User>) => {
			previousState.myUser = action.payload;
		}
	},
	extraReducers: builder => {
		builder
			.addCase(updateUser.fulfilled, (previousState, action: PayloadAction<{
				user: User,
				token: JwtPayload
			}>) => {
				previousState.myUser = action.payload.user;
				previousState.accessToken = action.payload.token.accessToken;
				previousState.tokenType = action.payload.token.tokenType;
				previousState.expiresIn = action.payload.token.expiresIn;
				previousState.expiresAt = Date.now() + action.payload.token.expiresIn;
			})


			.addCase(logoutUser.fulfilled, (previousState) => {
				previousState.accessToken = null;
				previousState.tokenType = null;
				previousState.expiresIn = null;
				previousState.expiresAt = null;
				previousState.myUser = null;
				previousState.isAuthChecked = false;
			})


			.addCase(loginUser.fulfilled, (previousState, action: PayloadAction<JwtPayload>) => {
				previousState.accessToken = action.payload.accessToken;
				previousState.tokenType = action.payload.tokenType;
				previousState.expiresIn = action.payload.expiresIn;
				previousState.expiresAt = Date.now() + action.payload.expiresIn;
			})

			.addCase(registerUser.fulfilled, (previousState, action: PayloadAction<JwtPayload>) => {
				previousState.accessToken = action.payload.accessToken;
				previousState.tokenType = action.payload.tokenType;
				previousState.expiresIn = action.payload.expiresIn;
				previousState.expiresAt = Date.now() + action.payload.expiresIn;
			})


			.addCase(getMyUser.fulfilled, (previousState, action: PayloadAction<User>) => {
				previousState.myUser = action.payload;
			})
	}
});

export default userSlice.reducer;
export const userActions = userSlice.actions;
