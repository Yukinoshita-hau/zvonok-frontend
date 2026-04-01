import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

export interface DeviceState {
	selectedCameraId: string;
	selectedMicrophoneId: string;
	videoQuality: "low" | "medium" | "high";
	isNoiseSuppressionEnabled: boolean;
}

const initialState: DeviceState = {
	selectedCameraId: "default",
	selectedMicrophoneId: "default",
	videoQuality: "high",
	isNoiseSuppressionEnabled: false
}

export const deviceSlice = createSlice({
	name: "device",
	initialState: initialState,
	reducers: {
		setCamera: (previousState, action: PayloadAction<string>) => {
			previousState.selectedCameraId = action.payload;
		},
		setMicrophone: (previousState, action: PayloadAction<string>) => {
			previousState.selectedMicrophoneId = action.payload;
		},
		setVideoQuality: (previousState, action: PayloadAction<"low" | "medium" | "high">) => {
			previousState.videoQuality = action.payload;
		},
		setNoiseSuppression: (state, action: PayloadAction<boolean>) => {
			state.isNoiseSuppressionEnabled = action.payload;
		}
	}
})

export default deviceSlice.reducer;
export const deviceActions = deviceSlice.actions;
