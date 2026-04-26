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
import { deviceActions } from "../../store/slices/device.slice";
import { useEffect, useMemo, useState, type MouseEvent } from "react";
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
import { AudioMixPanel } from "./AudioMixPanel/AudioMixPanel";
import { ParticipantContextMenu } from "./ParticipantContextMenu/ParticipantContextMenu";
import { useDismissibleLayer } from "../../hooks/useDismissibleLayer";
import { UserProfilePopover } from "./UserProfilePopover/UserProfilePopover";
import { StringToColor } from "../../utils/stringHelpers";
import { TheaterModeView } from "./TheaterMode/TheaterModeView";

interface ParticipantMenuState {
	x: number;
	y: number;
	participantIdentity: string;
}

interface ProfilePopoverState {
	x: number;
	y: number;
	participantIdentity: string;
}

export function CallUi({
	hasChat,
	isFocusMode,
	onHide,
	onOpenChat,
	onMinimize,
	onToggleFocus,
}: CallUiProps) {
	const [hadRemoteParticipant, setHadRemoteParticipant] = useState(false);
	const [isAudioPanelOpen, setIsAudioPanelOpen] = useState(false);
	const [participantMenu, setParticipantMenu] = useState<ParticipantMenuState | null>(null);
	const [profilePopover, setProfilePopover] = useState<ProfilePopoverState | null>(null);

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

	const getOpenParticipantContextMenuHandler =
		(participantIdentity: string) => (event: MouseEvent<HTMLButtonElement>) => {
			event.preventDefault();
			event.stopPropagation();

			const menuWidth = 340;
			const menuHeight = 320;

			let x = event.clientX;
			let y = event.clientY;
			if (x + menuWidth > window.innerWidth) x = window.innerWidth - menuWidth - 8;
			if (y + menuHeight > window.innerHeight) y = window.innerHeight - menuHeight - 8;
			if (x < 8) x = 8;
			if (y < 8) y = 8;

			setProfilePopover(null);
			setParticipantMenu({ x, y, participantIdentity });
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

	const currentMenuParticipant = useMemo(
		() =>
			participantMenu
				? sortedParticipants.find(
						(participant) => participant.identity === participantMenu.participantIdentity
				  ) ?? null
				: null,
		[participantMenu, sortedParticipants]
	);

	const currentMenuParticipantCard = useMemo(
		() =>
			currentMenuParticipant
				? participantCardByIdentity.get(currentMenuParticipant.identity) ?? null
				: null,
		[currentMenuParticipant, participantCardByIdentity]
	);

	useDismissibleLayer({
		isOpen: Boolean(participantMenu),
		onDismiss: () => setParticipantMenu(null),
	});

	useDismissibleLayer({
		isOpen: Boolean(profilePopover),
		onDismiss: () => setProfilePopover(null),
	});

	useEffect(() => {
		if (!call.isTheaterMode) return;

		const onEscape = (event: KeyboardEvent) => {
			if (event.key === "Escape") {
				dispatch(callActions.setTheaterMode(false));
			}
		};

		window.addEventListener("keydown", onEscape);
		return () => window.removeEventListener("keydown", onEscape);
	}, [call.isTheaterMode, dispatch]);

	useEffect(() => {
		if (!call.isTheaterMode) return;
		if (mainScreenTrack) return;
		dispatch(callActions.setTheaterMode(false));
	}, [call.isTheaterMode, mainScreenTrack, dispatch]);

	return (
		<div className={styles["call-root"]}>
			{call.isTheaterMode && hasScreenShare && mainScreenTrack ? (
				<TheaterModeView
					trackRef={mainScreenTrack}
					displayName={mainScreenTrack.participant.name || mainScreenTrack.participant.identity}
					onExit={() => dispatch(callActions.setTheaterMode(false))}
				/>
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
									onContextMenu={getOpenParticipantContextMenuHandler(participant.identity)}
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
								onContextMenu={getOpenParticipantContextMenuHandler(participant.identity)}
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
								onContextMenu={getOpenParticipantContextMenuHandler(participant.identity)}
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

			{isAudioPanelOpen && (
				<AudioMixPanel
					participants={sortedParticipants
						.filter((participant) => !participant.isLocal)
						.map((participant) => {
							const card = participantCardByIdentity.get(participant.identity);
							const displayName = card?.displayName || participant.identity;
							return {
								identity: participant.identity,
								displayName,
								avatarUrl: card?.avatarUrl ?? null,
								avatarLabel: displayName.slice(0, 1).toUpperCase(),
								micAvailable: remoteMicrophoneParticipants.has(participant.identity),
								streamAvailable: remoteScreenAudioParticipants.has(participant.identity),
								micVolume: getVolumeValue(participant.identity, "microphone"),
								streamVolume: getVolumeValue(participant.identity, "screenShareAudio"),
							};
						})}
					hasAnyRemoteAudioTracks={hasAnyRemoteAudioTracks}
					onMicVolumeChange={(participantIdentity, value) =>
						dispatch(
							deviceActions.setParticipantVolume({
								participantIdentity,
								source: "microphone",
								volume: value,
							})
						)
					}
					onMicReset={(participantIdentity) =>
						dispatch(
							deviceActions.resetParticipantVolume({
								participantIdentity,
								source: "microphone",
							})
						)
					}
					onStreamVolumeChange={(participantIdentity, value) =>
						dispatch(
							deviceActions.setParticipantVolume({
								participantIdentity,
								source: "screenShareAudio",
								volume: value,
							})
						)
					}
					onStreamReset={(participantIdentity) =>
						dispatch(
							deviceActions.resetParticipantVolume({
								participantIdentity,
								source: "screenShareAudio",
							})
						)
					}
				/>
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
					title="Share screen. Audio is included only when your browser and selected source support it. 1080p120 is experimental and best effort."
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

				{hasScreenShare && (
					<button
						type="button"
						className={styles["control-button"]}
						onClick={() => dispatch(callActions.setTheaterMode(!call.isTheaterMode))}
						title="Toggle theater mode"
					>
						{call.isTheaterMode ? "Exit Theater" : "Theater"}
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

			{participantMenu && currentMenuParticipant && currentMenuParticipantCard && (
				<div onClick={() => setParticipantMenu(null)}>
					<ParticipantContextMenu
						x={participantMenu.x}
						y={participantMenu.y}
						displayName={currentMenuParticipantCard.displayName}
						hasScreenShare={Boolean(screenTrackByParticipant.get(currentMenuParticipant.identity))}
						hasScreenShareAudio={remoteScreenAudioParticipants.has(currentMenuParticipant.identity)}
						micVolume={getVolumeValue(currentMenuParticipant.identity, "microphone")}
						streamVolume={getVolumeValue(currentMenuParticipant.identity, "screenShareAudio")}
						onOpenProfile={() => {
							setParticipantMenu(null);
							const popoverWidth = 360;
							const popoverHeight = 420;
							let x = participantMenu.x;
							let y = participantMenu.y;
							if (x + popoverWidth > window.innerWidth) x = window.innerWidth - popoverWidth - 8;
							if (y + popoverHeight > window.innerHeight) y = window.innerHeight - popoverHeight - 8;
							if (x < 8) x = 8;
							if (y < 8) y = 8;
							setProfilePopover({
								x,
								y,
								participantIdentity: currentMenuParticipant.identity,
							});
						}}
						onOpenScreenShare={() => {
							setParticipantMenu(null);
							const trackRef = screenTrackByParticipant.get(currentMenuParticipant.identity);
							const sid = trackRef?.publication?.trackSid;
							if (sid) {
								dispatch(callActions.setSelectedScreenTrackSid(sid));
							}
						}}
						onOpenTheater={() => {
							const trackRef = screenTrackByParticipant.get(currentMenuParticipant.identity);
							const sid = trackRef?.publication?.trackSid;
							if (sid) {
								dispatch(callActions.setSelectedScreenTrackSid(sid));
								dispatch(callActions.setTheaterMode(true));
							}
							setParticipantMenu(null);
						}}
						onMicChange={(value) =>
							dispatch(
								deviceActions.setParticipantVolume({
									participantIdentity: currentMenuParticipant.identity,
									source: "microphone",
									volume: value,
								})
							)
						}
						onMicReset={() =>
							dispatch(
								deviceActions.resetParticipantVolume({
									participantIdentity: currentMenuParticipant.identity,
									source: "microphone",
								})
							)
						}
						onStreamChange={(value) =>
							dispatch(
								deviceActions.setParticipantVolume({
									participantIdentity: currentMenuParticipant.identity,
									source: "screenShareAudio",
									volume: value,
								})
							)
						}
						onStreamReset={() =>
							dispatch(
								deviceActions.resetParticipantVolume({
									participantIdentity: currentMenuParticipant.identity,
									source: "screenShareAudio",
								})
							)
						}
					/>
				</div>
			)}

			{profilePopover && (
				<div onClick={() => setProfilePopover(null)}>
					<UserProfilePopover
						x={profilePopover.x}
						y={profilePopover.y}
						displayName={
							participantCardByIdentity.get(profilePopover.participantIdentity)?.displayName ??
							profilePopover.participantIdentity
						}
						avatarUrl={
							participantCardByIdentity.get(profilePopover.participantIdentity)?.avatarUrl ??
							null
						}
						avatarBg={StringToColor(profilePopover.participantIdentity)}
					/>
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
