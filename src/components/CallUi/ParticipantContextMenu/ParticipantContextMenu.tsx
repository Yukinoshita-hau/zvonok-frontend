import styles from "./ParticipantContextMenu.module.css";
import { ParticipantVolumeMenu } from "./ParticipantVolumeMenu";

interface ParticipantContextMenuProps {
	x: number;
	y: number;
	displayName: string;
	hasScreenShare: boolean;
	hasScreenShareAudio: boolean;
	micVolume: number;
	streamVolume: number;
	onOpenProfile: () => void;
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
			<button type="button" className={styles["item"]} onClick={onOpenProfile}>
				Open profile
			</button>
			{hasScreenShare && (
				<>
					<button type="button" className={styles["item"]} onClick={onOpenScreenShare}>
						Open screen share
					</button>
					<button type="button" className={styles["item"]} onClick={onOpenTheater}>
						Open theater mode
					</button>
				</>
			)}
			<div className={styles["divider"]} />
			<ParticipantVolumeMenu
				micVolume={micVolume}
				streamVolume={streamVolume}
				hasScreenShareAudio={hasScreenShareAudio}
				onMicChange={onMicChange}
				onMicReset={onMicReset}
				onStreamChange={onStreamChange}
				onStreamReset={onStreamReset}
			/>
		</div>
	);
}
