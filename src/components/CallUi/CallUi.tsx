import { TrackToggle, useTracks, VideoTrack } from "@livekit/components-react";
import styles from "./CallUi.module.css";
import { Track } from "livekit-client";
import { useDispatch } from "react-redux";
import type { AppDispatch } from "../../store/store";
import { callActions } from "../../store/slices/call.clice";

export function CallUi() {
	const tracks = useTracks([
		{ source: Track.Source.Camera, withPlaceholder: true }
	]);
	const dispatch = useDispatch<AppDispatch>();

	const onLeave = () => {
		dispatch(callActions.endCall())
	}
	return (
		<div className={styles["call-root"]}>
			<div className={styles["participants-grid"]}>
				{tracks.map((trackRef, index) => {
					const { participant, publication } = trackRef;

					const hasVideo = "publication" in trackRef && !!publication?.trackSid;
					return (
						<div key={publication?.trackSid ?? participant.identity ?? index} className={styles["tile"]}>
							<div className={styles["media"]}>
								{hasVideo ? (
									<VideoTrack trackRef={trackRef} />
								) : (
									<div className={styles["placeholder"]}>
										<div className={styles["avatar"]}>
											{participant.identity?.[0]?.toUpperCase()}
										</div>
									</div>
								)}
							</div>
							<div className={styles["name"]}>{participant.identity}</div>
						</div>
					)
				})}
			</div>
			<div className={styles["controls-bar"]}>
				<TrackToggle
					source={Track.Source.Microphone}
					className={styles["controll-button"]}
				/>
				<TrackToggle
					source={Track.Source.Camera}
					className={styles["controll-button"]}
				/>
				<TrackToggle
					source={Track.Source.ScreenShare}
					className={styles["controll-button"]}
				/>
				<button
					className={styles["leave-button"]}
					onClick={onLeave}
				>
					<img src="../../../public/leave-call-icon.svg" />
				</button>
			</div>
		</div>
	)
}
