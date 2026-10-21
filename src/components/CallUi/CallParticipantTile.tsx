import { MonitorUp, Mic, MicOff, Pin } from "lucide-react";
import { VideoTrack } from "@livekit/components-react";
import { useSelector } from "react-redux";
import { StringToColor } from "../../utils/stringHelpers";
import styles from "./CallUi.module.css";
import type { CallParticipantTileProps } from "./CallParticipantTile.props";
import type { RootState } from "../../store/store";
import { resolveMediaUrl } from "../../utils/mediaUrl";
import { mediaDiagnostic } from "./MediaDiagnostics";
import { mediaAspectRatio } from "./adaptiveLayout";
import type { SyntheticEvent } from "react";
import { useParticipantSpeaking } from "./hooks/useParticipantSpeaking";

export function CallParticipantTile({
	participant,
	videoTrack,
	avatarUrl,
	displayName,
	className,
	style,
	cardId,
	onAspectRatio,
	onVideoDimensions,
	isScreenShareCard = false,
	isFocused = false,
	onOpenFocus,
	onContextMenu,
}: CallParticipantTileProps) {
	const { voiceActivityThreshold, isAutoInputSensitivity } = useSelector(
		(state: RootState) => state.device
	);
	const pinned = useSelector((state: RootState) => !isScreenShareCard && state.call.pinnedParticipant === participant.identity);
	const identity = displayName || participant.name || "Участник";
	const avatarLabel = identity.slice(0, 1).toUpperCase();
	const avatarBg = StringToColor(identity);
	const resolvedAvatarUrl = resolveMediaUrl(avatarUrl);
	const micEnabled = participant.isMicrophoneEnabled;
	const localThreshold = (isAutoInputSensitivity ? 30 : voiceActivityThreshold) / 100;
	// На карточке трансляции не подсвечиваем речь: это экран, а не участник.
	const speaking = useParticipantSpeaking(participant, localThreshold);
	const isSpeaking = !isScreenShareCard && speaking;
	const hasVideo = Boolean(videoTrack);
	const isClickable = Boolean(onOpenFocus);
	const updateAspectRatio = (event: SyntheticEvent<HTMLVideoElement>) => {
		const video = event.currentTarget;
		mediaDiagnostic("video.state", { participantId: participant.identity, trackSid: videoTrack?.publication.trackSid,
      muted: videoTrack?.publication.isMuted, subscribed: videoTrack?.publication.isSubscribed,
      streamState: videoTrack?.publication.track?.streamState, event: event.type, readyState: video.readyState,
      width: video.videoWidth, height: video.videoHeight, currentTime: video.currentTime, timestamp: Date.now() });
    const ratio = mediaAspectRatio(video.videoWidth, video.videoHeight);
		if (ratio) onVideoDimensions?.(video.videoWidth, video.videoHeight);
		if (ratio && cardId) onAspectRatio?.(cardId, ratio);
	};

	return (
		<button
			style={style}
			data-card-id={cardId}
			data-speaking={isSpeaking}
			data-pinned={pinned}
			type="button"
			onClick={isClickable ? onOpenFocus : undefined}
			onContextMenu={onContextMenu}
			className={[
				className,
				styles["participant-card"],
				isSpeaking ? styles["participant-speaking"] : "",
				isScreenShareCard ? styles["participant-screen-sharing"] : "",
				isFocused ? styles["participant-screen-selected"] : "",
				isClickable ? styles["participant-clickable"] : "",
			].join(" ")}
			title={
				isScreenShareCard
					? `Открыть трансляцию ${participant.name || participant.identity}`
					: hasVideo
						? `Открыть видео ${participant.name || participant.identity}`
						: undefined
			}
		>
			<div className={styles["media"]}>
				{videoTrack ? (
					// A same-SID replacement can stay subscribed without notifying the SDK media observer.
					<VideoTrack key={videoTrack.publication.track?.mediaStreamTrack.id ?? "pending"} trackRef={videoTrack} onLoadedMetadata={updateAspectRatio} onResize={updateAspectRatio} onPlaying={updateAspectRatio} onEmptied={updateAspectRatio} onWaiting={updateAspectRatio} />
				) : (
					<div
						className={styles["avatar-fallback"]}
						style={!resolvedAvatarUrl ? { backgroundColor: avatarBg } : undefined}
					>
						{resolvedAvatarUrl ? (
							<img
								className={styles["avatar-image"]}
								src={resolvedAvatarUrl}
								alt={`Аватар ${identity}`}
							/>
						) : (
							<span className={styles["avatar-initial"]}>{avatarLabel}</span>
						)}
					</div>
				)}
			</div>

			{isScreenShareCard && (
				<div className={styles["screen-share-badge"]}>
					<MonitorUp size={12} />
				</div>
			)}
			{pinned && <span className={styles["person-pin-badge"]} title="Участник закреплён"><Pin size={12} aria-label="Закреплён" /></span>}

			{!isScreenShareCard && (
				<div
					className={`${styles["mic-indicator"]} ${
						micEnabled ? styles["mic-indicator-on"] : styles["mic-indicator-off"]
					}`}
					title={micEnabled ? "Микрофон включён" : "Микрофон выключен"}
				>
					{micEnabled ? <Mic size={10} /> : <MicOff size={10} />}
				</div>
			)}

			<div className={styles["name"]}>{identity}</div>
		</button>
	);
}
