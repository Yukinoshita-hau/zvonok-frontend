import { MonitorUp, Mic, MicOff } from "lucide-react";
import { VideoTrack } from "@livekit/components-react";
import { useSelector } from "react-redux";
import { StringToColor } from "../../utils/stringHelpers";
import styles from "./CallUi.module.css";
import type { CallParticipantTileProps } from "./CallParticipantTile.props";
import type { RootState } from "../../store/store";

export function CallParticipantTile({
	participant,
	videoTrack,
	avatarUrl,
	className,
	isScreenSharing = false,
	isScreenShareSelected = false,
	onOpenScreenShare,
}: CallParticipantTileProps) {
	const { voiceActivityThreshold, isAutoInputSensitivity } = useSelector(
		(state: RootState) => state.device
	);
	const identity = participant.name || "Unknown";
	const avatarLabel = identity.slice(0, 1).toUpperCase();
	const avatarBg = StringToColor(identity);
	const micEnabled = participant.isMicrophoneEnabled;
	const localThreshold = (isAutoInputSensitivity ? 30 : voiceActivityThreshold) / 100;
	const isSpeaking = participant.isLocal
		? participant.audioLevel >= localThreshold
		: participant.isSpeaking;
	const isClickableScreenShare = isScreenSharing && onOpenScreenShare;

	return (
		<button
			type="button"
			disabled={!isClickableScreenShare}
			onClick={isClickableScreenShare ? onOpenScreenShare : undefined}
			className={[
				className,
				styles["participant-card"],
				isSpeaking ? styles["participant-speaking"] : "",
				isScreenSharing ? styles["participant-screen-sharing"] : "",
				isScreenShareSelected ? styles["participant-screen-selected"] : "",
				isClickableScreenShare ? styles["participant-clickable"] : "",
			].join(" ")}
			title={isScreenSharing ? `Open ${identity}'s screen share` : undefined}
		>
			<div className={styles["media"]}>
				{videoTrack ? (
					<VideoTrack trackRef={videoTrack} />
				) : isScreenSharing ? (
					<div
						className={styles["screen-share-placeholder"]}
						style={!avatarUrl ? { backgroundColor: avatarBg } : undefined}
					>
						{avatarUrl && (
							<img
								className={styles["screen-share-avatar-image"]}
								src={avatarUrl}
								crossOrigin="anonymous"
								alt={`${identity} avatar`}
							/>
						)}
						<div className={styles["screen-share-overlay"]}>
							<MonitorUp size={22} />
							<span>Показывает экран</span>
							<small>Нажмите, чтобы открыть</small>
						</div>
					</div>
				) : (
					<div
						className={styles["avatar-fallback"]}
						style={!avatarUrl ? { backgroundColor: avatarBg } : undefined}
					>
						{avatarUrl ? (
							<img
								className={styles["avatar-image"]}
								src={avatarUrl}
								crossOrigin="anonymous"
								alt={`${identity} avatar`}
							/>
						) : (
							<span className={styles["avatar-initial"]}>{avatarLabel}</span>
						)}
					</div>
				)}
			</div>

			{isScreenSharing && videoTrack && (
				<div className={styles["screen-share-badge"]}>
					<MonitorUp size={12} />
				</div>
			)}

			<div
				className={`${styles["mic-indicator"]} ${
					micEnabled ? styles["mic-indicator-on"] : styles["mic-indicator-off"]
				}`}
				title={micEnabled ? "Microphone is enabled" : "Microphone is muted"}
			>
				{micEnabled ? <Mic size={10} /> : <MicOff size={10} />}
			</div>

			<div className={styles["name"]}>{identity}</div>
		</button>
	);
}
