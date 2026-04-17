import { MonitorUp, Mic, MicOff } from "lucide-react";
import { VideoTrack, type TrackReference } from "@livekit/components-react";
import type { Participant } from "livekit-client";
import { StringToColor } from "../../utils/stringHelpers";
import styles from "./CallUi.module.css";

interface CallParticipantTileProps {
	participant: Participant;
	videoTrack?: TrackReference;
	avatarUrl?: string | null;
	className: string;
	isScreenSharing?: boolean;
	isScreenShareSelected?: boolean;
	onOpenScreenShare?: () => void;
}

export function CallParticipantTile({
	participant,
	videoTrack,
	avatarUrl,
	className,
	isScreenSharing = false,
	isScreenShareSelected = false,
	onOpenScreenShare,
}: CallParticipantTileProps) {
	const identity = participant.identity || "Unknown";
	const avatarLabel = identity.slice(0, 1).toUpperCase();
	const avatarBg = StringToColor(identity);
	const micEnabled = participant.isMicrophoneEnabled;
	const isSpeaking = participant.isSpeaking;
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
					<MonitorUp size={13} />
					<span>Screen</span>
				</div>
			)}

			<div
				className={`${styles["mic-indicator"]} ${
					micEnabled ? styles["mic-indicator-on"] : styles["mic-indicator-off"]
				}`}
				title={micEnabled ? "Microphone is enabled" : "Microphone is muted"}
			>
				{micEnabled ? <Mic size={14} /> : <MicOff size={14} />}
			</div>

			<div className={styles["name"]}>{identity}</div>
		</button>
	);
}
