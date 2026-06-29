import { useCallback, useEffect, useRef, useState } from "react";

export type RecorderStatus = "idle" | "recording" | "stopped" | "error";

const MAX_VOICE_DURATION_MS = 5 * 60 * 1000;
const MAX_VOICE_SIZE_BYTES = 25 * 1024 * 1024;

function getSupportedAudioMimeType(): string {
	const preferredTypes = ["audio/webm;codecs=opus", "audio/webm"];

	return preferredTypes.find((type) => MediaRecorder.isTypeSupported(type)) ?? "";
}

function stopTracks(stream: MediaStream | null) {
	stream?.getTracks().forEach((track) => track.stop());
}

function createAudioFile(blob: Blob): File {
	const extension = blob.type.includes("webm") ? "webm" : "audio";
	return new File([blob], `voice-${Date.now()}.${extension}`, {
		type: blob.type || "audio/webm",
		lastModified: Date.now(),
	});
}

export function useVoiceRecorder() {
	const [status, setStatus] = useState<RecorderStatus>("idle");
	const [durationMs, setDurationMs] = useState(0);
	const [file, setFile] = useState<File | null>(null);
	const [previewUrl, setPreviewUrl] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);

	const recorderRef = useRef<MediaRecorder | null>(null);
	const streamRef = useRef<MediaStream | null>(null);
	const chunksRef = useRef<BlobPart[]>([]);
	const startedAtRef = useRef(0);
	const timerRef = useRef<number | null>(null);
	const stopTimerRef = useRef<number | null>(null);
	const previewUrlRef = useRef<string | null>(null);
	const discardStopRef = useRef(false);
	const pendingStopRef = useRef(false);

	const revokePreview = useCallback(() => {
		if (previewUrlRef.current) {
			URL.revokeObjectURL(previewUrlRef.current);
			previewUrlRef.current = null;
		}
		setPreviewUrl(null);
	}, []);

	const clearTimers = useCallback(() => {
		if (timerRef.current != null) window.clearInterval(timerRef.current);
		if (stopTimerRef.current != null) window.clearTimeout(stopTimerRef.current);
		timerRef.current = null;
		stopTimerRef.current = null;
	}, []);

	const reset = useCallback(() => {
		clearTimers();
		revokePreview();
		pendingStopRef.current = false;
		setStatus("idle");
		setDurationMs(0);
		setFile(null);
		setError(null);
		chunksRef.current = [];
	}, [clearTimers, revokePreview]);

	const cancel = useCallback(() => {
		const recorder = recorderRef.current;
		discardStopRef.current = true;
		pendingStopRef.current = false;
		if (recorder?.state === "recording") recorder.stop();
		recorderRef.current = null;
		stopTracks(streamRef.current);
		streamRef.current = null;
		reset();
	}, [reset]);

	const stop = useCallback(() => {
		const recorder = recorderRef.current;
		if (recorder?.state === "recording") {
			recorder.stop();
			return;
		}

		pendingStopRef.current = true;
	}, []);

	const start = useCallback(async () => {
		if (!("MediaRecorder" in window)) {
			setStatus("error");
			setError("Браузер не поддерживает запись аудио.");
			return;
		}

		reset();
		pendingStopRef.current = false;

		try {
			discardStopRef.current = false;
			const mimeType = getSupportedAudioMimeType();
			const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
			const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);

			streamRef.current = stream;
			recorderRef.current = recorder;
			chunksRef.current = [];
			startedAtRef.current = Date.now();

			recorder.ondataavailable = (event) => {
				if (event.data.size > 0) chunksRef.current.push(event.data);
			};

			recorder.onerror = () => {
				setStatus("error");
				setError("Не удалось записать голосовое сообщение.");
			};

			recorder.onstop = () => {
				clearTimers();
				stopTracks(streamRef.current);
				streamRef.current = null;
				recorderRef.current = null;

				if (discardStopRef.current) {
					discardStopRef.current = false;
					chunksRef.current = [];
					return;
				}

				const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
				const nextDuration = Math.max(0, Date.now() - startedAtRef.current);
				setDurationMs(nextDuration);
				chunksRef.current = [];

				if (blob.size > MAX_VOICE_SIZE_BYTES) {
					setStatus("error");
					setError("Голосовое сообщение больше 25 MB.");
					return;
				}

				const nextFile = createAudioFile(blob);
				const nextPreviewUrl = URL.createObjectURL(nextFile);
				previewUrlRef.current = nextPreviewUrl;
				setFile(nextFile);
				setPreviewUrl(nextPreviewUrl);
				setStatus("stopped");
			};

			recorder.start();
			setStatus("recording");

			if (pendingStopRef.current) {
				pendingStopRef.current = false;
				recorder.stop();
				return;
			}

			timerRef.current = window.setInterval(() => {
				setDurationMs(Date.now() - startedAtRef.current);
			}, 250);
			stopTimerRef.current = window.setTimeout(stop, MAX_VOICE_DURATION_MS);
		} catch {
			stopTracks(streamRef.current);
			streamRef.current = null;
			setStatus("error");
			setError("Нет доступа к микрофону.");
		}
	}, [clearTimers, reset, stop]);

	useEffect(() => {
		return () => {
			cancel();
		};
	}, [cancel]);

	return {
		status,
		durationMs,
		file,
		previewUrl,
		error,
		start,
		stop,
		cancel,
		reset,
	};
}
