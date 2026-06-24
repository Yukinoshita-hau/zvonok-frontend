import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import cn from "classnames";
import { useDispatch, useSelector } from "react-redux";
import type { AppDispatch, RootState } from "../../../store/store";
import {
	canvasActions,
	clearCanvasBoard,
	closeCanvasBoard,
	undoLastCanvasStroke,
	updateCanvasBoardPermissions,
} from "../../../store/slices/canvas.slice";
import type {
	CanvasBoardSessionDto,
	CanvasDrawingAccess,
	CanvasInteractionTool,
} from "../../../api/interfaces/CanvasDtos";
import { StringToColor } from "../../../utils/stringHelpers";
import { getCanvasPermissionState } from "../../../utils/canvasPermissions";
import { toastActions } from "../../../store/slices/toast.slice";
import { CanvasPresenceLayer } from "./CanvasPresenceLayer";
import { useCanvasDrawing } from "../hooks/useCanvasDrawing";
import { WhiteboardToolbar } from "../WhiteboardToolbar/WhiteboardToolbar";
import type { CanvasParticipantOption } from "../CallCanvas.types";
import styles from "./DrawableCanvas.module.css";

interface DrawableCanvasProps {
	callId: number;
	board: CanvasBoardSessionDto;
	canDraw: boolean;
	currentUsername?: string | null;
	isCurrentUserHost?: boolean;
	participantOptions?: CanvasParticipantOption[];
	variant?: "whiteboard" | "overlay";
	onExit: () => void;
}

export function DrawableCanvas({
	callId,
	board,
	canDraw,
	currentUsername,
	isCurrentUserHost = false,
	participantOptions = [],
	variant = "whiteboard",
	onExit,
}: DrawableCanvasProps) {
	const myUsername = useSelector((state: RootState) => state.user.myUser?.username ?? "guest");
	const activeUsername = currentUsername ?? myUsername;
	const userColor = useMemo(() => StringToColor(myUsername), [myUsername]);
	const [color, setColor] = useState(userColor);
	const [hasPickedColor, setHasPickedColor] = useState(false);
	const [width, setWidth] = useState(5);
	const [tool, setTool] = useState<CanvasInteractionTool>("PEN");
	const [isBusy, setIsBusy] = useState(false);
	const [isClearConfirmOpen, setIsClearConfirmOpen] = useState(false);
	const [backgroundMode, setBackgroundMode] = useState<"grid" | "dots" | "clean">("dots");
	const [isOverlayHidden, setIsOverlayHidden] = useState(false);
	const [overlayOpacity, setOverlayOpacity] = useState(1);
	const dispatch = useDispatch<AppDispatch>();

	const permissionState = useMemo(() => getCanvasPermissionState({
		board,
		currentUsername: activeUsername,
		isCurrentUserHost,
	}), [activeUsername, board, isCurrentUserHost]);
	const effectiveCanDraw = canDraw && permissionState.canDrawCanvas;

	useEffect(() => {
		if (hasPickedColor) return;
		setColor(userColor);
	}, [hasPickedColor, userColor]);

	const drawing = useCanvasDrawing({
		callId,
		board,
		color,
		width,
		tool,
		canDraw: effectiveCanDraw,
	});

	const handleClear = useCallback(async () => {
		if (!permissionState.canManageCanvas) return;
		setIsBusy(true);
		try {
			await dispatch(clearCanvasBoard({ callId, boardId: board.id }));
			dispatch(canvasActions.applyCanvasDrawEvent({ type: "BOARD_CLEAR", boardId: board.id }));
			setIsClearConfirmOpen(false);
		} finally {
			setIsBusy(false);
		}
	}, [board.id, callId, dispatch, permissionState.canManageCanvas]);

	const handleUndo = useCallback(async () => {
		setIsBusy(true);
		try {
			await dispatch(undoLastCanvasStroke({ callId, boardId: board.id })).unwrap();
		} catch (error) {
			dispatch(toastActions.showToast({
				id: crypto.randomUUID(),
				type: "error",
				title: "Доска",
				message: error instanceof Error ? error.message : "Не удалось отменить последний штрих",
			}));
		} finally {
			setIsBusy(false);
		}
	}, [board.id, callId, dispatch]);

	const handlePermissionChange = useCallback(async (
		drawingAccess: CanvasDrawingAccess,
		selectedDrawerUsername: string | null
	) => {
		if (!permissionState.canManageCanvas) return;
		setIsBusy(true);
		try {
			await dispatch(updateCanvasBoardPermissions({
				callId,
				boardId: board.id,
				request: {
					drawingAccess,
					selectedDrawerUsername,
				},
			})).unwrap();
		} catch (error) {
			dispatch(toastActions.showToast({
				id: crypto.randomUUID(),
				type: "error",
				title: "Права доски",
				message: error instanceof Error ? error.message : "Не удалось обновить права рисования",
			}));
		} finally {
			setIsBusy(false);
		}
	}, [board.id, callId, dispatch, permissionState.canManageCanvas]);

	const handleClose = useCallback(async () => {
		if (!permissionState.canManageCanvas) return;
		setIsBusy(true);
		try {
			await dispatch(closeCanvasBoard({ callId, boardId: board.id }));
			onExit();
		} finally {
			setIsBusy(false);
		}
	}, [board.id, callId, dispatch, onExit, permissionState.canManageCanvas]);

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
			<WhiteboardToolbar
				color={color}
				width={width}
				tool={tool}
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
				backgroundMode={backgroundMode}
				isOverlayHidden={isOverlayHidden}
				overlayOpacity={overlayOpacity}
				onColorChange={(nextColor) => {
					setHasPickedColor(true);
					setColor(nextColor);
				}}
				onWidthChange={setWidth}
				onToolChange={setTool}
				onUndo={handleUndo}
				onClear={() => setIsClearConfirmOpen(true)}
				onClose={handleClose}
				onExit={onExit}
				onPermissionChange={handlePermissionChange}
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
			{drawing.localCursor.visible && effectiveCanDraw && (
				<div
					className={cn(styles.localCursor, {
						[styles.localCursorPen]: tool === "PEN",
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
			{!(variant === "overlay" && isOverlayHidden) && (
				<CanvasPresenceLayer
					cursors={drawing.remoteCursors}
					laserTrails={drawing.laserTrails}
					now={drawing.presenceNow}
					opacity={variant === "overlay" ? overlayOpacity : 1}
				/>
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
