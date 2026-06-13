import {
	TrackToggle,
	isTrackReference,
	useParticipants,
	useTracks,
	VideoTrack,
	type TrackReference,
} from "@livekit/components-react";
import { Mic, MonitorUp, RotateCcw } from "lucide-react";
import styles from "./CallUi.module.css";
import { RemoteTrackPublication, Track } from "livekit-client";
import { useDispatch, useSelector } from "react-redux";
import type { AppDispatch, RootState } from "../../store/store";
import { callActions } from "../../store/slices/call.slice";
import { deviceActions } from "../../store/slices/device.slice";
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
	resolveScreenShareQualitySetting,
} from "../../utils/callQuality";
import type { CallUiProps } from "./CallUi.props";
import type { UserMini } from "../../entities/UserMini";
import { TheaterModeView } from "./TheaterMode/TheaterModeView";

export function CallUi({
	hasChat,
	isFocusMode,
	isCinemaMode,
	onHide,
	onOpenChat,
	onMinimize,
	onToggleFocus,
	onToggleCinema,
}: CallUiProps) {
	const [hadRemoteParticipant, setHadRemoteParticipant] = useState(false);
	const [isAudioPanelOpen, setIsAudioPanelOpen] = useState(false);

	const dispatch = useDispatch<AppDispatch>();

	const call = useSelector((s: RootState) => s.call);
	const myUser = useSelector((s: RootState) => s.user.myUser);
	const rooms = useSelector((s: RootState) => s.room.rooms);
	const usersById = useSelector((s: RootState) => s.users.byId);
	const device = useSelector((s: RootState) => s.device);
	const participantVolumes = useSelector((s: RootState) => s.device.participantVolumes);

	const participants = useParticipants();

	const videoTracks = useTracks([
		{ source: Track.Source.Camera, withPlaceholder: false },
	]);
	const microphoneAudioTracks = useTracks([
		{ source: Track.Source.Microphone, withPlaceholder: false },
	]);

	const screenTracks = useTracks([Track.Source.ScreenShare], {
		onlySubscribed: false,
	});

	const screenAudioTracks = useTracks([
		{ source: Track.Source.ScreenShareAudio, withPlaceholder: false },
	]);

	const onLeave = () => {
		console.debug("[call] user hangup clicked", { callId: call.callId, roomType: call.roomType });
		if (!call.callId) {
			dispatch(callActions.leaveCallLocally());
			return;
		}

		if (call.roomType === "GROUP") {
			const isHost = Boolean(myUser?.username && call.hostUsername && myUser.username === call.hostUsername);
			if (isHost) {
				dispatch({ type: "call/sendEnd", payload: { callId: call.callId, chatRoomId: call.chatRoomId ?? undefined } });
				dispatch(callActions.endCallLocally());
				return;
			}

			dispatch({ type: "call/sendLeave", payload: { callId: call.callId, chatRoomId: call.chatRoomId ?? undefined } });
			dispatch(callActions.leaveCallLocally());
			return;
		}

		dispatch({ type: "call/sendEnd", payload: { callId: call.callId, chatRoomId: call.chatRoomId ?? undefined } });
		dispatch(callActions.endCallLocally());
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

	const remoteMicrophoneParticipants = useMemo(() => {
		const participantSet = new Set<string>();
		microphoneAudioTracks.forEach((trackRef) => {
			if (trackRef.participant.isLocal) return;
			if (!trackRef.publication || trackRef.publication.isMuted) return;
			participantSet.add(trackRef.participant.identity);
		});
		return participantSet;
	}, [microphoneAudioTracks]);

	const remoteScreenAudioParticipants = useMemo(() => {
		const participantSet = new Set<string>();
		screenAudioTracks.forEach((trackRef) => {
			if (trackRef.participant.isLocal) return;
			if (!trackRef.publication || trackRef.publication.isMuted) return;
			participantSet.add(trackRef.participant.identity);
		});
		return participantSet;
	}, [screenAudioTracks]);

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

	const participantCardByIdentity = useMemo(() => {
		const map = new Map<
			string,
			{ avatarUrl: string | null; displayName: string }
		>();
		participantCards.forEach(({ participant, avatarUrl }) => {
			map.set(participant.identity, {
				avatarUrl,
				displayName: participant.name || participant.identity,
			});
		});
		return map;
	}, [participantCards]);

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
		const quality = resolveScreenShareQualitySetting(
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

	const hasScreenShare = availableScreenTracks.length > 0;

	const isSingleParticipantView =
		!hasScreenShare && participantCards.length === 1;

	useEffect(() => {
		if (!isCinemaMode) return;

		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key !== "Escape") return;
			onToggleCinema();
		};

		window.addEventListener("keydown", onKeyDown);
		return () => {
			window.removeEventListener("keydown", onKeyDown);
		};
	}, [isCinemaMode, onToggleCinema]);

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

	const getVolumeValue = (
		participantIdentity: string,
		source: "microphone" | "screenShareAudio"
	) =>
		participantVolumes.find(
			(item) =>
				item.participantIdentity === participantIdentity && item.source === source
		)?.volume ?? 100;

	const hasAnyRemoteAudioTracks =
		remoteMicrophoneParticipants.size > 0 || remoteScreenAudioParticipants.size > 0;

	useEffect(() => {
		if (!isCinemaMode) return;
		if (mainScreenTrack) return;
		dispatch(callActions.setTheaterMode(false));
	}, [dispatch, isCinemaMode, mainScreenTrack]);

	return (
		<div className={styles["call-root"]}>
			{isCinemaMode ? (
				mainScreenTrack ? (
					<div className={styles["cinema-layout"]}>
						<TheaterModeView
							trackRef={mainScreenTrack}
							displayName={mainScreenTrack.participant.name || mainScreenTrack.participant.identity}
							onExit={onToggleCinema}
						/>
					</div>
				) : (
					<div className={styles["empty-state"]}>
						<div className={styles["empty-title"]}>Cinema mode is unavailable</div>
						<div className={styles["empty-subtitle"]}>Select a screen share first.</div>
					</div>
				)
			) : hasScreenShare && mainScreenTrack ? (
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

			{isAudioPanelOpen && !isCinemaMode && (
				<div className={styles["audio-panel"]}>
					<div className={styles["audio-panel-title"]}>Participant volume</div>
					{sortedParticipants.filter((participant) => !participant.isLocal).length === 0 ? (
						<div className={styles["audio-panel-empty"]}>No remote participants yet.</div>
					) : !hasAnyRemoteAudioTracks ? (
						<div className={styles["audio-panel-empty"]}>
							Remote audio tracks are not available yet.
						</div>
					) : (
						sortedParticipants
							.filter((participant) => !participant.isLocal)
							.map((participant) => {
								const micAvailable = remoteMicrophoneParticipants.has(participant.identity);
								const streamAvailable = remoteScreenAudioParticipants.has(participant.identity);
								const micVolume = getVolumeValue(participant.identity, "microphone");
								const streamVolume = getVolumeValue(participant.identity, "screenShareAudio");
								const card = participantCardByIdentity.get(participant.identity);
								const displayName = card?.displayName || participant.identity;
								const avatarLabel = displayName.slice(0, 1).toUpperCase();

								return (
									<div key={participant.identity} className={styles["audio-row"]}>
										<div className={styles["audio-header"]}>
											<div className={styles["audio-avatar"]}>
												{card?.avatarUrl ? (
													<img
														src={card.avatarUrl}
														crossOrigin="anonymous"
														alt={`${displayName} avatar`}
														className={styles["audio-avatar-image"]}
													/>
												) : (
													<span>{avatarLabel}</span>
												)}
											</div>
											<div className={styles["audio-name"]} title={displayName}>
												{displayName}
											</div>
										</div>
										<div className={styles["audio-slider-row"]}>
											<div className={styles["audio-source-label"]}>
												<Mic size={14} />
												<span>Mic</span>
											</div>
											<input
												type="range"
												min={0}
												max={100}
												value={micVolume}
												disabled={!micAvailable}
												onChange={(event) =>
													dispatch(
														deviceActions.setParticipantVolume({
															participantIdentity: participant.identity,
															source: "microphone",
															volume: Number(event.target.value),
														})
													)
												}
											/>
											<span className={styles["audio-percent"]}>{micVolume}%</span>
											<button
												type="button"
												className={styles["audio-reset"]}
												title="Reset to 100%"
												onClick={() =>
													dispatch(
														deviceActions.resetParticipantVolume({
															participantIdentity: participant.identity,
															source: "microphone",
														})
													)
												}
											>
												<RotateCcw size={13} />
											</button>
										</div>
										{streamAvailable && (
											<div className={styles["audio-slider-row"]}>
												<div className={styles["audio-source-label"]}>
													<MonitorUp size={14} />
													<span>Stream</span>
												</div>
												<input
													type="range"
													min={0}
													max={100}
													value={streamVolume}
													onChange={(event) =>
														dispatch(
															deviceActions.setParticipantVolume({
																participantIdentity: participant.identity,
																source: "screenShareAudio",
																volume: Number(event.target.value),
															})
														)
													}
												/>
												<span className={styles["audio-percent"]}>{streamVolume}%</span>
												<button
													type="button"
													className={styles["audio-reset"]}
													title="Reset to 100%"
													onClick={() =>
														dispatch(
															deviceActions.resetParticipantVolume({
																participantIdentity: participant.identity,
																source: "screenShareAudio",
															})
														)
													}
												>
													<RotateCcw size={13} />
												</button>
											</div>
										)}
									</div>
								);
							})
					)}
				</div>
			)}

			{!isCinemaMode && (
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
						title="Share screen. Audio is included only when your browser and selected source support it"
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
						onClick={() => setIsAudioPanelOpen((prev) => !prev)}
						title="Per-user audio volume controls"
					>
						{isAudioPanelOpen ? "Close Mix" : "Audio Mix"}
					</button>

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
						onClick={() => {
							if (!call.selectedScreenTrackSid) return;
							onToggleCinema();
						}}
						title={
							call.selectedScreenTrackSid
								? isCinemaMode
									? "Exit cinema mode"
									: "Open cinema mode"
								: "Select a screen share first"
						}
						disabled={!call.selectedScreenTrackSid}
					>
						{isCinemaMode ? "Exit Cinema" : "Cinema"}
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
			)}
		</div>
	);
}

function normalizeIdentityKey(value: string) {
	return value.trim().toLowerCase();
}

function isUserMini(value: UserMini | undefined): value is UserMini {
	return Boolean(value);
}
