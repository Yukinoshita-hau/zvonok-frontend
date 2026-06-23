import styles from "./ParticipantContextMenu.module.css";
import { ParticipantVolumeMenu } from "./ParticipantVolumeMenu";

interface ParticipantContextMenuProps {
	x: number;
	y: number;
	displayName: string;
	hasScreenShare: boolean;
	hasMicrophoneAudio: boolean;
	hasScreenShareAudio: boolean;
	micVolume: number;
	streamVolume: number;
	onOpenProfile?: () => void;
	onOpenScreenShare: () => void;
	onOpenTheater: () => void;
	onMicChange: (value: number) => void;
	onMicReset: () => void;
	onStreamChange: (value: number) => void;
	onStreamReset: () => void;
}

export function ParticipantContextMenu({
	x,
	y,
	displayName,
	hasScreenShare,
	hasMicrophoneAudio,
	hasScreenShareAudio,
	micVolume,
	streamVolume,
	onOpenProfile,
	onOpenScreenShare,
	onOpenTheater,
	onMicChange,
	onMicReset,
	onStreamChange,
	onStreamReset,
}: ParticipantContextMenuProps) {
	return (
		<div
			className={styles["menu"]}
			style={{ top: y, left: x }}
			role="menu"
			onClick={(event) => event.stopPropagation()}
		>
			<div className={styles["header"]} title={displayName}>{displayName}</div>
			{onOpenProfile && (
				<button type="button" className={styles["item"]} onClick={onOpenProfile}>
					Открыть профиль
				</button>
			)}
			{hasScreenShare && (
				<>
					<button type="button" className={styles["item"]} onClick={onOpenScreenShare}>
						Открыть трансляцию
					</button>
					<button type="button" className={styles["item"]} onClick={onOpenTheater}>
						Открыть кино-режим
					</button>
				</>
			)}
			<div className={styles["divider"]} />
			<ParticipantVolumeMenu
				micVolume={micVolume}
				streamVolume={streamVolume}
				hasMicrophoneAudio={hasMicrophoneAudio}
				hasScreenShareAudio={hasScreenShareAudio}
				onMicChange={onMicChange}
				onMicReset={onMicReset}
				onStreamChange={onStreamChange}
				onStreamReset={onStreamReset}
			/>
		</div>
	);
}
