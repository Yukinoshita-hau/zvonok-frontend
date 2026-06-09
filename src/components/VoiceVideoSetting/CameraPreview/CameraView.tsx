import { useEffect, useRef, useState } from "react";
import { useSelector } from "react-redux";
import type { RootState } from "../../../store/store";
import styles from "./CameraView.module.css";

function CameraView() {
	const videoRef = useRef<HTMLVideoElement>(null);
	const [error, setError] = useState<string | null>(null);
	const cameraId = useSelector((s: RootState) => s.device.selectedCameraId);

	useEffect(() => {
		async function startCamera() {
			try {
				setError(null);
				const stream = await navigator.mediaDevices.getUserMedia({
					video: cameraId === "default"
						? true
						: cameraId ? 
						{ deviceId: { exact: cameraId } }
						: true,
					audio: false,
				});

				if (videoRef.current) {
					videoRef.current.srcObject = stream;
				}
			} catch (err: unknown) {
				if (err instanceof Error) {
					setError("Ошибка доступа к камере: " + err.message);
				}
			}
		}

		startCamera();

		return () => {
			if (videoRef.current && videoRef.current.srcObject) {
				videoRef.current.srcObject.getTracks().forEach(track => track.stop());
			}
		}
	}, [cameraId])

	return (
		<div className={styles["container"]}>
			{error && <p className={styles["error"]}>{error}</p>}
			{!error && (
				<video
					className={styles["camera"]}
					ref={videoRef}
					autoPlay
					playsInline
				/>
			)}
		</div>
	)
}

export default CameraView;
