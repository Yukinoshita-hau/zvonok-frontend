import { createAsyncThunk, createSlice, type PayloadAction } from "@reduxjs/toolkit";
import { canvasApi } from "../../api/canvasApi";
import type {
	CanvasBoardEventDto,
	CanvasBoardSessionDto,
	CanvasDrawEventDto,
	CanvasSnapshotDto,
	CanvasTool,
	StrokeRenderState,
	UpdateCanvasBoardPermissionsRequest,
} from "../../api/interfaces/CanvasDtos";

interface CanvasState {
	boardsByCallId: Record<number, CanvasBoardSessionDto[]>;
	loadingByCallId: Record<number, boolean>;
	errorByCallId: Record<number, string | undefined>;
	strokesByBoardId: Record<number, StrokeRenderState[]>;
	presenceEventByBoardId: Record<number, { event: CanvasDrawEventDto; sequence: number }>;
	presenceEventSequence: number;
	focusedBoardId: number | null;
}

interface CanvasDrawPublishPayload {
	callId: number;
	boardId: number;
	event: CanvasDrawEventDto;
}

interface CanvasBoardSubscriptionPayload {
	callId: number;
	boardId: number;
}

const initialState: CanvasState = {
	boardsByCallId: {},
	loadingByCallId: {},
	errorByCallId: {},
	strokesByBoardId: {},
	presenceEventByBoardId: {},
	presenceEventSequence: 0,
	focusedBoardId: null,
};

export const fetchCanvasBoards = createAsyncThunk(
	"canvas/fetchBoards",
	async (callId: number) => {
		const boards = await canvasApi.getActiveCanvasBoards(callId);
		return { callId, boards };
	}
);

export const createWhiteboard = createAsyncThunk(
	"canvas/createWhiteboard",
	async (callId: number) => {
		const board = await canvasApi.createCanvasBoard(callId, {
			mode: "WHITEBOARD",
			background: "WHITE",
		});

		return { callId, board };
	}
);

export const createScreenOverlayBoard = createAsyncThunk(
	"canvas/createScreenOverlayBoard",
	async (callId: number) => {
		const board = await canvasApi.createCanvasBoard(callId, {
			mode: "SCREEN_OVERLAY",
			background: "TRANSPARENT",
		});

		return { callId, board };
	}
);

export const fetchCanvasSnapshot = createAsyncThunk(
	"canvas/fetchSnapshot",
	async ({ callId, boardId }: { callId: number; boardId: number }) => {
		const snapshot = await canvasApi.getCanvasSnapshot(callId, boardId);
		return snapshot;
	}
);

export const clearCanvasBoard = createAsyncThunk(
	"canvas/clearBoard",
	async ({ callId, boardId }: { callId: number; boardId: number }) => {
		await canvasApi.clearCanvasBoard(callId, boardId);
		return { boardId };
	}
);

export const undoLastCanvasStroke = createAsyncThunk(
	"canvas/undoLastStroke",
	async ({ callId, boardId }: { callId: number; boardId: number }) => {
		await canvasApi.undoLastCanvasStroke(callId, boardId);
		return { boardId };
	}
);

export const updateCanvasBoardPermissions = createAsyncThunk(
	"canvas/updateBoardPermissions",
	async ({
		callId,
		boardId,
		request,
	}: {
		callId: number;
		boardId: number;
		request: UpdateCanvasBoardPermissionsRequest;
	}) => {
		const board = await canvasApi.updateCanvasBoardPermissions(callId, boardId, request);
		return { callId, board };
	}
);

export const closeCanvasBoard = createAsyncThunk(
	"canvas/closeBoard",
	async ({ callId, boardId }: { callId: number; boardId: number }) => {
		await canvasApi.closeCanvasBoard(callId, boardId);
		return { callId, boardId };
	}
);

export const canvasSlice = createSlice({
	name: "canvas",
	initialState,
	reducers: {
		applyCanvasBoardEvent(state, action: PayloadAction<CanvasBoardEventDto>) {
			const { type, board } = action.payload;
			const callId = board.callId;
			const boards = state.boardsByCallId[callId] ?? [];

			if (type === "BOARD_CREATED" || type === "BOARD_PERMISSIONS_UPDATED") {
				const exists = boards.some((item) => item.id === board.id);
				state.boardsByCallId[callId] = exists
					? boards.map((item) => (item.id === board.id ? board : item))
					: [...boards, board];
				return;
			}

			if (type === "BOARD_CLOSED") {
				state.boardsByCallId[callId] = boards.filter((item) => item.id !== board.id);
				delete state.strokesByBoardId[board.id];
				if (state.focusedBoardId === board.id) {
					state.focusedBoardId = null;
				}
				return;
			}

			if (type === "BOARD_CLEARED") {
				state.strokesByBoardId[board.id] = [];
			}
		},
		applyCanvasDrawEvent(state, action: PayloadAction<CanvasDrawEventDto>) {
			const event = action.payload;
			const boardId = event.boardId;

			if (isCanvasPresenceEvent(event.type)) {
				state.presenceEventSequence += 1;
				state.presenceEventByBoardId[boardId] = {
					event,
					sequence: state.presenceEventSequence,
				};
				return;
			}

			if (event.type === "BOARD_CLEAR") {
				state.strokesByBoardId[boardId] = [];
				return;
			}

			if (event.type === "STROKE_REMOVED") {
				if (!event.strokeId) return;
				state.strokesByBoardId[boardId] = (state.strokesByBoardId[boardId] ?? [])
					.filter((stroke) => stroke.id !== event.strokeId);
				return;
			}

			if (!event.strokeId || !event.userId) return;

			const strokes = state.strokesByBoardId[boardId] ?? [];
			const strokeIndex = strokes.findIndex((stroke) => stroke.id === event.strokeId);

			if (event.type === "STROKE_START") {
				if (strokeIndex >= 0) return;

				const stroke: StrokeRenderState = {
					id: event.strokeId,
					userId: event.userId,
					color: event.color ?? "#f8fafc",
					width: event.width ?? 4,
					tool: (event.tool ?? "PEN") as CanvasTool,
					points: event.x !== null && event.y !== null && event.x !== undefined && event.y !== undefined
						? [{ x: event.x, y: event.y }]
						: [],
					ended: false,
				};
				state.strokesByBoardId[boardId] = [...strokes, stroke];
				return;
			}

			if (strokeIndex < 0) return;

			const stroke = strokes[strokeIndex];
			if (event.type === "STROKE_POINT" && event.x !== null && event.y !== null && event.x !== undefined && event.y !== undefined) {
				const lastPoint = stroke.points[stroke.points.length - 1];
				if (lastPoint?.x === event.x && lastPoint.y === event.y) return;
				stroke.points.push({ x: event.x, y: event.y });
				return;
			}

			if (event.type === "STROKE_END") {
				stroke.ended = true;
			}
		},
		focusCanvasBoard(state, action: PayloadAction<number>) {
			state.focusedBoardId = action.payload;
		},
		clearFocusedCanvasBoard(state) {
			state.focusedBoardId = null;
		},
		subscribeCanvasBoardLifecycle: (_state, _action: PayloadAction<number>) => {},
		unsubscribeCanvasBoardLifecycle: (_state, _action: PayloadAction<number>) => {},
		subscribeCanvasDrawEvents: (_state, _action: PayloadAction<CanvasBoardSubscriptionPayload>) => {},
		unsubscribeCanvasDrawEvents: (_state, _action: PayloadAction<CanvasBoardSubscriptionPayload>) => {},
		sendCanvasDrawEvent: (_state, _action: PayloadAction<CanvasDrawPublishPayload>) => {},
	},
	extraReducers: (builder) => {
		builder
			.addCase(fetchCanvasBoards.pending, (state, action) => {
				state.loadingByCallId[action.meta.arg] = true;
				state.errorByCallId[action.meta.arg] = undefined;
			})
			.addCase(fetchCanvasBoards.fulfilled, (state, action) => {
				state.loadingByCallId[action.payload.callId] = false;
				state.boardsByCallId[action.payload.callId] = action.payload.boards;
			})
			.addCase(fetchCanvasBoards.rejected, (state, action) => {
				const callId = action.meta.arg;
				state.loadingByCallId[callId] = false;
				state.errorByCallId[callId] = action.error.message ?? "Не удалось загрузить доски";
			})
			.addCase(createWhiteboard.fulfilled, (state, action) => {
				const { callId, board } = action.payload;
				const boards = state.boardsByCallId[callId] ?? [];
				const exists = boards.some((item) => item.id === board.id);

				state.boardsByCallId[callId] = exists
					? boards.map((item) => (item.id === board.id ? board : item))
					: [...boards, board];
				state.focusedBoardId = board.id;
			})
			.addCase(createScreenOverlayBoard.fulfilled, (state, action) => {
				const { callId, board } = action.payload;
				const boards = state.boardsByCallId[callId] ?? [];
				const exists = boards.some((item) => item.id === board.id);

				state.boardsByCallId[callId] = exists
					? boards.map((item) => (item.id === board.id ? board : item))
					: [...boards, board];
			})
			.addCase(fetchCanvasSnapshot.fulfilled, (state, action: PayloadAction<CanvasSnapshotDto>) => {
				state.strokesByBoardId[action.payload.boardId] = action.payload.strokes.map((stroke) => ({
					...stroke,
					ended: true,
				}));
			})
			.addCase(clearCanvasBoard.fulfilled, (state, action) => {
				state.strokesByBoardId[action.payload.boardId] = [];
			})
			.addCase(updateCanvasBoardPermissions.fulfilled, (state, action) => {
				const { callId, board } = action.payload;
				const boards = state.boardsByCallId[callId] ?? [];
				const exists = boards.some((item) => item.id === board.id);

				state.boardsByCallId[callId] = exists
					? boards.map((item) => (item.id === board.id ? board : item))
					: [...boards, board];
			})
			.addCase(closeCanvasBoard.fulfilled, (state, action) => {
				const { callId, boardId } = action.payload;
				state.boardsByCallId[callId] = (state.boardsByCallId[callId] ?? []).filter((board) => board.id !== boardId);
				delete state.strokesByBoardId[boardId];
				if (state.focusedBoardId === boardId) {
					state.focusedBoardId = null;
				}
			});
	},
});

export default canvasSlice.reducer;
export const canvasActions = canvasSlice.actions;

function isCanvasPresenceEvent(type: CanvasDrawEventDto["type"]): boolean {
	return type === "CURSOR_MOVE" ||
		type === "CURSOR_LEAVE" ||
		type === "LASER_POINT" ||
		type === "LASER_END";
}
