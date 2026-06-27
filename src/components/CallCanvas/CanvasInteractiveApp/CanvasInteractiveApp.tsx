import { useCallback, useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
	canvasActions,
	closeCanvasBoard,
	createScreenOverlayBoard,
	createWhiteboard,
	fetchCanvasBoards,
} from "../../../store/slices/canvas.slice";
import { codeSessionActions, fetchActiveCodeSession } from "../../../store/slices/codeSession.slice";
import {
	selectFocusedCanvasBoard,
	selectScreenOverlayBoardByCallId,
	selectWhiteboardsByCallId,
} from "../../../store/selectors/canvas.selectors";
import type { AppDispatch, RootState } from "../../../store/store";
import { toastActions } from "../../../store/slices/toast.slice";
import { ScreenShareOverlayCanvas } from "../ScreenShareOverlayCanvas/ScreenShareOverlayCanvas";
import { WhiteboardFocus } from "../WhiteboardFocus/WhiteboardFocus";
import { WhiteboardTile } from "../WhiteboardTile/WhiteboardTile";
import { CodeSessionPanel } from "../../CodeSession/components/CodeSessionPanel";
import { CodeSessionTile } from "../../CodeSession/components/CodeSessionTile";
import type {
	CanvasInteractiveAppContext,
	CanvasInteractiveAppProps,
} from "./CanvasInteractiveApp.types";

export function CanvasInteractiveApp({
	callId,
	isWebSocketConnected,
	isFocusMode,
	focusedMediaCardId,
	currentUsername,
	currentUserId,
	isCurrentUserHost = false,
	focusedScreenShareCard,
	participantOptions,
	whiteboardTileClassName,
	onRequestFocusMode,
	onResetFocusMode,
	children,
}: CanvasInteractiveAppProps) {
	const [isScreenOverlayEnabled, setIsScreenOverlayEnabled] = useState(false);
	const [isCodeSessionOpen, setIsCodeSessionOpen] = useState(false);
	const dispatch = useDispatch<AppDispatch>();
	const whiteboards = useSelector((state: RootState) => selectWhiteboardsByCallId(state, callId));
	const activeCodeSession = useSelector((state: RootState) => callId ? state.codeSession.activeSessionByCallId[callId] ?? null : null);
	const primaryWhiteboard = whiteboards.find((board) => !board.backgroundImageUrl);
	const focusedBoard = useSelector((state: RootState) => selectFocusedCanvasBoard(state, callId));
	const screenShareOwnerUsername = focusedScreenShareCard?.participant.identity ||
		focusedScreenShareCard?.participant.name ||
		null;
	const screenOverlayBoard = useSelector((state: RootState) => selectScreenOverlayBoardByCallId(
		state,
		callId,
		screenShareOwnerUsername
	));
	const isCurrentUserScreenSharer = Boolean(currentUsername && screenShareOwnerUsername && currentUsername === screenShareOwnerUsername);

	const hasWhiteboard = whiteboards.length > 0;
	const isWhiteboardFocused = Boolean(focusedBoard && callId);
	const canUseWhiteboard = Boolean(callId);
	const canUseScreenOverlay = Boolean(callId && focusedScreenShareCard?.isScreenShareCard && focusedScreenShareCard.videoTrack);
	const isScreenOverlayOpen = Boolean(
		callId &&
		screenOverlayBoard &&
		isScreenOverlayEnabled &&
		focusedScreenShareCard?.isScreenShareCard
	);

	useEffect(() => {
		if (!callId || !isWebSocketConnected) return;

		dispatch(fetchCanvasBoards(callId));
		dispatch(canvasActions.subscribeCanvasBoardLifecycle(callId));

		return () => {
			dispatch(canvasActions.unsubscribeCanvasBoardLifecycle(callId));
		};
	}, [callId, dispatch, isWebSocketConnected]);

	useEffect(() => {
		if (!callId || !isWebSocketConnected) return;

		void dispatch(fetchActiveCodeSession(callId));
		dispatch(codeSessionActions.subscribeCodeSession({ callSessionId: callId }));

		return () => {
			dispatch(codeSessionActions.unsubscribeCodeSession({ callSessionId: callId }));
		};
	}, [callId, dispatch, isWebSocketConnected]);

	useEffect(() => {
		if (callId) return;
		dispatch(canvasActions.clearFocusedCanvasBoard());
		onResetFocusMode();
	}, [callId, dispatch, onResetFocusMode]);

	useEffect(() => {
		if (isFocusMode) return;
		dispatch(canvasActions.clearFocusedCanvasBoard());
	}, [dispatch, isFocusMode]);

	useEffect(() => {
		if (!focusedMediaCardId) return;
		dispatch(canvasActions.clearFocusedCanvasBoard());
	}, [dispatch, focusedMediaCardId]);

	useEffect(() => {
		if (focusedScreenShareCard?.isScreenShareCard) return;
		setIsScreenOverlayEnabled(false);
	}, [focusedScreenShareCard?.isScreenShareCard]);

	const showCanvasToast = useCallback((title: string, message: string, type: "error" | "info" = "error") => {
		dispatch(toastActions.showToast({
			id: crypto.randomUUID(),
			type,
			title,
			message,
		}));
	}, [dispatch]);

	const openWhiteboard = useCallback(async () => {
		if (!callId) return;
		setIsCodeSessionOpen(false);

		if (primaryWhiteboard) {
			dispatch(canvasActions.focusCanvasBoard(primaryWhiteboard.id));
			onRequestFocusMode();
			return;
		}

		try {
			const result = await dispatch(createWhiteboard(callId)).unwrap();
			dispatch(canvasActions.focusCanvasBoard(result.board.id));
			onRequestFocusMode();
		} catch (error) {
			showCanvasToast(
				"Доска",
				error instanceof Error ? error.message : "Не удалось открыть доску"
			);
		}
	}, [callId, dispatch, onRequestFocusMode, primaryWhiteboard, showCanvasToast]);

	const openCodeSession = useCallback(() => {
		if (!callId) return;
		dispatch(canvasActions.clearFocusedCanvasBoard());
		setIsCodeSessionOpen(true);
		onRequestFocusMode();
	}, [callId, dispatch, onRequestFocusMode]);

	const closeCodeSession = useCallback(() => {
		setIsCodeSessionOpen(false);
		onResetFocusMode();
	}, [onResetFocusMode]);

	const toggleScreenOverlay = useCallback(async () => {
		if (!callId || !focusedScreenShareCard?.isScreenShareCard) {
			showCanvasToast("Разметка", "Сначала откройте трансляцию экрана в фокусе", "info");
			return;
		}

		if (screenOverlayBoard) {
			setIsScreenOverlayEnabled((value) => !value);
			return;
		}

		if (!isCurrentUserScreenSharer) {
			showCanvasToast("Разметка", "Разметку должен открыть тот, кто шарит экран", "info");
			return;
		}

		try {
			let result = await dispatch(createScreenOverlayBoard(callId)).unwrap();

			if (result.board.createdBy !== screenShareOwnerUsername) {
				await dispatch(closeCanvasBoard({ callId, boardId: result.board.id })).unwrap();
				result = await dispatch(createScreenOverlayBoard(callId)).unwrap();
			}

			if (result.board.createdBy !== screenShareOwnerUsername) {
				showCanvasToast("Разметка", "Не удалось создать отдельную разметку для этой трансляции", "error");
				return;
			}
			setIsScreenOverlayEnabled(true);
		} catch (error) {
			showCanvasToast(
				"Разметка",
				error instanceof Error ? error.message : "Не удалось открыть разметку трансляции"
			);
		}
	}, [callId, dispatch, focusedScreenShareCard?.isScreenShareCard, isCurrentUserScreenSharer, screenOverlayBoard, screenShareOwnerUsername, showCanvasToast]);

	const whiteboardTiles = useMemo(() => {
		return whiteboards.map((board) => (
			<WhiteboardTile
				key={`whiteboard-${board.id}`}
				board={board}
				className={whiteboardTileClassName}
				isFocused={focusedBoard?.id === board.id}
				onOpen={() => {
					dispatch(canvasActions.focusCanvasBoard(board.id));
					onRequestFocusMode();
				}}
			/>
		));
	}, [dispatch, focusedBoard?.id, onRequestFocusMode, whiteboardTileClassName, whiteboards]);

	const interactiveTiles = useMemo(() => {
		if (!activeCodeSession?.active) return whiteboardTiles;

		return [
			...whiteboardTiles,
			<CodeSessionTile
				key={`code-session-${activeCodeSession.id}`}
				session={activeCodeSession}
				className={whiteboardTileClassName}
				isFocused={isCodeSessionOpen}
				onOpen={openCodeSession}
			/>,
		];
	}, [activeCodeSession, isCodeSessionOpen, openCodeSession, whiteboardTileClassName, whiteboardTiles]);

	const renderWhiteboardFocus = useCallback(() => {
		if (!callId) return null;

		return (
			<WhiteboardFocus
				callId={callId}
				currentUsername={currentUsername}
				participantOptions={participantOptions}
			/>
		);
	}, [callId, currentUsername, participantOptions]);

	const renderCodeSession = useCallback(() => {
		if (!isCodeSessionOpen || !callId) return null;
		return (
			<CodeSessionPanel
				callSessionId={callId}
				currentUserId={currentUserId}
				currentUsername={currentUsername}
				isCurrentUserHost={isCurrentUserHost}
				participantOptions={participantOptions}
				onClose={closeCodeSession}
			/>
		);
	}, [
		callId,
		closeCodeSession,
		currentUserId,
		currentUsername,
		isCodeSessionOpen,
		isCurrentUserHost,
		participantOptions,
	]);

	const renderScreenShareOverlay = useCallback(() => {
		if (!isScreenOverlayOpen || !callId || !screenOverlayBoard) return null;

		return (
			<ScreenShareOverlayCanvas
				callId={callId}
				board={screenOverlayBoard}
				canDraw
				currentUsername={currentUsername}
				managerUsername={screenShareOwnerUsername}
				participantOptions={participantOptions}
				onExit={() => setIsScreenOverlayEnabled(false)}
			/>
		);
	}, [
		callId,
		currentUsername,
		isScreenOverlayOpen,
		participantOptions,
		screenOverlayBoard,
		screenShareOwnerUsername,
	]);

	const context = useMemo<CanvasInteractiveAppContext>(() => ({
		hasWhiteboard,
		isWhiteboardFocused,
		canUseWhiteboard,
		canUseScreenOverlay,
		isScreenOverlayOpen,
		isCodeSessionOpen,
		whiteboardTiles,
		interactiveTiles,
		openWhiteboard,
		openCodeSession,
		closeCodeSession,
		toggleScreenOverlay,
		renderWhiteboardFocus,
		renderCodeSession,
		renderScreenShareOverlay,
	}), [
		canUseScreenOverlay,
		canUseWhiteboard,
		closeCodeSession,
		hasWhiteboard,
		isCodeSessionOpen,
		isScreenOverlayOpen,
		isWhiteboardFocused,
		interactiveTiles,
		openCodeSession,
		openWhiteboard,
		renderCodeSession,
		renderScreenShareOverlay,
		renderWhiteboardFocus,
		toggleScreenOverlay,
		whiteboardTiles,
	]);

	return <>{children(context)}</>;
}
