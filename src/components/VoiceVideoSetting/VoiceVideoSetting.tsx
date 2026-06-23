import { useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import styles from "./VoiceVideoSetting.module.css";
import { deviceActions } from "../../store/slices/device.slice";
import type { AppDispatch, RootState } from "../../store/store";
import { getMicrophoneCaptureOptions } from "../../utils/microphoneQuality";
import { ZvonokAudioGraph } from "../../livekit/audio/GlobalAudioGraph";

import { CameraSettingsSection } from "./sections/CameraSettingsSection";
import { MicrophoneSettingsSection } from "./sections/MicrophoneSettingsSection";
import { VoiceProcessingSection } from "./sections/VoiceProcessingSection";
import { EqualizerSettingsSection } from "./sections/EqualizerSettingsSection";
import { ScreenShareSettingsSection } from "./sections/ScreenShareSettingsSection";

export function VoiceVideoSetting() {
	const dispatch = useDispatch<AppDispatch>();

	const {
		selectedCameraId,
		selectedMicrophoneId,
		micQualitySetting,
		cameraQuality,
		screenShareQuality,
		isNoiseSuppressionEnabled,
		isEchoCancellationEnabled,
		isAutoGainControlEnabled,
		voiceActivityThreshold,
		isAutoInputSensitivity,
		screenShareRuntime,
		voiceProcessingConfig,
		voiceProcessingPreset,
		muteMicrophoneHotkey,
	} = useSelector((s: RootState) => s.device);

	const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
	const [microphones, setMicrophones] = useState<MediaDeviceInfo[]>([]);
	const [, setMediaDevicesReady] = useState(false);

	const [inputVolumePercent, setInputVolumePercent] = useState(
		Math.round(voiceProcessingConfig.inputVolume * 100)
	);

	const [outputVolumePercent, setOutputVolumePercent] = useState(
		Math.round(voiceProcessingConfig.outputVolume * 100)
	);

	const [cameraTestEnable, setCameraTestEnable] = useState(false);
	const [volumeLevel, setVolumeLevel] = useState(0);
	const [isListening, setIsListening] = useState(false);
	const [showExperimentalScreenModes, setShowExperimentalScreenModes] =
		useState(false);

	const streamRef = useRef<MediaStream | null>(null);
	const audioGraphRef = useRef<ZvonokAudioGraph | null>(null);
	const audioPreviewRef = useRef<HTMLAudioElement | null>(null);
	const animationRef = useRef<number | null>(null);

	const effectiveRnnoiseEnabled = voiceProcessingConfig.rnnoise.enabled;

	useEffect(() => {
		const getDevices = async () => {
			try {
				await navigator.mediaDevices.getUserMedia({
					audio: true,
					video: true,
				});

				const devices = await navigator.mediaDevices.enumerateDevices();

				setCameras(devices.filter((device) => device.kind === "videoinput"));
				setMicrophones(devices.filter((device) => device.kind === "audioinput"));
			} catch (error) {
				console.log("No access to media devices", error);
			} finally {
				setMediaDevicesReady(true);
			}
		};

		void getDevices();
	}, []);

	const cleanupAudioPreview = async () => {
		if (animationRef.current) {
			cancelAnimationFrame(animationRef.current);
			animationRef.current = null;
		}

		if (audioPreviewRef.current) {
			audioPreviewRef.current.pause();
			audioPreviewRef.current.srcObject = null;
		}

		if (audioGraphRef.current) {
			await audioGraphRef.current.destroy();
			audioGraphRef.current = null;
		}

		if (streamRef.current) {
			streamRef.current.getTracks().forEach((track) => track.stop());
			streamRef.current = null;
		}
	};

	useEffect(() => {
		let canceled = false;

		const startAudioPreview = async () => {
			try {
				await cleanupAudioPreview();

				const micCaptureOptions = getMicrophoneCaptureOptions({
					selectedMicrophoneId,
					micQualitySetting,
					isAutoGainControlEnabled,
					isEchoCancellationEnabled,
					isNoiseSuppressionEnabled,
					isRnnoiseEnabled: effectiveRnnoiseEnabled,
				});

				const audioConstraints: MediaTrackConstraints = {
					deviceId:
						selectedMicrophoneId === "default"
							? undefined
							: { exact: selectedMicrophoneId },

					noiseSuppression: effectiveRnnoiseEnabled
						? false
						: micCaptureOptions.noiseSuppression,

					echoCancellation: micCaptureOptions.echoCancellation,
					autoGainControl: micCaptureOptions.autoGainControl,

					channelCount: micCaptureOptions.channelCount ?? 1,
					sampleRate: micCaptureOptions.sampleRate ?? 48000,
					sampleSize: micCaptureOptions.sampleSize ?? 16,
				};

				const supportedConstraints =
					navigator.mediaDevices.getSupportedConstraints() as {
						voiceIsolation?: boolean;
					};

				if (supportedConstraints.voiceIsolation) {
					(
						audioConstraints as MediaTrackConstraints & {
							voiceIsolation?: boolean;
						}
					).voiceIsolation = effectiveRnnoiseEnabled
						? false
						: isNoiseSuppressionEnabled;
				}

				const stream = await navigator.mediaDevices.getUserMedia({
					audio: audioConstraints,
				});

				if (canceled) {
					stream.getTracks().forEach((track) => track.stop());
					return;
				}

				streamRef.current = stream;

				const rawAudioTrack = stream.getAudioTracks()[0];

				if (!rawAudioTrack) {
					throw new Error("Microphone audio track was not found");
				}

				const audioGraph = new ZvonokAudioGraph({
					...voiceProcessingConfig,
					stereoOutput: true,
				});

				audioGraphRef.current = audioGraph;

				await audioGraph.attachTrack(rawAudioTrack);

				if (canceled) {
					await audioGraph.destroy();
					stream.getTracks().forEach((track) => track.stop());
					return;
				}

				const previewStream = audioGraph.getOutputStream();

				if (audioPreviewRef.current) {
					audioPreviewRef.current.srcObject = previewStream;
					audioPreviewRef.current.muted = !isListening;

					if (isListening) {
						await audioPreviewRef.current.play().catch((error) => {
							console.error("Audio preview autoplay failed", error);
						});
					}
				}

				const analyser = audioGraph.getAnalyser();
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

		void startAudioPreview();

		return () => {
			canceled = true;
			void cleanupAudioPreview();
		};
	}, [
		selectedMicrophoneId,
		micQualitySetting,
		isNoiseSuppressionEnabled,
		isEchoCancellationEnabled,
		isAutoGainControlEnabled,
	]);

	useEffect(() => {
		const graph = audioGraphRef.current;

		if (!graph) return;

		void graph
			.updateConfig({
				...voiceProcessingConfig,
				stereoOutput: true,
			})
			.catch((error) => {
				console.log("[audio-processor] failed to update graph config", error);
			});
	}, [voiceProcessingConfig]);

	useEffect(() => {
		const audio = audioPreviewRef.current;

		if (!audio) return;

		audio.muted = !isListening;

		if (isListening) {
			void audio.play().catch((error) => {
				console.error("Audio preview play failed", error);
			});
		} else {
			audio.pause();
		}
	}, [isListening]);

	useEffect(() => {
		setInputVolumePercent(Math.round(voiceProcessingConfig.inputVolume * 100));
	}, [voiceProcessingConfig.inputVolume]);

	useEffect(() => {
		const timeoutId = window.setTimeout(() => {
			dispatch(deviceActions.setVoiceInputVolume(inputVolumePercent / 100));
		}, 150);

		return () => {
			window.clearTimeout(timeoutId);
		};
	}, [dispatch, inputVolumePercent]);

	useEffect(() => {
		setOutputVolumePercent(Math.round(voiceProcessingConfig.outputVolume * 100));
	}, [voiceProcessingConfig.outputVolume]);

	useEffect(() => {
		const timeoutId = window.setTimeout(() => {
			dispatch(deviceActions.setVoiceOutputVolume(outputVolumePercent / 100));
		}, 150);

		return () => {
			window.clearTimeout(timeoutId);
		};
	}, [dispatch, outputVolumePercent]);

	return (
		<div className={styles["container"]}>
			<div className={styles["content"]}>
				<CameraSettingsSection
					dispatch={dispatch}
					selectedCameraId={selectedCameraId}
					cameras={cameras}
					cameraQuality={cameraQuality}
					cameraTestEnable={cameraTestEnable}
					onCameraTestToggle={() =>
						setCameraTestEnable((previous) => !previous)
					}
				/>

				<MicrophoneSettingsSection
					dispatch={dispatch}
					selectedMicrophoneId={selectedMicrophoneId}
					microphones={microphones}
					micQualitySetting={micQualitySetting}
					isNoiseSuppressionEnabled={isNoiseSuppressionEnabled}
					isEchoCancellationEnabled={isEchoCancellationEnabled}
					effectiveRnnoiseEnabled={effectiveRnnoiseEnabled}
					volumeLevel={volumeLevel}
					isListening={isListening}
					isAutoInputSensitivity={isAutoInputSensitivity}
					voiceActivityThreshold={voiceActivityThreshold}
					muteMicrophoneHotkey={muteMicrophoneHotkey}
					audioPreviewRef={audioPreviewRef}
					onListeningToggle={() => setIsListening((previous) => !previous)}
				/>

				<VoiceProcessingSection
					dispatch={dispatch}
					voiceProcessingPreset={voiceProcessingPreset}
					voiceProcessingConfig={voiceProcessingConfig}
					inputVolumePercent={inputVolumePercent}
					outputVolumePercent={outputVolumePercent}
					onInputVolumePercentChange={setInputVolumePercent}
					onOutputVolumePercentChange={setOutputVolumePercent}
				/>

				<EqualizerSettingsSection
					dispatch={dispatch}
					voiceProcessingConfig={voiceProcessingConfig}
				/>

				<ScreenShareSettingsSection
					dispatch={dispatch}
					screenShareQuality={screenShareQuality}
					showExperimentalScreenModes={showExperimentalScreenModes}
					onShowExperimentalScreenModesChange={setShowExperimentalScreenModes}
					screenShareRuntime={screenShareRuntime}
				/>
			</div>
		</div>
	);
}
