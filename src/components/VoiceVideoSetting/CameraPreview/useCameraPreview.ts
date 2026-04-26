import { useEffect, useMemo, useRef, useState } from "react";
import {
	getCameraCaptureOptions,
	type CallQualityRecommendation,
	type CallQualitySetting,
	getQualityPreset,
	resolveQualitySetting,
} from "../../../utils/callQuality";

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
	const requestIdRef = useRef(0);

	const resolvedCameraQuality = useMemo(
		() => resolveQualitySetting("camera", cameraQuality, recommendation),
		[cameraQuality, recommendation]
	);

	useEffect(() => {
		const stopStream = (stream: MediaStream | null) => {
			if (!stream) return;
			stream.getTracks().forEach((track) => track.stop());
		};

		const detachCurrentVideo = () => {
			const video = videoElementRef.current;
			if (!video) return;
			if (video.srcObject === streamRef.current) {
				video.srcObject = null;
			}
		};

		const startPreview = async () => {
			requestIdRef.current += 1;
			const requestId = requestIdRef.current;

			detachCurrentVideo();
			stopStream(streamRef.current);
			streamRef.current = null;

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
				const preset = getQualityPreset("camera", resolvedCameraQuality);
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

				if (requestId !== requestIdRef.current) {
					stopStream(stream);
					return;
				}

				streamRef.current = stream;
				setStatus("ready");
			} catch (rawError) {
				if (requestId !== requestIdRef.current) return;

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
			requestIdRef.current += 1;
			detachCurrentVideo();
			stopStream(streamRef.current);
			streamRef.current = null;
		};
	}, [selectedCameraId, resolvedCameraQuality, hasCameraDevices]);

	useEffect(() => {
		if (status !== "ready") return;

		const stream = streamRef.current;
		const video = videoElementRef.current;
		if (!stream || !video) return;

		video.srcObject = stream;
		video.muted = true;
		video.playsInline = true;
		void video.play().catch(() => undefined);

		return () => {
			if (video.srcObject === stream) {
				video.srcObject = null;
			}
		};
	}, [status]);

	return {
		status,
		error,
		videoElementRef,
	};
}
