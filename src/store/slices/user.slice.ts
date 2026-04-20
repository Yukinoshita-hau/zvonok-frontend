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
	status: "idle" | "loading" | "succeeded" | "failed";
	error: string | null;
}

const initialState: UserState = {
	accessToken: null,
	tokenType: null,
	expiresIn: null,
	expiresAt: null,
	isAuthChecked: false,
	myUser: null,
	status: "idle",
	error: null,
};

export const updateUser = createAsyncThunk(
	"user/updateUser",
	async (body: UpdateUserDto, thunkAPI) => {
		try {
			const updateUserData = (await userApi.updateMyUser(body)).data;
			const refreshTokenData = (await authApi.refresh()).data;

			return {
				user: updateUserData,
				token: refreshTokenData,
			};
		} catch (e: any) {
			return thunkAPI.rejectWithValue(
				e?.response?.data?.message ?? e?.message ?? "Failed to update user"
			);
		}
	}
);

export const uploadAvatar = createAsyncThunk(
	"user/uploadAvatar",
	async (file: File, thunkAPI) => {
		try {
			await userApi.uploadAvatar(file);
			const { data } = await userApi.getMyUser();
			return data;
		} catch (e: any) {
			return thunkAPI.rejectWithValue(
				e?.response?.data?.message ?? e?.message ?? "Failed to upload user avatar"
			);
		}
	}
);

export const logoutUser = createAsyncThunk(
	"user/logoutUser",
	async (body: LogoutDto, thunkAPI) => {
		try {
			const { data } = await authApi.logout(body);
			return data;
		} catch (e: any) {
			return thunkAPI.rejectWithValue(
				e?.response?.data?.message ?? e?.message ?? "Failed to logout user"
			);
		}
	}
);

export const loginUser = createAsyncThunk(
	"user/loginUser",
	async (body: LoginDto, thunkAPI) => {
		try {
			const { data } = await authApi.login(body);
			return data;
		} catch (e: any) {
			return thunkAPI.rejectWithValue(
				e?.response?.data?.message ?? e?.message ?? "Failed to login user"
			);
		}
	}
);

export const registerUser = createAsyncThunk(
	"user/registerUser",
	async (body: RegisterDto, thunkAPI) => {
		try {
			const { data } = await authApi.register(body);
			return data;
		} catch (e: any) {
			return thunkAPI.rejectWithValue(
				e?.response?.data?.message ?? e?.message ?? "Failed to register user"
			);
		}
	}
);

export const getMyUser = createAsyncThunk(
	"user/getMyUser",
	async (_, thunkAPI) => {
		try {
			const { data } = await userApi.getMyUser();
			return data;
		} catch (e: any) {
			return thunkAPI.rejectWithValue(
				e?.response?.data?.message ?? e?.message ?? "Failed to load user"
			);
		}
	}
);

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
	extraReducers: (builder) => {
		builder
			.addCase(updateUser.pending, (previousState) => {
				previousState.status = "loading";
				previousState.error = null;
			})
			.addCase(updateUser.fulfilled, (previousState, action: PayloadAction<{
				user: User;
				token: JwtPayload;
			}>) => {
				previousState.status = "succeeded";
				previousState.error = null;

				previousState.myUser = action.payload.user;
				previousState.accessToken = action.payload.token.accessToken;
				previousState.tokenType = action.payload.token.tokenType;
				previousState.expiresIn = action.payload.token.expiresIn;
				previousState.expiresAt = Date.now() + action.payload.token.expiresIn;
			})
			.addCase(updateUser.rejected, (previousState, action) => {
				previousState.status = "failed";
				previousState.error = action.payload as string;
			})

			.addCase(uploadAvatar.pending, (previousState) => {
				previousState.status = "loading";
				previousState.error = null;
			})
			.addCase(uploadAvatar.fulfilled, (previousState, action: PayloadAction<User>) => {
				previousState.status = "succeeded";
				previousState.error = null;
				previousState.myUser = action.payload;
			})
			.addCase(uploadAvatar.rejected, (previousState, action) => {
				previousState.status = "failed";
				previousState.error = action.payload as string;
			})

			.addCase(getMyUser.pending, (previousState) => {
				previousState.status = "loading";
				previousState.error = null;
			})
			.addCase(getMyUser.fulfilled, (previousState, action: PayloadAction<User>) => {
				previousState.status = "succeeded";
				previousState.error = null;
				previousState.myUser = action.payload;
			})
			.addCase(getMyUser.rejected, (previousState, action) => {
				previousState.status = "failed";
				previousState.error = action.payload as string;
			})

			.addCase(logoutUser.fulfilled, (previousState) => {
				previousState.accessToken = null;
				previousState.tokenType = null;
				previousState.expiresIn = null;
				previousState.expiresAt = null;
				previousState.myUser = null;
				previousState.isAuthChecked = false;
				previousState.status = "idle";
				previousState.error = null;
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
			});
	}
});

export default userSlice.reducer;
export const userActions = userSlice.actions;
