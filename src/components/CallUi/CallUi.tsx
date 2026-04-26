import {
	TrackToggle,
	isTrackReference,
	useParticipants,
	useTracks,
	VideoTrack,
	type TrackReference,
} from "@livekit/components-react";
import styles from "./CallUi.module.css";
import { RemoteTrackPublication, Track } from "livekit-client";
import { useDispatch, useSelector } from "react-redux";
import type { AppDispatch, RootState } from "../../store/store";
import { callActions } from "../../store/slices/call.slice";
import { useEffect, useMemo, useState } from "react";
import { CallParticipantTile } from "./CallParticipantTile";
import { MicrophoneToggleButton } from "./MicrophoneToggleButton";
import {
	getCameraCaptureOptions,
	getCameraPublishOptions,
	getQualityPreset,
	getScreenShareCaptureOptions,
	getScreenSharePublishOptions,
	resolveQualitySetting,
} from "../../utils/callQuality";
import type { CallUiProps } from "./CallUi.props";
import type { UserMini } from "../../entities/UserMini";

export function CallUi({
	hasChat,
	isFocusMode,
	onHide,
	onOpenChat,
	onMinimize,
	onToggleFocus,
}: CallUiProps) {
	const [hadRemoteParticipant, setHadRemoteParticipant] = useState(false);

	const dispatch = useDispatch<AppDispatch>();

	const call = useSelector((s: RootState) => s.call);
	const myUser = useSelector((s: RootState) => s.user.myUser);
	const rooms = useSelector((s: RootState) => s.room.rooms);
	const usersById = useSelector((s: RootState) => s.users.byId);
	const device = useSelector((s: RootState) => s.device);

	const participants = useParticipants();

	const videoTracks = useTracks([
		{ source: Track.Source.Camera, withPlaceholder: false },
	]);

	const screenTracks = useTracks([Track.Source.ScreenShare], {
		onlySubscribed: false,
	});

	const screenAudioTracks = useTracks([
		{ source: Track.Source.ScreenShareAudio, withPlaceholder: false },
	]);

	const onLeave = () => {
		dispatch(callActions.endCall());
	};

	const currentRoom = useMemo(
		() => rooms.find((room) => room.id === call.chatRoomId) ?? null,
		[rooms, call.chatRoomId]
	);

	const currentRoomMembers = useMemo(() => {
		if (!currentRoom) return [];

		return (currentRoom.memberIds ?? [])
			.map((memberId) => usersById[memberId])
			.filter(isUserMini);
	}, [currentRoom, usersById]);

	const participantAvatarResolver = useMemo(() => {
		const avatarsByKey = new Map<string, string | null>();

		const normalizedMyUser =
			myUser?.id ? usersById[myUser.id] ?? myUser : myUser;

		const remoteMembers = currentRoomMembers.filter(
			(member) => member.id !== myUser?.id
		);

		if (normalizedMyUser?.username) {
			avatarsByKey.set(
				normalizeIdentityKey(normalizedMyUser.username),
				normalizedMyUser.avatarUrl ?? null
			);

			avatarsByKey.set(
				String(normalizedMyUser.id),
				normalizedMyUser.avatarUrl ?? null
			);
		}

		currentRoomMembers.forEach((member) => {
			avatarsByKey.set(
				normalizeIdentityKey(member.username),
				member.avatarUrl ?? null
			);

			avatarsByKey.set(
				String(member.id),
				member.avatarUrl ?? null
			);
		});

		return (identity: string, isLocal: boolean) => {
			if (isLocal) {
				return normalizedMyUser?.avatarUrl ?? null;
			}

			const normalizedIdentity = normalizeIdentityKey(identity);

			const exactAvatar = avatarsByKey.get(normalizedIdentity);

			if (exactAvatar !== undefined) {
				return exactAvatar;
			}

			const matchedMember = remoteMembers.find((member) => {
				const normalizedUsername = normalizeIdentityKey(member.username);

				return (
					normalizedIdentity.includes(normalizedUsername) ||
					normalizedUsername.includes(normalizedIdentity)
				);
			});

			if (matchedMember) {
				return matchedMember.avatarUrl ?? null;
			}

			if (remoteMembers.length === 1) {
				return remoteMembers[0].avatarUrl ?? null;
			}

			return null;
		};
	}, [currentRoomMembers, myUser, usersById]);

	const availableScreenTracks = useMemo(
		() =>
			screenTracks.filter(
				(trackRef) => trackRef.publication && !trackRef.publication.isMuted
			),
		[screenTracks]
	);

	const subscribedVideoTracks = useMemo(
		() =>
			videoTracks
				.filter(
					(trackRef) =>
						trackRef.publication &&
						(trackRef.participant.isLocal || trackRef.publication.isSubscribed) &&
						!trackRef.publication.isMuted
				)
				.filter(isTrackReference),
		[videoTracks]
	);

	const isLocalScreenShareActive = useMemo(
		() =>
			availableScreenTracks.some(
				(trackRef) =>
					trackRef.participant.isLocal &&
					trackRef.publication
			),
		[availableScreenTracks]
	);

	const hasLocalScreenShareAudio = useMemo(
		() =>
			screenAudioTracks.some(
				(trackRef) =>
					trackRef.participant.isLocal &&
					trackRef.publication &&
					!trackRef.publication.isMuted
			),
		[screenAudioTracks]
	);

	const videoTrackByParticipant = useMemo(() => {
		const trackMap = new Map<string, TrackReference>();

		subscribedVideoTracks.forEach((trackRef) => {
			trackMap.set(trackRef.participant.identity, trackRef);
		});

		return trackMap;
	}, [subscribedVideoTracks]);

	const screenTrackByParticipant = useMemo(() => {
		const trackMap = new Map<string, TrackReference>();

		availableScreenTracks.forEach((trackRef) => {
			if (!isTrackReference(trackRef)) return;

			trackMap.set(trackRef.participant.identity, trackRef);
		});

		return trackMap;
	}, [availableScreenTracks]);

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
				screenTrack: screenTrackByParticipant.get(participant.identity),
				avatarUrl: participantAvatarResolver(
					participant.identity,
					participant.isLocal
				),
			})),
		[
			sortedParticipants,
			videoTrackByParticipant,
			screenTrackByParticipant,
			participantAvatarResolver,
		]
	);

	const remoteParticipantsCount = useMemo(
		() => sortedParticipants.filter((participant) => !participant.isLocal).length,
		[sortedParticipants]
	);

	const qualityRecommendation = device.connectionTestResult.recommendation;

	const cameraPreset = useMemo(() => {
		const quality = resolveQualitySetting(
			"camera",
			device.cameraQuality,
			qualityRecommendation
		);

		return getQualityPreset("camera", quality);
	}, [device.cameraQuality, qualityRecommendation]);

	const screenSharePreset = useMemo(() => {
		const quality = resolveQualitySetting(
			"screenShare",
			device.screenShareQuality,
			qualityRecommendation
		);

		return getQualityPreset("screenShare", quality);
	}, [device.screenShareQuality, qualityRecommendation]);

	const cameraCaptureOptions = useMemo(
		() => getCameraCaptureOptions(device.selectedCameraId, cameraPreset),
		[device.selectedCameraId, cameraPreset]
	);

	const cameraPublishOptions = useMemo(
		() => getCameraPublishOptions(cameraPreset),
		[cameraPreset]
	);

	const screenShareCaptureOptions = useMemo(
		() => getScreenShareCaptureOptions(screenSharePreset),
		[screenSharePreset]
	);

	const screenSharePublishOptions = useMemo(
		() => getScreenSharePublishOptions(screenSharePreset),
		[screenSharePreset]
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

	const hasScreenShare = availableScreenTracks.length > 0;

	const isSingleParticipantView =
		!hasScreenShare && participantCards.length === 1;

	useEffect(() => {
		if (!availableScreenTracks.length) {
			if (call.selectedScreenTrackSid !== null) {
				dispatch(callActions.setSelectedScreenTrackSid(null));
			}

			return;
		}

		const selectedStillExists = availableScreenTracks.some(
			(trackRef) =>
				trackRef.publication?.trackSid === call.selectedScreenTrackSid
		);

		if (!selectedStillExists) {
			dispatch(
				callActions.setSelectedScreenTrackSid(
					availableScreenTracks[0].publication?.trackSid ?? null
				)
			);
		}
	}, [availableScreenTracks, call.selectedScreenTrackSid, dispatch]);

	useEffect(() => {
		availableScreenTracks.forEach((trackRef) => {
			const publication = trackRef.publication;

			if (!(publication instanceof RemoteTrackPublication)) return;

			const shouldSubscribe =
				publication.trackSid === call.selectedScreenTrackSid;

			if (publication.isDesired !== shouldSubscribe) {
				publication.setSubscribed(shouldSubscribe);
			}
		});
	}, [availableScreenTracks, call.selectedScreenTrackSid]);

	const mainScreenTrack = useMemo(() => {
		if (!availableScreenTracks.length) return null;

		return (
			availableScreenTracks.find(
				(trackRef) =>
					trackRef.publication?.trackSid === call.selectedScreenTrackSid
			) ?? availableScreenTracks[0]
		);
	}, [availableScreenTracks, call.selectedScreenTrackSid]);

	const getOpenScreenShareHandler = (screenTrack?: TrackReference) => {
		const trackSid = screenTrack?.publication?.trackSid;

		if (!trackSid) return undefined;

		return () => dispatch(callActions.setSelectedScreenTrackSid(trackSid));
	};

	return (
		<div className={styles["call-root"]}>
			{hasScreenShare && mainScreenTrack ? (
				<div className={styles["screen-layout"]}>
					<div className={styles["main-screen"]}>
						{mainScreenTrack.participant.isLocal ||
						mainScreenTrack.publication?.isSubscribed ? (
							<VideoTrack trackRef={mainScreenTrack} />
						) : (
							<div className={styles["screen-loading"]}>
								Opening screen share...
							</div>
						)}

						<div className={styles["name"]}>
							{mainScreenTrack.participant.name ||
								mainScreenTrack.participant.identity}
						</div>
					</div>

					<div className={styles["participants-strip"]}>
						{participantCards.map(
							(
								{ participant, videoTrack, screenTrack, avatarUrl },
								index
							) => (
								<CallParticipantTile
									key={participant.sid ?? participant.identity ?? index}
									className={styles["participant-tile"]}
									participant={participant}
									videoTrack={videoTrack}
									avatarUrl={avatarUrl}
									isScreenSharing={Boolean(screenTrack)}
									isScreenShareSelected={
										screenTrack?.publication?.trackSid ===
										call.selectedScreenTrackSid
									}
									onOpenScreenShare={getOpenScreenShareHandler(screenTrack)}
								/>
							)
						)}
					</div>
				</div>
			) : isSingleParticipantView ? (
				<div className={styles["single-layout"]}>
					{participantCards.map(
						({ participant, videoTrack, screenTrack, avatarUrl }, index) => (
							<CallParticipantTile
								key={participant.sid ?? participant.identity ?? index}
								className={styles["single-tile"]}
								participant={participant}
								videoTrack={videoTrack}
								avatarUrl={avatarUrl}
								isScreenSharing={Boolean(screenTrack)}
								isScreenShareSelected={
									screenTrack?.publication?.trackSid ===
									call.selectedScreenTrackSid
								}
								onOpenScreenShare={getOpenScreenShareHandler(screenTrack)}
							/>
						)
					)}
				</div>
			) : participantCards.length > 0 ? (
				<div className={styles["participants-grid"]}>
					{participantCards.map(
						({ participant, videoTrack, screenTrack, avatarUrl }, index) => (
							<CallParticipantTile
								key={participant.sid ?? participant.identity ?? index}
								className={styles["tile"]}
								participant={participant}
								videoTrack={videoTrack}
								avatarUrl={avatarUrl}
								isScreenSharing={Boolean(screenTrack)}
								isScreenShareSelected={
									screenTrack?.publication?.trackSid ===
									call.selectedScreenTrackSid
								}
								onOpenScreenShare={getOpenScreenShareHandler(screenTrack)}
							/>
						)
					)}
				</div>
			) : (
				<div className={styles["empty-state"]}>
					<div className={styles["empty-title"]}>
						Connecting call...
					</div>
					<div className={styles["empty-subtitle"]}>
						Waiting for participants to join the room.
					</div>
				</div>
			)}

			<div className={styles["controls-bar"]}>
				<MicrophoneToggleButton
					className={styles["control-button"]}
					enabledLabel="Mic"
					disabledLabel="Muted"
					showIcon
				/>

				<TrackToggle
					source={Track.Source.Camera}
					className={styles["control-button"]}
					captureOptions={cameraCaptureOptions}
					publishOptions={cameraPublishOptions}
				/>

				<TrackToggle
					source={Track.Source.ScreenShare}
					className={styles["control-button"]}
					captureOptions={screenShareCaptureOptions}
					publishOptions={screenSharePublishOptions}
					title="Share screen. Audio is included only when your browser and selected source support it."
				/>

				{hasChat && (
					<button
						type="button"
						className={styles["control-button"]}
						onClick={onOpenChat}
						title="Open call chat"
					>
						Chat
					</button>
				)}

				<button
					type="button"
					className={styles["control-button"]}
					onClick={onToggleFocus}
					title={isFocusMode ? "Exit call focus mode" : "Focus call"}
				>
					{isFocusMode ? "Unfocus" : "Focus"}
				</button>

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

function normalizeIdentityKey(value: string) {
	return value.trim().toLowerCase();
}

function isUserMini(value: UserMini | undefined): value is UserMini {
	return Boolean(value);
}
