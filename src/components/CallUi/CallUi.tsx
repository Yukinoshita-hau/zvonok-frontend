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
import { canvasActions, createScreenOverlayBoard, createWhiteboard, fetchCanvasBoards } from "../../store/slices/canvas.slice";
import { selectFocusedCanvasBoard, selectScreenOverlayBoardByCallId, selectWhiteboardByCallId } from "../../store/selectors/canvas.selectors";
import { WhiteboardTile } from "../CallCanvas/WhiteboardTile/WhiteboardTile";
import { WhiteboardFocus } from "../CallCanvas/WhiteboardFocus/WhiteboardFocus";
import { toastActions } from "../../store/slices/toast.slice";
import { ScreenShareOverlayCanvas } from "../CallCanvas/ScreenShareOverlayCanvas/ScreenShareOverlayCanvas";
import type { CanvasParticipantOption } from "../CallCanvas/CallCanvas.types";

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
	const [isScreenOverlayEnabled, setIsScreenOverlayEnabled] = useState(false);
	const callRootRef = useRef<HTMLDivElement>(null);
	const previousScreenTrackSidsRef = useRef<Set<string>>(new Set());
	const dispatch = useDispatch<AppDispatch>();

	const call = useSelector((s: RootState) => s.call);
	const myUser = useSelector((s: RootState) => s.user.myUser);
	const device = useSelector((s: RootState) => s.device);
	const participantVolumes = useSelector((s: RootState) => s.device.participantVolumes);
	const isWebSocketConnected = useSelector((s: RootState) => s.websocket.isConnected);
	const whiteboard = useSelector((s: RootState) => selectWhiteboardByCallId(s, s.call.callId));
	const screenOverlayBoard = useSelector((s: RootState) => selectScreenOverlayBoardByCallId(s, s.call.callId));
	const focusedBoard = useSelector((s: RootState) => selectFocusedCanvasBoard(s));

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
	const hasWhiteboard = Boolean(whiteboard);
	const isWhiteboardFocused = Boolean(focusedBoard && call.callId);
	const isSingleParticipantView = !hasScreenShare && !hasWhiteboard && participantCards.length === 1;

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
	const canUseWhiteboard = Boolean(call.callId);
	const canUseScreenOverlay = Boolean(call.callId && focusedCard?.isScreenShareCard && focusedCard.videoTrack);
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
	const shouldRenderScreenOverlay = Boolean(
		call.callId &&
		screenOverlayBoard &&
		isScreenOverlayEnabled &&
		focusedCard?.isScreenShareCard
	);

	const whiteboardTile = useMemo(() => {
		if (!whiteboard) return [];

		return [
			<WhiteboardTile
				key={`whiteboard-${whiteboard.id}`}
				board={whiteboard}
				className={[
					styles["tile"],
					styles["tile-animated"],
				].join(" ")}
				isFocused={focusedBoard?.id === whiteboard.id}
				onOpen={() => {
					dispatch(canvasActions.focusCanvasBoard(whiteboard.id));
					dispatch(callActions.setCallFocusMode(true));
				}}
			/>
		];
	}, [dispatch, focusedBoard?.id, whiteboard]);

	useEffect(() => {
		if (!call.callId || !isWebSocketConnected) return;

		dispatch(fetchCanvasBoards(call.callId));
		dispatch(canvasActions.subscribeCanvasBoardLifecycle(call.callId));

		return () => {
			if (call.callId) {
				dispatch(canvasActions.unsubscribeCanvasBoardLifecycle(call.callId));
			}
		};
	}, [call.callId, dispatch, isWebSocketConnected]);

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
		dispatch(canvasActions.clearFocusedCanvasBoard());
		setFocusedCardId(card.id);
		const screenTrackSid = screenTrackSidByCardId.get(card.id);
		if (screenTrackSid) {
			dispatch(callActions.setSelectedScreenTrackSid(screenTrackSid));
		}
		dispatch(callActions.setCallFocusMode(true));
	}, [dispatch, screenTrackSidByCardId]);

	const closeFocusMode = useCallback(() => {
		setFocusedCardId(null);
		dispatch(canvasActions.clearFocusedCanvasBoard());
		dispatch(callActions.setCallFocusMode(false));
	}, [dispatch]);

	const openWhiteboard = useCallback(async () => {
		if (!call.callId) return;

		setParticipantMenu(null);
		setFocusedCardId(null);

		if (whiteboard) {
			dispatch(canvasActions.focusCanvasBoard(whiteboard.id));
			dispatch(callActions.setCallFocusMode(true));
			return;
		}

		try {
			const result = await dispatch(createWhiteboard(call.callId)).unwrap();
			dispatch(canvasActions.focusCanvasBoard(result.board.id));
			dispatch(callActions.setCallFocusMode(true));
		} catch (error) {
			dispatch(toastActions.showToast({
				id: crypto.randomUUID(),
				type: "error",
				title: "Доска",
				message: error instanceof Error ? error.message : "Не удалось открыть доску",
			}));
		}
	}, [call.callId, dispatch, whiteboard]);

	const toggleScreenOverlay = useCallback(async () => {
		if (!call.callId || !focusedCard?.isScreenShareCard) {
			dispatch(toastActions.showToast({
				id: crypto.randomUUID(),
				type: "info",
				title: "Разметка",
				message: "Сначала откройте трансляцию экрана в фокусе",
			}));
			return;
		}

		if (screenOverlayBoard) {
			setIsScreenOverlayEnabled((value) => !value);
			return;
		}

		try {
			await dispatch(createScreenOverlayBoard(call.callId)).unwrap();
			setIsScreenOverlayEnabled(true);
		} catch (error) {
			dispatch(toastActions.showToast({
				id: crypto.randomUUID(),
				type: "error",
				title: "Разметка",
				message: error instanceof Error ? error.message : "Не удалось открыть разметку трансляции",
			}));
		}
	}, [call.callId, dispatch, focusedCard, screenOverlayBoard]);

	useEffect(() => {
		if (focusedCard?.isScreenShareCard) return;
		setIsScreenOverlayEnabled(false);
	}, [focusedCard?.isScreenShareCard]);

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

	return (
		<div ref={callRootRef} className={styles["call-root"]}>
			{isCinemaMode ? (
				focusedCard?.videoTrack ? (
					<div className={styles["cinema-layout"]}>
						<TheaterModeView
							trackRef={focusedCard.videoTrack}
							displayName={focusedCard.displayName}
							onExit={onToggleCinema}
							onToggleScreenOverlay={toggleScreenOverlay}
							isScreenOverlayOpen={shouldRenderScreenOverlay}
							canUseScreenOverlay={canUseScreenOverlay}
						>
							{shouldRenderScreenOverlay && call.callId && screenOverlayBoard && (
								<ScreenShareOverlayCanvas
									callId={call.callId}
									board={screenOverlayBoard}
									canDraw
									currentUsername={myUser?.username}
									isCurrentUserHost={isCurrentUserHost}
									participantOptions={canvasParticipantOptions}
									onExit={() => setIsScreenOverlayEnabled(false)}
								/>
							)}
						</TheaterModeView>
						{focusedScreenShareVolumeControl}
					</div>
				) : (
					<div className={styles["empty-state"]}>
						<div className={styles["empty-title"]}>Кино-режим недоступен</div>
						<div className={styles["empty-subtitle"]}>Сначала выберите камеру или трансляцию экрана.</div>
					</div>
				)
			) : isFocusMode && isWhiteboardFocused && call.callId ? (
				<WhiteboardFocus
					callId={call.callId}
					currentUsername={myUser?.username}
					isCurrentUserHost={isCurrentUserHost}
					participantOptions={canvasParticipantOptions}
				/>
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
						{shouldRenderScreenOverlay && call.callId && screenOverlayBoard && (
							<ScreenShareOverlayCanvas
								callId={call.callId}
								board={screenOverlayBoard}
								canDraw
								currentUsername={myUser?.username}
								isCurrentUserHost={isCurrentUserHost}
								participantOptions={canvasParticipantOptions}
								onExit={() => setIsScreenOverlayEnabled(false)}
							/>
						)}
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
							extraTiles={whiteboardTile}
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
						extraTiles={whiteboardTile}
						focusedCardId={focusedCardId}
						onOpenCard={openCardInFocus}
						onOpenContextMenu={openParticipantMenu}
						itemsPerPage={8}
					/>
				</div>
			) : isSingleParticipantView ? (
				<ParticipantsGrid
					participantCards={participantCards}
					extraTiles={whiteboardTile}
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
						extraTiles={whiteboardTile}
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
					onOpenWhiteboard={openWhiteboard}
					onToggleScreenOverlay={toggleScreenOverlay}
					onToggleFocus={onToggleFocus}
					onToggleCinema={onToggleCinema}
					onMinimize={onMinimize}
					onHide={onHide}
					onLeave={onLeave}
					canUseWhiteboard={canUseWhiteboard}
					isWhiteboardOpen={isWhiteboardFocused}
					canUseScreenOverlay={canUseScreenOverlay}
					isScreenOverlayOpen={shouldRenderScreenOverlay}
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
		</div>
	);
}
