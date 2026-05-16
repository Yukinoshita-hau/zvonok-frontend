import { createAsyncThunk, createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { ActiveCallResponse } from "../../api/interfaces/ActiveCallResponse";
import { roomApi } from "../../api/roomApi";


export interface ActiveCallState {
	activeCall: null | ActiveCallResponse
	error: null | string;
}

export const initialState: ActiveCallState = {
	activeCall: null,
	error: null
}

export const getActiveCall = createAsyncThunk("activeCall/getActiveCall", async (roomId: number, thunkAPI) => {
	try {
		const { data } = await roomApi.getActiveCall({ roomId });
		return data;
	} catch(e: any) {
		return thunkAPI.rejectWithValue(e?.message ?? "Failed to get active call");
	}
})

export const activeCallSlice = createSlice({
	name: "activeCall",
	initialState,
	reducers: {
		clearCall: (previosState) => {
			previosState.activeCall = null;
		}
	},
	extraReducers: (builder) => {
		builder
			.addCase(getActiveCall.rejected, (state, action) => {
				state.error = typeof action.payload === "string" ? action.payload : "Failed to get active call";
			})
			.addCase(getActiveCall.fulfilled, (state, action: PayloadAction<ActiveCallResponse | "">) => {
				if (action.payload !== "") {
					state.activeCall = action.payload;
				} else {
					state.activeCall = null;
				}
				state.error = null;
			})
	}
})

export default activeCallSlice.reducer;
export const activeCallActions = activeCallSlice.actions;
