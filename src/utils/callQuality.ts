import type {
	ScreenShareCaptureOptions,
	TrackPublishOptions,
	VideoCaptureOptions,
	VideoEncoding,
} from "livekit-client";

export type ManualCallQuality = "low" | "medium" | "high";
export type CallQualitySetting = "auto" | ManualCallQuality;
export type ScreenSharePresetGroup = "base" | "gaming" | "crystal" | "godlike";

export type ScreenShareManualQuality =
	| ManualCallQuality
	| "game60"
	| "game120"
	| "g1080p144"
	| "g1080p180"
	| "g1080p200"
	| "g1080p220"
	| "g1080p300"
	| "c1440p30"
	| "c4k30"
	| "c4k60"
	| "c4k120"
	| "g8k30"
	| "g8k60";

export type ScreenShareQualitySetting = "auto" | ScreenShareManualQuality;
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

export interface ScreenShareQualityPreset extends Omit<CallQualityPreset, "value"> {
	value: ScreenShareManualQuality;
	group: ScreenSharePresetGroup;
	warning?: string;
	bandwidthHint?: string;
	isExperimental?: boolean;
	bandwidthMbps?: number;
	contentHint: "motion" | "detail";
}

export interface CallQualityRecommendation {
	cameraQuality: ManualCallQuality;
	screenShareQuality: ScreenShareManualQuality;
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

const EXPERIMENTAL_WARNING = "Experimental / best-effort. Browser, source and GPU may fallback.";

export const SCREEN_SHARE_QUALITY_PRESETS: Record<ScreenShareManualQuality, ScreenShareQualityPreset> = {
	low: {
		value: "low",
		group: "base",
		label: "Low",
		width: 1280,
		height: 720,
		frameRate: 5,
		maxBitrate: 800_000,
		description: "720p, text first on weak upload",
		contentHint: "detail",
		bandwidthMbps: 1,
	},
	medium: {
		value: "medium",
		group: "base",
		label: "Medium",
		width: 1920,
		height: 1080,
		frameRate: 15,
		maxBitrate: 2_500_000,
		description: "1080p, readable UI sharing",
		contentHint: "detail",
		bandwidthMbps: 3,
	},
	high: {
		value: "high",
		group: "base",
		label: "High",
		width: 1920,
		height: 1080,
		frameRate: 30,
		maxBitrate: 5_000_000,
		description: "1080p, smoother screen motion",
		contentHint: "detail",
		bandwidthMbps: 5,
	},
	game60: {
		value: "game60",
		group: "gaming",
		label: "Gaming 1080p60",
		width: 1920,
		height: 1080,
		frameRate: 60,
		maxBitrate: 8_000_000,
		description: "Low-latency motion-focused stream",
		contentHint: "motion",
		bandwidthHint: "Needs stable upload around 8+ Mbps",
		bandwidthMbps: 8,
	},
	game120: {
		value: "game120",
		group: "gaming",
		label: "Gaming 1080p120",
		width: 1920,
		height: 1080,
		frameRate: 120,
		maxBitrate: 12_000_000,
		description: "Fast motion, very high upload required",
		contentHint: "motion",
		warning: EXPERIMENTAL_WARNING,
		bandwidthHint: "Needs very stable upload around 12+ Mbps",
		isExperimental: true,
		bandwidthMbps: 12,
	},
	g1080p144: {
		value: "g1080p144",
		group: "gaming",
		label: "1080p144 Gaming",
		width: 1920,
		height: 1080,
		frameRate: 144,
		maxBitrate: 25_000_000,
		description: "Fast motion, high bandwidth",
		contentHint: "motion",
		warning: EXPERIMENTAL_WARNING,
		bandwidthHint: "Requires very strong upload",
		isExperimental: true,
		bandwidthMbps: 25,
	},
	g1080p180: {
		value: "g1080p180",
		group: "gaming",
		label: "1080p180 Gaming",
		width: 1920,
		height: 1080,
		frameRate: 180,
		maxBitrate: 35_000_000,
		description: "Extreme high FPS, best-effort only",
		contentHint: "motion",
		warning: EXPERIMENTAL_WARNING,
		bandwidthHint: "Requires very strong upload",
		isExperimental: true,
		bandwidthMbps: 35,
	},
	g1080p200: {
		value: "g1080p200",
		group: "gaming",
		label: "1080p200 Gaming",
		width: 1920,
		height: 1080,
		frameRate: 200,
		maxBitrate: 40_000_000,
		description: "Extreme FPS showcase",
		contentHint: "motion",
		warning: EXPERIMENTAL_WARNING,
		bandwidthHint: "Requires very strong upload",
		isExperimental: true,
		bandwidthMbps: 40,
	},
	g1080p220: {
		value: "g1080p220",
		group: "gaming",
		label: "1080p220 Gaming",
		width: 1920,
		height: 1080,
		frameRate: 220,
		maxBitrate: 45_000_000,
		description: "Extreme FPS showcase",
		contentHint: "motion",
		warning: EXPERIMENTAL_WARNING,
		bandwidthHint: "Requires very strong upload",
		isExperimental: true,
		bandwidthMbps: 45,
	},
	g1080p300: {
		value: "g1080p300",
		group: "gaming",
		label: "1080p300 Gaming",
		width: 1920,
		height: 1080,
		frameRate: 300,
		maxBitrate: 70_000_000,
		description: "Extreme experimental, may fallback",
		contentHint: "motion",
		warning: EXPERIMENTAL_WARNING,
		bandwidthHint: "Requires extreme upload and hardware",
		isExperimental: true,
		bandwidthMbps: 70,
	},
	c1440p30: {
		value: "c1440p30",
		group: "crystal",
		label: "1440p30 Crystal",
		width: 2560,
		height: 1440,
		frameRate: 30,
		maxBitrate: 12_000_000,
		description: "Sharper text and detail",
		contentHint: "detail",
		warning: EXPERIMENTAL_WARNING,
		isExperimental: true,
		bandwidthMbps: 12,
	},
	c4k30: {
		value: "c4k30",
		group: "crystal",
		label: "4K30 Crystal",
		width: 3840,
		height: 2160,
		frameRate: 30,
		maxBitrate: 25_000_000,
		description: "Very high quality detail",
		contentHint: "detail",
		warning: EXPERIMENTAL_WARNING,
		isExperimental: true,
		bandwidthMbps: 25,
	},
	c4k60: {
		value: "c4k60",
		group: "crystal",
		label: "4K60 Crystal",
		width: 3840,
		height: 2160,
		frameRate: 60,
		maxBitrate: 45_000_000,
		description: "Very high quality, strong upload",
		contentHint: "detail",
		warning: EXPERIMENTAL_WARNING,
		isExperimental: true,
		bandwidthMbps: 45,
	},
	c4k120: {
		value: "c4k120",
		group: "crystal",
		label: "4K120 Crystal",
		width: 3840,
		height: 2160,
		frameRate: 120,
		maxBitrate: 80_000_000,
		description: "Very high quality, requires very strong upload",
		contentHint: "detail",
		warning: EXPERIMENTAL_WARNING,
		isExperimental: true,
		bandwidthMbps: 80,
	},
	g8k30: {
		value: "g8k30",
		group: "godlike",
		label: "8K30 Godlike",
		width: 7680,
		height: 4320,
		frameRate: 30,
		maxBitrate: 80_000_000,
		description: "Absurd/experimental, for testing only",
		contentHint: "detail",
		warning: EXPERIMENTAL_WARNING,
		isExperimental: true,
		bandwidthMbps: 80,
	},
	g8k60: {
		value: "g8k60",
		group: "godlike",
		label: "8K60 Godlike",
		width: 7680,
		height: 4320,
		frameRate: 60,
		maxBitrate: 140_000_000,
		description: "Absurd/experimental, for testing only",
		contentHint: "detail",
		warning: EXPERIMENTAL_WARNING,
		isExperimental: true,
		bandwidthMbps: 140,
	},
};

export const SCREEN_SHARE_PRESET_GROUPS: Record<ScreenSharePresetGroup, { label: string; description: string }> = {
	base: { label: "Base", description: "Stable default presets." },
	gaming: { label: "Gaming", description: "Motion-priority presets." },
	crystal: { label: "Crystal", description: "Detail and readability presets." },
	godlike: { label: "Godlike", description: "Showcase only; extreme requirements." },
};

export const DEFAULT_AUTO_QUALITY: ManualCallQuality = "medium";

export function getQualityPreset(
	kind: "camera",
	quality: ManualCallQuality
): CallQualityPreset;
export function getQualityPreset(
	kind: "screenShare",
	quality: ScreenShareManualQuality
): ScreenShareQualityPreset;
export function getQualityPreset(
	kind: CallMediaKind,
	quality: ManualCallQuality | ScreenShareManualQuality
) {
	return kind === "camera"
		? CAMERA_QUALITY_PRESETS[quality as ManualCallQuality]
		: SCREEN_SHARE_QUALITY_PRESETS[quality as ScreenShareManualQuality];
}

export function resolveQualitySetting(
	kind: "camera",
	setting: CallQualitySetting,
	recommendation?: CallQualityRecommendation | null
): ManualCallQuality {
	if (setting !== "auto") return setting;

	return recommendation?.cameraQuality ?? DEFAULT_AUTO_QUALITY;
}

export function resolveScreenShareQualitySetting(
	setting: ScreenShareQualitySetting,
	recommendation?: CallQualityRecommendation | null
): ScreenShareManualQuality {
	if (setting !== "auto") return setting;

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
	preset: ScreenShareQualityPreset
): ScreenShareCaptureOptions {
	return {
		audio: true,
		resolution: {
			width: preset.width,
			height: preset.height,
			frameRate: preset.frameRate,
		},
		systemAudio: "include",
		contentHint: preset.contentHint,
	};
}

export function getCameraPublishOptions(preset: CallQualityPreset): TrackPublishOptions {
	return {
		degradationPreference: "maintain-framerate",
		videoEncoding: getVideoEncoding(preset, "high"),
	};
}

export function getScreenSharePublishOptions(
	preset: ScreenShareQualityPreset
): TrackPublishOptions {
	return {
		degradationPreference:
			preset.frameRate >= 60 ? "maintain-framerate" : "maintain-resolution",
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
