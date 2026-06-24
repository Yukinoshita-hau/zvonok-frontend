import { useEffect, useMemo, useState, type CSSProperties } from "react";
import cn from "classnames";
import { useDispatch, useSelector } from "react-redux";
import type { AppDispatch, RootState } from "../../../store/store";
import { canvasActions, clearCanvasBoard, closeCanvasBoard } from "../../../store/slices/canvas.slice";
import type { CanvasBoardSessionDto, CanvasInteractionTool } from "../../../api/interfaces/CanvasDtos";
import { StringToColor } from "../../../utils/stringHelpers";
import { CanvasPresenceLayer } from "./CanvasPresenceLayer";
import { useCanvasDrawing } from "../hooks/useCanvasDrawing";
import { WhiteboardToolbar } from "../WhiteboardToolbar/WhiteboardToolbar";
import styles from "./DrawableCanvas.module.css";

interface DrawableCanvasProps {
	callId: number;
	board: CanvasBoardSessionDto;
	canDraw: boolean;
	variant?: "whiteboard" | "overlay";
	onExit: () => void;
}

export function DrawableCanvas({
	callId,
	board,
	canDraw,
	variant = "whiteboard",
	onExit,
}: DrawableCanvasProps) {
	const myUsername = useSelector((state: RootState) => state.user.myUser?.username ?? "guest");
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
		canDraw,
	});

	const handleClear = async () => {
		setIsBusy(true);
		try {
			await dispatch(clearCanvasBoard({ callId, boardId: board.id }));
			dispatch(canvasActions.applyCanvasDrawEvent({ type: "BOARD_CLEAR", boardId: board.id }));
			setIsClearConfirmOpen(false);
		} finally {
			setIsBusy(false);
		}
	};

	const handleClose = async () => {
		setIsBusy(true);
		try {
			await dispatch(closeCanvasBoard({ callId, boardId: board.id }));
			onExit();
		} finally {
			setIsBusy(false);
		}
	};

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
				canClose
				isBusy={isBusy}
				backgroundMode={backgroundMode}
				isOverlayHidden={isOverlayHidden}
				overlayOpacity={overlayOpacity}
				onColorChange={(nextColor) => {
					setHasPickedColor(true);
					setColor(nextColor);
				}}
				onWidthChange={setWidth}
				onToolChange={setTool}
				onClear={() => setIsClearConfirmOpen(true)}
				onClose={handleClose}
				onExit={onExit}
				onBackgroundModeChange={setBackgroundMode}
				onToggleOverlayHidden={() => setIsOverlayHidden((value) => !value)}
				onOverlayOpacityChange={setOverlayOpacity}
			/>
			<canvas
				ref={drawing.canvasRef}
				className={cn(styles.canvas, {
					[styles.eraser]: tool === "ERASER",
					[styles.disabled]: !canDraw,
					[styles.drawing]: drawing.isDrawing,
				})}
				onPointerDown={drawing.handlePointerDown}
				onPointerMove={drawing.handlePointerMove}
				onPointerUp={drawing.handlePointerUp}
				onPointerLeave={drawing.handlePointerLeave}
				onPointerCancel={drawing.handlePointerCancel}
			/>
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
