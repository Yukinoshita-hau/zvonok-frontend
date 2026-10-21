import type { UserProfileUpdate } from "../../api/interfaces/UserProfileUpdatedEvent";
import { createAsyncThunk, createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { JwtPayload } from "../JwtPayload";
import type { User } from "../../entities/user";
import type { UpdateUserDto } from "../../api/interfaces/UpdateUserDto";
import { userApi } from "../../api/userApi";
import type { LogoutDto } from "../../api/interfaces/LogoutDto";
import type { LoginDto } from "../../api/interfaces/LoginDto";
import type { RegisterDto } from "../../api/interfaces/RegisterDto";
import authApi from "../../api/authApi";
import { session } from '../../api/api';
import { AVATAR_READBACK_FAILED, confirmedProfile, profileRequestError } from '../../api/profileResponse';

export interface UserState {
	logoutNotice: string | null;
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
	logoutNotice: null,
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
			const owner = (thunkAPI.getState() as {user:UserState}).user.myUser?.id;
			const updateUserData = (await userApi.updateMyUser(body)).data;
			if (updateUserData?.id !== owner || (thunkAPI.getState() as {user:UserState}).user.myUser?.id !== owner) throw new Error('Аккаунт изменился. Перечитайте профиль.');
			return confirmedProfile(updateUserData);
		} catch (e: any) {
			return thunkAPI.rejectWithValue(
				profileRequestError(e)
			);
		}
	}
);

export const uploadAvatar = createAsyncThunk(
	"user/uploadAvatar",
	async (file: File, thunkAPI) => {
		try {
			const previous = (thunkAPI.getState() as {user:UserState}).user.myUser;
			await userApi.uploadAvatar(file);
			try {
				const { data } = await userApi.getMyUser();
				const confirmed = confirmedProfile(data);
				if (!confirmed.avatarUrl || confirmed.avatarUrl === previous?.avatarUrl || confirmed.id !== previous?.id || (thunkAPI.getState() as {user:UserState}).user.myUser?.id !== previous?.id) throw new Error('Missing avatar acknowledgement');
				return confirmed;
			} catch { return thunkAPI.rejectWithValue(AVATAR_READBACK_FAILED); }
		} catch (e: any) {
			return thunkAPI.rejectWithValue(
				profileRequestError(e)
			);
		}
	}
);

export const logoutUser = createAsyncThunk(
	"user/logoutUser",
	async (body: LogoutDto, thunkAPI) => {
		const epoch = session.epoch;
		try {
			const { data } = await authApi.logout(body);
			if (data.allDevices !== body.allDevices) throw new Error('Logout scope was not confirmed');
			if (session.epoch === epoch) thunkAPI.dispatch(userActions.setLogoutNotice(body.allDevices ? 'Сервер подтвердил выход на всех устройствах.' : 'Сервер подтвердил выход из текущего сеанса.'));
			return data;
		} catch (e: any) {
			if (session.epoch === epoch) thunkAPI.dispatch(userActions.setLogoutNotice('Локальный доступ закрыт. Сервер не подтвердил отзыв сеанса: проверьте соединение. Выход на других устройствах не подтверждён.'));
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
			return confirmedProfile(data);
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
		setLogoutNotice: (state, action: PayloadAction<string>) => { if (!state.accessToken) state.logoutNotice = action.payload; },
		addJwt: (previousState, action: PayloadAction<JwtPayload>) => {
			previousState.logoutNotice = null;
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
			previousState.isAuthChecked = true;
		},
		setAuthChecked: (previousState, action: PayloadAction<boolean>) => {
			previousState.isAuthChecked = action.payload;
		},
		addUser: (previousState, action: PayloadAction<User>) => {
			previousState.myUser = action.payload;
		},

		patchMyUser: (previousState, action: PayloadAction<UserProfileUpdate>) => {
			if (!previousState.myUser) return;
			if (previousState.myUser.id !== action.payload.id) return;

			previousState.myUser = {
				...previousState.myUser,
				...action.payload,
			};
		},
	},
	extraReducers: (builder) => {
		builder
			.addCase(updateUser.pending, (previousState) => {
				previousState.status = "loading";
				previousState.error = null;
			})
			.addCase(updateUser.fulfilled, (previousState, action: PayloadAction<User>) => {
				previousState.status = "succeeded";
				previousState.error = null;

				previousState.myUser = action.payload;
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
