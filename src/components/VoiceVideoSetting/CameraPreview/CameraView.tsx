import { startCameraCapture } from "./cameraCapture";
import { useEffect, useRef, useState } from "react";
import { useSelector } from "react-redux";
import type { RootState } from "../../../store/store";
import styles from "./CameraView.module.css";

function CameraView() {
	const videoRef = useRef<HTMLVideoElement>(null);
	const [error, setError] = useState<string | null>(null);
	const cameraId = useSelector((s: RootState) => s.device.selectedCameraId);

	useEffect(() => {
		let video: HTMLVideoElement | null = null;
		setError(null);
		const cancel = startCameraCapture(
			{
				video: cameraId && cameraId !== "default" ? { deviceId: { exact: cameraId } } : true,
				audio: false,
			},
			(stream) => {
				video = videoRef.current;
				if (video) video.srcObject = stream;
			},
			(error) => {
				setError(
					"Ошибка доступа к камере: " + (error instanceof Error ? error.message : String(error)),
				);
			},
		);
		return () => {
			cancel();
			if (video) video.srcObject = null;
		};
	}, [cameraId]);

	return (
		<div className={styles["container"]}>
			{error && <p className={styles["error"]}>{error}</p>}
			{!error && <video className={styles["camera"]} ref={videoRef} autoPlay playsInline />}
		</div>
	);
}

export default CameraView;
