import { VideoTrack, type TrackReference } from "@livekit/components-react";
import { Mic, MicOff } from "lucide-react";
import type { Participant } from "livekit-client";
import { StringToColor } from "../../utils/stringHelpers";
import styles from "./CallUi.module.css";

interface CallParticipantTileProps {
	participant: Participant;
	videoTrack?: TrackReference;
	avatarUrl?: string | null;
	className: string;
}

export function CallParticipantTile({
	participant,
	videoTrack,
	avatarUrl,
	className,
}: CallParticipantTileProps) {
	const identity = participant.identity || "Unknown";
	const avatarLabel = identity.slice(0, 1).toUpperCase();
	const avatarBg = StringToColor(identity);
	const micEnabled = participant.isMicrophoneEnabled;
	const isSpeaking = participant.isSpeaking;

	return (
		<div
			className={[
				className,
				styles["participant-card"],
				isSpeaking ? styles["participant-speaking"] : "",
			].join(" ")}
		>
			<div className={styles["media"]}>
				{videoTrack ? (
					<VideoTrack trackRef={videoTrack} />
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

			<div
				className={`${styles["mic-indicator"]} ${
					micEnabled ? styles["mic-indicator-on"] : styles["mic-indicator-off"]
				}`}
				title={micEnabled ? "Microphone is enabled" : "Microphone is muted"}
			>
				{micEnabled ? <Mic size={14} /> : <MicOff size={14} />}
			</div>

			<div className={styles["name"]}>{identity}</div>
		</div>
	);
}
