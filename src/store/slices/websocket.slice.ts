import { createSlice, type PayloadAction } from "@reduxjs/toolkit";


export interface WebSocketState {
	isConnected: boolean;
	status: "idle" | "connecting" | "connected" | "error"
	error: string | null
}

const initialState: WebSocketState = {
	isConnected: false,
	status: "idle",
	error: null
}

export const websocketSlice = createSlice({
	name: "websocket",
	initialState,
	reducers: {
		connectStart: (previousState) => {
			previousState.status = "connecting";
			previousState.error = null;
		},
		connectSuccess: (previousState) => {
			previousState.isConnected = true;
			previousState.status = "connected";
			previousState.error = null;
		},
		connectError: (previousState, action: PayloadAction<string>) => {
			previousState.isConnected = false;
			previousState.status = "error";
			previousState.error = action.payload;
		},
	}
})

export default websocketSlice.reducer;
export const websocketActions = websocketSlice.actions;
