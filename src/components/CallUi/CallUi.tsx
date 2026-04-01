import { AudioTrack, TrackToggle, useTracks, VideoTrack } from "@livekit/components-react";
import styles from "./CallUi.module.css";
import { Track } from "livekit-client";
import { useDispatch, useSelector } from "react-redux";
import type { AppDispatch, RootState } from "../../store/store";
import { callActions } from "../../store/slices/call.slice";
import { useEffect, useMemo, useState } from "react";

export function CallUi() {
	const [hoveredId, setHoveredId] = useState<string | null>(null);

	const dispatch = useDispatch<AppDispatch>();
	const call = useSelector((s: RootState) => s.call);

	const videoTracks = useTracks([
		{ source: Track.Source.Camera, withPlaceholder: false },
	]);

	const audioTracks = useTracks([
		{ source: Track.Source.Microphone, withPlaceholder: false },
		{ source: Track.Source.ScreenShareAudio, withPlaceholder: false }
	]);

	const screenTracks = useTracks([
		{ source: Track.Source.ScreenShare, withPlaceholder: false },
	]);

	const onLeave = () => {
		dispatch(callActions.endCall());
	};

	const subscribedScreenTracks = useMemo(
		() =>
			screenTracks.filter(
				(trackRef) => trackRef.publication && trackRef.publication.isSubscribed
			),
		[screenTracks]
	);

	const subscribedVideoTracks = useMemo(
		() =>
			videoTracks.filter(
				(trackRef) =>
					trackRef.publication &&
					trackRef.publication.isSubscribed &&
					!trackRef.publication.isMuted
			),
		[videoTracks]
	);


	const hasScreenShare = subscribedScreenTracks.length > 0;
	const isSingleCameraView =
		!hasScreenShare && subscribedVideoTracks.length === 1;

	useEffect(() => {
		if (!subscribedScreenTracks.length) {
			if (call.selectedScreenTrackSid !== null) {
				dispatch(callActions.setSelectedScreenTrackSid(null));
			}
			return;
		}

		const selectedStillExists = subscribedScreenTracks.some(
			(trackRef) => trackRef.publication?.trackSid === call.selectedScreenTrackSid
		);

		if (!selectedStillExists) {
			dispatch(
				callActions.setSelectedScreenTrackSid(
					subscribedScreenTracks[0].publication?.trackSid ?? null
				)
			);
		}
	}, [subscribedScreenTracks, call.selectedScreenTrackSid, dispatch]);

	const mainScreenTrack = useMemo(() => {
		if (!subscribedScreenTracks.length) return null;

		return (
			subscribedScreenTracks.find(
				(trackRef) => trackRef.publication?.trackSid === call.selectedScreenTrackSid
			) ?? subscribedScreenTracks[0]
		);
	}, [subscribedScreenTracks, call.selectedScreenTrackSid]);

	return (
		<div className={styles["call-root"]}>
			{hasScreenShare && mainScreenTrack ? (
				<div className={styles["screen-layout"]}>
					<div className={styles["main-screen"]}>
						<VideoTrack trackRef={mainScreenTrack} />
						<div className={styles["name"]}>
							{mainScreenTrack.participant.identity}
						</div>
					</div>

					{subscribedScreenTracks.length > 1 && (
						<div className={styles["screen-picker"]}>
							{subscribedScreenTracks.map((trackRef, index) => {
								const { participant, publication } = trackRef;
								const key = publication?.trackSid ?? participant.identity ?? index;
								const isActive =
									publication?.trackSid === call.selectedScreenTrackSid;

								return (
									<button
										key={key}
										type="button"
										className={`${styles["screen-preview"]} ${
											isActive ? styles["screen-preview-active"] : ""
										}`}
										onClick={() =>
											dispatch(
												callActions.setSelectedScreenTrackSid(
													publication?.trackSid ?? null
												)
											)
										}
									>
										<div className={styles["screen-preview-media"]}>
											<VideoTrack trackRef={trackRef} />
										</div>
										<div className={styles["screen-preview-name"]}>
											{participant.identity}
										</div>
									</button>
								);
							})}
						</div>
					)}

					<div className={styles["participants-strip"]}>
						{subscribedVideoTracks.map((trackRef, index) => {
							const { participant, publication } = trackRef;
							const key = publication?.trackSid ?? participant.identity ?? index;
							const isHovered = hoveredId === participant.identity;

							return (
								<div
									key={key}
									className={styles["participant-tile"]}
									onMouseEnter={() => setHoveredId(participant.identity)}
									onMouseLeave={() => setHoveredId(null)}
								>
									<div className={styles["media"]}>
										<VideoTrack trackRef={trackRef} />
									</div>
									{isHovered && (
										<div className={styles["name"]}>{participant.identity}</div>
									)}
								</div>
							);
						})}
					</div>
				</div>
			) : isSingleCameraView ? (
				<div className={styles["single-layout"]}>
					{subscribedVideoTracks.map((trackRef, index) => {
						const { participant, publication } = trackRef;
						const key = publication?.trackSid ?? participant.identity ?? index;
						const isHovered = hoveredId === participant.identity;

						return (
							<div
								key={key}
								className={styles["single-tile"]}
								onMouseEnter={() => setHoveredId(participant.identity)}
								onMouseLeave={() => setHoveredId(null)}
							>
								<div className={styles["media"]}>
									<VideoTrack trackRef={trackRef} />
								</div>
								{isHovered && (
									<div className={styles["name"]}>{participant.identity}</div>
								)}
							</div>
						);
					})}
				</div>
			) : (
				<div className={styles["participants-grid"]}>
					{subscribedVideoTracks.map((trackRef, index) => {
						const { participant, publication } = trackRef;
						const key = publication?.trackSid ?? participant.identity ?? index;
						const isHovered = hoveredId === participant.identity;

						return (
							<div
								key={key}
								className={styles["tile"]}
								onMouseEnter={() => setHoveredId(participant.identity)}
								onMouseLeave={() => setHoveredId(null)}
							>
								<div className={styles["media"]}>
									<VideoTrack trackRef={trackRef} />
								</div>
								{isHovered && (
									<div className={styles["name"]}>{participant.identity}</div>
								)}
							</div>
						);
					})}
				</div>
			)}

			<div aria-hidden="true" style={{ display: "none" }}>
				{audioTracks.map((trackRef, index) => {
					const { publication, participant } = trackRef;
					if (!publication?.trackSid) return null;
					if (participant.isLocal) return null;

					return (
						<AudioTrack
							key={publication.trackSid ?? index}
							trackRef={trackRef}
						/>
					);
				})}
			</div>

			<div className={styles["controls-bar"]}>
				<TrackToggle
					source={Track.Source.Microphone}
					className={styles["control-button"]}
				/>
				<TrackToggle
					source={Track.Source.Camera}
					className={styles["control-button"]}
				/>
				<TrackToggle
					source={Track.Source.ScreenShare}
					className={styles["control-button"]}
				/>

				<button
					type="button"
					className={styles["control-button"]}
					onClick={() => dispatch(callActions.toggleCallFocusMode())}
					title="Toggle focus mode"
				>
					⛶
				</button>

				<button
					type="button"
					className={styles["control-button"]}
					onClick={() => dispatch(callActions.toggleChatHiddenInCall())}
					title="Toggle chat"
				>
					☰
				</button>

				<button className={styles["leave-button"]} onClick={onLeave}>
					<img src="/leave-call-icon.svg" alt="Leave call" />
				</button>
			</div>
		</div>
	);
}
