import { useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import type { RootState } from "../../../store/store";
import {
	selectCanvasNotesByBoardId,
	selectCanvasVotesByBoardId,
} from "../../../store/selectors/canvas.selectors";
import type {
	CanvasInteractionTool,
	CanvasReactionType,
} from "../../../api/interfaces/CanvasDtos";
import { StringToColor } from "../../../utils/stringHelpers";
import { CanvasPresenceLayer } from "./CanvasPresenceLayer";
import { CanvasReactionLayer } from "../CanvasReactionLayer/CanvasReactionLayer";
import { CanvasStickyNotesLayer } from "../CanvasStickyNotesLayer/CanvasStickyNotesLayer";
import { CanvasTimerChip } from "../CanvasTimerChip/CanvasTimerChip";
import { useCanvasDrawing } from "../hooks/useCanvasDrawing";
import { WhiteboardToolbar } from "../WhiteboardToolbar/WhiteboardToolbar";
import type { CanvasBackgroundMode, DrawableCanvasProps } from "./DrawableCanvas.types";
import { getCanvasTemplateType } from "./utils/canvasModeUtils";
import { useCanvasPermissions } from "./hooks/useCanvasPermissions";
import { useCanvasBoardActions } from "./hooks/useCanvasBoardActions";
import { CanvasViewport } from "./components/CanvasViewport";
import { CanvasLayer } from "./components/CanvasLayer";
import { CanvasLocalCursor } from "./components/CanvasLocalCursor";
import { CanvasPresenterBadge } from "./components/CanvasPresenterBadge";
import { CanvasClearConfirm } from "./components/CanvasClearConfirm";

export function DrawableCanvas({
	callId,
	board,
	canDraw,
	currentUsername,
	managerUsername,
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
	const [backgroundMode, setBackgroundMode] = useState<CanvasBackgroundMode>(
		board.background === "BLACK" ? "dark" : "dots"
	);
	const [isOverlayHidden, setIsOverlayHidden] = useState(false);
	const [overlayOpacity, setOverlayOpacity] = useState(1);
	const [drawingOpacity, setDrawingOpacity] = useState(1);
	const [backgroundImageOpacity, setBackgroundImageOpacity] = useState(board.backgroundImageUrl ? 0.86 : 1);
	const [isFollowingPresenter, setIsFollowingPresenter] = useState(true);

	const {
		boardForPermissions,
		permissionState,
		effectiveCanDraw,
	} = useCanvasPermissions({
		board,
		currentUsername: activeUsername,
		managerUsername,
		canDraw,
	});

	const actions = useCanvasBoardActions({
		callId,
		board,
		boardForPermissions,
		activeUsername,
		canManageCanvas: permissionState.canManageCanvas,
		effectiveCanDraw,
		notesLength: notes.length,
		onExit,
	});

	const drawing = useCanvasDrawing({
		callId,
		board,
		color,
		width,
		tool,
		reaction,
		canDraw: effectiveCanDraw,
		onCreateStickyNote: actions.createStickyAtPoint,
	});

	const templateType = getCanvasTemplateType(board.templateType, backgroundMode);
	const isPresenterModeEnabled = board.presenterModeEnabled ?? false;
	const presenterUsername = board.presenterUsername ?? null;
	const isPresenter = isPresenterModeEnabled && presenterUsername === activeUsername;

	useEffect(() => {
		if (hasPickedColor) return;
		setColor(userColor);
	}, [hasPickedColor, userColor]);

	useEffect(() => {
		setBackgroundMode(board.background === "BLACK" ? "dark" : "dots");
		setBackgroundImageOpacity(board.backgroundImageUrl ? 0.86 : 1);
		setDrawingOpacity(1);
	}, [board.background, board.backgroundImageUrl, board.id]);

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
			void actions.undo();
		};

		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [actions.undo]);

	return (
		<CanvasViewport
			variant={variant}
			backgroundMode={backgroundMode}
			templateType={templateType}
			backgroundImageUrl={board.backgroundImageUrl}
			backgroundImageOpacity={backgroundImageOpacity}
			isOverlayHidden={isOverlayHidden}
			overlayOpacity={overlayOpacity}
			drawingOpacity={drawingOpacity}
		>
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
				isBusy={actions.isBusy}
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
				drawingOpacity={drawingOpacity}
				backgroundImageOpacity={backgroundImageOpacity}
				hasBackgroundImage={Boolean(board.backgroundImageUrl)}
				onColorChange={(nextColor) => {
					setHasPickedColor(true);
					setColor(nextColor);
				}}
				onWidthChange={setWidth}
				onToolChange={setTool}
				onReactionChange={setReaction}
				onUndo={actions.undo}
				onClear={() => actions.setIsClearConfirmOpen(true)}
				onClose={actions.close}
				onExit={onExit}
				onPermissionChange={actions.changePermission}
				onTemplateChange={actions.changeTemplate}
				onCaptureBackground={actions.captureBackground}
				onPresenterChange={actions.changePresenter}
				onStartTimer={actions.startTimer}
				onStopTimer={actions.stopTimer}
				onResetTimer={actions.resetTimer}
				onBackgroundModeChange={setBackgroundMode}
				onToggleOverlayHidden={() => setIsOverlayHidden((value) => !value)}
				onOverlayOpacityChange={setOverlayOpacity}
				onDrawingOpacityChange={setDrawingOpacity}
				onBackgroundImageOpacityChange={setBackgroundImageOpacity}
			/>

			<CanvasLayer
				canvasRef={drawing.canvasRef}
				tool={tool}
				canDraw={effectiveCanDraw}
				isDrawing={drawing.isDrawing}
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
				onUpdateNote={actions.updateNote}
				onDeleteNote={actions.deleteNote}
				onToggleVote={actions.toggleVote}
			/>

			<CanvasLocalCursor
				visible={drawing.localCursor.visible}
				canDraw={effectiveCanDraw}
				x={drawing.localCursor.x}
				y={drawing.localCursor.y}
				color={color}
				width={width}
				tool={tool}
			/>

			<CanvasReactionLayer reactions={drawing.reactions} now={drawing.presenceNow} />

			{!(variant === "overlay" && isOverlayHidden) && (
				<CanvasPresenceLayer
					cursors={drawing.remoteCursors}
					laserTrails={drawing.laserTrails}
					now={drawing.presenceNow}
					opacity={variant === "overlay" ? overlayOpacity : 1}
					presenterUsername={presenterUsername}
					isFollowingPresenter={isFollowingPresenter}
				/>
			)}

			<CanvasTimerChip
				board={board}
				canManage={permissionState.canManageCanvas}
				variant={variant}
				onStart={actions.startTimer}
				onStop={actions.stopTimer}
				onReset={actions.resetTimer}
			/>

			{isPresenterModeEnabled && (
				<CanvasPresenterBadge
					isPresenter={isPresenter}
					isFollowingPresenter={isFollowingPresenter}
					presenterUsername={presenterUsername}
					onToggleFollowing={() => setIsFollowingPresenter((value) => !value)}
				/>
			)}

			{actions.isClearConfirmOpen && (
				<CanvasClearConfirm
					isBusy={actions.isBusy}
					onCancel={() => actions.setIsClearConfirmOpen(false)}
					onConfirm={actions.clear}
				/>
			)}
		</CanvasViewport>
	);
}
