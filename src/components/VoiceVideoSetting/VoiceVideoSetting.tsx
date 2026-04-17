import { useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import styles from "./VoiceVideoSetting.module.css";
import { deviceActions } from "../../store/slices/device.slice";
import type { AppDispatch, RootState } from "../../store/store";

export function VoiceVideoSetting() {
	const dispatch = useDispatch<AppDispatch>();
	const {
		selectedCameraId,
		selectedMicrophoneId,
		videoQuality,
		isNoiseSuppressionEnabled,
	} = useSelector((s: RootState) => s.device);

	const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
	const [microphones, setMicrophones] = useState<MediaDeviceInfo[]>([]);
	const [volumeLevel, setVolumeLevel] = useState(0);
	const [isListening, setIsListening] = useState(false);

	const streamRef = useRef<MediaStream | null>(null);
	const audioContextRef = useRef<AudioContext | null>(null);
	const audioPreviewRef = useRef<HTMLAudioElement | null>(null);
	const animationRef = useRef<number>();

	useEffect(() => {
		const getDevices = async () => {
			try {
				await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
				const devices = await navigator.mediaDevices.enumerateDevices();
				setCameras(devices.filter((device) => device.kind === "videoinput"));
				setMicrophones(devices.filter((device) => device.kind === "audioinput"));
			} catch (error) {
				console.log("No access to media devices", error);
			}
		};

		getDevices();
	}, []);

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
					autoGainControl: true,
					echoCancellation: true,
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
	}, [selectedMicrophoneId, isListening, isNoiseSuppressionEnabled]);

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
							{cameras.map((camera) => (
								<option key={camera.deviceId} value={camera.deviceId}>
									{camera.label || "Camera"}
								</option>
							))}
						</select>
					</div>

					<div className={styles["form-group"]}>
						<label className={styles["label"]}>Microphone</label>
						<select
							className={styles["input"]}
							value={selectedMicrophoneId}
							onChange={(e) => dispatch(deviceActions.setMicrophone(e.target.value))}
						>
							<option value="default">Default</option>
							{microphones.map((microphone) => (
								<option key={microphone.deviceId} value={microphone.deviceId}>
									{microphone.label || "Microphone"}
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
						<audio ref={audioPreviewRef} autoPlay style={{ display: "none" }} />
					</div>

					<div className={styles["form-group"]}>
						<label className={styles["label"]}>Video Quality</label>
						<select
							className={styles["input"]}
							value={videoQuality}
							onChange={(e) =>
								dispatch(deviceActions.setVideoQuality(e.target.value as "low" | "medium" | "high"))
							}
						>
							<option value="high">High (1080p)</option>
							<option value="medium">Medium (720p)</option>
							<option value="low">Low (360p)</option>
						</select>
					</div>
				</div>
			</div>
		</div>
	);
}
