import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import cn from "classnames";
import { useDispatch, useSelector } from "react-redux";
import type { AppDispatch, RootState } from "../../../store/store";
import {
	canvasActions,
	clearCanvasBoard,
	closeCanvasBoard,
	createCanvasStickyNote,
	deleteCanvasStickyNote,
	resetCanvasTimer,
	startCanvasTimer,
	stopCanvasTimer,
	undoLastCanvasStroke,
	unvoteCanvasNote,
	updateCanvasBoardPermissions,
	updateCanvasBoardTemplate,
	updateCanvasPresenter,
	updateCanvasStickyNote,
	uploadCanvasBackgroundImage,
	voteCanvasNote,
} from "../../../store/slices/canvas.slice";
import {
	selectCanvasNotesByBoardId,
	selectCanvasVotesByBoardId,
} from "../../../store/selectors/canvas.selectors";
import type {
	CanvasBoardSessionDto,
	CanvasDrawingAccess,
	CanvasInteractionTool,
	CanvasPointDto,
	CanvasReactionType,
	CanvasStickyNoteDto,
	CanvasTemplateType,
} from "../../../api/interfaces/CanvasDtos";
import { StringToColor } from "../../../utils/stringHelpers";
import { getCanvasPermissionState } from "../../../utils/canvasPermissions";
import { toastActions } from "../../../store/slices/toast.slice";
import { CanvasPresenceLayer } from "./CanvasPresenceLayer";
import { CanvasReactionLayer } from "../CanvasReactionLayer/CanvasReactionLayer";
import { CanvasStickyNotesLayer } from "../CanvasStickyNotesLayer/CanvasStickyNotesLayer";
import { CanvasTemplateLayer } from "../CanvasTemplateLayer/CanvasTemplateLayer";
import { CanvasTimerChip } from "../CanvasTimerChip/CanvasTimerChip";
import { useCanvasDrawing } from "../hooks/useCanvasDrawing";
import { WhiteboardToolbar } from "../WhiteboardToolbar/WhiteboardToolbar";
import type { CanvasParticipantOption } from "../CallCanvas.types";
import styles from "./DrawableCanvas.module.css";

interface DrawableCanvasProps {
	callId: number;
	board: CanvasBoardSessionDto;
	permissionBoard?: CanvasBoardSessionDto;
	canDraw: boolean;
	currentUsername?: string | null;
	isCurrentUserHost?: boolean;
	participantOptions?: CanvasParticipantOption[];
	variant?: "whiteboard" | "overlay";
	onExit: () => void;
}

const DEFAULT_NOTE_WIDTH = 0.16;
const DEFAULT_NOTE_HEIGHT = 0.12;
const NOTE_COLORS = ["#fde68a", "#bfdbfe", "#bbf7d0", "#fecdd3", "#ddd6fe"];

export function DrawableCanvas({
	callId,
	board,
	permissionBoard,
	canDraw,
	currentUsername,
	isCurrentUserHost = false,
	participantOptions = [],
	variant = "whiteboard",
	onExit,
}: DrawableCanvasProps) {
	const myUsername = useSelector((state: RootState) => state.user.myUser?.username ?? "guest");
	const notes = useSelector((state: RootState) => selectCanvasNotesByBoardId(state, board.id));
	const votes = useSelector((state: RootState) => selectCanvasVotesByBoardId(state, board.id));
	const activeUsername = currentUsername ?? myUsername;
	const userColor = useMemo(() => StringToColor(myUsername), [myUsername]);
	const [color, setColor] = useState(userColor);
	const [hasPickedColor, setHasPickedColor] = useState(false);
	const [width, setWidth] = useState(5);
	const [tool, setTool] = useState<CanvasInteractionTool>("PEN");
	const [reaction, setReaction] = useState<CanvasReactionType>("THUMBS_UP");
	const [isBusy, setIsBusy] = useState(false);
	const [isClearConfirmOpen, setIsClearConfirmOpen] = useState(false);
	const [backgroundMode, setBackgroundMode] = useState<"grid" | "dots" | "clean">("dots");
	const [isOverlayHidden, setIsOverlayHidden] = useState(false);
	const [overlayOpacity, setOverlayOpacity] = useState(1);
	const [isFollowingPresenter, setIsFollowingPresenter] = useState(true);
	const dispatch = useDispatch<AppDispatch>();
	const boardForPermissions = permissionBoard ?? board;

	const permissionState = useMemo(() => getCanvasPermissionState({
		board: boardForPermissions,
		currentUsername: activeUsername,
		isCurrentUserHost,
	}), [activeUsername, boardForPermissions, isCurrentUserHost]);
	const effectiveCanDraw = canDraw && permissionState.canDrawCanvas;
	const templateType = board.templateType ?? (backgroundMode === "grid" ? "GRID" : backgroundMode === "clean" ? "CLEAN" : "DOTS");
	const isPresenterModeEnabled = board.presenterModeEnabled ?? false;
	const presenterUsername = board.presenterUsername ?? null;
	const isPresenter = isPresenterModeEnabled && presenterUsername === activeUsername;

	useEffect(() => {
		if (hasPickedColor) return;
		setColor(userColor);
	}, [hasPickedColor, userColor]);

	const showToast = useCallback((title: string, message: string) => {
		dispatch(toastActions.showToast({
			id: crypto.randomUUID(),
			type: "error",
			title,
			message,
		}));
	}, [dispatch]);

	const createStickyAtPoint = useCallback((point: CanvasPointDto) => {
		if (!effectiveCanDraw) return;
		const colorIndex = notes.length % NOTE_COLORS.length;
		void dispatch(createCanvasStickyNote({
			callId,
			boardId: board.id,
			request: {
				text: "Новая заметка",
				color: NOTE_COLORS[colorIndex],
				x: point.x,
				y: point.y,
				width: DEFAULT_NOTE_WIDTH,
				height: DEFAULT_NOTE_HEIGHT,
			},
		})).unwrap().catch((error) => {
			showToast("Заметка", error instanceof Error ? error.message : "Не удалось создать стикер");
		});
	}, [board.id, callId, dispatch, effectiveCanDraw, notes.length, showToast]);

	const drawing = useCanvasDrawing({
		callId,
		board,
		color,
		width,
		tool,
		reaction,
		canDraw: effectiveCanDraw,
		onCreateStickyNote: createStickyAtPoint,
	});

	const upsertBoardOperation = useCallback(async (
		operation: () => Promise<unknown>,
		title: string,
		fallbackMessage: string
	) => {
		setIsBusy(true);
		try {
			await operation();
		} catch (error) {
			showToast(title, error instanceof Error ? error.message : fallbackMessage);
		} finally {
			setIsBusy(false);
		}
	}, [showToast]);

	const handleClear = useCallback(async () => {
		if (!permissionState.canManageCanvas) return;
		await upsertBoardOperation(async () => {
			await dispatch(clearCanvasBoard({ callId, boardId: board.id })).unwrap();
			dispatch(canvasActions.applyCanvasDrawEvent({ type: "BOARD_CLEAR", boardId: board.id }));
			setIsClearConfirmOpen(false);
		}, "Доска", "Не удалось очистить доску");
	}, [board.id, callId, dispatch, permissionState.canManageCanvas, upsertBoardOperation]);

	const handleUndo = useCallback(async () => {
		await upsertBoardOperation(
			() => dispatch(undoLastCanvasStroke({ callId, boardId: board.id })).unwrap(),
			"Доска",
			"Не удалось отменить последний штрих"
		);
	}, [board.id, callId, dispatch, upsertBoardOperation]);

	const handlePermissionChange = useCallback(async (
		drawingAccess: CanvasDrawingAccess,
		selectedDrawerUsername: string | null
	) => {
		if (!permissionState.canManageCanvas) return;
		await upsertBoardOperation(
			() => dispatch(updateCanvasBoardPermissions({
				callId,
				boardId: boardForPermissions.id,
				request: { drawingAccess, selectedDrawerUsername },
			})).unwrap(),
			"Права доски",
			"Не удалось обновить права рисования"
		);
	}, [boardForPermissions.id, callId, dispatch, permissionState.canManageCanvas, upsertBoardOperation]);

	const handleTemplateChange = useCallback(async (nextTemplateType: CanvasTemplateType) => {
		if (!permissionState.canManageCanvas) return;
		await upsertBoardOperation(
			() => dispatch(updateCanvasBoardTemplate({
				callId,
				boardId: board.id,
				request: { templateType: nextTemplateType },
			})).unwrap(),
			"Шаблон",
			"Не удалось обновить шаблон доски"
		);
	}, [board.id, callId, dispatch, permissionState.canManageCanvas, upsertBoardOperation]);

	const handleClose = useCallback(async () => {
		if (!permissionState.canManageCanvas) return;
		await upsertBoardOperation(async () => {
			await dispatch(closeCanvasBoard({ callId, boardId: board.id })).unwrap();
			onExit();
		}, "Доска", "Не удалось закрыть доску");
	}, [board.id, callId, dispatch, onExit, permissionState.canManageCanvas, upsertBoardOperation]);

	const handleStartTimer = useCallback((durationSeconds: number) => {
		if (!permissionState.canManageCanvas) return;
		void upsertBoardOperation(
			() => dispatch(startCanvasTimer({ callId, boardId: board.id, durationSeconds })).unwrap(),
			"Таймер",
			"Не удалось запустить таймер"
		);
	}, [board.id, callId, dispatch, permissionState.canManageCanvas, upsertBoardOperation]);

	const handleStopTimer = useCallback(() => {
		if (!permissionState.canManageCanvas) return;
		void upsertBoardOperation(
			() => dispatch(stopCanvasTimer({ callId, boardId: board.id })).unwrap(),
			"Таймер",
			"Не удалось остановить таймер"
		);
	}, [board.id, callId, dispatch, permissionState.canManageCanvas, upsertBoardOperation]);

	const handleResetTimer = useCallback(() => {
		if (!permissionState.canManageCanvas) return;
		void upsertBoardOperation(
			() => dispatch(resetCanvasTimer({ callId, boardId: board.id })).unwrap(),
			"Таймер",
			"Не удалось сбросить таймер"
		);
	}, [board.id, callId, dispatch, permissionState.canManageCanvas, upsertBoardOperation]);

	const handleUpdateNote = useCallback((noteId: number, patch: Partial<CanvasStickyNoteDto>) => {
		void dispatch(updateCanvasStickyNote({
			callId,
			boardId: board.id,
			noteId,
			request: patch,
		})).unwrap().catch((error) => {
			showToast("Заметка", error instanceof Error ? error.message : "Не удалось обновить заметку");
		});
	}, [board.id, callId, dispatch, showToast]);

	const handleDeleteNote = useCallback((noteId: number) => {
		void dispatch(deleteCanvasStickyNote({ callId, boardId: board.id, noteId })).unwrap().catch((error) => {
			showToast("Заметка", error instanceof Error ? error.message : "Не удалось удалить заметку");
		});
	}, [board.id, callId, dispatch, showToast]);

	const handleToggleVote = useCallback((noteId: number, hasVoted: boolean) => {
		const action = hasVoted
			? unvoteCanvasNote({ callId, boardId: board.id, noteId, userId: activeUsername })
			: voteCanvasNote({ callId, boardId: board.id, noteId });
		void dispatch(action).unwrap().catch((error) => {
			showToast("Голос", error instanceof Error ? error.message : "Не удалось поставить голос");
		});
	}, [activeUsername, board.id, callId, dispatch, showToast]);

	const handleCaptureBackground = useCallback(async () => {
		if (!permissionState.canManageCanvas) return;
		const video = findScreenShareVideo(board.id);
		if (!video || !video.videoWidth || !video.videoHeight) {
			showToast("Снимок экрана", "Нет готовой трансляции экрана");
			return;
		}

		const captureCanvas = document.createElement("canvas");
		captureCanvas.width = video.videoWidth;
		captureCanvas.height = video.videoHeight;
		const context = captureCanvas.getContext("2d");
		if (!context) {
			showToast("Снимок экрана", "Не удалось подготовить снимок");
			return;
		}

		context.drawImage(video, 0, 0, captureCanvas.width, captureCanvas.height);
		const blob = await new Promise<Blob | null>((resolve) => captureCanvas.toBlob(resolve, "image/png", 0.92));
		if (!blob) {
			showToast("Снимок экрана", "Не удалось сохранить снимок экрана");
			return;
		}

		await upsertBoardOperation(
			() => dispatch(uploadCanvasBackgroundImage({
				callId,
				boardId: board.id,
				file: new File([blob], "screen-share-snapshot.png", { type: "image/png" }),
			})).unwrap(),
			"Снимок экрана",
			"Не удалось сохранить снимок экрана"
		);
	}, [board.id, callId, dispatch, permissionState.canManageCanvas, showToast, upsertBoardOperation]);

	const handlePresenterChange = useCallback(async (
		presenterModeEnabled: boolean,
		presenterUsername: string | null
	) => {
		if (!permissionState.canManageCanvas) return;
		await upsertBoardOperation(
			() => dispatch(updateCanvasPresenter({
				callId,
				boardId: board.id,
				request: { presenterModeEnabled, presenterUsername },
			})).unwrap(),
			"Режим ведущего",
			"Не удалось обновить режим ведущего"
		);
	}, [board.id, callId, dispatch, permissionState.canManageCanvas, upsertBoardOperation]);

	useEffect(() => {
		const onKeyDown = (event: KeyboardEvent) => {
			if ((!event.ctrlKey && !event.metaKey) || event.key.toLowerCase() !== "z") return;
			const target = event.target;
			if (target instanceof HTMLInputElement ||
				target instanceof HTMLTextAreaElement ||
				(target instanceof HTMLElement && target.isContentEditable)) {
				return;
			}

			event.preventDefault();
			void handleUndo();
		};

		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [handleUndo]);

	return (
		<div
			className={cn(styles.root, styles[variant], styles[backgroundMode], {
				[styles.overlayHidden]: variant === "overlay" && isOverlayHidden,
			})}
			style={{ "--canvas-overlay-opacity": overlayOpacity } as CSSProperties}
		>
			<CanvasTemplateLayer
				templateType={templateType}
				backgroundImageUrl={board.backgroundImageUrl}
			/>

			<WhiteboardToolbar
				color={color}
				width={width}
				tool={tool}
				reaction={reaction}
				variant={variant}
				userColor={userColor}
				canDraw={effectiveCanDraw}
				canManage={permissionState.canManageCanvas}
				canClose
				isBusy={isBusy}
				readOnlyReason={permissionState.readOnlyReason}
				drawingAccess={permissionState.drawingAccess}
				selectedDrawerUsername={permissionState.selectedDrawerUsername}
				participantOptions={participantOptions}
				templateType={templateType}
				timerStatus={board.timerStatus ?? "STOPPED"}
				isPresenterModeEnabled={isPresenterModeEnabled}
				presenterUsername={presenterUsername}
				currentUsername={activeUsername}
				backgroundMode={backgroundMode}
				isOverlayHidden={isOverlayHidden}
				overlayOpacity={overlayOpacity}
				onColorChange={(nextColor) => {
					setHasPickedColor(true);
					setColor(nextColor);
				}}
				onWidthChange={setWidth}
				onToolChange={setTool}
				onReactionChange={setReaction}
				onUndo={handleUndo}
				onClear={() => setIsClearConfirmOpen(true)}
				onClose={handleClose}
				onExit={onExit}
				onPermissionChange={handlePermissionChange}
				onTemplateChange={handleTemplateChange}
				onCaptureBackground={handleCaptureBackground}
				onPresenterChange={handlePresenterChange}
				onStartTimer={handleStartTimer}
				onStopTimer={handleStopTimer}
				onResetTimer={handleResetTimer}
				onBackgroundModeChange={setBackgroundMode}
				onToggleOverlayHidden={() => setIsOverlayHidden((value) => !value)}
				onOverlayOpacityChange={setOverlayOpacity}
			/>

			<canvas
				ref={drawing.canvasRef}
				className={cn(styles.canvas, {
					[styles.eraser]: tool === "ERASER",
					[styles.disabled]: !effectiveCanDraw,
					[styles.localCursorEnabled]: effectiveCanDraw,
					[styles.drawing]: drawing.isDrawing,
				})}
				onPointerDown={drawing.handlePointerDown}
				onPointerMove={drawing.handlePointerMove}
				onPointerUp={drawing.handlePointerUp}
				onPointerLeave={drawing.handlePointerLeave}
				onPointerCancel={drawing.handlePointerCancel}
			/>

			<CanvasStickyNotesLayer
				notes={notes}
				votes={votes}
				currentUsername={activeUsername}
				canDraw={effectiveCanDraw}
				onUpdateNote={handleUpdateNote}
				onDeleteNote={handleDeleteNote}
				onToggleVote={handleToggleVote}
			/>

			{drawing.localCursor.visible && effectiveCanDraw && (
				<div
					className={cn(styles.localCursor, {
						[styles.localCursorPen]: tool === "PEN" || tool === "STICKY" || tool === "REACTION",
						[styles.localCursorEraser]: tool === "ERASER",
						[styles.localCursorLaser]: tool === "LASER",
					})}
					style={{
						left: `${drawing.localCursor.x * 100}%`,
						top: `${drawing.localCursor.y * 100}%`,
						"--local-cursor-color": color,
						"--local-cursor-size": `${Math.max(12, width * (tool === "ERASER" ? 2.4 : 1.8))}px`,
					} as CSSProperties}
					aria-hidden="true"
				/>
			)}

			<CanvasReactionLayer reactions={drawing.reactions} now={drawing.presenceNow} />

			{!(variant === "overlay" && isOverlayHidden) && (
				<CanvasPresenceLayer
					cursors={drawing.remoteCursors}
					laserTrails={drawing.laserTrails}
					now={drawing.presenceNow}
					opacity={variant === "overlay" ? overlayOpacity : 1}
				/>
			)}

			<CanvasTimerChip
				board={board}
				canManage={permissionState.canManageCanvas}
				variant={variant}
				onStart={handleStartTimer}
				onStop={handleStopTimer}
				onReset={handleResetTimer}
			/>

			{isPresenterModeEnabled && (
				<div className={styles.presenterBadge}>
					{isPresenter ? "Вы ведёте доску" : isFollowingPresenter ? `Следуете: ${presenterUsername}` : `Ведущий: ${presenterUsername}`}
					{!isPresenter && (
						<button type="button" onClick={() => setIsFollowingPresenter((value) => !value)}>
							{isFollowingPresenter ? "Не следовать" : "Следовать"}
						</button>
					)}
				</div>
			)}

			{isClearConfirmOpen && (
				<div className={styles.confirmBackdrop} role="presentation">
					<div className={styles.confirmDialog} role="dialog" aria-modal="true" aria-labelledby="clear-board-title">
						<div className={styles.confirmGlow} />
						<div id="clear-board-title" className={styles.confirmTitle}>Очистить доску?</div>
						<div className={styles.confirmText}>
							Все линии исчезнут у участников этой доски. Действие нельзя отменить.
						</div>
						<div className={styles.confirmActions}>
							<button
								type="button"
								className={styles.confirmSecondary}
								onClick={() => setIsClearConfirmOpen(false)}
								disabled={isBusy}
							>
								Отмена
							</button>
							<button
								type="button"
								className={styles.confirmDanger}
								onClick={handleClear}
								disabled={isBusy}
							>
								Очистить
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}

function findScreenShareVideo(boardId: number): HTMLVideoElement | null {
	const root = document.querySelector(`[data-canvas-overlay-root="${boardId}"]`)?.parentElement;
	return root?.querySelector("video") ?? document.querySelector("video");
}
