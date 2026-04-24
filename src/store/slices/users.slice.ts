import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { UserShort } from "../../entities/userShort";

export interface UsersState {
	usersById: Record<number, UserShort>;
}

const initialState: UsersState = {
	usersById: {},
};

const mergeUser = (state: UsersState, user: UserShort) => {
	const existingUser = state.usersById[user.id];
	state.usersById[user.id] = existingUser ? { ...existingUser, ...user } : user;
};

export const usersSlice = createSlice({
	name: "users",
	initialState,
	reducers: {
		upsertUser: (state, action: PayloadAction<UserShort>) => {
			mergeUser(state, action.payload);
		},
		upsertUsers: (state, action: PayloadAction<UserShort[]>) => {
			action.payload.forEach((user) => {
				mergeUser(state, user);
			});
		},
		userProfileUpdated: (state, action: PayloadAction<UserShort>) => {
			mergeUser(state, action.payload);
		},
		clearUsers: (state) => {
			state.usersById = {};
		},
	},
});

export default usersSlice.reducer;
export const usersActions = usersSlice.actions;
