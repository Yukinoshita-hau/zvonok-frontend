import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type {
	CallQualityRecommendation,
	CallQualitySetting,
	NetworkQualityMetrics,
} from "../../utils/callQuality";

export interface ConnectionTestResult {
	status: "idle" | "running" | "succeeded" | "failed";
	summary: string | null;
	metrics: NetworkQualityMetrics | null;
	recommendation: CallQualityRecommendation | null;
	error: string | null;
	updatedAt: string | null;
}

export interface DeviceState {
	selectedCameraId: string;
	selectedMicrophoneId: string;
	cameraQuality: CallQualitySetting;
	screenShareQuality: CallQualitySetting;
	isNoiseSuppressionEnabled: boolean;
	connectionTestResult: ConnectionTestResult;
}

const initialState: DeviceState = {
	selectedCameraId: "default",
	selectedMicrophoneId: "default",
	cameraQuality: "high",
	screenShareQuality: "medium",
	isNoiseSuppressionEnabled: true,
	connectionTestResult: {
		status: "idle",
		summary: null,
		metrics: null,
		recommendation: null,
		error: null,
		updatedAt: null,
	},
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
		setCameraQuality: (previousState, action: PayloadAction<CallQualitySetting>) => {
			previousState.cameraQuality = action.payload;
		},
		setScreenShareQuality: (previousState, action: PayloadAction<CallQualitySetting>) => {
			previousState.screenShareQuality = action.payload;
		},
		setNoiseSuppression: (state, action: PayloadAction<boolean>) => {
			state.isNoiseSuppressionEnabled = action.payload;
		},
		setConnectionTestRunning: (state) => {
			state.connectionTestResult.status = "running";
			state.connectionTestResult.error = null;
			state.connectionTestResult.summary = "Testing LiveKit connection...";
			state.connectionTestResult.metrics = null;
			state.connectionTestResult.recommendation = null;
			state.connectionTestResult.updatedAt = null;
		},
		setConnectionTestResult: (
			state,
			action: PayloadAction<Omit<ConnectionTestResult, "status" | "error">>
		) => {
			state.connectionTestResult = {
				...action.payload,
				status: "succeeded",
				error: null,
			};
		},
		setConnectionTestError: (
			state,
			action: PayloadAction<{ message: string; updatedAt: string }>
		) => {
			state.connectionTestResult.status = "failed";
			state.connectionTestResult.error = action.payload.message;
			state.connectionTestResult.summary = "Connection test failed.";
			state.connectionTestResult.updatedAt = action.payload.updatedAt;
		},
		applyConnectionTestRecommendation: (state) => {
			const recommendation = state.connectionTestResult.recommendation;
			if (!recommendation) return;

			state.cameraQuality = recommendation.cameraQuality;
			state.screenShareQuality = recommendation.screenShareQuality;
		},
		useAutoQuality: (state) => {
			state.cameraQuality = "auto";
			state.screenShareQuality = "auto";
		}
	}
})

export default deviceSlice.reducer;
export const deviceActions = deviceSlice.actions;
