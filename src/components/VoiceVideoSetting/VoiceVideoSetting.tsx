import { useEffect, useRef, useState } from "react";
import { DeviceInformation } from './DeviceInformation';
import { useDispatch, useSelector } from "react-redux";
import styles from "./VoiceVideoSetting.module.css";
import { deviceActions } from "../../store/slices/device.slice";
import type { AppDispatch, RootState } from "../../store/store";
import { getMicrophoneCaptureOptions } from "../../utils/microphoneQuality";
import type { ZvonokAudioGraph } from "../../livekit/audio/GlobalAudioGraph";
import { AudioOutputSettings } from './AudioOutputSettings';

import { CameraSettingsSection } from "./sections/CameraSettingsSection";
import { MicrophoneSettingsSection } from "./sections/MicrophoneSettingsSection";
import { VoiceProcessingSection } from "./sections/VoiceProcessingSection";
import { EqualizerSettingsSection } from "./sections/EqualizerSettingsSection";
import { ScreenShareSettingsSection } from "./sections/ScreenShareSettingsSection";
import { HotkeysSettingsSection } from "./sections/HotkeysSettingsSection";

type VoiceVideoTab = "camera" | "microphone" | "hotkeys" | "processing" | "equalizer" | "screen";

const VOICE_VIDEO_TABS: Array<{
	id: VoiceVideoTab;
	label: string;
	description: string;
}> = [
	{ id: "camera", label: "Камера", description: "Устройство и качество видео" },
	{ id: "microphone", label: "Микрофон", description: "Вход, тест и обработка" },
	{ id: "hotkeys", label: "Горячие", description: "Клавиши звонка" },
	{ id: "processing", label: "Обработка", description: "Шумодав и голосовые пресеты" },
	{ id: "equalizer", label: "Эквалайзер", description: "Тонкая настройка голоса" },
	{ id: "screen", label: "Экран", description: "Параметры трансляции" },
];

export function VoiceVideoSetting({hotkeysOnly = false, section, advanced = false}: {hotkeysOnly?: boolean; section?: 'microphone' | 'camera' | 'screen' | 'processing' | 'output'; advanced?: boolean}) {
	const dispatch = useDispatch<AppDispatch>();
	const callStatus = useSelector((s:RootState) => s.call.status);
	const callActive = callStatus === 'connecting' || callStatus === 'in_call';
	const [mediaError, setMediaError] = useState('');
	const {persistenceError, mediaError: applyError} = useSelector((s: RootState) => s.device);

	const {
		selectedAudioOutputId,
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
		toggleCameraHotkey,
		toggleScreenShareHotkey,
	} = useSelector((s: RootState) => s.device);

	const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
	const [microphones, setMicrophones] = useState<MediaDeviceInfo[]>([]);
	const [outputs, setOutputs] = useState<MediaDeviceInfo[]>([]);
	const [, setMediaDevicesReady] = useState(false);

	const [cameraTestEnable, setCameraTestEnable] = useState(false);
	const meterRef = useRef<HTMLDivElement>(null);
	const activityRef = useRef<HTMLDivElement>(null);
	const [isListening, setIsListening] = useState(false);
	const [showExperimentalScreenModes, setShowExperimentalScreenModes] =
		useState(false);
	const [activeTab, setActiveTab] = useState<VoiceVideoTab>(hotkeysOnly ? 'hotkeys' : section && section !== 'output' ? section : 'microphone');

	const streamRef = useRef<MediaStream | null>(null);
	const audioGraphRef = useRef<ZvonokAudioGraph | null>(null);
	const audioPreviewRef = useRef<HTMLAudioElement | null>(null);
	const animationRef = useRef<number | null>(null);

	const effectiveRnnoiseEnabled = voiceProcessingConfig.rnnoise.enabled;
	const thresholdRef = useRef(30);
	thresholdRef.current = isAutoInputSensitivity ? 30 : voiceActivityThreshold;

	useEffect(() => {
		if (hotkeysOnly) return;
		const getDevices = async () => {
			try {
				const devices = await navigator.mediaDevices.enumerateDevices();

				setCameras(devices.filter((device) => device.kind === "videoinput"));
				setMicrophones(devices.filter((device) => device.kind === "audioinput" && device.deviceId !== 'default'));
				setOutputs(devices.filter(device => device.kind === 'audiooutput'));
			} catch (error) {
				setMediaError('Не удалось получить список устройств. Проверьте разрешения браузера.');
			} finally {
				setMediaDevicesReady(true);
			}
		};

		void getDevices();
		navigator.mediaDevices?.addEventListener('devicechange', getDevices);
		return () => navigator.mediaDevices?.removeEventListener('devicechange', getDevices);
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
		if (meterRef.current) {
			meterRef.current.setAttribute('aria-valuenow','0');
			(meterRef.current.firstElementChild as HTMLElement).style.width = '0%';
		}
		if (activityRef.current) activityRef.current.textContent = 'Активность голоса: ниже порога';

		if (streamRef.current) {
			streamRef.current.getTracks().forEach((track) => track.stop());
			streamRef.current = null;
		}
		const graph = audioGraphRef.current;
		audioGraphRef.current = null;
		if (graph) await graph.destroy();
	};

	useEffect(() => {
		let canceled = false;
		if (!isListening || callActive || activeTab !== 'microphone') return;

		const startAudioPreview = async () => {
			try {
				await cleanupAudioPreview();
				if (canceled) return;
				setMediaError('');

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

				const { ZvonokAudioGraph } = await import('../../livekit/audio/GlobalAudioGraph');
				if (canceled) { stream.getTracks().forEach(track => track.stop()); return; }
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
						await audioPreviewRef.current.play();
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

					const level = Math.min(100, (average / 128) * 100);
					const meter = meterRef.current;
					if (meter) {
						meter.setAttribute('aria-valuenow', String(Math.round(level)));
						(meter.firstElementChild as HTMLElement).style.width = `${level}%`;
					}
					if (activityRef.current) activityRef.current.textContent = `Активность голоса: ${level >= thresholdRef.current ? 'голос обнаружен' : 'ниже порога'}`;

					animationRef.current = requestAnimationFrame(checkVolume);
				};

				checkVolume();
			} catch (error) {
				if (!canceled) {
					setMediaError(`Не удалось запустить проверку микрофона. Проверьте устройство и разрешения. ${String(error)}`);
					setIsListening(false);
					void cleanupAudioPreview();
				}
			}
		};

		void startAudioPreview();

		return () => {
			canceled = true;
			void cleanupAudioPreview();
		};
	}, [
		isListening,
		callActive,
		activeTab,
		effectiveRnnoiseEnabled,
		selectedMicrophoneId,
		micQualitySetting,
		isNoiseSuppressionEnabled,
		isEchoCancellationEnabled,
		isAutoGainControlEnabled,
	]);

	useEffect(() => {
		setCameraTestEnable(false);
		setIsListening(false);
		if (meterRef.current) {
			meterRef.current.setAttribute('aria-valuenow','0');
			(meterRef.current.firstElementChild as HTMLElement).style.width = '0%';
		}
	}, [activeTab, callActive]);

	useEffect(() => {
		const graph = audioGraphRef.current;

		if (!graph) return;

		void graph
			.updateConfig({
				...voiceProcessingConfig,
				stereoOutput: true,
			})
			.catch(() => {
				setMediaError('Не удалось применить обработку к проверке микрофона.');
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


	return (
		<div className={styles["container"]}>
			<div className={styles["content"]}>
				{persistenceError && <p role="alert">{persistenceError}</p>}
				{applyError && <p role="alert">{applyError}</p>}
				{mediaError && <p role="alert" className={styles['error-text']}>{mediaError}</p>}
				{!hotkeysOnly && <p className={styles['help-text']}>{callActive ? 'Звонок активен. Отдельные тесты устройств отключены; настройки применяются существующей системой звонка.' : 'Проверка устройств запускается только кнопкой. Названия устройств могут появиться после выдачи разрешения.'}</p>}
				{!hotkeysOnly && (section === 'output' ? <DeviceInformation devices={outputs} kind="audiooutput" selected={selectedAudioOutputId}/> : activeTab === 'microphone' ? <DeviceInformation devices={microphones} kind="audioinput" selected={selectedMicrophoneId}/> : activeTab === 'camera' ? <DeviceInformation devices={cameras} kind="videoinput" selected={selectedCameraId}/> : null)}
				{!hotkeysOnly && !section && <AudioOutputSettings devices={outputs}/>}
				{section === 'output' && <AudioOutputSettings devices={outputs}/>}
				{!hotkeysOnly && !section && <div className={styles["section-tabs"]}>
					{VOICE_VIDEO_TABS.filter(tab=>tab.id!=='hotkeys').map((tab) => (
						<button
							key={tab.id}
							type="button"
							data-active={activeTab === tab.id}
							aria-pressed={activeTab === tab.id}
							onClick={() => setActiveTab(tab.id)}
						>
							<strong>{tab.label}</strong>
							<span>{tab.description}</span>
						</button>
					))}
				</div>}

				{activeTab === "camera" && (
					<CameraSettingsSection
						dispatch={dispatch}
						selectedCameraId={selectedCameraId}
						cameras={cameras}
						cameraQuality={cameraQuality}
						cameraTestEnable={cameraTestEnable && !callActive}
						testDisabled={callActive}
						onCameraTestToggle={() =>
							setCameraTestEnable((previous) => !previous)
						}
					/>
				)}

				{activeTab === "microphone" && section !== 'output' && (
					<MicrophoneSettingsSection
						dispatch={dispatch}
						selectedMicrophoneId={selectedMicrophoneId}
						microphones={microphones}
						micQualitySetting={micQualitySetting}
						isNoiseSuppressionEnabled={isNoiseSuppressionEnabled}
						isEchoCancellationEnabled={isEchoCancellationEnabled}
						effectiveRnnoiseEnabled={effectiveRnnoiseEnabled}
						meterRef={meterRef}
						activityRef={activityRef}
						isListening={isListening}
						testDisabled={callActive}
						audioPreviewRef={audioPreviewRef}
						onListeningToggle={() => setIsListening((previous) => !previous)}
					/>
				)}

				{activeTab === "hotkeys" && (
					<HotkeysSettingsSection
						dispatch={dispatch}
						muteMicrophoneHotkey={muteMicrophoneHotkey}
						toggleCameraHotkey={toggleCameraHotkey}
						toggleScreenShareHotkey={toggleScreenShareHotkey}
					/>
				)}

				{activeTab === "processing" && (
					<><VoiceProcessingSection
						dispatch={dispatch}
						voiceProcessingPreset={voiceProcessingPreset}
						voiceProcessingConfig={voiceProcessingConfig}
						inputVolumePercent={Math.round(voiceProcessingConfig.inputVolume * 100)}
						outputVolumePercent={Math.round(voiceProcessingConfig.outputVolume * 100)}
						onInputVolumePercentChange={value => dispatch(deviceActions.setVoiceInputVolume(value / 100))}
						onOutputVolumePercentChange={value => dispatch(deviceActions.setVoiceOutputVolume(value / 100))}
					/><EqualizerSettingsSection initiallyOpen={advanced} dispatch={dispatch} voiceProcessingConfig={voiceProcessingConfig}/></>
				)}

				{activeTab === "equalizer" && (
					<EqualizerSettingsSection
						dispatch={dispatch}
						voiceProcessingConfig={voiceProcessingConfig}
					/>
				)}

				{activeTab === "screen" && (
					<ScreenShareSettingsSection
						dispatch={dispatch}
						screenShareQuality={screenShareQuality}
						showExperimentalScreenModes={showExperimentalScreenModes}
						onShowExperimentalScreenModesChange={setShowExperimentalScreenModes}
						screenShareRuntime={screenShareRuntime}
					/>
				)}
			</div>
		</div>
	);
}
