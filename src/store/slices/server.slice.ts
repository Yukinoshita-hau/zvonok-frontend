import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import type { Server } from "../../entities/server";
import { serverApi } from "../../api/serverApi";

export interface ServerState {
	servers: Server[] | null;
	status: "idle" | "loading" | "succeeded" | "failed";
	error: string | null;
}

const initialState: ServerState = {
	servers: null,
	status: "idle",
	error: null,
};

export const fetchMyServers = createAsyncThunk(
	"server/fetchMyServers",
	async (_, thunkAPI) => {
		try {
			const { data } = await serverApi.myServers();
			return data;
		} catch (e: any) {
			return thunkAPI.rejectWithValue(e?.message ?? "Failed to load servers");
		}
	}
)

export const serverSlice = createSlice({
	name: "server",
	initialState: initialState,
	reducers: {},
	extraReducers: builder => {
		builder
			.addCase(fetchMyServers.pending, currentState => {
				currentState.status = "loading";
				currentState.error = null;
			})
			.addCase(fetchMyServers.fulfilled, (currentState, action) => {
				currentState.status = "succeeded";
				currentState.servers = action.payload;
			})
			.addCase(fetchMyServers.rejected, (currentState, action) => {
				currentState.status = "failed";
				currentState.error = typeof action.payload === "string" ? action.payload : "Unknown error";
			})
	}
});

export default serverSlice.reducer;
export const serverActions = serverSlice.actions;
