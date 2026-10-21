import { parseWaveform } from "../../utils/parseWaveform";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { FileArchive, FileText, ImageOff, Mic, Pause, Play } from "lucide-react";
import { messageAttachmentsApi } from "../../api/messageAttachmentsApi";
import type { MessageAttachment } from "../../api/interfaces/MessageAttachmentDtos";
import { resolveAttachmentUrl } from "../../utils/messageAttachmentMediaUrl";
import { StreamingAttachment } from "./StreamingAttachment";
import { attachmentMedia } from "./playback";
import { MediaLightbox } from "./MediaLightbox";
import styles from "./MessageAttachments.module.css";
import viewerStyles from './AttachmentViewer.module.css';
const AttachmentViewer = lazy(() => import('./AttachmentViewer'));

interface MessageAttachmentsProps {
	attachments?: MessageAttachment[] | null;
	author?: string;
	date?: string;
}

export function MessageAttachments({ attachments, author, date }: MessageAttachmentsProps) {
	const [viewerIndex, setViewerIndex] = useState<number | null>(null);
	const [lightboxImage, setLightboxImage] = useState<{
		src: string;
		alt: string;
	} | null>(null);
	const safeAttachments = attachments ?? [];
	const viewerAttachments = safeAttachments;

	if (safeAttachments.length === 0) return null;

	return (
		<>
			<div className={styles["message-attachments"]}>
				{safeAttachments.map((attachment) => viewerIndex !== null || attachment.type === 'FILE' || (attachment.type === 'IMAGE' && import.meta.env.VITE_PRIVATE_MEDIA_STREAMING === 'true') ? (
					<button key={attachment.id} className={viewerStyles.card} onClick={() => setViewerIndex(viewerAttachments.indexOf(attachment))}>
						{attachment.contentType === 'application/zip' ? <FileArchive size={22} aria-hidden="true" /> : <FileText size={22} aria-hidden="true" />}
						<span>{attachment.originalFileName || 'Вложение'}</span>
						<small>{attachment.contentType || 'Файл'} · {Math.ceil((attachment.sizeBytes || 0) / 1024)} КиБ · Открыть</small>
					</button>
				) : (
					<MessageAttachmentItem
						key={attachment.id}
						attachment={attachment}
						onOpenImage={(src, alt) => setLightboxImage({ src, alt })}
					/>
				))}
			</div>
			{viewerIndex !== null && <Suspense fallback={<p role="status">Загрузка просмотрщика…</p>}><AttachmentViewer attachments={viewerAttachments} initial={viewerIndex} author={author} date={date} onClose={() => setViewerIndex(null)} /></Suspense>}

			{lightboxImage && (
				<MediaLightbox
					src={lightboxImage.src}
					alt={lightboxImage.alt}
					onClose={() => setLightboxImage(null)}
				/>
			)}
		</>
	);
}

interface MessageAttachmentItemProps {
	attachment: MessageAttachment;
	onOpenImage: (src: string, alt: string) => void;
}

function MessageAttachmentItem(props: MessageAttachmentItemProps) {
 const type = props.attachment.type;
 if (import.meta.env.VITE_PRIVATE_MEDIA_STREAMING === 'true' &&
     (type === 'VIDEO' || type === 'VIDEO_NOTE' || type === 'AUDIO')) {
   return <StreamingAttachment {...props} />;
 }
 return <LegacyAttachmentItem {...props} />;
}

function LegacyAttachmentItem({
	attachment,
	onOpenImage,
}: MessageAttachmentItemProps) {
	const itemRef = useRef<HTMLDivElement>(null);
	const [visible, setVisible] = useState(false);
	const [requested, setRequested] = useState(false);
	const needsRequest =
		attachment.type === "VIDEO" || attachment.type === "VIDEO_NOTE";
	useEffect(() => {
		const element = itemRef.current;
		if (!element) return;
		const observer = new IntersectionObserver(
			(entries) => {
				if (entries.some((entry) => entry.isIntersecting)) {
					setVisible(true);
					observer.disconnect();
				}
			},
			{ rootMargin: "200px" },
		);
		observer.observe(element);
		return () => observer.disconnect();
	}, []);
	const [objectUrl, setObjectUrl] = useState<string>("");
	const [isError, setIsError] = useState(false);
	const [mediaError, setMediaError] = useState(false);
	const sourceUrl = resolveAttachmentUrl(
		attachment.downloadUrl ?? attachment.url,
	);

	useEffect(() => {
		if (!sourceUrl || !visible || (needsRequest && !requested)) return;

		let cancelled = false;
		let nextObjectUrl = "";

		const loadAttachment = async () => {
			setIsError(false);
			setMediaError(false);

			try {
				if (sourceUrl.startsWith("blob:") || sourceUrl.startsWith("data:")) {
					setObjectUrl(sourceUrl);
					return;
				}

				const blob =
					await messageAttachmentsApi.downloadAttachmentBlob(sourceUrl);
				if (cancelled) return;

				nextObjectUrl = URL.createObjectURL(blob);
				setObjectUrl(nextObjectUrl);
			} catch {
				if (!cancelled) setIsError(true);
			}
		};

		void loadAttachment();

		return () => {
			cancelled = true;
			if (nextObjectUrl) URL.revokeObjectURL(nextObjectUrl);
		};
	}, [sourceUrl, visible, needsRequest, requested]);

	if (!sourceUrl || isError) {
		return (
			<div className={styles["attachment-error"]}>
				<ImageOff size={18} />
				<span>{attachment.originalFileName}</span>
			</div>
		);
	}

	if (!objectUrl) {
		return (
			<div ref={itemRef} className={styles["attachment-loading"]} role="status">
				{needsRequest && !requested ? (
					<button
						className={styles["load-media"]}
						onClick={() => setRequested(true)}
					>
						<Play size={18} /> Загрузить видео ·{" "}
						{Math.ceil(attachment.sizeBytes / 1024)} КБ
					</button>
				) : (
					<span>Загрузка…</span>
				)}
				<span>{attachment.originalFileName}</span>
			</div>
		);
	}

	const fileLink = (
		<a
			className={styles["file-attachment"]}
			href={objectUrl}
			download={attachment.originalFileName}
		>
			<span title={attachment.originalFileName}>
				{attachment.originalFileName}
			</span>
			<small>
				{attachment.contentType} · {Math.ceil(attachment.sizeBytes / 1024)} КБ ·
				Скачать
			</small>
		</a>
	);
	if (attachment.type === "IMAGE") {
		return (
			<>
				<button
					type="button"
					className={styles["image-attachment"]}
					onClick={() => onOpenImage(objectUrl, attachment.originalFileName)}
				>
					<img
						src={objectUrl}
						alt={attachment.originalFileName}
						loading="lazy"
						width={attachment.width ?? undefined}
						height={attachment.height ?? undefined}
					/>
				</button>
				{fileLink}
			</>
		);
	}

	if (attachment.type === "AUDIO") {
		return (
			<>
				<VoiceMessagePlayer attachment={attachment} src={objectUrl} />
				{fileLink}
			</>
		);
	}

	if (attachment.type === "VIDEO_NOTE") {
		return (
			<>
				<VideoNotePlayer
					attachment={attachment}
					src={objectUrl}
					isError={mediaError}
					onError={() => setMediaError(true)}
				/>
				{fileLink}
			</>
		);
	}

	return (
		<div className={styles["video-attachment"]}>
			<LegacyVideo src={objectUrl} />
			{fileLink}
		</div>
	);
}

function LegacyVideo({ src }: { src: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    return attachmentMedia.register(video);
  }, [src]);
  return <video ref={ref} src={src} controls preload="metadata" onPlay={event => attachmentMedia.activate(event.currentTarget)} />;
}

interface MediaPlayerProps {
	attachment: MessageAttachment;
	src: string;
}

function VoiceMessagePlayer({ attachment, src }: MediaPlayerProps) {
	const audioRef = useRef<HTMLAudioElement | null>(null);
	const fallbackDuration = getAttachmentDurationSeconds(attachment);
	const [isPlaying, setIsPlaying] = useState(false);
	const [currentTime, setCurrentTime] = useState(0);
	const [duration, setDuration] = useState(fallbackDuration);
	const waveformBars = normalizeWaveformBars(attachment.waveform) ?? DEFAULT_VOICE_WAVEFORM_BARS;
	const progress = getProgressPercent(currentTime, duration);
	const rangeStyle = { "--progress": `${progress}%` } as CSSProperties;

 useEffect(() => {
   const audio = audioRef.current;
   if (!audio) return;
   return attachmentMedia.register(audio);
 }, [src]);

	const togglePlayback = async () => {
		const audio = audioRef.current;
		if (!audio) return;

		if (audio.paused) {
			try {
				await audio.play();
				setIsPlaying(true);
			} catch {
				setIsPlaying(false);
			}
			return;
		}

		audio.pause();
		setIsPlaying(false);
	};

	const seek = (value: string) => {
		const nextTime = Number(value);
		const audio = audioRef.current;
		if (!audio || Number.isNaN(nextTime)) return;

		audio.currentTime = nextTime;
		setCurrentTime(nextTime);
	};

	return (
		<div className={styles["voice-attachment"]}>
			<button
				type="button"
				className={styles["voice-play-button"]}
				onClick={togglePlayback}
				aria-label={
					isPlaying ? "Поставить голосовое на паузу" : "Воспроизвести голосовое"
				}
				title={isPlaying ? "Пауза" : "Воспроизвести"}
			>
				{isPlaying ? <Pause size={18} /> : <Play size={18} />}
			</button>

			<div className={styles["voice-content"]}>
				<div className={styles["voice-meta"]}>
					<span className={styles["voice-title"]}>
						<Mic size={13} />
						Голосовое
					</span>
					<span className={styles["voice-time"]}>
						{formatMediaTime(currentTime || duration)}
					</span>
				</div>

				<div className={styles["voice-waveform"]}>
					<div className={styles["voice-wave-bars"]} aria-hidden="true">
						{waveformBars.map((height, index) => (
							<span
								key={`${height}-${index}`}
								className={styles["voice-wave-bar"]}
								style={{ height: `${height}px` }}
							/>
						))}
					</div>
					<input
						className={`${styles["media-range"]} ${styles["voice-range"]}`}
						type="range"
						min="0"
						max={Math.max(duration, 0.1)}
						step="0.1"
						value={Math.min(currentTime, duration || currentTime)}
						style={rangeStyle}
						onChange={(event) => seek(event.target.value)}
						aria-label="Перемотать голосовое сообщение"
					/>
					<div
						className={styles["voice-wave-progress"]}
						style={rangeStyle}
						aria-hidden="true"
					>
						{waveformBars.map((height, index) => (
							<span
								key={`active-${height}-${index}`}
								className={styles["voice-wave-bar"]}
								style={{ height: `${height}px` }}
							/>
						))}
					</div>
				</div>
			</div>

			<audio
				ref={audioRef}
				src={src}
				preload="metadata"
				onLoadedMetadata={(event) => {
					const nextDuration = event.currentTarget.duration;
					if (Number.isFinite(nextDuration)) setDuration(nextDuration);
				}}
				onTimeUpdate={(event) =>
					setCurrentTime(event.currentTarget.currentTime)
				}
				onPause={() => setIsPlaying(false)}
				onPlay={(event) => { attachmentMedia.activate(event.currentTarget); setIsPlaying(true); }}
				onEnded={() => {
					setIsPlaying(false);
					setCurrentTime(0);
				}}
			/>
		</div>
	);
}

interface VideoNotePlayerProps extends MediaPlayerProps {
	isError: boolean;
	onError: () => void;
}

function VideoNotePlayer({
	attachment,
	src,
	isError,
	onError,
}: VideoNotePlayerProps) {
	const videoRef = useRef<HTMLVideoElement | null>(null);
 useEffect(() => {
   const video = videoRef.current;
   if (!video) return;
   return attachmentMedia.register(video);
 }, [src]);
	const fallbackDuration = getAttachmentDurationSeconds(attachment);
	const [isPlaying, setIsPlaying] = useState(false);
	const [currentTime, setCurrentTime] = useState(0);
	const [duration, setDuration] = useState(fallbackDuration);
	const progress = getProgressPercent(currentTime, duration);
	const rangeStyle = { "--progress": `${progress}%` } as CSSProperties;

	const togglePlayback = async () => {
		const video = videoRef.current;
		if (!video) return;

		if (video.paused) {
			try {
				await video.play();
				setIsPlaying(true);
			} catch {
				setIsPlaying(false);
			}
			return;
		}

		video.pause();
		setIsPlaying(false);
	};

	const seek = (value: string) => {
		const nextTime = Number(value);
		const video = videoRef.current;
		if (!video || Number.isNaN(nextTime)) return;

		video.currentTime = nextTime;
		setCurrentTime(nextTime);
	};

	if (isError) {
		return (
			<div className={styles["video-note-attachment"]}>
				<div className={styles["video-note-error"]}>
					<ImageOff size={18} />
					<span>{attachment.originalFileName}</span>
				</div>
			</div>
		);
	}

	return (
		<div className={styles["video-note-attachment"]}>
			<button
				type="button"
				className={styles["video-note-stage"]}
				onClick={togglePlayback}
				aria-label={
					isPlaying
						? "Поставить видео-кружок на паузу"
						: "Воспроизвести видео-кружок"
				}
				title={isPlaying ? "Пауза" : "Воспроизвести"}
			>
				<video
					ref={videoRef}
					key={src}
					src={src}
					playsInline
					preload="metadata"
					className={styles["video-note-video"]}
					onLoadedMetadata={(event) => {
						const nextDuration = event.currentTarget.duration;
						if (Number.isFinite(nextDuration)) setDuration(nextDuration);
					}}
					onTimeUpdate={(event) =>
						setCurrentTime(event.currentTarget.currentTime)
					}
					onPause={() => setIsPlaying(false)}
					onPlay={(event) => { attachmentMedia.activate(event.currentTarget); setIsPlaying(true); }}
					onEnded={() => {
						setIsPlaying(false);
						setCurrentTime(0);
					}}
					onError={onError}
				/>
				<span className={styles["video-note-shade"]} />
				<span className={styles["video-note-play"]}>
					{isPlaying ? <Pause size={20} /> : <Play size={20} />}
				</span>
				<span className={styles["video-note-time"]}>
					{formatMediaTime(currentTime)} / {formatMediaTime(duration)}
				</span>
			</button>

			<input
				className={`${styles["media-range"]} ${styles["video-note-range"]}`}
				type="range"
				min="0"
				max={Math.max(duration, 0.1)}
				step="0.1"
				value={Math.min(currentTime, duration || currentTime)}
				style={rangeStyle}
				onChange={(event) => seek(event.target.value)}
				aria-label="Перемотать видео-кружок"
			/>
		</div>
	);
}

const DEFAULT_VOICE_WAVEFORM_BARS = [
	8, 12, 16, 10, 20, 14, 9, 18, 15, 24, 13, 17, 22, 10, 14, 20, 12, 23, 16, 8,
	18, 13, 21, 11, 16, 24, 14, 18, 9, 20, 15, 10, 17, 13, 21, 11, 15, 19, 12, 22,
	16, 10,
];
const VOICE_WAVEFORM_BAR_COUNT = 42;

function normalizeWaveformBars(serialized?: string | null) {
	const waveform = parseWaveform(serialized);
	if (!waveform || waveform.length === 0) return null;

	const resampledBars = resampleValues(waveform, VOICE_WAVEFORM_BAR_COUNT);
	const maxPeak = Math.max(
		...resampledBars.map((value) => Math.abs(value)),
		0.01,
	);
	return resampledBars.map((value) =>
		Math.round(6 + (Math.abs(value) / maxPeak) * 18),
	);
}

function resampleValues(values: number[], targetLength: number) {
	if (values.length === targetLength) return values;
	if (targetLength <= 1) return [values[0] ?? 0];

	return Array.from({ length: targetLength }, (_, index) => {
		const sourceIndex = (index / (targetLength - 1)) * (values.length - 1);
		const leftIndex = Math.floor(sourceIndex);
		const rightIndex = Math.min(values.length - 1, leftIndex + 1);
		const ratio = sourceIndex - leftIndex;
		return values[leftIndex] * (1 - ratio) + values[rightIndex] * ratio;
	});
}

function getAttachmentDurationSeconds(attachment: MessageAttachment) {
	return attachment.durationMs ? Math.max(0, attachment.durationMs / 1000) : 0;
}

function getProgressPercent(currentTime: number, duration: number) {
	if (!duration) return 0;
	return Math.min(100, Math.max(0, (currentTime / duration) * 100));
}

function formatMediaTime(seconds: number) {
	if (!Number.isFinite(seconds) || seconds <= 0) return "0:00";

	const rounded = Math.floor(seconds);
	const minutes = Math.floor(rounded / 60);
	const restSeconds = rounded % 60;
	return `${minutes}:${restSeconds.toString().padStart(2, "0")}`;
}
