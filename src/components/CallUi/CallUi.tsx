import styles from "./CallUi.module.css";
import { ContentView } from "./ContentView";
import { resolveContentSources } from "./sourcePresentation";
import { useConnectionState, useRoomContext } from "@livekit/components-react";
import { ConnectionState, RemoteTrackPublication } from "livekit-client";
import { Maximize2, Minimize2, MessageSquare, Settings, Shapes } from "lucide-react";
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
import { CallParticipantTile } from "./CallParticipantTile";
import { resolveStageLayout, type StageLayout } from "./stageLayout";
import { useCallParticipants } from "./hooks/useCallParticipants";
import {
	ParticipantsGrid,
	type ParticipantContextMenuAnchor,
} from "./ParticipantsGrid";
import { CallControls } from "./CallControls";
import { SettingModal } from "../SettingModal/SettingModal";
import { CallChatPanel } from "./CallChatPanel";
import { getCallDevices } from "./CallDeviceSelectButton";
import type { ParticipantCard } from "./hooks/useCallParticipants";
import { ParticipantContextMenu } from "./ParticipantContextMenu/ParticipantContextMenu";
import {
	deviceActions,
	type ParticipantAudioSource,
} from "../../store/slices/device.slice";
import { FocusedScreenShareVolume } from "./FocusedScreenShareVolume";
import { parseBackendDateMs } from "../../utils/timeHelpers";
import { useFollowSpeaker } from "./hooks/useFollowSpeaker";
import { useCinemaControls } from "./hooks/useCinemaControls";
import { useBrowserActivity } from './BrowserActivity/useBrowserActivity';
import { BrowserActivityPanel } from './BrowserActivity/BrowserActivityPanel';
import { ActivitySelection } from './BrowserActivity/ActivitySelection';
import { clampSplitRatio, resizeSplitWithKey } from './contentGeometry';
import { createPortal } from 'react-dom';

interface ParticipantMenuState {
	cardId: string;
	x: number;
	y: number;
}

export function CallUi({
	hasChat,
	visible,
	isFocusMode,
	isCinemaMode,
	onHide,
	onMinimize,
	onToggleCinema,
}: CallUiProps) {
	const [settingsOpen, setSettingsOpen] = useState(false);

	const [videoFit, setVideoFit] = useState<"contain" | "cover">("contain");
	const [focusedCardId, setFocusedCardId] = useState<string | null>(null);
	const [participantMenu, setParticipantMenu] =
		useState<ParticipantMenuState | null>(null);
	const [elapsedCallMs, setElapsedCallMs] = useState(0);
	const [isCallChatOpen, setIsCallChatOpen] = useState(false);
	const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
	const [microphones, setMicrophones] = useState<MediaDeviceInfo[]>([]);
	const callRootRef = useRef<HTMLDivElement>(null);
	const dispatch = useDispatch<AppDispatch>();

	const call = useSelector((s: RootState) => s.call);
	const layout = call.layoutIntent;
	const browser = useBrowserActivity(call.callId, import.meta.env.VITE_BROWSER_ACTIVITY === 'true' && call.roomType === 'PRIVATE');
	const [activitiesOpen, setActivitiesOpen] = useState(false);
	const [browserChatRatio, setBrowserChatRatio] = useState(65);
	const browserSelected = browser.show && !!browser.activity?.joined && browser.activity.session?.status === 'active';
	useEffect(() => { if (browserSelected || !visible) setActivitiesOpen(false); }, [browserSelected, visible]);
	const setLayout = (next: StageLayout) => dispatch(callActions.setLayoutIntent(next));
	const myUser = useSelector((s: RootState) => s.user.myUser);
	const device = useSelector((s: RootState) => s.device);
	const activeCall = useSelector((s: RootState) =>
		call.chatRoomId
			? (s.activeCall.activeCallsByRoomId[call.chatRoomId] ?? null)
			: null,
	);
	const participantVolumes = useSelector(
		(s: RootState) => s.device.participantVolumes,
	);

	const {
		participantCards,
		people,
		mediaSources,
		remoteMicrophoneParticipants,
		remoteScreenAudioParticipants,
		availableScreenTracks,
	} = useCallParticipants();

	useEffect(() => {
		let isMounted = true;

		const loadDevices = async () => {
			try {
				const [nextCameras, nextMicrophones] = await Promise.all([
					getCallDevices("videoinput"),
					getCallDevices("audioinput"),
				]);
				if (!isMounted) return;
				setCameras(nextCameras);
				setMicrophones(nextMicrophones);
			} catch (error) {
				console.error("Failed to load call devices", error);
			}
		};

		void loadDevices();
		navigator.mediaDevices?.addEventListener?.("devicechange", loadDevices);

		return () => {
			isMounted = false;
			navigator.mediaDevices?.removeEventListener?.(
				"devicechange",
				loadDevices,
			);
		};
	}, []);

	const activeCallStartedAtMs = useMemo(() => {
		return (
			parseDateMs(activeCall?.startedAt) ??
			parseDateMs(activeCall?.activatedAt) ??
			null
		);
	}, [activeCall?.activatedAt, activeCall?.startedAt]);

	const effectiveCallStartedAtMs =
		activeCallStartedAtMs ?? call.callStartedAtMs;

	useEffect(() => {
		if (call.status !== "in_call" || !effectiveCallStartedAtMs) {
			setElapsedCallMs(0);
			return;
		}

		const updateElapsed = () => {
			setElapsedCallMs(Math.max(0, Date.now() - effectiveCallStartedAtMs));
		};

		updateElapsed();
		const intervalId = window.setInterval(updateElapsed, 1000);
		return () => window.clearInterval(intervalId);
	}, [effectiveCallStartedAtMs, call.status]);

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
			const isHost = Boolean(
				myUser?.username &&
				call.hostUsername &&
				myUser.username === call.hostUsername,
			);
			if (isHost) {
				dispatch({
					type: "call/sendEnd",
					payload: {
						callId: call.callId,
						chatRoomId: call.chatRoomId ?? undefined,
					},
				});
				dispatch(callActions.endCallLocally());
				return;
			}
			dispatch({
				type: "call/sendLeave",
				payload: {
					callId: call.callId,
					chatRoomId: call.chatRoomId ?? undefined,
				},
			});
			dispatch(callActions.leaveCallLocally());
			return;
		}

		dispatch({
			type: "call/sendEnd",
			payload: {
				callId: call.callId,
				chatRoomId: call.chatRoomId ?? undefined,
			},
		});
		dispatch(callActions.endCallLocally());
	};

	const qualityRecommendation = device.connectionTestResult.recommendation;

	const cameraPreset = useMemo(() => {
		const quality = resolveQualitySetting(
			"camera",
			device.cameraQuality,
			qualityRecommendation,
		);
		return getQualityPreset("camera", quality);
	}, [device.cameraQuality, qualityRecommendation]);

	const screenSharePreset = useMemo(() => {
		const quality = resolveScreenShareQualitySetting(
			device.screenShareQuality,
			qualityRecommendation,
		);
		return getQualityPreset("screenShare", quality);
	}, [device.screenShareQuality, qualityRecommendation]);

	const cameraCaptureOptions = useMemo(
		() => getCameraCaptureOptions(device.selectedCameraId, cameraPreset),
		[device.selectedCameraId, cameraPreset],
	);
	const cameraPublishOptions = useMemo(
		() => getCameraPublishOptions(cameraPreset),
		[cameraPreset],
	);
	const screenShareCaptureOptions = useMemo(
		() => getScreenShareCaptureOptions(screenSharePreset),
		[screenSharePreset],
	);
	const screenSharePublishOptions = useMemo(
		() => getScreenSharePublishOptions(screenSharePreset),
		[screenSharePreset],
	);

	const connection = useConnectionState();
	const room = useRoomContext();
	useEffect(() => {
		if (connection !== ConnectionState.Connected) return;
		dispatch(callActions.initializePresentation({ hasVideo: [room.localParticipant, ...room.remoteParticipants.values()].some(participant => [...participant.videoTrackPublications.values()].some(publication => !publication.isMuted)) }));
	}, [dispatch, participantCards, call.status, call.mediaState, connection, room]);

	const screenTrackSidByCardId = useMemo(() => {
		const map = new Map<string, string>();
		participantCards.forEach((card) => {
			if (!card.isScreenShareCard) return;
			const trackSid = card.videoTrack?.publication?.trackSid;
			if (trackSid) map.set(card.id, trackSid);
		});
		return map;
	}, [participantCards]);

	const selectedSpeaker = useFollowSpeaker(room, `${call.callId}:${call.conferenceId}:${call.callStartedAtMs}`,
		call.followSpeaker && visible, call.pinnedParticipant, focusedCardId,
		(device.isAutoInputSensitivity ? 30 : device.voiceActivityThreshold) / 100);
	const focusTarget = call.pinnedParticipant ?? (call.followSpeaker ? selectedSpeaker : focusedCardId);
	const stage = resolveStageLayout(
		participantCards,
		layout,
		layout === "focus" ? focusTarget : focusedCardId,
		call.selectedScreenTrackSid,
	);
	const mode = layout === "screen" && mediaSources.length ? "screen" : stage.mode;
	const contentSources = resolveContentSources(mediaSources,
		layout === "auto" && !call.content.sourceManual && mediaSources.some(s => s.type === "screen")
			&& !mediaSources.some(s => s.key === call.content.primaryKey && s.type === "screen") ? null : call.content.primaryKey,
		call.content.secondaryKey);
	const focusedCard = mode === "screen" ? contentSources.primary?.card ?? stage.focusedCard : stage.focusedCard;
	const sourceKeys = JSON.stringify(mediaSources.map(s => s.key));
	useEffect(() => {
		if ((mode !== "screen" && !call.content.primaryKey) || connection !== ConnectionState.Connected || !mediaSources.length) return;
		// Commit fallback now: a later unrelated share must not steal the surviving source.
		if (call.content.primaryKey !== contentSources.primary?.key || (call.content.secondaryKey && !contentSources.secondary)) {
			dispatch(callActions.setContentPresentation({
				primaryKey: contentSources.primary?.key ?? null,
				secondaryKey: contentSources.secondary?.key ?? null, split: call.content.split && Boolean(contentSources.secondary)
			}));
		}
	}, [sourceKeys, mode, connection, call.content.primaryKey, call.content.secondaryKey, call.content.split, dispatch]);


	const contextMenuCard = useMemo(() => {
		if (!participantMenu) return null;
		return (
			participantCards.find((card) => card.id === participantMenu.cardId) ??
			null
		);
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

	const controlsVisible = useCinemaControls(callRootRef, isCinemaMode && visible,
		settingsOpen || Boolean(participantMenu) || connection !== ConnectionState.Connected
		|| (mode === "screen" && (contentSources.primary?.availability !== "available"
			|| (call.content.split && Boolean(contentSources.secondary && contentSources.secondary.availability !== "available")))));
	useEffect(() => {
		if (connection !== ConnectionState.Connected || !call.pinnedParticipant) return;
		if (!people.some(person => person.participantIdentity === call.pinnedParticipant)) dispatch(callActions.setPinnedParticipant(null));
	}, [connection, people, call.pinnedParticipant, dispatch]);
	useEffect(() => { setFocusedCardId(null); }, [call.callId, call.conferenceId, call.callStartedAtMs]);
	const canOpenCinemaMode = browserSelected || (mode !== "voice" && Boolean(focusedCard?.videoTrack));
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
		if (connection !== ConnectionState.Connected) return;
		const primary = contentSources.primary;
		const secondary = call.content.split ? contentSources.secondary : null;
		const selected = mode === "screen"
			? (primary?.type === "screen" ? primary : secondary?.type === "screen" ? secondary : null)?.publicationSid ?? null
			: availableScreenTracks.some(t => t.publication.trackSid === call.selectedScreenTrackSid)
				? call.selectedScreenTrackSid : availableScreenTracks[0]?.publication.trackSid ?? null;
		if (selected !== call.selectedScreenTrackSid) dispatch(callActions.setSelectedScreenTrackSid(selected));
		if (!mediaSources.length && (call.content.primaryKey || call.content.secondaryKey)) {
			dispatch(callActions.setContentPresentation({ primaryKey: null, secondaryKey: null, split: false }));
			if (call.content.sourceManual || layout === "screen") dispatch(callActions.setLayoutIntent("voice"));
		}
	}, [sourceKeys, connection, mode, layout, call.content, call.selectedScreenTrackSid, dispatch]);

	useEffect(() => {
		availableScreenTracks.forEach((trackRef) => {
			const publication = trackRef.publication;
			if (!(publication instanceof RemoteTrackPublication)) return;
			if (!publication.isDesired) publication.setSubscribed(true);
		});
	}, [availableScreenTracks]);

	const openCardInFocus = useCallback(
		(card: ParticipantCard) => {
			browser.setShow(false);
			setParticipantMenu(null);
			setFocusedCardId(card.id);
			if (!card.isScreenShareCard) dispatch(callActions.setPinnedParticipant(card.participant.identity));
			setLayout(card.isScreenShareCard ? "screen" : "focus");
			const screenTrackSid = screenTrackSidByCardId.get(card.id);
			if (screenTrackSid) {
				dispatch(callActions.setContentPresentation({ primaryKey: `screen:${screenTrackSid}`, sourceManual: true }));
				dispatch(callActions.setSelectedScreenTrackSid(screenTrackSid));
			}
			dispatch(callActions.setCallFocusMode(true));
		},
		[dispatch, screenTrackSidByCardId],
	);

	const closeFocusMode = useCallback(() => {
		browser.setShow(false);
		setFocusedCardId(null);
		setLayout("grid");
		dispatch(callActions.setCallFocusMode(false));
	}, [dispatch]);

	const getParticipantVolume = useCallback(
		(participantIdentity: string, source: ParticipantAudioSource) => {
			return (
				participantVolumes.find(
					(item) =>
						item.participantIdentity === participantIdentity &&
						item.source === source,
				)?.volume ?? 100
			);
		},
		[participantVolumes],
	);

	const setParticipantVolume = useCallback(
		(
			participantIdentity: string,
			source: ParticipantAudioSource,
			volume: number,
		) => {
			dispatch(
				deviceActions.setParticipantVolume({
					participantIdentity,
					source,
					volume,
				}),
			);
		},
		[dispatch],
	);

	const resetParticipantVolume = useCallback(
		(participantIdentity: string, source: ParticipantAudioSource) => {
			dispatch(
				deviceActions.resetParticipantVolume({ participantIdentity, source }),
			);
		},
		[dispatch],
	);

	const openParticipantMenu = useCallback(
		(card: ParticipantCard, anchor: ParticipantContextMenuAnchor) => {
			const menuWidth = 320;
			const menuHeight =
				screenCardByIdentity.has(card.participant.identity) ||
					remoteScreenAudioParticipants.has(card.participant.identity)
					? 270
					: 172;
			const rootRect = callRootRef.current?.getBoundingClientRect();
			const rootLeft = rootRect?.left ?? 0;
			const rootTop = rootRect?.top ?? 0;
			const rootWidth = rootRect?.width ?? window.innerWidth;
			const rootHeight = rootRect?.height ?? window.innerHeight;
			const cardLeft = anchor.left - rootLeft;
			const cardBottom = anchor.bottom - rootTop;
			const preferredX = cardLeft + 8;
			const belowY = cardBottom + 8;
			const aboveY = anchor.top - rootTop - menuHeight - 8;
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
		},
		[remoteScreenAudioParticipants, screenCardByIdentity],
	);

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
		if (!isCinemaMode || focusedCard?.videoTrack || browserSelected) return;
		dispatch(callActions.setTheaterMode(false));
	}, [dispatch, focusedCard, isCinemaMode, browserSelected]);

	const focusedScreenShareVolumeControl =
		focusedCard?.isScreenShareCard &&
			remoteScreenAudioParticipants.has(focusedCard.participant.identity) ? (
			<FocusedScreenShareVolume
				volume={getParticipantVolume(
					focusedCard.participant.identity,
					"screenShareAudio",
				)}
				onChange={(volume) =>
					setParticipantVolume(
						focusedCard.participant.identity,
						"screenShareAudio",
						volume,
					)
				}
				onReset={() =>
					resetParticipantVolume(
						focusedCard.participant.identity,
						"screenShareAudio",
					)
				}
			/>
		) : null;

	const chooseLayout = (next: StageLayout) => {
		browser.setShow(next === 'screen' || next === 'focus' || next === 'auto');
		if (next === "auto") dispatch(callActions.setContentPresentation({ sourceManual: false, primaryKey: null, secondaryKey: null, split: false }));
		setLayout(next);
		setFocusedCardId(null);
		dispatch(callActions.setCallFocusMode(next === "focus"));
		if (isCinemaMode) dispatch(callActions.setTheaterMode(false));
	};
	const minimize = () => {
		onMinimize();
		requestAnimationFrame(() => document.querySelector<HTMLButtonElement>('[data-call-dock] [aria-label="Развернуть"]')?.focus({ preventScroll: true }));
	};

	return (
		<div
			ref={callRootRef}
			aria-hidden={!visible}
			className={styles["call-root"]}
			data-fit={videoFit}
			data-cinema={isCinemaMode}
			data-controls-visible={controlsVisible}
			data-layout={mode}
			data-activity-content={browserSelected || undefined}
			style={browserSelected && isCallChatOpen ? { gridTemplateColumns: `minmax(0, ${browserChatRatio}fr) 10px minmax(280px, ${100 - browserChatRatio}fr)` } : undefined}
			data-focus-person={mode === "focus" ? focusedCard?.participant.identity : undefined}
			data-follow-speaker={call.followSpeaker}
			data-pinned-person={call.pinnedParticipant ?? undefined}
		>
			{!visible && browser.activity && !browser.activity.joined && browser.declined !== browser.activity.activityId && createPortal(
				<aside className={styles['browser-invitation']} role="status" aria-label="Приглашение в совместный браузер">
					<span>Совместный браузер в звонке</span>
					<button disabled={browser.busy} onClick={() => { void browser.perform('join'); dispatch(callActions.setPresentationMode('expanded')); }}>Присоединиться</button>
					<button onClick={browser.decline}>Не сейчас</button>
				</aside>, document.body)}
			<div className={styles["stage-main"]}>
				<header className={styles["stage-header"]}>
					<strong>
						{call.roomType === "GROUP" ? "Групповой звонок" : "Звонок"} ·{" "}
						{participantCards.filter((c) => !c.isScreenShareCard).length}
					</strong>
					{import.meta.env.VITE_BROWSER_ACTIVITY === 'true' && call.roomType === 'PRIVATE' && <>
						<button className={styles['activities-entry']} aria-haspopup="dialog" aria-expanded={activitiesOpen} onClick={() => setActivitiesOpen(v => !v)}><Shapes size={16} aria-hidden="true" />Активности</button>
						{activitiesOpen && <ActivitySelection browser={browser} onClose={() => setActivitiesOpen(false)} />}
					</>}
					<button
						type="button"
						title="Настройки звука и устройств"
						aria-label="Настройки звука и устройств"
						onClick={() => setSettingsOpen(true)}
					>
						<Settings size={17} />
					</button>
					<span className={styles["stage-duration"]}>
						{effectiveCallStartedAtMs
							? formatCallDuration(elapsedCallMs)
							: "Подключение…"}
					</span>
					<button
						type="button"
						title="Вернуться к перепискам"
						aria-label="Свернуть звонок"
						onClick={minimize}
					>
						<Minimize2 size={17} />
					</button>
				</header>
				{!browserSelected && !activitiesOpen && (browser.error || browser.notice) && <p className={styles['browser-notice']} role="status">{browser.error || browser.notice}</p>}
				<div className={styles["layout-toolbar"]} aria-label="Раскладка звонка">
					<button type="button" aria-pressed={layout === "auto"} onClick={() => chooseLayout("auto")}>Авто</button>
					<button type="button" aria-pressed={mode === "voice"} onClick={() => chooseLayout("voice")}>Голос</button>
					<button
						type="button"
						aria-pressed={mode === "grid" && !isCinemaMode}
						onClick={() => chooseLayout("grid")}
					>
						Сетка
					</button>
					<button
						type="button"
						aria-pressed={mode === "focus" && !isCinemaMode}
						onClick={() => chooseLayout("focus")}
					>
						Фокус
					</button>
					<button type="button" aria-pressed={call.followSpeaker && !call.pinnedParticipant}
						onClick={() => {
							const enabled = !call.followSpeaker || Boolean(call.pinnedParticipant);
							if (!enabled && focusedCard && !focusedCard.isScreenShareCard) setFocusedCardId(focusedCard.id);
							dispatch(callActions.setFollowSpeaker(enabled));
						}}>Следовать за говорящим</button>
					<button
						type="button"
						disabled={!mediaSources.length && !browser.activity?.joined}
						aria-pressed={mode === "screen" && !isCinemaMode}
						onClick={() => chooseLayout("screen")}
					>
						Контент
					</button>
					<button
						type="button"
						disabled={!canOpenCinemaMode}
						aria-pressed={isCinemaMode}
						onClick={onToggleCinema}
					>
						{isCinemaMode ? "Выйти из кино · Esc" : "Кино"}
					</button>
					<button
						type="button"
						title="Масштаб камеры"
						aria-label="Масштаб камеры"
						aria-pressed={videoFit === "cover"}
						onClick={() =>
							setVideoFit((v) => (v === "contain" ? "cover" : "contain"))
						}
					>
						{videoFit === "contain" ? "Вписать" : "Заполнить"}
					</button>
					{hasChat && (
						<button
							type="button"
							className={styles["chat-toggle"]}
							aria-label="Переписка звонка"
							aria-expanded={isCallChatOpen}
							onClick={() => setIsCallChatOpen((v) => !v)}
						>
							<MessageSquare size={16} />
						</button>
					)}
				</div>
				<div className={styles["stage-media"]}>
					{browser.activity && <div className={`${styles['browser-stage']} ${!browserSelected ? styles['browser-tile'] : ''}`}>
						<BrowserActivityPanel browser={browser} visible={visible} compact={!browserSelected} />
						{browserSelected && !isCinemaMode && <div className={styles['browser-people']} aria-label="Участники звонка">
							{participantCards.filter(c => !c.isScreenShareCard).map(card => <CallParticipantTile key={card.id} cardId={card.id}
								participant={card.participant} videoTrack={card.videoTrack} avatarUrl={card.avatarUrl} displayName={card.displayName} className={styles['browser-person']} />)}
						</div>}
					</div>}
					{!browserSelected && (mode === "voice" ? (
						<div className={styles["voice-grid"]} data-voice-count={participantCards.filter(c => !c.isScreenShareCard).length}>
							{participantCards.filter(c => !c.isScreenShareCard).map(card => (
								<CallParticipantTile key={card.id} cardId={card.id} participant={card.participant}
									avatarUrl={card.avatarUrl} displayName={card.displayName} className={styles["voice-card"]} />
							))}
						</div>
					) : mode === "screen" ? (
						<ContentView sources={mediaSources} people={people} primary={contentSources.primary} secondary={contentSources.secondary} cinema={isCinemaMode}
							onOpenCard={openCardInFocus} onOpenContextMenu={openParticipantMenu} volumeControl={focusedScreenShareVolumeControl} />
					) : focusedCard ? (
						<div className={styles["screen-layout"]}>
							<div className={styles["main-screen"]}>
								<ParticipantsGrid participantCards={participantCards} focusedCardId={focusedCard.id}
									onOpenCard={openCardInFocus} onOpenContextMenu={openParticipantMenu} focus cinema={isCinemaMode} />
								{focusedScreenShareVolumeControl}
								<button
									type="button"
									className={styles["pin-action"]}
									aria-label={call.pinnedParticipant === focusedCard.participant.identity ? "Открепить" : "Закрепить"}
									aria-pressed={call.pinnedParticipant === focusedCard.participant.identity}
									onClick={() => {
										setFocusedCardId(focusedCard.id);
										dispatch(callActions.setPinnedParticipant(call.pinnedParticipant === focusedCard.participant.identity ? null : focusedCard.participant.identity));
									}}
								>
									{call.pinnedParticipant === focusedCard.participant.identity ? "Открепить" : "Закрепить"}
								</button>
								{!isCinemaMode && (
									<button
										type="button"
										className={styles["cinema-action"]}
										title="Открыть кино-режим"
										aria-label="Открыть кино-режим"
										disabled={!canOpenCinemaMode}
										onClick={onToggleCinema}
									>
										<Maximize2 size={18} />
									</button>
								)}
							</div>
						</div>
					) : (
						<div className={styles["grid-container"]}>
							<ParticipantsGrid
								participantCards={participantCards}
								focusedCardId={focusedCardId}
								onOpenCard={openCardInFocus}
								onOpenContextMenu={openParticipantMenu}
							/>
						</div>
					))}
				</div>
				<CallControls
					hasChat={hasChat}
					isFocusMode={isFocusMode}
					isCinemaMode={isCinemaMode}
					canOpenCinema={canOpenCinemaMode}
					cameras={cameras}
					microphones={microphones}
					selectedCameraId={device.selectedCameraId}
					selectedMicrophoneId={device.selectedMicrophoneId}
					cameraCaptureOptions={cameraCaptureOptions}
					cameraPublishOptions={cameraPublishOptions}
					screenShareCaptureOptions={screenShareCaptureOptions}
					screenSharePublishOptions={screenSharePublishOptions}
					onOpenChat={() => setIsCallChatOpen((v) => !v)}
					onToggleFocus={() =>
						isFocusMode ? closeFocusMode() : chooseLayout("focus")
					}
					onToggleCinema={onToggleCinema}
					onMinimize={minimize}
					onHide={onHide}
					onLeave={onLeave}
				/>
			</div>
			{browserSelected && hasChat && isCallChatOpen && !isCinemaMode && <div role="separator" tabIndex={0}
				className={styles['browser-chat-divider']} aria-label="Пропорции браузера и чата" aria-orientation="vertical"
				aria-valuemin={30} aria-valuemax={70} aria-valuenow={browserChatRatio}
				onPointerDown={e => { if (e.button === 0) e.currentTarget.setPointerCapture(e.pointerId); }}
				onPointerMove={e => {
					if (e.currentTarget.hasPointerCapture(e.pointerId)) {
						const r = callRootRef.current!.getBoundingClientRect(); setBrowserChatRatio(clampSplitRatio((e.clientX - r.left) / r.width * 100));
					}
				}}
				onPointerUp={e => { if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId); }}
				onKeyDown={e => { const next = resizeSplitWithKey(e.key, browserChatRatio, true); if (next !== null) { e.preventDefault(); setBrowserChatRatio(next); } }} />}
			{hasChat && isCallChatOpen && !isCinemaMode && call.chatRoomId && (
				<CallChatPanel
					roomId={call.chatRoomId}
					onClose={() => setIsCallChatOpen(false)}
				/>
			)}

			<SettingModal
				isOpen={settingsOpen}
				onClose={() => setSettingsOpen(false)}
			/>
			{participantMenu && contextMenuCard && !isCinemaMode && (
				<ParticipantContextMenu
					x={participantMenu.x}
					y={participantMenu.y}
					displayName={contextMenuCard.displayName}
					pinnedParticipant={call.pinnedParticipant === contextMenuCard.participant.identity}
					onPinParticipant={!contextMenuCard.isScreenShareCard ? () => {
						dispatch(callActions.setPinnedParticipant(call.pinnedParticipant === contextMenuCard.participant.identity
							? null : contextMenuCard.participant.identity));
						setParticipantMenu(null);
					} : undefined}
					hasScreenShare={Boolean(
						screenCardByIdentity.get(contextMenuCard.participant.identity),
					)}
					hasMicrophoneAudio={remoteMicrophoneParticipants.has(
						contextMenuCard.participant.identity,
					)}
					hasScreenShareAudio={remoteScreenAudioParticipants.has(
						contextMenuCard.participant.identity,
					)}
					micVolume={getParticipantVolume(
						contextMenuCard.participant.identity,
						"microphone",
					)}
					streamVolume={getParticipantVolume(
						contextMenuCard.participant.identity,
						"screenShareAudio",
					)}
					onOpenScreenShare={() => {
						const screenCard = screenCardByIdentity.get(
							contextMenuCard.participant.identity,
						);
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
					onMicChange={(volume) =>
						setParticipantVolume(
							contextMenuCard.participant.identity,
							"microphone",
							volume,
						)
					}
					onMicReset={() =>
						resetParticipantVolume(
							contextMenuCard.participant.identity,
							"microphone",
						)
					}
					onStreamChange={(volume) =>
						setParticipantVolume(
							contextMenuCard.participant.identity,
							"screenShareAudio",
							volume,
						)
					}
					onStreamReset={() =>
						resetParticipantVolume(
							contextMenuCard.participant.identity,
							"screenShareAudio",
						)
					}
				/>
			)}
		</div>
	);
}

function formatCallDuration(ms: number): string {
	const totalSeconds = Math.floor(ms / 1000);
	const hours = Math.floor(totalSeconds / 3600);
	const minutes = Math.floor((totalSeconds % 3600) / 60);
	const seconds = totalSeconds % 60;

	if (hours > 0) {
		return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
	}

	return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function parseDateMs(value?: string | null): number | null {
	return parseBackendDateMs(value);
}
