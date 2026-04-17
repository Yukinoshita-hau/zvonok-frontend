import {
	TrackToggle,
	useParticipants,
	useTracks,
	VideoTrack,
	type TrackReference,
} from "@livekit/components-react";
import styles from "./CallUi.module.css";
import { Track } from "livekit-client";
import { useDispatch, useSelector } from "react-redux";
import type { AppDispatch, RootState } from "../../store/store";
import { callActions } from "../../store/slices/call.slice";
import { useEffect, useMemo, useState } from "react";
import { CallParticipantTile } from "./CallParticipantTile";

interface CallUiProps {
	onHide: () => void;
	onMinimize: () => void;
}

export function CallUi({ onHide, onMinimize }: CallUiProps) {
	const [hadRemoteParticipant, setHadRemoteParticipant] = useState(false);

	const dispatch = useDispatch<AppDispatch>();
	const call = useSelector((s: RootState) => s.call);
	const myUser = useSelector((s: RootState) => s.user.myUser);
	const rooms = useSelector((s: RootState) => s.room.rooms);

	const participants = useParticipants();

	const videoTracks = useTracks([
		{ source: Track.Source.Camera, withPlaceholder: false },
	]);

	const screenTracks = useTracks([
		{ source: Track.Source.ScreenShare, withPlaceholder: false },
	]);

	const onLeave = () => {
		dispatch(callActions.endCall());
	};

	const currentRoom = useMemo(
		() => rooms.find((room) => room.id === call.chatRoomId) ?? null,
		[rooms, call.chatRoomId]
	);

	const participantAvatarByIdentity = useMemo(() => {
		const avatars = new Map<string, string | null>();

		if (myUser?.username) {
			avatars.set(myUser.username, myUser.avatarUrl ?? null);
		}

		currentRoom?.members.forEach((member) => {
			avatars.set(member.username, member.avatarUrl ?? null);
		});

		return avatars;
	}, [currentRoom, myUser?.avatarUrl, myUser?.username]);

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
					(trackRef.participant.isLocal || trackRef.publication.isSubscribed) &&
					!trackRef.publication.isMuted
			),
		[videoTracks]
	);

	const videoTrackByParticipant = useMemo(() => {
		const trackMap = new Map<string, TrackReference>();

		subscribedVideoTracks.forEach((trackRef) => {
			trackMap.set(trackRef.participant.identity, trackRef);
		});

		return trackMap;
	}, [subscribedVideoTracks]);

	const sortedParticipants = useMemo(
		() =>
			[...participants].sort((left, right) => {
				if (left.isLocal !== right.isLocal) return left.isLocal ? -1 : 1;
				return left.identity.localeCompare(right.identity);
			}),
		[participants]
	);

	const participantCards = useMemo(
		() =>
			sortedParticipants.map((participant) => ({
				participant,
				videoTrack: videoTrackByParticipant.get(participant.identity),
				avatarUrl:
					participantAvatarByIdentity.get(participant.identity) ??
					(participant.isLocal ? myUser?.avatarUrl ?? null : null),
			})),
		[sortedParticipants, videoTrackByParticipant, participantAvatarByIdentity, myUser?.avatarUrl]
	);

	const remoteParticipantsCount = useMemo(
		() => sortedParticipants.filter((participant) => !participant.isLocal).length,
		[sortedParticipants]
	);

	useEffect(() => {
		if (remoteParticipantsCount > 0) {
			setHadRemoteParticipant(true);
		}
	}, [remoteParticipantsCount]);

	useEffect(() => {
		if (call.status !== "in_call") return;
		if (!hadRemoteParticipant) return;
		if (remoteParticipantsCount > 0) return;

		const timeout = window.setTimeout(() => {
			dispatch(callActions.endCall());
		}, 3500);

		return () => {
			window.clearTimeout(timeout);
		};
	}, [call.status, hadRemoteParticipant, remoteParticipantsCount, dispatch]);

	const hasScreenShare = subscribedScreenTracks.length > 0;
	const isSingleParticipantView = !hasScreenShare && participantCards.length === 1;

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
						{participantCards.map(({ participant, videoTrack, avatarUrl }, index) => (
							<CallParticipantTile
								key={participant.sid ?? participant.identity ?? index}
								className={styles["participant-tile"]}
								participant={participant}
								videoTrack={videoTrack}
								avatarUrl={avatarUrl}
							/>
						))}
					</div>
				</div>
			) : isSingleParticipantView ? (
				<div className={styles["single-layout"]}>
					{participantCards.map(({ participant, videoTrack, avatarUrl }, index) => (
						<CallParticipantTile
							key={participant.sid ?? participant.identity ?? index}
							className={styles["single-tile"]}
							participant={participant}
							videoTrack={videoTrack}
							avatarUrl={avatarUrl}
						/>
					))}
				</div>
			) : participantCards.length > 0 ? (
				<div className={styles["participants-grid"]}>
					{participantCards.map(({ participant, videoTrack, avatarUrl }, index) => (
						<CallParticipantTile
							key={participant.sid ?? participant.identity ?? index}
							className={styles["tile"]}
							participant={participant}
							videoTrack={videoTrack}
							avatarUrl={avatarUrl}
						/>
					))}
				</div>
			) : (
				<div className={styles["empty-state"]}>
					<div className={styles["empty-title"]}>Connecting call...</div>
					<div className={styles["empty-subtitle"]}>
						Waiting for participants to join the room.
					</div>
				</div>
			)}

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
					onClick={onMinimize}
					title="Minimize call"
				>
					Mini
				</button>

				<button
					type="button"
					className={styles["control-button"]}
					onClick={onHide}
					title="Hide call"
				>
					Hide
				</button>

				<button className={styles["leave-button"]} onClick={onLeave}>
					<img src="/leave-call-icon.svg" alt="Leave call" />
				</button>
			</div>
		</div>
	);
}
