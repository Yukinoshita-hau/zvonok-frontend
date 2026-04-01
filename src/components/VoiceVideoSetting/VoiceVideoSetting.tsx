import { useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import styles from "./VoiceVideoSetting.module.css";
import { deviceActions } from "../../store/slices/device.slice";
import type { AppDispatch, RootState } from "../../store/store";

export function VoiceVideoSetting() {
	const dispatch = useDispatch<AppDispatch>();
	const { selectedCameraId, selectedMicrophoneId, videoQuality } = useSelector((s: RootState) => s.device);

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
				setCameras(devices.filter(d => d.kind === "videoinput"));
				setMicrophones(devices.filter(d => d.kind === "audioinput"));
			} catch (error) {
				console.log("Нет доступа к устройствам", error);
			}
		};
		getDevices();
	}, []);

	useEffect(() => {
		const startAudio = async () => {
			try {
				if (streamRef.current) {
					streamRef.current.getTracks().forEach(t => t.stop());
				}

				const stream = await navigator.mediaDevices.getUserMedia({
					audio: {
						deviceId: selectedMicrophoneId === "default" ? undefined : { exact: selectedMicrophoneId },
					}
				});
				
				streamRef.current = stream;

				if (audioPreviewRef.current) {
					audioPreviewRef.current.srcObject = isListening ? stream : null;
					
					if (isListening) {
						audioPreviewRef.current.muted = false;
						audioPreviewRef.current.play().catch(e => console.error("Ошибка автоплея", e));
					}
				}

				const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
				audioContextRef.current = audioContext;
				const analyser = audioContext.createAnalyser();
				analyser.fftSize = 256;
				const source = audioContext.createMediaStreamSource(stream);
				source.connect(analyser);

				const dataArray = new Uint8Array(analyser.frequencyBinCount);
				const checkVolume = () => {
					analyser.getByteFrequencyData(dataArray);
					let sum = 0;
					for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
					const average = sum / dataArray.length;
					setVolumeLevel(Math.min(100, (average / 128) * 100));
					animationRef.current = requestAnimationFrame(checkVolume);
				};
				checkVolume();

			} catch (err) {
				console.log("Ошибка микрофона:", err);
			}
		};

		startAudio();

		return () => {
			if (animationRef.current) cancelAnimationFrame(animationRef.current);
			if (audioContextRef.current) audioContextRef.current.close();
			if (streamRef.current) {
				streamRef.current.getTracks().forEach(track => track.stop());
			}
		};
	}, [selectedMicrophoneId, isListening]);

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
							<option value="default">По умолчанию</option>
							{cameras.map(cam => (
								<option key={cam.deviceId} value={cam.deviceId}>{cam.label || "Камера"}</option>
							))}
						</select>
					</div>

					<div className={styles["form-group"]}>
						<label className={styles["label"]}>Микрофон</label>
						<select
							className={styles["input"]}
							value={selectedMicrophoneId}
							onChange={(e) => dispatch(deviceActions.setMicrophone(e.target.value))}
						>
							<option value="default">По умолчанию</option>
							{microphones.map(mic => (
								<option key={mic.deviceId} value={mic.deviceId}>{mic.label || "Микрофон"}</option>
							))}
						</select>
					</div>

					<div className={styles["form-group"]}>
						<label className={styles["label"]}>Проверка микрофона</label>
						<div className={styles["volume-bar-bg"]}>
							<div className={styles["volume-bar-fill"]} style={{ width: `${volumeLevel}%` }} />
						</div>
						<button
							className={isListening ? styles["btn-secondary"] : styles["btn-primary"]}
							onClick={() => setIsListening(!isListening)}
						>
							{isListening ? "Остановить прослушивание" : "Проверить себя (прослушать)"}
						</button>
						<audio ref={audioPreviewRef} autoPlay style={{ display: 'none' }} />
					</div>

					<div className={styles["form-group"]}>
						<label className={styles["label"]}>Качество видео</label>
						<select
							className={styles["input"]}
							value={videoQuality}
							onChange={(e) => dispatch(deviceActions.setVideoQuality(e.target.value as any))}
						>
							<option value="high">Высокое (1080p, 60fps)</option>
							<option value="medium">Среднее (720p, 30fps)</option>
							<option value="low">Низкое (360p, 15fps)</option>
						</select>
					</div>
				</div>
			</div>
		</div>
	);
}
