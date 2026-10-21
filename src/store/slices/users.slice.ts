import type { UserProfileUpdate } from "../../api/interfaces/UserProfileUpdatedEvent";
import { createSlice, isAnyOf, type PayloadAction } from "@reduxjs/toolkit";
import { updateUser, uploadAvatar } from './user.slice';
import type { UserSummary } from "../../entities/UserMini";

export interface UsersState {
	byId: Record<number, UserSummary>
	ids: number[];
}

const initialState: UsersState = {
	byId: {},
	ids: []
}

const usersSlice = createSlice({
	name: "users",
	initialState,
	reducers: {
		patchUser(state, action: PayloadAction<UserProfileUpdate>) {
			const previous = state.byId[action.payload.id];
			if (previous) state.byId[action.payload.id] = { ...previous, ...action.payload };
		},
		upsertUser(previousState, action: PayloadAction<UserSummary>) {
			const user = action.payload;

			if (!previousState.byId[user.id]) {
				previousState.ids.push(user.id);
			}

			previousState.byId[user.id] = {
				...previousState.byId[user.id],
				...user,
			};
		},

		upsertUsers(previousState, action: PayloadAction<UserSummary[]>) {
			for (const user of action.payload) {
				if (!previousState.byId[user.id]) {
					previousState.ids.push(user.id);
				}

				previousState.byId[user.id] = {
					...previousState.byId[user.id],
					...user,
				};
			}
		},

		removeUser(previousState, action: PayloadAction<number>) {
			const userId = action.payload;

			delete previousState.byId[userId];
			previousState.ids = previousState.ids.filter((id) => id !== userId);
		},

		clearUsers() {
			return initialState;
		},
	},
	extraReducers: builder => builder.addMatcher(isAnyOf(updateUser.fulfilled, uploadAvatar.fulfilled), (state, {payload}) => {
		const previous = state.byId[payload.id];
		if (previous) state.byId[payload.id] = {...previous, username:payload.username, displayName:payload.displayName, avatarUrl:payload.avatarUrl};
	}),
})

export default usersSlice.reducer;
export const usersActions = usersSlice.actions;
