import { VideoTrack, type TrackReference } from "@livekit/components-react";
import styles from "./TheaterModeView.module.css";

interface TheaterModeViewProps {
	trackRef: TrackReference;
	displayName: string;
	onExit: () => void;
}

export function TheaterModeView({ trackRef, displayName, onExit }: TheaterModeViewProps) {
	const isReady = trackRef.participant.isLocal || trackRef.publication?.isSubscribed;

	return (
		<div className={styles["root"]}>
			<div className={styles["overlayTop"]}>
				<div className={styles["title"]}>Screen share by {displayName}</div>
				<button type="button" className={styles["exitButton"]} onClick={onExit}>
					Exit theater
				</button>
			</div>
			<div className={styles["media"]}>
				{isReady ? (
					<VideoTrack trackRef={trackRef} />
				) : (
					<div className={styles["loading"]}>Opening screen share...</div>
				)}
			</div>
		</div>
	);
}
