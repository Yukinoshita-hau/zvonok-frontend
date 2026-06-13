import { useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import styles from "./VoiceVideoSetting.module.css";
import { deviceActions } from "../../store/slices/device.slice";
import type { AppDispatch, RootState } from "../../store/store";
import {
	type CallQualitySetting,
	type ScreenShareQualitySetting,
} from "../../utils/callQuality";
import {
	getMicrophoneCaptureOptions,
	MICROPHONE_QUALITY_PRESETS,
} from "../../utils/microphoneQuality";
import { ScreenShareQualityGrid } from "./ScreenShareQualityGrid/ScreenShareQualityGrid";
import { MicrophoneQualitySelector } from "./MicrophoneQualitySelector/MicrophoneQualitySelector";
import CameraView from "./CameraPreview/CameraView";
import { ZvonokAudioGraph } from "../../livekit/audio/GlobalAudioGraph";

export function VoiceVideoSetting() {
	const dispatch = useDispatch<AppDispatch>();
	const {
		selectedCameraId,
		selectedMicrophoneId,
		micQualitySetting,
		cameraQuality,
		screenShareQuality,
		isNoiseSuppressionEnabled,
		isRnnoiseEnabled,
		isEchoCancellationEnabled,
		isAutoGainControlEnabled,
		voiceActivityThreshold,
		isAutoInputSensitivity,
		screenShareRuntime,
	} = useSelector((s: RootState) => s.device);
	const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
	const [microphones, setMicrophones] = useState<MediaDeviceInfo[]>([]);
	const [mediaDevicesReady, setMediaDevicesReady] = useState(false);
	const [cameraTestEnable, setCameraTestEnable] = useState(false);
	const [volumeLevel, setVolumeLevel] = useState(0);
	const [isListening, setIsListening] = useState(false);
	const [showExperimentalScreenModes, setShowExperimentalScreenModes] = useState(false);

	const streamRef = useRef<MediaStream | null>(null);
	const audioGraphRef = useRef<ZvonokAudioGraph | null>(null);
	const audioPreviewRef = useRef<HTMLAudioElement | null>(null);
	const animationRef = useRef<number | null>(null);

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
				});

				const audioConstraints: MediaTrackConstraints = {
					deviceId:
						selectedMicrophoneId === "default"
							? undefined
							: { exact: selectedMicrophoneId },
					// есл включён RNNoise, браузерное шумоподавление лучше вырубить,
					// что бы двойной обработки небыло
					noiseSuppression: isRnnoiseEnabled ? false: micCaptureOptions.noiseSuppression,
					echoCancellation: micCaptureOptions.echoCancellation,
					autoGainControl: micCaptureOptions.autoGainControl,

					channelCount: micCaptureOptions.channelCount ?? 1,
					sampleRate: micCaptureOptions.sampleRate ?? 48000,
					sampleSize: micCaptureOptions.sampleSize ?? 16,
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
					rnnoiseEnabled: isRnnoiseEnabled,
					inputVolume: 1,
					outputVolume: 1,
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

				console.log("[audio-preview] raw track settings:", rawAudioTrack.getSettings());
				console.log("[audio-preview] rnnoise enabled:", isRnnoiseEnabled);
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
		isRnnoiseEnabled
	]);

	useEffect(() => {
		const audio = audioPreviewRef.current;

		if (!audio) return;

		audio.muted = !isListening;

		if (isListening) {
			void audio.play().catch((error) => {
				console.error("Audio preview play failed", error);
			})
		} else {
			audio.pause();
		}
	}, [isListening])

	return (
		<div className={styles["container"]}>
			<div className={styles["content"]}>
				<div className={styles["edit-section"]}>
					<div className={styles["form-group"]}>
						<label className={styles["label"]}>Камера</label>
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
						<label className={styles["label"]}>Предпросмотр выбранной камеры</label>

						{cameraTestEnable && <CameraView />}
						<button
							className={cameraTestEnable ? styles["btn-secondary"] : styles["btn-primary"]}
							onClick={() => setCameraTestEnable(!cameraTestEnable)}
						>
							{cameraTestEnable ? "Закончить проверку" : "Проверить камеру"}
						</button>

					</div>

					<div className={styles["form-group"]}>
						<label className={styles["label"]}>Микрофон</label>
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
						<label className={styles["label"]}>Качество микрофона</label>
						<MicrophoneQualitySelector
							value={micQualitySetting}
							onChange={(value) => dispatch(deviceActions.setMicrophoneQuality(value))}
						/>
						<span className={styles["help-text"]}>
							Запрошенные значения - это максимальные настройки которые могут быть изменены посредством браузера/ОС/аудиодрайвера.
						</span>
						{MICROPHONE_QUALITY_PRESETS[micQualitySetting].warning && (
							<span className={styles["help-text"]}>
								{MICROPHONE_QUALITY_PRESETS[micQualitySetting].warning}
							</span>
						)}
					</div>

					<div className={styles["form-group"]}>
						<label className={styles["label"]}>Браузерное шумоподавление</label>
						<label className={styles["toggle-row"]}>
							<input
								type="checkbox"
								checked={isNoiseSuppressionEnabled}
								onChange={(e) => dispatch(deviceActions.setNoiseSuppression(e.target.checked))}
							/>
							<span>{isNoiseSuppressionEnabled || !isRnnoiseEnabled ? "Включено" : "Выключено"}</span>
						</label>
						<span className={styles["help-text"]}>
							Используеться браузерное шумоподавление и изоляция звука если подурживаеться.
						</span>
					</div>

					<div className={styles["form-group"]}>
						<label className={styles["label"]}>Подавление шума с помощью Rnnoise</label>
						<label className={styles["toggle-row"]}>
							<input
								type="checkbox"
								checked={isRnnoiseEnabled}
								onChange={(e) => dispatch(deviceActions.setRnnoise(e.target.checked))}
							/>
							<span>{isRnnoiseEnabled ? "Включено" : "Выключено"}</span>
						</label>
						<span className={styles["help-text"]}>
							Использует нейросетевой алгоритм RNNoise для дополнительного подавления фонового шума с сохранением естественного звучания голоса.
							Если включено, используется вместо стандартного шумоподавления браузера.
						</span>
					</div>

					<div className={styles["form-group"]}>
						<label className={styles["label"]}>Эхоподавление</label>
						<label className={styles["toggle-row"]}>
							<input
								type="checkbox"
								checked={isEchoCancellationEnabled}
								onChange={(e) => dispatch(deviceActions.setEchoCancellation(e.target.checked))}
							/>
							<span>{isEchoCancellationEnabled ? "Включено" : "Выключено"}</span>
						</label>
					</div>

					<div className={styles["form-group"]}>
						<label className={styles["label"]}>Проверка микрофона</label>
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
							{isListening ? "Закончить прослушивание" : "Послушать себя"}
						</button>
						<div className={styles["help-text"]}>
							Voice activity:{" "}
							{volumeLevel >= (isAutoInputSensitivity ? 30 : voiceActivityThreshold)
								? "Detected"
								: "Below threshold"}
						</div>
						<audio ref={audioPreviewRef} style={{ display: "none" }} />
					</div>

					<div className={styles["form-group"]}>
						<label className={styles["label"]}>Качество камеры</label>
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
						<label className={styles["label"]}>Качество трансляции экрана</label>
						<ScreenShareQualityGrid
							value={screenShareQuality}
							onChange={(value) => dispatch(deviceActions.setScreenShareQuality(value as ScreenShareQualitySetting))}
							showExperimental={showExperimentalScreenModes}
							onShowExperimentalChange={setShowExperimentalScreenModes}
							runtimeInfo={screenShareRuntime}
						/>
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
