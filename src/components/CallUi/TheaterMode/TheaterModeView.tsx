import { VideoTrack, type TrackReference } from "@livekit/components-react";
import { CinemaModeOverlayControls } from "../CinemaModeOverlayControls/CinemaModeOverlayControls";
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
			<CinemaModeOverlayControls displayName={displayName} onExit={onExit} />
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
