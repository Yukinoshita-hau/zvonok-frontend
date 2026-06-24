import { VideoTrack, type TrackReference } from "@livekit/components-react";
import type { ReactNode } from "react";
import { CinemaModeOverlayControls } from "../CinemaModeOverlayControls/CinemaModeOverlayControls";
import styles from "./TheaterModeView.module.css";

interface TheaterModeViewProps {
	trackRef: TrackReference;
	displayName: string;
	onExit: () => void;
	children?: ReactNode;
	onToggleScreenOverlay?: () => void;
	isScreenOverlayOpen?: boolean;
	canUseScreenOverlay?: boolean;
}

export function TheaterModeView({
	trackRef,
	displayName,
	onExit,
	children,
	onToggleScreenOverlay,
	isScreenOverlayOpen,
	canUseScreenOverlay,
}: TheaterModeViewProps) {
	const isReady = trackRef.participant.isLocal || trackRef.publication?.isSubscribed;

	return (
		<div className={styles["root"]}>
			<CinemaModeOverlayControls
				displayName={displayName}
				onExit={onExit}
				onToggleScreenOverlay={onToggleScreenOverlay}
				isScreenOverlayOpen={isScreenOverlayOpen}
				canUseScreenOverlay={canUseScreenOverlay}
			/>
			<div className={styles["media"]}>
				{isReady ? (
					<VideoTrack trackRef={trackRef} />
				) : (
					<div className={styles["loading"]}>Открываем видео...</div>
				)}
			</div>
			{children}
		</div>
	);
}
