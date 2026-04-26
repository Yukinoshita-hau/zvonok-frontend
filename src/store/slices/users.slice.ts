import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { UserMini } from "../../entities/UserMini";

export interface UsersState {
	byId: Record<number, UserMini>
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
		upsertUser(previousState, action: PayloadAction<UserMini>) {
			const user = action.payload;

			if (!previousState.byId[user.id]) {
				previousState.ids.push(user.id);
			}

			previousState.byId[user.id] = {
				...previousState.byId[user.id],
				...user,
			};
		},

		upsertUsers(previousState, action: PayloadAction<UserMini[]>) {
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
})

export default usersSlice.reducer;
export const usersActions = usersSlice.actions;
