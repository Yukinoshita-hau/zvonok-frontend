import { useCallback, useEffect, useRef, useState } from "react";
import type { RecorderStatus } from "./useVoiceRecorder";

const MAX_VIDEO_NOTE_DURATION_MS = 60 * 1000;
const MAX_VIDEO_NOTE_SIZE_BYTES = 5 * 1024 * 1024;
const VIDEO_NOTE_SIZE_LABEL = "5 MB";
const VIDEO_NOTE_WIDTH = 360;
const VIDEO_NOTE_HEIGHT = 360;
const VIDEO_NOTE_FRAME_RATE = 24;
const VIDEO_NOTE_BITS_PER_SECOND = 560_000;
const VIDEO_NOTE_AUDIO_BITS_PER_SECOND = 64_000;
const VIDEO_NOTE_VIDEO_BITS_PER_SECOND = 480_000;

function getSupportedVideoMimeType(): string {
	const preferredTypes = ["video/webm;codecs=vp8,opus", "video/webm"];

	return preferredTypes.find((type) => MediaRecorder.isTypeSupported(type)) ?? "";
}

function stopTracks(stream: MediaStream | null) {
	stream?.getTracks().forEach((track) => track.stop());
}

function createVideoNoteFile(blob: Blob): File {
	return new File([blob], `video-note-${Date.now()}.webm`, {
		type: "video/webm",
		lastModified: Date.now(),
	});
}

export function useVideoNoteRecorder() {
	const [status, setStatus] = useState<RecorderStatus>("idle");
	const [durationMs, setDurationMs] = useState(0);
	const [file, setFile] = useState<File | null>(null);
	const [previewUrl, setPreviewUrl] = useState<string | null>(null);
	const [liveStream, setLiveStream] = useState<MediaStream | null>(null);
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
		setLiveStream(null);
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
			setError("Браузер не поддерживает запись видео.");
			return;
		}

		reset();
		pendingStopRef.current = false;

		try {
			discardStopRef.current = false;
			const mimeType = getSupportedVideoMimeType();
			const stream = await navigator.mediaDevices.getUserMedia({
				audio: true,
				video: {
					width: { ideal: VIDEO_NOTE_WIDTH, max: VIDEO_NOTE_WIDTH },
					height: { ideal: VIDEO_NOTE_HEIGHT, max: VIDEO_NOTE_HEIGHT },
					frameRate: { ideal: VIDEO_NOTE_FRAME_RATE, max: VIDEO_NOTE_FRAME_RATE },
					facingMode: "user",
				},
			});
			const recorder = new MediaRecorder(stream, {
				...(mimeType ? { mimeType } : {}),
				audioBitsPerSecond: VIDEO_NOTE_AUDIO_BITS_PER_SECOND,
				videoBitsPerSecond: VIDEO_NOTE_VIDEO_BITS_PER_SECOND,
				bitsPerSecond: VIDEO_NOTE_BITS_PER_SECOND,
			});

			streamRef.current = stream;
			setLiveStream(stream);
			recorderRef.current = recorder;
			chunksRef.current = [];
			startedAtRef.current = Date.now();

			recorder.ondataavailable = (event) => {
				if (event.data.size > 0) chunksRef.current.push(event.data);
			};

			recorder.onerror = () => {
				setStatus("error");
				setError("Не удалось записать видео-кружок.");
			};

			recorder.onstop = () => {
				clearTimers();
				stopTracks(streamRef.current);
				streamRef.current = null;
				setLiveStream(null);
				recorderRef.current = null;

				if (discardStopRef.current) {
					discardStopRef.current = false;
					chunksRef.current = [];
					return;
				}

				const blob = new Blob(chunksRef.current, { type: "video/webm" });
				const nextDuration = Math.max(0, Date.now() - startedAtRef.current);
				setDurationMs(nextDuration);
				chunksRef.current = [];

				if (blob.size > MAX_VIDEO_NOTE_SIZE_BYTES) {
					setStatus("error");
					setError(`Видео-кружок больше ${VIDEO_NOTE_SIZE_LABEL}. Запишите короче.`);
					return;
				}

				const nextFile = createVideoNoteFile(blob);
				const nextPreviewUrl = URL.createObjectURL(nextFile);
				previewUrlRef.current = nextPreviewUrl;
				setFile(nextFile);
				setPreviewUrl(nextPreviewUrl);
				setStatus("stopped");
			};

			recorder.start(250);
			setStatus("recording");

			if (pendingStopRef.current) {
				pendingStopRef.current = false;
				recorder.stop();
				return;
			}

			timerRef.current = window.setInterval(() => {
				setDurationMs(Date.now() - startedAtRef.current);
			}, 250);
			stopTimerRef.current = window.setTimeout(stop, MAX_VIDEO_NOTE_DURATION_MS);
		} catch {
			stopTracks(streamRef.current);
			streamRef.current = null;
			setLiveStream(null);
			setStatus("error");
			setError("Нет доступа к камере или микрофону.");
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
		liveStream,
		error,
		start,
		stop,
		cancel,
		reset,
	};
}
