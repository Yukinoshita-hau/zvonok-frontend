import { useEffect, useRef, useState } from "react";
import { getCameraCaptureOptions, type CallQualityRecommendation, type CallQualitySetting, getQualityPreset, resolveQualitySetting } from "../../../utils/callQuality";

export type CameraPreviewStatus =
	| "idle"
	| "loading"
	| "ready"
	| "no_device"
	| "denied"
	| "not_found"
	| "error";

interface UseCameraPreviewParams {
	selectedCameraId: string;
	cameraQuality: CallQualitySetting;
	recommendation: CallQualityRecommendation | null;
	hasCameraDevices: boolean;
}

export function useCameraPreview({
	selectedCameraId,
	cameraQuality,
	recommendation,
	hasCameraDevices,
}: UseCameraPreviewParams) {
	const [status, setStatus] = useState<CameraPreviewStatus>("idle");
	const [error, setError] = useState<string | null>(null);
	const streamRef = useRef<MediaStream | null>(null);
	const videoElementRef = useRef<HTMLVideoElement | null>(null);

	useEffect(() => {
		const stopPreview = () => {
			if (streamRef.current) {
				streamRef.current.getTracks().forEach((track) => track.stop());
				streamRef.current = null;
			}
			if (videoElementRef.current) {
				videoElementRef.current.srcObject = null;
			}
		};

		const startPreview = async () => {
			stopPreview();
			setStatus("loading");
			setError(null);

			if (!navigator.mediaDevices?.getUserMedia) {
				setStatus("error");
				setError("Camera preview is not supported in this browser.");
				return;
			}

			if (!hasCameraDevices) {
				setStatus("no_device");
				setError("No camera devices were detected.");
				return;
			}

			try {
				const preset = getQualityPreset(
					"camera",
					resolveQualitySetting("camera", cameraQuality, recommendation)
				);
				const captureOptions = getCameraCaptureOptions(selectedCameraId, preset);
				const resolution = captureOptions.resolution;

				const stream = await navigator.mediaDevices.getUserMedia({
					video: {
						deviceId: captureOptions.deviceId,
						facingMode: captureOptions.facingMode,
						width: resolution?.width,
						height: resolution?.height,
						frameRate: resolution?.frameRate,
					},
					audio: false,
				});

				streamRef.current = stream;

				if (videoElementRef.current) {
					videoElementRef.current.srcObject = stream;
					await videoElementRef.current.play().catch(() => undefined);
				}

				setStatus("ready");
			} catch (rawError) {
				const mediaError = rawError as DOMException;
				if (mediaError?.name === "NotAllowedError") {
					setStatus("denied");
					setError("Camera permission denied.");
					return;
				}
				if (
					mediaError?.name === "NotFoundError" ||
					mediaError?.name === "OverconstrainedError"
				) {
					setStatus("not_found");
					setError("Selected camera is unavailable.");
					return;
				}

				setStatus("error");
				setError("Could not start camera preview.");
			}
		};

		void startPreview();

		return () => {
			stopPreview();
		};
	}, [selectedCameraId, cameraQuality, recommendation, hasCameraDevices]);

	return {
		status,
		error,
		videoElementRef,
	};
}
