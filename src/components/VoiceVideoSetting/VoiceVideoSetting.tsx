import { useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { LocalVideoTrack, Room, Track } from "livekit-client";
import styles from "./VoiceVideoSetting.module.css";
import { deviceActions } from "../../store/slices/device.slice";
import type { AppDispatch, RootState } from "../../store/store";
import { livekitApi } from "../../api/livekitApi";
import {
	formatBitrate,
	formatMilliseconds,
	formatPercent,
	getCameraCaptureOptions,
	getQualityPreset,
	recommendQualityFromMetrics,
	resolveQualitySetting,
	type NetworkQualityMetrics,
	type CallQualitySetting,
	type ScreenShareQualitySetting,
} from "../../utils/callQuality";

interface PublishStats {
	packetsLost: number;
	packetsSent: number;
	rttTotal: number;
	jitterTotal: number;
	bitrateTotal: number;
	count: number;
}

interface BrowserNetworkInfo {
	downlink?: number;
	effectiveType?: string;
	rtt?: number;
}

export function VoiceVideoSetting() {
	const dispatch = useDispatch<AppDispatch>();
	const {
		selectedCameraId,
		selectedMicrophoneId,
		cameraQuality,
		screenShareQuality,
		isNoiseSuppressionEnabled,
		isEchoCancellationEnabled,
		isAutoGainControlEnabled,
		voiceActivityThreshold,
		isAutoInputSensitivity,
		screenShareRuntime,
		connectionTestResult,
	} = useSelector((s: RootState) => s.device);
	const myUser = useSelector((s: RootState) => s.user.myUser);
	const recommendation = connectionTestResult.recommendation;
	const metrics = connectionTestResult.metrics;

	const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
	const [microphones, setMicrophones] = useState<MediaDeviceInfo[]>([]);
	const [mediaDevicesReady, setMediaDevicesReady] = useState(false);
	const [volumeLevel, setVolumeLevel] = useState(0);
	const [isListening, setIsListening] = useState(false);
	const [cameraPreviewStatus, setCameraPreviewStatus] = useState<
		"idle" | "loading" | "ready" | "no_device" | "denied" | "not_found" | "error"
	>("idle");
	const [cameraPreviewError, setCameraPreviewError] = useState<string | null>(null);

	const streamRef = useRef<MediaStream | null>(null);
	const audioContextRef = useRef<AudioContext | null>(null);
	const audioPreviewRef = useRef<HTMLAudioElement | null>(null);
	const animationRef = useRef<number | null>(null);
	const cameraPreviewStreamRef = useRef<MediaStream | null>(null);
	const cameraPreviewVideoRef = useRef<HTMLVideoElement | null>(null);

	useEffect(() => {
		const getDevices = async () => {
			try {
				await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
				const devices = await navigator.mediaDevices.enumerateDevices();
				setCameras(devices.filter((device) => device.kind === "videoinput"));
				setMicrophones(devices.filter((device) => device.kind === "audioinput"));
			} catch (error) {
				console.log("No access to media devices", error);
			} finally {
				setMediaDevicesReady(true);
			}
		};

		getDevices();
	}, []);

	const cameraPreviewPreset = getQualityPreset(
		"camera",
		resolveQualitySetting("camera", cameraQuality, recommendation)
	);

	const selectedCameraLabel =
		cameras.find((camera) => camera.deviceId === selectedCameraId)?.label ||
		(selectedCameraId === "default" ? "Default camera" : "Selected camera");

	useEffect(() => {
		const stopCameraPreviewTracks = () => {
			if (cameraPreviewStreamRef.current) {
				cameraPreviewStreamRef.current.getTracks().forEach((track) => track.stop());
				cameraPreviewStreamRef.current = null;
			}
			if (cameraPreviewVideoRef.current) {
				cameraPreviewVideoRef.current.srcObject = null;
			}
		};

		const startCameraPreview = async () => {
			stopCameraPreviewTracks();
			setCameraPreviewStatus("loading");
			setCameraPreviewError(null);
			if (mediaDevicesReady && cameras.length === 0) {
				setCameraPreviewStatus("no_device");
				setCameraPreviewError("No camera devices were detected.");
				return;
			}

			if (!navigator.mediaDevices?.getUserMedia) {
				setCameraPreviewStatus("error");
				setCameraPreviewError("Camera preview is not supported in this browser.");
				return;
			}

			try {
				const captureOptions = getCameraCaptureOptions(
					selectedCameraId,
					cameraPreviewPreset
				);
				const resolution = captureOptions.resolution;
				const videoConstraints: MediaTrackConstraints = {
					deviceId: captureOptions.deviceId,
					facingMode: captureOptions.facingMode,
					width: resolution?.width,
					height: resolution?.height,
					frameRate: resolution?.frameRate,
				};

				const stream = await navigator.mediaDevices.getUserMedia({
					video: videoConstraints,
					audio: false,
				});
				cameraPreviewStreamRef.current = stream;

				if (cameraPreviewVideoRef.current) {
					cameraPreviewVideoRef.current.srcObject = stream;
					await cameraPreviewVideoRef.current.play().catch(() => undefined);
				}

				setCameraPreviewStatus("ready");
			} catch (error) {
				const mediaError = error as DOMException;
				if (mediaError?.name === "NotAllowedError") {
					setCameraPreviewStatus("denied");
					setCameraPreviewError("Camera permission denied.");
					return;
				}
				if (mediaError?.name === "NotFoundError" || mediaError?.name === "OverconstrainedError") {
					setCameraPreviewStatus("not_found");
					setCameraPreviewError("Selected camera is unavailable.");
					return;
				}
				setCameraPreviewStatus("error");
				setCameraPreviewError("Could not start camera preview.");
			}
		};

		void startCameraPreview();

		return () => {
			stopCameraPreviewTracks();
		};
	}, [selectedCameraId, cameraPreviewPreset, cameras.length, mediaDevicesReady]);

	useEffect(() => {
		const startAudio = async () => {
			try {
				if (streamRef.current) {
					streamRef.current.getTracks().forEach((track) => track.stop());
				}

				const audioConstraints: MediaTrackConstraints = {
					deviceId:
						selectedMicrophoneId === "default"
							? undefined
							: { exact: selectedMicrophoneId },
					autoGainControl: isAutoGainControlEnabled,
					echoCancellation: isEchoCancellationEnabled,
					noiseSuppression: isNoiseSuppressionEnabled,
					channelCount: 1,
					sampleRate: 48000,
					sampleSize: 16,
				};

				const supportedConstraints = navigator.mediaDevices.getSupportedConstraints() as {
					voiceIsolation?: boolean;
				};
				if (supportedConstraints.voiceIsolation) {
					(
						audioConstraints as MediaTrackConstraints & {
							voiceIsolation?: boolean;
						}
					).voiceIsolation = isNoiseSuppressionEnabled;
				}

				const stream = await navigator.mediaDevices.getUserMedia({
					audio: audioConstraints,
				});

				streamRef.current = stream;

				if (audioPreviewRef.current) {
					audioPreviewRef.current.srcObject = isListening ? stream : null;

					if (isListening) {
						audioPreviewRef.current.muted = false;
						audioPreviewRef.current.play().catch((error) => {
							console.error("Audio preview autoplay failed", error);
						});
					}
				}

				const audioContext = new (
					window.AudioContext ||
					(window as typeof window & { webkitAudioContext: typeof AudioContext }).webkitAudioContext
				)();
				audioContextRef.current = audioContext;

				const analyser = audioContext.createAnalyser();
				analyser.fftSize = 256;
				const source = audioContext.createMediaStreamSource(stream);
				source.connect(analyser);

				const dataArray = new Uint8Array(analyser.frequencyBinCount);
				const checkVolume = () => {
					analyser.getByteFrequencyData(dataArray);
					let sum = 0;

					for (let i = 0; i < dataArray.length; i++) {
						sum += dataArray[i];
					}

					const average = sum / dataArray.length;
					setVolumeLevel(Math.min(100, (average / 128) * 100));
					animationRef.current = requestAnimationFrame(checkVolume);
				};

				checkVolume();
			} catch (error) {
				console.log("Microphone preview error:", error);
			}
		};

		startAudio();

		return () => {
			if (animationRef.current) cancelAnimationFrame(animationRef.current);
			if (audioContextRef.current) void audioContextRef.current.close();
			if (streamRef.current) {
				streamRef.current.getTracks().forEach((track) => track.stop());
			}
		};
	}, [
		selectedMicrophoneId,
		isListening,
		isNoiseSuppressionEnabled,
		isEchoCancellationEnabled,
		isAutoGainControlEnabled,
	]);

	const runConnectionTest = async () => {
		dispatch(deviceActions.setConnectionTestRunning());

		try {
			const credentials = (
				await livekitApi.getToken(`quality-test-${myUser?.id ?? "anonymous"}`)
			).data;

			const stats = await runPublishStatsTest(
				credentials.serverUrl,
				credentials.participantToken
			);
			const metrics = getNetworkMetrics(stats);
			const recommendation = recommendQualityFromMetrics(metrics);

			dispatch(
				deviceActions.setConnectionTestResult({
					summary: "Connection test completed with LiveKit WebRTC publish stats.",
					metrics,
					recommendation,
					updatedAt: new Date().toISOString(),
				})
			);
		} catch (error) {
			dispatch(
				deviceActions.setConnectionTestError({
					message: error instanceof Error ? error.message : "Connection test failed.",
					updatedAt: new Date().toISOString(),
				})
			);
		}
	};

	function getNetworkMetrics(stats: PublishStats | null): NetworkQualityMetrics {
		const browserNetwork = getBrowserNetworkInfo();
		const sampleCount = stats?.count ?? 0;

		return {
			upstreamKbps:
				stats && sampleCount > 0
					? stats.bitrateTotal / sampleCount / 1000
					: null,
			rttMs:
				stats && sampleCount > 0
					? (stats.rttTotal / sampleCount) * 1000
					: browserNetwork.rtt ?? null,
			jitterMs:
				stats && sampleCount > 0
					? (stats.jitterTotal / sampleCount) * 1000
					: null,
			packetLossPercent:
				stats && stats.packetsSent > 0
					? (stats.packetsLost / stats.packetsSent) * 100
					: null,
			downlinkMbps: browserNetwork.downlink ?? null,
			effectiveType: browserNetwork.effectiveType ?? null,
		};
	}

	function getBrowserNetworkInfo(): BrowserNetworkInfo {
		const nav = navigator as Navigator & {
			connection?: BrowserNetworkInfo;
			mozConnection?: BrowserNetworkInfo;
			webkitConnection?: BrowserNetworkInfo;
		};

		return nav.connection ?? nav.mozConnection ?? nav.webkitConnection ?? {};
	}

	return (
		<div className={styles["container"]}>
			<div className={styles["content"]}>
				<div className={styles["edit-section"]}>
					<div className={styles["form-group"]}>
						<label className={styles["label"]}>Camera</label>
						<select
							className={styles["input"]}
							value={selectedCameraId}
							onChange={(e) => dispatch(deviceActions.setCamera(e.target.value))}
						>
							<option value="default">Default</option>
							{cameras.map((camera, index) => (
								<option key={camera.deviceId} value={camera.deviceId}>
									{getDeviceLabel(camera, index, "Camera")}
								</option>
							))}
						</select>
					</div>

					<div className={styles["form-group"]}>
						<label className={styles["label"]}>Camera Preview</label>
						<div className={styles["camera-preview-card"]}>
							<div className={styles["camera-preview-media"]}>
								{cameraPreviewStatus === "ready" ? (
									<video
										ref={cameraPreviewVideoRef}
										className={styles["camera-preview-video"]}
										autoPlay
										playsInline
										muted
									/>
								) : (
									<div className={styles["camera-preview-state"]}>
										{cameraPreviewStatus === "loading" && "Loading camera preview..."}
										{cameraPreviewStatus === "denied" && "Camera permission denied."}
										{cameraPreviewStatus === "not_found" && "Selected camera is unavailable."}
										{cameraPreviewStatus === "error" && "Could not start camera preview."}
										{cameraPreviewStatus === "no_device" && "No camera devices found."}
									</div>
								)}
							</div>
							<div className={styles["camera-preview-caption"]}>{selectedCameraLabel}</div>
							<div className={styles["help-text"]}>
								Preview is local only and is not sent to the call.
							</div>
							{cameraPreviewError && (
								<div className={styles["error-text"]}>{cameraPreviewError}</div>
							)}
						</div>
					</div>

					<div className={styles["form-group"]}>
						<label className={styles["label"]}>Microphone</label>
						<select
							className={styles["input"]}
							value={selectedMicrophoneId}
							onChange={(e) => dispatch(deviceActions.setMicrophone(e.target.value))}
						>
							<option value="default">Default</option>
							{microphones.map((microphone, index) => (
								<option key={microphone.deviceId} value={microphone.deviceId}>
									{getDeviceLabel(microphone, index, "Microphone")}
								</option>
							))}
						</select>
					</div>

					<div className={styles["form-group"]}>
						<label className={styles["label"]}>Noise Suppression</label>
						<label className={styles["toggle-row"]}>
							<input
								type="checkbox"
								checked={isNoiseSuppressionEnabled}
								onChange={(e) => dispatch(deviceActions.setNoiseSuppression(e.target.checked))}
							/>
							<span>{isNoiseSuppressionEnabled ? "Enabled" : "Disabled"}</span>
						</label>
						<span className={styles["help-text"]}>
							Uses browser noise suppression and voice isolation when supported.
						</span>
					</div>

					<div className={styles["form-group"]}>
						<label className={styles["label"]}>Echo Cancellation</label>
						<label className={styles["toggle-row"]}>
							<input
								type="checkbox"
								checked={isEchoCancellationEnabled}
								onChange={(e) => dispatch(deviceActions.setEchoCancellation(e.target.checked))}
							/>
							<span>{isEchoCancellationEnabled ? "Enabled" : "Disabled"}</span>
						</label>
					</div>

					<div className={styles["form-group"]}>
						<label className={styles["label"]}>Auto Gain Control</label>
						<label className={styles["toggle-row"]}>
							<input
								type="checkbox"
								checked={isAutoGainControlEnabled}
								onChange={(e) => dispatch(deviceActions.setAutoGainControl(e.target.checked))}
							/>
							<span>{isAutoGainControlEnabled ? "Enabled" : "Disabled"}</span>
						</label>
					</div>

					<div className={styles["form-group"]}>
						<label className={styles["label"]}>Microphone Test</label>
						<div className={styles["volume-bar-bg"]}>
							<div
								className={styles["volume-bar-fill"]}
								style={{ width: `${volumeLevel}%` }}
							/>
						</div>
						<button
							className={isListening ? styles["btn-secondary"] : styles["btn-primary"]}
							onClick={() => setIsListening(!isListening)}
						>
							{isListening ? "Stop monitoring" : "Monitor myself"}
						</button>
						<div className={styles["help-text"]}>
							Voice activity:{" "}
							{volumeLevel >= (isAutoInputSensitivity ? 30 : voiceActivityThreshold)
								? "Detected"
								: "Below threshold"}
						</div>
						<audio ref={audioPreviewRef} autoPlay style={{ display: "none" }} />
					</div>

					<div className={styles["form-group"]}>
						<label className={styles["label"]}>Input sensitivity / Voice activity threshold</label>
						<label className={styles["toggle-row"]}>
							<input
								type="checkbox"
								checked={isAutoInputSensitivity}
								onChange={(e) => dispatch(deviceActions.setAutoInputSensitivity(e.target.checked))}
							/>
							<span>{isAutoInputSensitivity ? "Auto sensitivity" : "Manual threshold"}</span>
						</label>
						<input
							type="range"
							min={5}
							max={90}
							step={1}
							disabled={isAutoInputSensitivity}
							value={voiceActivityThreshold}
							onChange={(e) =>
								dispatch(deviceActions.setVoiceActivityThreshold(Number(e.target.value)))
							}
						/>
						<span className={styles["help-text"]}>
							Lower sensitivity may cut background noise but can also cut quiet speech.
						</span>
					</div>

					<div className={styles["form-group"]}>
						<label className={styles["label"]}>Camera Quality</label>
						<select
							className={styles["input"]}
							value={cameraQuality}
							onChange={(e) =>
								dispatch(deviceActions.setCameraQuality(e.target.value as CallQualitySetting))
							}
						>
							<option value="auto">Auto</option>
							<option value="high">High (1080p, 30 FPS)</option>
							<option value="medium">Medium (720p, 24 FPS)</option>
							<option value="low">Low (360p, 15 FPS)</option>
						</select>
					</div>

					<div className={styles["form-group"]}>
						<label className={styles["label"]}>Screen Share Quality</label>
						<select
							className={styles["input"]}
							value={screenShareQuality}
							onChange={(e) =>
								dispatch(deviceActions.setScreenShareQuality(e.target.value as ScreenShareQualitySetting))
							}
						>
							<option value="auto">Auto</option>
							<option value="high">High (1080p, 30 FPS)</option>
							<option value="medium">Medium (1080p, 15 FPS)</option>
							<option value="low">Low (720p, 5 FPS)</option>
							<option value="game60">Gaming 1080p60</option>
							<option value="game120">Gaming 1080p120 Experimental</option>
						</select>
						{screenShareQuality === "game120" && (
							<span className={styles["help-text"]}>
								Experimental. Requires strong upload and browser/source support. 120 FPS is best effort, not guaranteed.
							</span>
						)}
						{screenShareRuntime.updatedAt && (
							<div className={styles["summary-text"]}>
								Requested FPS: {screenShareRuntime.requestedFps ?? "N/A"}, actual: {screenShareRuntime.actualFps ?? "N/A"}, applied mode: {screenShareRuntime.activePreset ?? "N/A"}.
								{screenShareRuntime.fallbackReason ? ` ${screenShareRuntime.fallbackReason}` : ""}
							</div>
						)}
					</div>

					<div className={styles["form-group"]}>
						<label className={styles["label"]}>Connection Test</label>
						<button
							type="button"
							className={styles["btn-primary"]}
							disabled={connectionTestResult.status === "running"}
							onClick={runConnectionTest}
						>
							{connectionTestResult.status === "running" ? "Testing..." : "Run internet test"}
						</button>
						<span className={styles["help-text"]}>
							Uses LiveKit WebRTC publish stats. Download speed is shown only when
							the browser exposes a network hint.
						</span>

						{connectionTestResult.error && (
							<div className={styles["error-text"]}>
								{connectionTestResult.error}
							</div>
						)}

						{connectionTestResult.summary && !connectionTestResult.error && (
							<div className={styles["summary-text"]}>
								{connectionTestResult.summary}
							</div>
						)}

						{metrics && (
							<div className={styles["metrics-grid"]}>
								<div>Upload</div>
								<strong>{formatBitrate(metrics.upstreamKbps)}</strong>
								<div>RTT</div>
								<strong>{formatMilliseconds(metrics.rttMs)}</strong>
								<div>Jitter</div>
								<strong>{formatMilliseconds(metrics.jitterMs)}</strong>
								<div>Packet loss</div>
								<strong>{formatPercent(metrics.packetLossPercent)}</strong>
								<div>Download hint</div>
								<strong>
									{metrics.downlinkMbps !== null
										? `${metrics.downlinkMbps.toFixed(1)} Mbps`
										: "Unavailable"}
								</strong>
								<div>Network type</div>
								<strong>{metrics.effectiveType ?? "Unavailable"}</strong>
							</div>
						)}

						{recommendation && (
							<div className={styles["recommendation-box"]}>
								Recommended: camera {recommendation.cameraQuality}, screen share {recommendation.screenShareQuality}.
							</div>
						)}

						<div className={styles["test-actions"]}>
							<button
								type="button"
								className={styles["btn-primary"]}
								disabled={!recommendation}
								onClick={() => dispatch(deviceActions.applyConnectionTestRecommendation())}
							>
								Apply recommendation
							</button>
							<button
								type="button"
								className={styles["btn-primary"]}
								onClick={() => dispatch(deviceActions.useAutoQuality())}
							>
								Use Auto
							</button>
							<button
								type="button"
								className={styles["btn-secondary-neutral"]}
							>
								Keep manual
							</button>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}

function getDeviceLabel(
	device: MediaDeviceInfo,
	index: number,
	fallbackType: "Camera" | "Microphone"
) {
	const trimmed = device.label?.trim();
	if (trimmed) return trimmed;
	return `${fallbackType} ${index + 1}`;
}

async function runPublishStatsTest(
	serverUrl: string,
	participantToken: string
): Promise<PublishStats> {
	const room = new Room({
		adaptiveStream: false,
		dynacast: false,
	});
	const canvas = document.createElement("canvas");
	canvas.width = 1280;
	canvas.height = 720;
	const context = canvas.getContext("2d");

	if (!context) {
		throw new Error("Could not create a canvas for the connection test.");
	}

	let animationFrame = 0;
	const drawFrame = () => {
		const time = Date.now() / 1000;
		context.fillStyle = `hsl(${Math.floor(time * 70) % 360}, 80%, 46%)`;
		context.fillRect(0, 0, canvas.width, canvas.height);
		context.fillStyle = "#ffffff";
		context.font = "32px sans-serif";
		context.fillText("Zvonok connection test", 36, 72);
		context.fillText(new Date().toLocaleTimeString(), 36, 120);
		animationFrame = window.requestAnimationFrame(drawFrame);
	};
	drawFrame();

	const stream = canvas.captureStream(30);
	const mediaTrack = stream.getVideoTracks()[0];
	if (!mediaTrack) {
		throw new Error("Could not create a test video track.");
	}

	const stats: PublishStats = {
		packetsLost: 0,
		packetsSent: 0,
		rttTotal: 0,
		jitterTotal: 0,
		bitrateTotal: 0,
		count: 0,
	};

	let intervalId: number | null = null;

	try {
		await room.connect(serverUrl, participantToken, {
			autoSubscribe: false,
		});

		const publication = await room.localParticipant.publishTrack(mediaTrack, {
			source: Track.Source.Camera,
			simulcast: false,
			degradationPreference: "maintain-resolution",
			videoEncoding: {
				maxBitrate: 2_000_000,
				maxFramerate: 30,
				priority: "high",
			},
		});
		const publishedTrack = publication.track;

		if (!(publishedTrack instanceof LocalVideoTrack)) {
			throw new Error("Could not publish a test video track.");
		}

		await new Promise<void>((resolve) => {
			intervalId = window.setInterval(async () => {
				const senderStats = await publishedTrack.getSenderStats();
				const primaryStats = senderStats[0];
				if (!primaryStats) return;

				stats.packetsSent = Math.max(stats.packetsSent, primaryStats.packetsSent ?? 0);
				stats.packetsLost = Math.max(stats.packetsLost, primaryStats.packetsLost ?? 0);
				stats.bitrateTotal += primaryStats.targetBitrate ?? 0;
				stats.rttTotal += primaryStats.roundTripTime ?? 0;
				stats.jitterTotal += primaryStats.jitter ?? 0;
				stats.count += 1;
			}, 1000);

			window.setTimeout(resolve, 8000);
		});

		if (stats.count === 0 || stats.packetsSent === 0) {
			throw new Error("Could not collect WebRTC publish stats.");
		}

		return stats;
	} finally {
		if (intervalId !== null) window.clearInterval(intervalId);
		window.cancelAnimationFrame(animationFrame);
		stream.getTracks().forEach((track) => track.stop());
		canvas.remove();
		await room.disconnect();
	}
}
