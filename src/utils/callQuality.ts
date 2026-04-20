import type {
	ScreenShareCaptureOptions,
	TrackPublishOptions,
	VideoCaptureOptions,
	VideoEncoding,
} from "livekit-client";

export type ManualCallQuality = "low" | "medium" | "high";
export type CallQualitySetting = "auto" | ManualCallQuality;
export type CallMediaKind = "camera" | "screenShare";

export interface CallQualityPreset {
	value: ManualCallQuality;
	label: string;
	width: number;
	height: number;
	frameRate: number;
	maxBitrate: number;
	description: string;
}

export interface CallQualityRecommendation {
	cameraQuality: ManualCallQuality;
	screenShareQuality: ManualCallQuality;
}

export interface NetworkQualityMetrics {
	upstreamKbps: number | null;
	rttMs: number | null;
	jitterMs: number | null;
	packetLossPercent: number | null;
	downlinkMbps: number | null;
	effectiveType: string | null;
}

export const CAMERA_QUALITY_PRESETS: Record<ManualCallQuality, CallQualityPreset> = {
	low: {
		value: "low",
		label: "Low",
		width: 640,
		height: 360,
		frameRate: 15,
		maxBitrate: 500_000,
		description: "360p, stable on weak upload",
	},
	medium: {
		value: "medium",
		label: "Medium",
		width: 1280,
		height: 720,
		frameRate: 24,
		maxBitrate: 1_500_000,
		description: "720p, balanced camera quality",
	},
	high: {
		value: "high",
		label: "High",
		width: 1920,
		height: 1080,
		frameRate: 30,
		maxBitrate: 3_000_000,
		description: "1080p, best camera quality",
	},
};

export const SCREEN_SHARE_QUALITY_PRESETS: Record<ManualCallQuality, CallQualityPreset> = {
	low: {
		value: "low",
		label: "Low",
		width: 1280,
		height: 720,
		frameRate: 5,
		maxBitrate: 800_000,
		description: "720p, text first on weak upload",
	},
	medium: {
		value: "medium",
		label: "Medium",
		width: 1920,
		height: 1080,
		frameRate: 15,
		maxBitrate: 2_500_000,
		description: "1080p, readable UI sharing",
	},
	high: {
		value: "high",
		label: "High",
		width: 1920,
		height: 1080,
		frameRate: 30,
		maxBitrate: 5_000_000,
		description: "1080p, smoother screen motion",
	}
};

export const DEFAULT_AUTO_QUALITY: ManualCallQuality = "medium";

export function getQualityPreset(kind: CallMediaKind, quality: ManualCallQuality) {
	return kind === "camera"
		? CAMERA_QUALITY_PRESETS[quality]
		: SCREEN_SHARE_QUALITY_PRESETS[quality];
}

export function resolveQualitySetting(
	kind: CallMediaKind,
	setting: CallQualitySetting,
	recommendation?: CallQualityRecommendation | null
): ManualCallQuality {
	if (setting !== "auto") return setting;

	if (kind === "camera") {
		return recommendation?.cameraQuality ?? DEFAULT_AUTO_QUALITY;
	}

	return recommendation?.screenShareQuality ?? DEFAULT_AUTO_QUALITY;
}

export function getCameraCaptureOptions(
	cameraId: string,
	preset: CallQualityPreset
): VideoCaptureOptions {
	return {
		deviceId: cameraId !== "default" ? cameraId : undefined,
		facingMode: "user",
		resolution: {
			width: preset.width,
			height: preset.height,
			frameRate: preset.frameRate,
		},
	};
}

export function getScreenShareCaptureOptions(
	preset: CallQualityPreset
): ScreenShareCaptureOptions {
	return {
		audio: true,
		resolution: {
			width: preset.width,
			height: preset.height,
			frameRate: preset.frameRate,
		},
		systemAudio: "include",
		contentHint: "detail",
	};
}

export function getCameraPublishOptions(preset: CallQualityPreset): TrackPublishOptions {
	return {
		degradationPreference: "maintain-framerate",
		videoEncoding: getVideoEncoding(preset, "high"),
	};
}

export function getScreenSharePublishOptions(preset: CallQualityPreset): TrackPublishOptions {
	return {
		degradationPreference: "maintain-resolution",
		screenShareEncoding: getVideoEncoding(preset, "high"),
	};
}

export function getVideoEncoding(
	preset: CallQualityPreset,
	priority: RTCPriorityType = "high"
): VideoEncoding {
	return {
		maxBitrate: preset.maxBitrate,
		maxFramerate: preset.frameRate,
		priority,
	};
}

export function recommendQualityFromMetrics(
	metrics: NetworkQualityMetrics
): CallQualityRecommendation {
	const upstreamKbps = metrics.upstreamKbps ?? 0;
	const rttMs = metrics.rttMs ?? 0;
	const packetLoss = metrics.packetLossPercent ?? 0;

	if (
		upstreamKbps >= 4_500 &&
		(rttMs === 0 || rttMs < 120) &&
		packetLoss < 1
	) {
		return {
			cameraQuality: "high",
			screenShareQuality: "high",
		};
	}

	if (
		upstreamKbps >= 1_800 &&
		(rttMs === 0 || rttMs < 220) &&
		packetLoss < 3
	) {
		return {
			cameraQuality: "medium",
			screenShareQuality: "medium",
		};
	}

	return {
		cameraQuality: "low",
		screenShareQuality: upstreamKbps >= 1_000 && packetLoss < 5 ? "medium" : "low",
	};
}

export function formatBitrate(kbps: number | null) {
	if (kbps === null) return "Unavailable";
	if (kbps >= 1000) return `${(kbps / 1000).toFixed(2)} Mbps`;
	return `${Math.round(kbps)} Kbps`;
}

export function formatMilliseconds(value: number | null) {
	if (value === null) return "Unavailable";
	return `${Math.round(value)} ms`;
}

export function formatPercent(value: number | null) {
	if (value === null) return "Unavailable";
	return `${value.toFixed(2)}%`;
}
