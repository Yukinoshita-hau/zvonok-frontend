import type { RootState } from "../store";
import type {
	CanvasBoardSessionDto,
	CanvasNoteVoteDto,
	CanvasStickyNoteDto,
	StrokeRenderState,
} from "../../api/interfaces/CanvasDtos";

export function selectCanvasBoardsByCallId(
	state: RootState,
	callId: number | null | undefined
): CanvasBoardSessionDto[] {
	if (!callId) return [];
	return state.canvas.boardsByCallId[callId] ?? [];
}

export function selectWhiteboardByCallId(
	state: RootState,
	callId: number | null | undefined
): CanvasBoardSessionDto | undefined {
	return selectCanvasBoardsByCallId(state, callId).find(
		(board) => board.mode === "WHITEBOARD" && board.active
	);
}

export function selectScreenOverlayBoardByCallId(
	state: RootState,
	callId: number | null | undefined
): CanvasBoardSessionDto | undefined {
	return selectCanvasBoardsByCallId(state, callId).find(
		(board) => board.mode === "SCREEN_OVERLAY" && board.active
	);
}

export function selectFocusedCanvasBoard(
	state: RootState,
	callId?: number | null
): CanvasBoardSessionDto | undefined {
	const focusedBoardId = state.canvas.focusedBoardId;
	if (!focusedBoardId) return undefined;

	const boards = callId
		? state.canvas.boardsByCallId[callId] ?? []
		: Object.values(state.canvas.boardsByCallId).flat();

	return boards
		.find((board) => board.id === focusedBoardId && board.active);
}

export function selectCanvasStrokesByBoardId(
	state: RootState,
	boardId: number
): StrokeRenderState[] {
	return state.canvas.strokesByBoardId[boardId] ?? [];
}

export function selectCanvasPresenceEventByBoardId(
	state: RootState,
	boardId: number
) {
	return state.canvas.presenceEventByBoardId[boardId] ?? null;
}

export function selectCanvasNotesByBoardId(
	state: RootState,
	boardId: number
): CanvasStickyNoteDto[] {
	return state.canvas.notesByBoardId[boardId] ?? [];
}

export function selectCanvasVotesByBoardId(
	state: RootState,
	boardId: number
): CanvasNoteVoteDto[] {
	return state.canvas.votesByBoardId[boardId] ?? [];
}
