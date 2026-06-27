import { VideoTrack } from "@livekit/components-react";
import styles from "./CallUi.module.css";
import { RemoteTrackPublication } from "livekit-client";
import { X } from "lucide-react";
import { useDispatch, useSelector } from "react-redux";
import type { AppDispatch, RootState } from "../../store/store";
import { callActions, endConference } from "../../store/slices/call.slice";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { TheaterModeView } from "./TheaterMode/TheaterModeView";
import { useCallParticipants } from "./hooks/useCallParticipants";
import { ParticipantsGrid, type ParticipantContextMenuAnchor } from "./ParticipantsGrid";
import { CallControls } from "./CallControls";
import type { ParticipantCard } from "./hooks/useCallParticipants";
import { ParticipantContextMenu } from "./ParticipantContextMenu/ParticipantContextMenu";
import { deviceActions, type ParticipantAudioSource } from "../../store/slices/device.slice";
import { FocusedScreenShareVolume } from "./FocusedScreenShareVolume";
import type { CanvasParticipantOption } from "../CallCanvas/CallCanvas.types";
import { InteractiveHost } from "../InteractiveHost/InteractiveHost";

interface ParticipantMenuState {
	cardId: string;
	x: number;
	y: number;
}

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
	const [focusedCardId, setFocusedCardId] = useState<string | null>(null);
	const [participantMenu, setParticipantMenu] = useState<ParticipantMenuState | null>(null);
	const callRootRef = useRef<HTMLDivElement>(null);
	const previousScreenTrackSidsRef = useRef<Set<string>>(new Set());
	const dispatch = useDispatch<AppDispatch>();

	const call = useSelector((s: RootState) => s.call);
	const myUser = useSelector((s: RootState) => s.user.myUser);
	const device = useSelector((s: RootState) => s.device);
	const participantVolumes = useSelector((s: RootState) => s.device.participantVolumes);
	const isWebSocketConnected = useSelector((s: RootState) => s.websocket.isConnected);

	const {
		participantCards,
		sortedParticipants,
		remoteMicrophoneParticipants,
		remoteScreenAudioParticipants,
		availableScreenTracks,
	} = useCallParticipants();

	const onLeave = () => {
		if (call.conferenceCode) {
			if (call.isConferenceHost) {
				void dispatch(endConference(call.conferenceCode));
				return;
			}
			dispatch(callActions.leaveCallLocally());
			return;
		}

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

	const qualityRecommendation = device.connectionTestResult.recommendation;

	const cameraPreset = useMemo(() => {
		const quality = resolveQualitySetting("camera", device.cameraQuality, qualityRecommendation);
		return getQualityPreset("camera", quality);
	}, [device.cameraQuality, qualityRecommendation]);

	const screenSharePreset = useMemo(() => {
		const quality = resolveScreenShareQualitySetting(device.screenShareQuality, qualityRecommendation);
		return getQualityPreset("screenShare", quality);
	}, [device.screenShareQuality, qualityRecommendation]);

	const cameraCaptureOptions = useMemo(() => getCameraCaptureOptions(device.selectedCameraId, cameraPreset), [device.selectedCameraId, cameraPreset]);
	const cameraPublishOptions = useMemo(() => getCameraPublishOptions(cameraPreset), [cameraPreset]);
	const screenShareCaptureOptions = useMemo(() => getScreenShareCaptureOptions(screenSharePreset), [screenSharePreset]);
	const screenSharePublishOptions = useMemo(() => getScreenSharePublishOptions(screenSharePreset), [screenSharePreset]);

	const hasScreenShare = availableScreenTracks.length > 0;

	const screenTrackSidByCardId = useMemo(() => {
		const map = new Map<string, string>();
		participantCards.forEach((card) => {
			if (!card.isScreenShareCard) return;
			const trackSid = card.videoTrack?.publication?.trackSid;
			if (trackSid) map.set(card.id, trackSid);
		});
		return map;
	}, [participantCards]);

	const focusedCard = useMemo(() => {
		if (!focusedCardId) return null;
		return participantCards.find((card) => card.id === focusedCardId && card.videoTrack) ?? null;
	}, [focusedCardId, participantCards]);

	const contextMenuCard = useMemo(() => {
		if (!participantMenu) return null;
		return participantCards.find((card) => card.id === participantMenu.cardId) ?? null;
	}, [participantCards, participantMenu]);

	const screenCardByIdentity = useMemo(() => {
		const map = new Map<string, ParticipantCard>();
		participantCards.forEach((card) => {
			if (card.isScreenShareCard) {
				map.set(card.participant.identity, card);
			}
		});
		return map;
	}, [participantCards]);

	const canOpenCinemaMode = Boolean(focusedCard?.videoTrack);
	const isCurrentUserHost = Boolean(
		myUser?.username &&
		(
			call.isConferenceHost ||
			(call.hostUsername && myUser.username === call.hostUsername)
		)
	);
	const canvasParticipantOptions = useMemo<CanvasParticipantOption[]>(() => {
		const seen = new Set<string>();
		return sortedParticipants.flatMap((participant) => {
			const username = participant.identity || participant.name;
			if (!username || seen.has(username)) return [];
			seen.add(username);

			const isHost = username === call.hostUsername ||
				participant.name === call.hostUsername ||
				(participant.isLocal && isCurrentUserHost);

			return [{
				username,
				displayName: participant.name || participant.identity,
				role: isHost ? "HOST" : "MEMBER",
			}];
		});
	}, [call.hostUsername, isCurrentUserHost, sortedParticipants]);
	useEffect(() => {
		if (!isCinemaMode) return;
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key !== "Escape") return;
			onToggleCinema();
		};
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [isCinemaMode, onToggleCinema]);

	useEffect(() => {
		if (!availableScreenTracks.length) {
			if (call.selectedScreenTrackSid !== null) dispatch(callActions.setSelectedScreenTrackSid(null));
			previousScreenTrackSidsRef.current = new Set();
			return;
		}

		const currentSids = new Set(
			availableScreenTracks
				.map((trackRef) => trackRef.publication?.trackSid)
				.filter((trackSid): trackSid is string => Boolean(trackSid))
		);
		const newlySharedSid = [...currentSids].find(
			(trackSid) => !previousScreenTrackSidsRef.current.has(trackSid)
		);
		previousScreenTrackSidsRef.current = currentSids;

		if (newlySharedSid) {
			dispatch(callActions.setSelectedScreenTrackSid(newlySharedSid));
			return;
		}

		const selectedStillExists = availableScreenTracks.some((t) => t.publication?.trackSid === call.selectedScreenTrackSid);
		if (!selectedStillExists) {
			dispatch(callActions.setSelectedScreenTrackSid(null));
		}
	}, [availableScreenTracks, call.selectedScreenTrackSid, dispatch]);

	useEffect(() => {
		availableScreenTracks.forEach((trackRef) => {
			const publication = trackRef.publication;
			if (!(publication instanceof RemoteTrackPublication)) return;
			if (!publication.isDesired) publication.setSubscribed(true);
		});
	}, [availableScreenTracks]);

	const openCardInFocus = useCallback((card: ParticipantCard) => {
		setParticipantMenu(null);
		setFocusedCardId(card.id);
		const screenTrackSid = screenTrackSidByCardId.get(card.id);
		if (screenTrackSid) {
			dispatch(callActions.setSelectedScreenTrackSid(screenTrackSid));
		}
		dispatch(callActions.setCallFocusMode(true));
	}, [dispatch, screenTrackSidByCardId]);

	const closeFocusMode = useCallback(() => {
		setFocusedCardId(null);
		dispatch(callActions.setCallFocusMode(false));
	}, [dispatch]);


	const clearFocusedMedia = useCallback(() => {
		const screenTrackSid = focusedCardId ? screenTrackSidByCardId.get(focusedCardId) : null;
		setFocusedCardId(null);
		if (screenTrackSid && call.selectedScreenTrackSid === screenTrackSid) {
			dispatch(callActions.setSelectedScreenTrackSid(null));
		}
	}, [call.selectedScreenTrackSid, dispatch, focusedCardId, screenTrackSidByCardId]);

	const getParticipantVolume = useCallback((participantIdentity: string, source: ParticipantAudioSource) => {
		return participantVolumes.find(
			(item) => item.participantIdentity === participantIdentity && item.source === source
		)?.volume ?? 100;
	}, [participantVolumes]);

	const setParticipantVolume = useCallback((
		participantIdentity: string,
		source: ParticipantAudioSource,
		volume: number
	) => {
		dispatch(deviceActions.setParticipantVolume({ participantIdentity, source, volume }));
	}, [dispatch]);

	const resetParticipantVolume = useCallback((participantIdentity: string, source: ParticipantAudioSource) => {
		dispatch(deviceActions.resetParticipantVolume({ participantIdentity, source }));
	}, [dispatch]);

	const openParticipantMenu = useCallback((card: ParticipantCard, anchor: ParticipantContextMenuAnchor) => {
		const menuWidth = 320;
		const menuHeight = screenCardByIdentity.has(card.participant.identity) ||
			remoteScreenAudioParticipants.has(card.participant.identity)
			? 230
			: 132;
		const rootRect = callRootRef.current?.getBoundingClientRect();
		const rootLeft = rootRect?.left ?? 0;
		const rootTop = rootRect?.top ?? 0;
		const rootWidth = rootRect?.width ?? window.innerWidth;
		const rootHeight = rootRect?.height ?? window.innerHeight;
		const cardLeft = anchor.left - rootLeft;
		const cardBottom = anchor.bottom - rootTop;
		const preferredX = cardLeft + 8;
		const belowY = cardBottom + 8;
		const aboveY = (anchor.top - rootTop) - menuHeight - 8;
		const preferredY = anchor.preferAbove ? aboveY : belowY;
		const maxX = Math.max(8, rootWidth - menuWidth - 8);
		const maxY = Math.max(8, rootHeight - menuHeight - 8);
		const x = Math.max(8, Math.min(preferredX, maxX));
		const y = Math.max(8, Math.min(preferredY, maxY));

		setParticipantMenu({
			cardId: card.id,
			x: Math.max(8, x),
			y,
		});
	}, [remoteScreenAudioParticipants, screenCardByIdentity]);

	useEffect(() => {
		if (!participantMenu) return;
		const closeMenu = () => setParticipantMenu(null);
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") closeMenu();
		};

		window.addEventListener("click", closeMenu);
		window.addEventListener("contextmenu", closeMenu);
		window.addEventListener("keydown", onKeyDown);
		window.addEventListener("resize", closeMenu);

		return () => {
			window.removeEventListener("click", closeMenu);
			window.removeEventListener("contextmenu", closeMenu);
			window.removeEventListener("keydown", onKeyDown);
			window.removeEventListener("resize", closeMenu);
		};
	}, [participantMenu]);

	useEffect(() => {
		if (!focusedCardId) return;
		if (participantCards.some((card) => card.id === focusedCardId)) return;
		setFocusedCardId(null);
	}, [focusedCardId, participantCards]);

	useEffect(() => {
		if (!isCinemaMode || focusedCard?.videoTrack) return;
		dispatch(callActions.setTheaterMode(false));
	}, [dispatch, focusedCard, isCinemaMode]);

	const focusedScreenShareVolumeControl = focusedCard?.isScreenShareCard &&
		remoteScreenAudioParticipants.has(focusedCard.participant.identity) ? (
		<FocusedScreenShareVolume
			volume={getParticipantVolume(focusedCard.participant.identity, "screenShareAudio")}
			onChange={(volume) => setParticipantVolume(
				focusedCard.participant.identity,
				"screenShareAudio",
				volume
			)}
			onReset={() => resetParticipantVolume(focusedCard.participant.identity, "screenShareAudio")}
		/>
	) : null;

	const openInteractiveFocusMode = useCallback(() => {
		setParticipantMenu(null);
		setFocusedCardId(null);
		dispatch(callActions.setCallFocusMode(true));
	}, [dispatch]);

	const resetInteractiveFocusMode = useCallback(() => {
		setFocusedCardId(null);
		dispatch(callActions.setCallFocusMode(false));
	}, [dispatch]);

	return (
		<div ref={callRootRef} className={styles["call-root"]}>
			<InteractiveHost
				callId={call.callId}
				isWebSocketConnected={isWebSocketConnected}
				isFocusMode={isFocusMode}
				focusedMediaCardId={focusedCardId}
				currentUsername={myUser?.username}
				currentUserId={myUser?.id}
				isCurrentUserHost={isCurrentUserHost}
				focusedScreenShareCard={focusedCard?.isScreenShareCard ? focusedCard : null}
				participantOptions={canvasParticipantOptions}
				whiteboardTileClassName={[
					styles["tile"],
					styles["tile-animated"],
				].join(" ")}
				onRequestFocusMode={openInteractiveFocusMode}
				onResetFocusMode={resetInteractiveFocusMode}
			>
				{(interactive) => {
					const isSingleParticipantView = !hasScreenShare && !interactive.hasWhiteboard && participantCards.length === 1;

					return (
						<>
			{isCinemaMode ? (
				focusedCard?.videoTrack ? (
					<div className={styles["cinema-layout"]}>
						<TheaterModeView
							trackRef={focusedCard.videoTrack}
							displayName={focusedCard.displayName}
							onExit={onToggleCinema}
							onToggleScreenOverlay={interactive.toggleScreenOverlay}
							isScreenOverlayOpen={interactive.isScreenOverlayOpen}
							canUseScreenOverlay={interactive.canUseScreenOverlay}
						>
							{interactive.renderScreenShareOverlay()}
						</TheaterModeView>
						{focusedScreenShareVolumeControl}
					</div>
				) : (
					<div className={styles["empty-state"]}>
						<div className={styles["empty-title"]}>Кино-режим недоступен</div>
						<div className={styles["empty-subtitle"]}>Сначала выберите камеру или трансляцию экрана.</div>
					</div>
				)
			) : isFocusMode && interactive.isCodeSessionOpen ? (
				interactive.renderCodeSession()
			) : isFocusMode && interactive.isWhiteboardFocused && call.callId ? (
				interactive.renderWhiteboardFocus()
			) : isFocusMode && focusedCard?.videoTrack ? (
				<div className={styles["screen-layout"]}>
					<div
						className={[
							styles["main-screen"],
							focusedCard.isScreenShareCard ? styles["main-screen-share"] : styles["main-camera"],
						].join(" ")}
					>
						{focusedCard.videoTrack.participant.isLocal || focusedCard.videoTrack.publication?.isSubscribed ? (
							<VideoTrack trackRef={focusedCard.videoTrack} />
						) : (
							<div className={styles["screen-loading"]}>Открываем видео...</div>
						)}
						{interactive.renderScreenShareOverlay()}
						<div className={styles["name"]}>{focusedCard.displayName}</div>
						<button
							type="button"
							className={styles["focus-close-media-button"]}
							onClick={clearFocusedMedia}
							title="Закрыть выбранное видео"
							aria-label="Закрыть выбранное видео"
						>
							<X size={18} />
						</button>
						<button
							type="button"
							className={styles["focus-exit-button"]}
							onClick={closeFocusMode}
							title="Выйти из фокус-режима"
						>
							Выйти
						</button>
						{focusedScreenShareVolumeControl}
					</div>

					<div className={styles["participants-strip-shell"]}>
						<ParticipantsGrid
							participantCards={participantCards}
							extraTiles={interactive.interactiveTiles}
							focusedCardId={focusedCard.id}
							onOpenCard={openCardInFocus}
							onOpenContextMenu={openParticipantMenu}
							itemsPerPage={8}
							className={styles["participants-strip"]}
							tileClassName={styles["participant-tile"]}
							preferContextMenuAbove
						/>
					</div>
				</div>
			) : isFocusMode && participantCards.length > 0 ? (
				<div className={styles["grid-container"]}>
					<ParticipantsGrid
						participantCards={participantCards}
						extraTiles={interactive.interactiveTiles}
						focusedCardId={focusedCardId}
						onOpenCard={openCardInFocus}
						onOpenContextMenu={openParticipantMenu}
						itemsPerPage={8}
					/>
				</div>
			) : isSingleParticipantView ? (
				<ParticipantsGrid
					participantCards={participantCards}
					extraTiles={interactive.interactiveTiles}
					focusedCardId={focusedCardId}
					onOpenCard={openCardInFocus}
					onOpenContextMenu={openParticipantMenu}
					className={styles["single-layout"]}
					tileClassName={styles["single-tile"]}
				/>
			) : participantCards.length > 0 ? (
				<div className={styles["grid-container"]}>
					<ParticipantsGrid
						participantCards={participantCards}
						extraTiles={interactive.interactiveTiles}
						focusedCardId={focusedCardId}
						onOpenCard={openCardInFocus}
						onOpenContextMenu={openParticipantMenu}
						itemsPerPage={6}
					/>
				</div>
			) : (
				<div className={styles["empty-state"]}>
					<div className={styles["empty-title"]}>Подключаем звонок...</div>
					<div className={styles["empty-subtitle"]}>Ждём, когда участники зайдут в комнату.</div>
				</div>
			)}

			{!isCinemaMode && (
				<CallControls
					hasChat={hasChat}
					isFocusMode={isFocusMode}
					isCinemaMode={isCinemaMode}
					canOpenCinema={canOpenCinemaMode}
					cameraCaptureOptions={cameraCaptureOptions}
					cameraPublishOptions={cameraPublishOptions}
					screenShareCaptureOptions={screenShareCaptureOptions}
					screenSharePublishOptions={screenSharePublishOptions}
					onOpenChat={onOpenChat}
					onOpenWhiteboard={interactive.openWhiteboard}
					onOpenCodeSession={interactive.openCodeSession}
					onToggleScreenOverlay={interactive.toggleScreenOverlay}
					onToggleFocus={onToggleFocus}
					onToggleCinema={onToggleCinema}
					onMinimize={onMinimize}
					onHide={onHide}
					onLeave={onLeave}
					canUseWhiteboard={interactive.canUseWhiteboard}
					isWhiteboardOpen={interactive.isWhiteboardFocused}
					isCodeSessionOpen={interactive.isCodeSessionOpen}
					canUseScreenOverlay={interactive.canUseScreenOverlay}
					isScreenOverlayOpen={interactive.isScreenOverlayOpen}
				/>
			)}
			{participantMenu && contextMenuCard && !isCinemaMode && (
				<ParticipantContextMenu
					x={participantMenu.x}
					y={participantMenu.y}
					displayName={contextMenuCard.displayName}
					hasScreenShare={Boolean(screenCardByIdentity.get(contextMenuCard.participant.identity))}
					hasMicrophoneAudio={remoteMicrophoneParticipants.has(contextMenuCard.participant.identity)}
					hasScreenShareAudio={remoteScreenAudioParticipants.has(contextMenuCard.participant.identity)}
					micVolume={getParticipantVolume(contextMenuCard.participant.identity, "microphone")}
					streamVolume={getParticipantVolume(contextMenuCard.participant.identity, "screenShareAudio")}
					onOpenScreenShare={() => {
						const screenCard = screenCardByIdentity.get(contextMenuCard.participant.identity);
						if (screenCard) openCardInFocus(screenCard);
					}}
					onOpenTheater={() => {
						const targetCard = contextMenuCard.isScreenShareCard
							? contextMenuCard
							: screenCardByIdentity.get(contextMenuCard.participant.identity);
						if (!targetCard) return;
						openCardInFocus(targetCard);
						onToggleCinema();
					}}
					onMicChange={(volume) => setParticipantVolume(contextMenuCard.participant.identity, "microphone", volume)}
					onMicReset={() => resetParticipantVolume(contextMenuCard.participant.identity, "microphone")}
					onStreamChange={(volume) => setParticipantVolume(contextMenuCard.participant.identity, "screenShareAudio", volume)}
					onStreamReset={() => resetParticipantVolume(contextMenuCard.participant.identity, "screenShareAudio")}
				/>
			)}
						</>
					);
				}}
			</InteractiveHost>
		</div>
	);
}
