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
		isEchoCancellationEnabled,
		isAutoGainControlEnabled,
		voiceActivityThreshold,
		isAutoInputSensitivity,
		screenShareRuntime,
		voiceProcessingConfig,
		voiceProcessingPreset
	} = useSelector((s: RootState) => s.device);
	const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
	const [inputVolumePercent, setInputVolumePercent] = useState(
		Math.round(voiceProcessingConfig.inputVolume * 100)
	);
	const [outputVolumePercent, setOutputVolumePercent] = useState(
		Math.round(voiceProcessingConfig.outputVolume * 100)
	);
	const [microphones, setMicrophones] = useState<MediaDeviceInfo[]>([]);
	const [_, setMediaDevicesReady] = useState(false);
	const [cameraTestEnable, setCameraTestEnable] = useState(false);
	const [volumeLevel, setVolumeLevel] = useState(0);
	const [isListening, setIsListening] = useState(false);
	const [showExperimentalScreenModes, setShowExperimentalScreenModes] = useState(false);

	const streamRef = useRef<MediaStream | null>(null);
	const audioGraphRef = useRef<ZvonokAudioGraph | null>(null);
	const audioPreviewRef = useRef<HTMLAudioElement | null>(null);
	const animationRef = useRef<number | null>(null);

	const effectiveRnnoiseEnabled = voiceProcessingConfig.rnnoise.enabled;

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
					isRnnoiseEnabled: effectiveRnnoiseEnabled
				});

				const audioConstraints: MediaTrackConstraints = {
					deviceId:
						selectedMicrophoneId === "default"
							? undefined
							: { exact: selectedMicrophoneId },
					// есл включён RNNoise, браузерное шумоподавление вырубаеться,
					// что бы двойной обработки небыло
					noiseSuppression: effectiveRnnoiseEnabled ? false : micCaptureOptions.noiseSuppression,
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

		void graph.updateConfig({
			...voiceProcessingConfig,
			stereoOutput: true
		}).catch((error) => {
			console.log("[audio-processor] failed to update graph config", error)
		});
	}, [voiceProcessingConfig])

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

	useEffect(() => {
		setInputVolumePercent(Math.round(voiceProcessingConfig.inputVolume * 100))
	}, [voiceProcessingConfig.inputVolume])


	useEffect(() => {
		const timeoutId = window.setTimeout(() => {
			dispatch(deviceActions.setVoiceInputVolume(inputVolumePercent / 100));
		})

		return () => {
			window.clearTimeout(timeoutId);
		}
	}, [dispatch, inputVolumePercent])


	useEffect(() => {
		setOutputVolumePercent(Math.round(voiceProcessingConfig.outputVolume * 100))
	}, [voiceProcessingConfig.outputVolume])


	useEffect(() => {
		const timeoutId = window.setTimeout(() => {
			dispatch(deviceActions.setVoiceOutputVolume(outputVolumePercent / 100));
		})

		return () => {
			window.clearTimeout(timeoutId);
		}
	}, [dispatch, outputVolumePercent])

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
						<label className={styles["label"]}>Обработка голоса</label>

						<select
							className={styles["input"]}
							value={voiceProcessingPreset}
							onChange={(e) =>
								dispatch(
									deviceActions.setVoiceProcessingPreset(
										e.target.value as "default" | "clearVoice" | "softVoice"
									)
								)
							}
						>
							<option value="default">Default</option>
							<option value="clearVoice">Clear Voice</option>
							<option value="softVoice">Soft Voice</option>
						</select>

						<span className={styles["help-text"]}>
							Пресет меняет Web Audio обработку: громкость, RNNoise, фильтры, компрессор и лимитер.
						</span>
					</div>

					<div className={styles["form-group"]}>
						<label className={styles["label"]}>
							Громкость микрофона: {Math.round(voiceProcessingConfig.inputVolume * 100)}%
						</label>

						<input
							type="range"
							min={0}
							max={300}
							value={inputVolumePercent}
							onChange={(e) => setInputVolumePercent(Number(e.target.value))}
						/>

						<span className={styles["help-text"]}>
							Это усиление до обработки. 100% = без изменения, 200% = в 2 раза громче.
						</span>
					</div>

					<div className={styles["form-group"]}>
						<label className={styles["label"]}>
							Итоговая громкость: {Math.round(voiceProcessingConfig.outputVolume * 100)}%
						</label>

						<input
							type="range"
							min={0}
							max={200}
							value={outputVolumePercent}
							onChange={(e) => setOutputVolumePercent(Number(e.target.value))}
						/>

						<span className={styles["help-text"]}>
							Это громкость после всех фильтров.
						</span>
					</div>

					<div className={styles["form-group"]}>
						<label className={styles["label"]}>RNNoise</label>

						<label className={styles["toggle-row"]}>
							<input
								type="checkbox"
								checked={voiceProcessingConfig.rnnoise.enabled}
								onChange={(e) =>
									dispatch(deviceActions.setVoiceRnnoiseEnabled(e.target.checked))
								}
							/>
							<span>{voiceProcessingConfig.rnnoise.enabled ? "Включено" : "Выключено"}</span>
						</label>

						<span className={styles["help-text"]}>
							Если включено, браузерное шумоподавление и voice isolation лучше выключать, чтобы не было двойной обработки.
						</span>
					</div>

					<div className={styles["form-group"]}>
						<label className={styles["label"]}>High-pass filter</label>

						<label className={styles["toggle-row"]}>
							<input
								type="checkbox"
								checked={voiceProcessingConfig.highPass.enabled}
								onChange={(e) =>
									dispatch(deviceActions.setVoiceHighPass({ enabled: e.target.checked }))
								}
							/>
							<span>{voiceProcessingConfig.highPass.enabled ? "Включено" : "Выключено"}</span>
						</label>

						<label className={styles["help-text"]}>
							Частота: {voiceProcessingConfig.highPass.frequency} Hz
						</label>

						<input
							type="range"
							min={60}
							max={160}
							value={voiceProcessingConfig.highPass.frequency}
							disabled={!voiceProcessingConfig.highPass.enabled}
							onChange={(e) =>
								dispatch(deviceActions.setVoiceHighPass({ frequency: Number(e.target.value) }))
							}
						/>
					</div>

					<div className={styles["form-group"]}>
						<label className={styles["label"]}>Presence boost</label>

						<label className={styles["toggle-row"]}>
							<input
								type="checkbox"
								checked={voiceProcessingConfig.presence.enabled}
								onChange={(e) =>
									dispatch(deviceActions.setVoicePresence({ enabled: e.target.checked }))
								}
							/>
							<span>{voiceProcessingConfig.presence.enabled ? "Включено" : "Выключено"}</span>
						</label>

						<label className={styles["help-text"]}>
							Усиление: {voiceProcessingConfig.presence.gain.toFixed(1)} dB
						</label>

						<input
							type="range"
							min={0}
							max={6}
							step={0.5}
							value={voiceProcessingConfig.presence.gain}
							disabled={!voiceProcessingConfig.presence.enabled}
							onChange={(e) =>
								dispatch(deviceActions.setVoicePresence({ gain: Number(e.target.value) }))
							}
						/>
					</div>

					<div className={styles["form-group"]}>
						<label className={styles["label"]}>Compressor</label>

						<label className={styles["toggle-row"]}>
							<input
								type="checkbox"
								checked={voiceProcessingConfig.compressor.enabled}
								onChange={(e) =>
									dispatch(deviceActions.setVoiceCompressor({ enabled: e.target.checked }))
								}
							/>
							<span>{voiceProcessingConfig.compressor.enabled ? "Включено" : "Выключено"}</span>
						</label>

						<label className={styles["help-text"]}>
							Сила: ratio {voiceProcessingConfig.compressor.ratio}
						</label>

						<input
							type="range"
							min={2}
							max={12}
							step={1}
							value={voiceProcessingConfig.compressor.ratio}
							disabled={!voiceProcessingConfig.compressor.enabled}
							onChange={(e) =>
								dispatch(deviceActions.setVoiceCompressor({ ratio: Number(e.target.value) }))
							}
						/>
					</div>

					<div className={styles["form-group"]}>
						<label className={styles["label"]}>Limiter</label>

						<label className={styles["toggle-row"]}>
							<input
								type="checkbox"
								checked={voiceProcessingConfig.limiter.enabled}
								onChange={(e) =>
									dispatch(deviceActions.setVoiceLimiter({ enabled: e.target.checked }))
								}
							/>
							<span>{voiceProcessingConfig.limiter.enabled ? "Включено" : "Выключено"}</span>
						</label>

						<label className={styles["help-text"]}>
							Порог: {voiceProcessingConfig.limiter.threshold} dB
						</label>

						<input
							type="range"
							min={-20}
							max={-2}
							step={1}
							value={voiceProcessingConfig.limiter.threshold}
							disabled={!voiceProcessingConfig.limiter.enabled}
							onChange={(e) =>
								dispatch(deviceActions.setVoiceLimiter({ threshold: Number(e.target.value) }))
							}
						/>
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
					</div>
					
					<span className={styles["help-text"]}>
						Bitrate применяется только в звонке при публикации микрофона.
						В проверке микрофона слышны только захват, шумоподавление и Web Audio обработка.
					</span>

					<div className={styles["form-group"]}>
						<label className={styles["label"]}>Браузерное шумоподавление</label>
						<label className={styles["toggle-row"]}>
							<input
								type="checkbox"
								checked={isNoiseSuppressionEnabled}
								onChange={(e) => dispatch(deviceActions.setNoiseSuppression(e.target.checked))}
							/>
							<span>{isNoiseSuppressionEnabled || !effectiveRnnoiseEnabled ? "Включено" : "Выключено"}</span>
						</label>
						<span className={styles["help-text"]}>
							Используеться браузерное шумоподавление и изоляцию звука если поддерживается.
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
