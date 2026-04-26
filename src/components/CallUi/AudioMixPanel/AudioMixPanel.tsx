import styles from "./AudioMixPanel.module.css";
import { ParticipantVolumeRow } from "./ParticipantVolumeRow";

export interface AudioMixParticipantItem {
	identity: string;
	displayName: string;
	avatarUrl: string | null;
	avatarLabel: string;
	micAvailable: boolean;
	streamAvailable: boolean;
	micVolume: number;
	streamVolume: number;
}

interface AudioMixPanelProps {
	participants: AudioMixParticipantItem[];
	hasAnyRemoteAudioTracks: boolean;
	onMicVolumeChange: (participantIdentity: string, value: number) => void;
	onMicReset: (participantIdentity: string) => void;
	onStreamVolumeChange: (participantIdentity: string, value: number) => void;
	onStreamReset: (participantIdentity: string) => void;
}

export function AudioMixPanel({
	participants,
	hasAnyRemoteAudioTracks,
	onMicVolumeChange,
	onMicReset,
	onStreamVolumeChange,
	onStreamReset,
}: AudioMixPanelProps) {
	if (participants.length === 0) {
		return <div className={styles["empty"]}>No remote participants yet.</div>;
	}

	if (!hasAnyRemoteAudioTracks) {
		return <div className={styles["empty"]}>Remote audio tracks are not available yet.</div>;
	}

	return (
		<div className={styles["panel"]}>
			<div className={styles["title"]}>Participant volume</div>
			{participants.map((participant) => (
				<div key={participant.identity} className={styles["participant"]}>
					<div className={styles["header"]}>
						<div className={styles["avatar"]}>
							{participant.avatarUrl ? (
								<img src={participant.avatarUrl} alt={`${participant.displayName} avatar`} className={styles["avatarImage"]} />
							) : (
								<span>{participant.avatarLabel}</span>
							)}
						</div>
						<div className={styles["name"]} title={participant.displayName}>{participant.displayName}</div>
					</div>
					<ParticipantVolumeRow
						source="microphone"
						value={participant.micVolume}
						disabled={!participant.micAvailable}
						onChange={(value) => onMicVolumeChange(participant.identity, value)}
						onReset={() => onMicReset(participant.identity)}
					/>
					{participant.streamAvailable && (
						<ParticipantVolumeRow
							source="screenShareAudio"
							value={participant.streamVolume}
							onChange={(value) => onStreamVolumeChange(participant.identity, value)}
							onReset={() => onStreamReset(participant.identity)}
						/>
					)}
				</div>
			))}
		</div>
	);
}
