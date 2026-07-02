import { MonitorUp, Mic, MicOff } from "lucide-react";
import { VideoTrack } from "@livekit/components-react";
import { useSelector } from "react-redux";
import { StringToColor } from "../../utils/stringHelpers";
import styles from "./CallUi.module.css";
import type { CallParticipantTileProps } from "./CallParticipantTile.props";
import type { RootState } from "../../store/store";
import { resolveMediaUrl } from "../../utils/mediaUrl";

export function CallParticipantTile({
	participant,
	videoTrack,
	avatarUrl,
	displayName,
	className,
	isScreenShareCard = false,
	isFocused = false,
	onOpenFocus,
	onContextMenu,
}: CallParticipantTileProps) {
	const { voiceActivityThreshold, isAutoInputSensitivity } = useSelector(
		(state: RootState) => state.device
	);
	const identity = displayName || participant.name || "Участник";
	const avatarLabel = identity.slice(0, 1).toUpperCase();
	const avatarBg = StringToColor(identity);
	const resolvedAvatarUrl = resolveMediaUrl(avatarUrl);
	const micEnabled = participant.isMicrophoneEnabled;
	const localThreshold = (isAutoInputSensitivity ? 30 : voiceActivityThreshold) / 100;
	// На карточке трансляции не подсвечиваем речь: это экран, а не участник.
	const isSpeaking = isScreenShareCard
		? false
		: participant.isLocal
			? participant.audioLevel >= localThreshold
			: participant.isSpeaking;
	const hasVideo = Boolean(videoTrack);
	const isClickable = hasVideo && Boolean(onOpenFocus);

	return (
		<button
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
					<VideoTrack trackRef={videoTrack} />
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
