import { TrackToggle, useTracks, VideoTrack } from "@livekit/components-react";
import styles from "./CallUi.module.css";
import { Track } from "livekit-client";

export function CallUi() {
	const tracks = useTracks([
		Track.Source.Camera,
	]);

	return (
		<div className={styles["call-root"]}>
			<div className={styles["participants-grid"]}>
				{tracks.map((trackRef, index) => {
					const { participant, publication, source } = trackRef;
					return (
						<div key={publication?.trackSid ?? index} className={styles["tile"]}>
							<VideoTrack trackRef={trackRef} />
							<div className={styles["name"]}>{participant.identity}</div>
							<div className={styles["source"]}>{source}</div>
						</div>
					)
				})}
			</div>
			<div className={styles["controls-bar"]}>
				<TrackToggle source={Track.Source.Camera}>
					Камера
				</TrackToggle>
			</div>
		</div>
	)
}
