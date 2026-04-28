import { useRoomContext } from "@livekit/components-react";
import { useEffect, useMemo, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
	ConnectionQuality,
	LocalVideoTrack,
	RoomEvent,
	Track,
	VideoQuality,
	type Participant,
} from "livekit-client";
import type { AppDispatch, RootState } from "../../store/store";
import {
	getCameraCaptureOptions,
	getQualityPreset,
	resolveQualitySetting,
	type CallMediaKind,
	type ManualCallQuality,
	type ScreenShareManualQuality,
} from "../../utils/callQuality";
import { deviceActions } from "../../store/slices/device.slice";

type AutoPressure = 0 | 1 | 2;

interface AutoState {
	quality: ManualCallQuality;
	pressure: AutoPressure;
	lastChangeAt: number;
}

interface SenderSignal {
	isPoor: boolean;
	isGood: boolean;
}

const QUALITY_ORDER: ManualCallQuality[] = ["low", "medium", "high"];
const DOWNGRADE_COOLDOWN_MS = 10_000;
const UPGRADE_COOLDOWN_MS = 30_000;
const SCREEN_DOWNGRADE_COOLDOWN_MS = 15_000;
const SCREEN_UPGRADE_COOLDOWN_MS = 45_000;
const STATS_INTERVAL_MS = 5_000;
const APPLY_DEBOUNCE_MS = 450;

export function CallQualityController() {
	const room = useRoomContext();
	const dispatch = useDispatch<AppDispatch>();
	const device = useSelector((s: RootState) => s.device);
	const recommendation = device.connectionTestResult.recommendation;

	const initialCameraQuality = useMemo(
		() => resolveQualitySetting("camera", device.cameraQuality, recommendation),
		[device.cameraQuality, recommendation]
	);
	const initialScreenQuality = useMemo(
		() => normalizeToManualQuality(recommendation?.screenShareQuality),
		[recommendation?.screenShareQuality]
	);

	const connectionQualityRef = useRef<ConnectionQuality>(ConnectionQuality.Unknown);
	const cameraAutoRef = useRef<AutoState>({
		quality: initialCameraQuality,
		pressure: 0,
		lastChangeAt: 0,
	});
	const screenAutoRef = useRef<AutoState>({
		quality: initialScreenQuality,
		pressure: 0,
		lastChangeAt: 0,
	});
	const applyTimersRef = useRef<Record<CallMediaKind, number | null>>({
		camera: null,
		screenShare: null,
	});

	useEffect(() => {
		const onConnectionQualityChanged = (
			quality: ConnectionQuality,
			participant: Participant
		) => {
			if (participant.isLocal) {
				connectionQualityRef.current = quality;
			}
		};

		room.on(RoomEvent.ConnectionQualityChanged, onConnectionQualityChanged);

		return () => {
			room.off(RoomEvent.ConnectionQualityChanged, onConnectionQualityChanged);
		};
	}, [room]);

	useEffect(() => {
		if (device.cameraQuality === "auto") {
			cameraAutoRef.current = {
				quality: initialCameraQuality,
				pressure: 0,
				lastChangeAt: Date.now(),
			};
			queueApply("camera", initialCameraQuality, true);
			return;
		}

		queueApply("camera", device.cameraQuality, true);
	}, [device.cameraQuality, initialCameraQuality, device.selectedCameraId]);

	useEffect(() => {
		if (device.screenShareQuality === "auto") {
			screenAutoRef.current = {
				quality: initialScreenQuality,
				pressure: 0,
				lastChangeAt: Date.now(),
			};
			queueApply("screenShare", initialScreenQuality, false);
			return;
		}

		queueApply("screenShare", device.screenShareQuality, false);
	}, [device.screenShareQuality, initialScreenQuality]);

	useEffect(() => {
		const interval = window.setInterval(() => {
			void evaluateAutoQuality().catch((error) => {
				console.error("Auto quality evaluation failed", error);
			});
		}, STATS_INTERVAL_MS);

		return () => {
			window.clearInterval(interval);
			Object.values(applyTimersRef.current).forEach((timer) => {
				if (timer !== null) window.clearTimeout(timer);
			});
		};
	}, [device.cameraQuality, device.screenShareQuality, device.selectedCameraId]);

	const queueApply = (
		kind: CallMediaKind,
		quality: ManualCallQuality | ScreenShareManualQuality,
		includeResolutionRestart: boolean
	) => {
		const previousTimer = applyTimersRef.current[kind];
		if (previousTimer !== null) {
			window.clearTimeout(previousTimer);
		}

		applyTimersRef.current[kind] = window.setTimeout(() => {
			applyTimersRef.current[kind] = null;
			void applyQuality(kind, quality, {
				includeResolutionRestart,
				includeFrameRate: true,
			}).catch((error) => {
				console.error("Failed to apply call quality", error);
			});
		}, APPLY_DEBOUNCE_MS);
	};

	const evaluateAutoQuality = async () => {
		if (device.cameraQuality === "auto") {
			await evaluateKindAutoQuality("camera", cameraAutoRef.current);
		}

		if (device.screenShareQuality === "auto") {
			await evaluateKindAutoQuality("screenShare", screenAutoRef.current);
		}
	};

	const evaluateKindAutoQuality = async (kind: CallMediaKind, state: AutoState) => {
		const track = getLocalVideoTrack(kind);
		if (!track) return;

		const signal = await getSenderSignal(track);
		const now = Date.now();
		const downgradeCooldown =
			kind === "screenShare" ? SCREEN_DOWNGRADE_COOLDOWN_MS : DOWNGRADE_COOLDOWN_MS;
		const upgradeCooldown =
			kind === "screenShare" ? SCREEN_UPGRADE_COOLDOWN_MS : UPGRADE_COOLDOWN_MS;

		if (signal.isPoor && now - state.lastChangeAt >= downgradeCooldown) {
			state.lastChangeAt = now;

			if (state.pressure === 0) {
				state.pressure = 1;
				await applyQuality(kind, getLowerQuality(state.quality), {
					includeResolutionRestart: false,
					includeFrameRate: false,
				});
				return;
			}

			if (state.pressure === 1) {
				state.pressure = 2;
				await applyQuality(kind, getLowerQuality(state.quality), {
					includeResolutionRestart: false,
					includeFrameRate: true,
				});
				return;
			}

			const nextQuality = getLowerQuality(state.quality);
			if (nextQuality !== state.quality) {
				state.quality = nextQuality;
				state.pressure = 0;
				await applyQuality(kind, nextQuality, {
					includeResolutionRestart: kind === "camera",
					includeFrameRate: true,
				});
			}

			return;
		}

		if (signal.isGood && now - state.lastChangeAt >= upgradeCooldown) {
			state.lastChangeAt = now;

			if (state.pressure > 0) {
				state.pressure = (state.pressure - 1) as AutoPressure;
				await applyQuality(kind, state.quality, {
					includeResolutionRestart: false,
					includeFrameRate: true,
				});
				return;
			}

			const nextQuality = getHigherQuality(state.quality);
			if (nextQuality !== state.quality) {
				state.quality = nextQuality;
				await applyQuality(kind, nextQuality, {
					includeResolutionRestart: kind === "camera",
					includeFrameRate: true,
				});
			}
		}
	};

	const getLocalVideoTrack = (kind: CallMediaKind) => {
		const source =
			kind === "camera" ? Track.Source.Camera : Track.Source.ScreenShare;
		const publication = room.localParticipant.getTrackPublication(source);
		const track = publication?.track;

		return track instanceof LocalVideoTrack ? track : null;
	};

	const applyQuality = async (
		kind: CallMediaKind,
		quality: ManualCallQuality | ScreenShareManualQuality,
		options: {
			includeResolutionRestart: boolean;
			includeFrameRate: boolean;
		}
	) => {
		const track = getLocalVideoTrack(kind);
		if (!track) return;

		const preset =
			kind === "camera"
				? getQualityPreset("camera", quality as ManualCallQuality)
				: getQualityPreset("screenShare", quality as ScreenShareManualQuality);

		await setSenderEncoding(track, preset.maxBitrate, options.includeFrameRate ? preset.frameRate : null);

		if (kind === "screenShare") {
			track.setPublishingQuality(toVideoQuality(quality));
			const settings = track.getSourceTrackSettings();
			const actualFps =
				typeof settings.frameRate === "number"
					? Math.round(settings.frameRate)
					: null;
			const fallbackPreset = resolveScreenShareFallbackPreset(
				quality as ScreenShareManualQuality,
				preset.frameRate,
				actualFps
			);
			const fallbackReason = resolveScreenShareFallbackReason(
				quality as ScreenShareManualQuality,
				preset.frameRate,
				actualFps,
				fallbackPreset
			);
			const appliedPreset = fallbackPreset
				? getQualityPreset("screenShare", fallbackPreset)
				: preset;
			const actualWidth = typeof settings.width === "number" ? Math.round(settings.width) : null;
			const actualHeight = typeof settings.height === "number" ? Math.round(settings.height) : null;
			if (fallbackPreset) {
				await setSenderEncoding(track, appliedPreset.maxBitrate, appliedPreset.frameRate);
				track.setPublishingQuality(toVideoQuality(fallbackPreset));
			}
			dispatch(
				deviceActions.setScreenShareRuntimeInfo({
					requestedFps: preset.frameRate,
					actualFps,
					requestedResolution: `${preset.width}x${preset.height}`,
					actualResolution:
						actualWidth !== null && actualHeight !== null
							? `${actualWidth}x${actualHeight}`
							: null,
					activePreset: appliedPreset.value,
					fallbackReason,
				})
			);
			return;
		}

		if (!options.includeResolutionRestart) return;

		const settings = track.getSourceTrackSettings();
		if (settings.width === preset.width && settings.height === preset.height) {
			return;
		}

		await track.restartTrack(getCameraCaptureOptions(device.selectedCameraId, preset));
		await setSenderEncoding(track, preset.maxBitrate, options.includeFrameRate ? preset.frameRate : null);
	};

	const getSenderSignal = async (track: LocalVideoTrack): Promise<SenderSignal> => {
		const senderStats = await track.getSenderStats();
		const primaryStats = senderStats[0];
		const quality = connectionQualityRef.current;
		const packetLossPercent =
			primaryStats?.packetsLost !== undefined && primaryStats.packetsSent
				? (primaryStats.packetsLost / primaryStats.packetsSent) * 100
				: 0;
		const rttMs = primaryStats?.roundTripTime
			? primaryStats.roundTripTime * 1000
			: 0;

		const isBandwidthLimited =
			primaryStats?.qualityLimitationReason === "bandwidth";
		const isPoor =
			quality === ConnectionQuality.Poor ||
			quality === ConnectionQuality.Lost ||
			isBandwidthLimited ||
			packetLossPercent >= 5 ||
			rttMs >= 450;
		const isGood =
			(quality === ConnectionQuality.Excellent ||
				quality === ConnectionQuality.Good ||
				quality === ConnectionQuality.Unknown) &&
			!isBandwidthLimited &&
			packetLossPercent < 2 &&
			rttMs < 220;

		return { isPoor, isGood };
	};

	return null;
}

function resolveScreenShareFallbackReason(
	quality: ScreenShareManualQuality,
	requestedFps: number,
	actualFps: number | null,
	fallbackPreset: ScreenShareManualQuality | null
) {
	if (actualFps === null) return null;
	if (!fallbackPreset && actualFps >= requestedFps * 0.6) return null;
	if (fallbackPreset) {
		const fallback = getQualityPreset("screenShare", fallbackPreset);
		return `Browser/source fallback detected. Requested ${requestedFps} FPS, got ${actualFps} FPS. Switched to ${fallback.label}.`;
	}
	return `Browser/source fallback detected. Requested ${requestedFps} FPS, got ${actualFps} FPS.`;
}

function resolveScreenShareFallbackPreset(
	quality: ScreenShareManualQuality,
	requestedFps: number,
	actualFps: number | null
): ScreenShareManualQuality | null {
	if (actualFps === null) {
		return null;
	}

	const chain = SCREEN_FPS_FALLBACK_CHAIN[quality];
	if (!chain || actualFps >= requestedFps * 0.6) return null;
	return chain.find((candidate) => getQualityPreset("screenShare", candidate).frameRate <= actualFps) ?? chain[chain.length - 1];
}

async function setSenderEncoding(
	track: LocalVideoTrack,
	maxBitrate: number,
	maxFramerate: number | null
) {
	const sender = track.sender;
	if (!sender) return;

	const params = sender.getParameters();
	if (!params.encodings?.length) return;

	const encodingCount = params.encodings.length;
	params.encodings = params.encodings.map((encoding, index) => {
		const layerDistanceFromTop = encodingCount - index - 1;
		const layerBitrate = Math.max(
			80_000,
			Math.floor(maxBitrate / Math.pow(2, layerDistanceFromTop))
		);

		return {
			...encoding,
			maxBitrate: layerBitrate,
			...(maxFramerate !== null ? { maxFramerate } : {}),
		};
	});

	await sender.setParameters(params);
}

function getLowerQuality(quality: ManualCallQuality): ManualCallQuality {
	const currentIndex = QUALITY_ORDER.indexOf(quality);
	return QUALITY_ORDER[Math.max(0, currentIndex - 1)];
}

function getHigherQuality(quality: ManualCallQuality): ManualCallQuality {
	const currentIndex = QUALITY_ORDER.indexOf(quality);
	return QUALITY_ORDER[Math.min(QUALITY_ORDER.length - 1, currentIndex + 1)];
}

function toVideoQuality(quality: ManualCallQuality | ScreenShareManualQuality): VideoQuality {
	if (quality === "medium") return VideoQuality.MEDIUM;
	if (quality === "medium") return VideoQuality.MEDIUM;
	if (quality === "low") return VideoQuality.LOW;
	return VideoQuality.HIGH;
}

function normalizeToManualQuality(
	quality: ScreenShareManualQuality | undefined
): ManualCallQuality {
	if (quality && !["low", "medium", "high"].includes(quality)) {
		return "high";
	}
	return quality ?? "medium";
}

const SCREEN_FPS_FALLBACK_CHAIN: Partial<Record<ScreenShareManualQuality, ScreenShareManualQuality[]>> = {
	g8k60: ["g8k30", "c4k60", "c4k30", "c1440p30", "high"],
	g8k30: ["c4k60", "c4k30", "c1440p30", "high"],
	c4k120: ["c4k60", "c4k30", "c1440p30", "high"],
	c4k60: ["c4k30", "c1440p30", "high"],
	c4k30: ["c1440p30", "high"],
	g1080p300: ["g1080p220", "g1080p200", "g1080p180", "g1080p144", "game120", "game60", "high"],
	g1080p220: ["g1080p200", "g1080p180", "g1080p144", "game120", "game60", "high"],
	g1080p200: ["g1080p180", "g1080p144", "game120", "game60", "high"],
	g1080p180: ["g1080p144", "game120", "game60", "high"],
	g1080p144: ["game120", "game60", "high"],
	game120: ["game60", "high"],
	game60: ["high"],
};
