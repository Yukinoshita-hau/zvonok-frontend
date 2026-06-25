import { createAsyncThunk, createSlice, type PayloadAction } from "@reduxjs/toolkit";
import { canvasApi } from "../../api/canvasApi";
import type {
	CanvasBoardEventDto,
	CanvasBoardObjectEventDto,
	CanvasBoardSessionDto,
	CanvasDrawEventDto,
	CanvasNoteVoteDto,
	CanvasSnapshotDto,
	CanvasStickyNoteDto,
	CanvasTool,
	CreateCanvasStickyNoteRequest,
	StrokeRenderState,
	UpdateCanvasBoardTemplateRequest,
	UpdateCanvasBoardPermissionsRequest,
	UpdateCanvasPresenterRequest,
	UpdateCanvasStickyNoteRequest,
} from "../../api/interfaces/CanvasDtos";

interface CanvasState {
	boardsByCallId: Record<number, CanvasBoardSessionDto[]>;
	loadingByCallId: Record<number, boolean>;
	errorByCallId: Record<number, string | undefined>;
	strokesByBoardId: Record<number, StrokeRenderState[]>;
	notesByBoardId: Record<number, CanvasStickyNoteDto[]>;
	votesByBoardId: Record<number, CanvasNoteVoteDto[]>;
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
	notesByBoardId: {},
	votesByBoardId: {},
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

export const updateCanvasBoardTemplate = createAsyncThunk(
	"canvas/updateBoardTemplate",
	async ({
		callId,
		boardId,
		request,
	}: {
		callId: number;
		boardId: number;
		request: UpdateCanvasBoardTemplateRequest;
	}) => {
		const board = await canvasApi.updateCanvasBoardTemplate(callId, boardId, request);
		return { callId, board };
	}
);

export const startCanvasTimer = createAsyncThunk(
	"canvas/startTimer",
	async ({ callId, boardId, durationSeconds }: { callId: number; boardId: number; durationSeconds: number }) => {
		const board = await canvasApi.startCanvasTimer(callId, boardId, durationSeconds);
		return { callId, board };
	}
);

export const stopCanvasTimer = createAsyncThunk(
	"canvas/stopTimer",
	async ({ callId, boardId }: { callId: number; boardId: number }) => {
		const board = await canvasApi.stopCanvasTimer(callId, boardId);
		return { callId, board };
	}
);

export const resetCanvasTimer = createAsyncThunk(
	"canvas/resetTimer",
	async ({ callId, boardId }: { callId: number; boardId: number }) => {
		const board = await canvasApi.resetCanvasTimer(callId, boardId);
		return { callId, board };
	}
);

export const uploadCanvasBackgroundImage = createAsyncThunk(
	"canvas/uploadBackgroundImage",
	async ({ callId, boardId, file }: { callId: number; boardId: number; file: File }) => {
		const board = await canvasApi.uploadCanvasBackgroundImage(callId, boardId, file);
		return { callId, board };
	}
);

export const updateCanvasPresenter = createAsyncThunk(
	"canvas/updatePresenter",
	async ({
		callId,
		boardId,
		request,
	}: {
		callId: number;
		boardId: number;
		request: UpdateCanvasPresenterRequest;
	}) => {
		const board = await canvasApi.updateCanvasPresenter(callId, boardId, request);
		return { callId, board };
	}
);

export const createCanvasStickyNote = createAsyncThunk(
	"canvas/createStickyNote",
	async ({
		callId,
		boardId,
		request,
	}: {
		callId: number;
		boardId: number;
		request: CreateCanvasStickyNoteRequest;
	}) => {
		const note = await canvasApi.createCanvasStickyNote(callId, boardId, request);
		return { boardId, note };
	}
);

export const updateCanvasStickyNote = createAsyncThunk(
	"canvas/updateStickyNote",
	async ({
		callId,
		boardId,
		noteId,
		request,
	}: {
		callId: number;
		boardId: number;
		noteId: number;
		request: UpdateCanvasStickyNoteRequest;
	}) => {
		const note = await canvasApi.updateCanvasStickyNote(callId, boardId, noteId, request);
		return { boardId, note };
	}
);

export const deleteCanvasStickyNote = createAsyncThunk(
	"canvas/deleteStickyNote",
	async ({ callId, boardId, noteId }: { callId: number; boardId: number; noteId: number }) => {
		await canvasApi.deleteCanvasStickyNote(callId, boardId, noteId);
		return { boardId, noteId };
	}
);

export const voteCanvasNote = createAsyncThunk(
	"canvas/voteNote",
	async ({ callId, boardId, noteId }: { callId: number; boardId: number; noteId: number }) => {
		const vote = await canvasApi.voteCanvasNote(callId, boardId, noteId);
		return { boardId, vote };
	}
);

export const unvoteCanvasNote = createAsyncThunk(
	"canvas/unvoteNote",
	async ({ callId, boardId, noteId, userId }: { callId: number; boardId: number; noteId: number; userId: string }) => {
		await canvasApi.unvoteCanvasNote(callId, boardId, noteId);
		return { boardId, noteId, userId };
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

			if (isBoardUpsertEvent(type)) {
				upsertBoard(state.boardsByCallId, callId, normalizeBoardEvent(type, board));
				return;
			}

			if (type === "BOARD_CLOSED") {
				state.boardsByCallId[callId] = boards.filter((item) => item.id !== board.id);
				delete state.strokesByBoardId[board.id];
				delete state.notesByBoardId[board.id];
				delete state.votesByBoardId[board.id];
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
				if (stroke.ended) return;
				const lastPoint = stroke.points[stroke.points.length - 1];
				if (lastPoint?.x === event.x && lastPoint.y === event.y) return;
				stroke.points.push({ x: event.x, y: event.y });
				return;
			}

			if (event.type === "STROKE_END") {
				stroke.ended = true;
			}
		},
		applyCanvasObjectEvent(state, action: PayloadAction<CanvasBoardObjectEventDto>) {
			const event = action.payload;
			const boardId = event.boardId;

			if ((event.type === "NOTE_CREATED" || event.type === "NOTE_UPDATED") && event.note) {
				upsertNote(state.notesByBoardId, boardId, event.note);
				return;
			}

			if (event.type === "NOTE_DELETED" && event.noteId) {
				state.notesByBoardId[boardId] = (state.notesByBoardId[boardId] ?? [])
					.filter((note) => note.id !== event.noteId);
				state.votesByBoardId[boardId] = (state.votesByBoardId[boardId] ?? [])
					.filter((vote) => vote.noteId !== event.noteId);
				return;
			}

			if (event.type === "NOTE_VOTED") {
				const vote = event.vote ?? (event.noteId && event.userId ? {
					noteId: event.noteId,
					userId: event.userId,
					createdAt: event.timestamp ?? new Date().toISOString(),
				} : null);
				if (vote) upsertVote(state.votesByBoardId, boardId, vote);
				return;
			}

			if (event.type === "NOTE_UNVOTED" && event.noteId && event.userId) {
				state.votesByBoardId[boardId] = (state.votesByBoardId[boardId] ?? [])
					.filter((vote) => !(vote.noteId === event.noteId && vote.userId === event.userId));
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
				upsertBoard(state.boardsByCallId, callId, board);
				state.focusedBoardId = board.id;
			})
			.addCase(createScreenOverlayBoard.fulfilled, (state, action) => {
				const { callId, board } = action.payload;
				upsertBoard(state.boardsByCallId, callId, board);
			})
			.addCase(fetchCanvasSnapshot.fulfilled, (state, action: PayloadAction<CanvasSnapshotDto>) => {
				state.strokesByBoardId[action.payload.boardId] = action.payload.strokes.map((stroke) => ({
					...stroke,
					ended: true,
				}));
				state.notesByBoardId[action.payload.boardId] = action.payload.notes ?? [];
				state.votesByBoardId[action.payload.boardId] = action.payload.votes ?? [];
			})
			.addCase(clearCanvasBoard.fulfilled, (state, action) => {
				state.strokesByBoardId[action.payload.boardId] = [];
			})
			.addCase(updateCanvasBoardPermissions.fulfilled, (state, action) => {
				const { callId, board } = action.payload;
				const { request } = action.meta.arg;
				upsertBoard(state.boardsByCallId, callId, {
					...board,
					drawingAccess: request.drawingAccess,
					selectedDrawerUsername: request.drawingAccess === "SELECTED_PARTICIPANT"
						? request.selectedDrawerUsername
						: null,
				});
			})
			.addCase(updateCanvasBoardTemplate.fulfilled, (state, action) => {
				const { callId, board } = action.payload;
				upsertBoard(state.boardsByCallId, callId, board);
			})
			.addCase(startCanvasTimer.fulfilled, (state, action) => {
				const { callId, board } = action.payload;
				upsertBoard(state.boardsByCallId, callId, board);
			})
			.addCase(stopCanvasTimer.fulfilled, (state, action) => {
				const { callId, board } = action.payload;
				upsertBoard(state.boardsByCallId, callId, board);
			})
			.addCase(resetCanvasTimer.fulfilled, (state, action) => {
				const { callId, board } = action.payload;
				upsertBoard(state.boardsByCallId, callId, board);
			})
			.addCase(uploadCanvasBackgroundImage.fulfilled, (state, action) => {
				const { callId, board } = action.payload;
				upsertBoard(state.boardsByCallId, callId, board);
			})
			.addCase(updateCanvasPresenter.fulfilled, (state, action) => {
				const { callId, board } = action.payload;
				upsertBoard(state.boardsByCallId, callId, board);
			})
			.addCase(createCanvasStickyNote.fulfilled, (state, action) => {
				upsertNote(state.notesByBoardId, action.payload.boardId, action.payload.note);
			})
			.addCase(updateCanvasStickyNote.fulfilled, (state, action) => {
				upsertNote(state.notesByBoardId, action.payload.boardId, action.payload.note);
			})
			.addCase(deleteCanvasStickyNote.fulfilled, (state, action) => {
				const { boardId, noteId } = action.payload;
				state.notesByBoardId[boardId] = (state.notesByBoardId[boardId] ?? [])
					.filter((note) => note.id !== noteId);
				state.votesByBoardId[boardId] = (state.votesByBoardId[boardId] ?? [])
					.filter((vote) => vote.noteId !== noteId);
			})
			.addCase(voteCanvasNote.fulfilled, (state, action) => {
				upsertVote(state.votesByBoardId, action.payload.boardId, action.payload.vote);
			})
			.addCase(unvoteCanvasNote.fulfilled, (state, action) => {
				const { boardId, noteId, userId } = action.payload;
				state.votesByBoardId[boardId] = (state.votesByBoardId[boardId] ?? [])
					.filter((vote) => !(vote.noteId === noteId && vote.userId === userId));
			})
			.addCase(closeCanvasBoard.fulfilled, (state, action) => {
				const { callId, boardId } = action.payload;
				state.boardsByCallId[callId] = (state.boardsByCallId[callId] ?? []).filter((board) => board.id !== boardId);
				delete state.strokesByBoardId[boardId];
				delete state.notesByBoardId[boardId];
				delete state.votesByBoardId[boardId];
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
		type === "LASER_END" ||
		type === "REACTION" ||
		type === "VIEWPORT_CHANGED";
}

function isBoardUpsertEvent(type: CanvasBoardEventDto["type"]): boolean {
	return type === "BOARD_CREATED" ||
		type === "BOARD_PERMISSIONS_UPDATED" ||
		type === "BOARD_TEMPLATE_UPDATED" ||
		type === "BOARD_TIMER_STARTED" ||
		type === "BOARD_TIMER_STOPPED" ||
		type === "BOARD_TIMER_RESET" ||
		type === "BOARD_BACKGROUND_UPDATED" ||
		type === "BOARD_PRESENTER_UPDATED";
}

function normalizeBoardEvent(
	type: CanvasBoardEventDto["type"],
	board: CanvasBoardSessionDto
): CanvasBoardSessionDto {
	if (type !== "BOARD_PERMISSIONS_UPDATED") return board;
	if (board.drawingAccess === "SELECTED_PARTICIPANT") return board;
	if (!Object.prototype.hasOwnProperty.call(board, "drawingAccess")) return board;

	return {
		...board,
		selectedDrawerUsername: null,
	};
}

function upsertBoard(
	boardsByCallId: Record<number, CanvasBoardSessionDto[]>,
	callId: number,
	board: CanvasBoardSessionDto
): void {
	const boards = boardsByCallId[callId] ?? [];
	const existingBoard = boards.find((item) => item.id === board.id);
	boardsByCallId[callId] = existingBoard
		? boards.map((item) => (item.id === board.id ? mergeBoardSession(item, board) : item))
		: [...boards, board];
}

function mergeBoardSession(
	current: CanvasBoardSessionDto,
	incoming: CanvasBoardSessionDto
): CanvasBoardSessionDto {
	return {
		...current,
		...incoming,
		drawingAccess: pickBoardField(current, incoming, "drawingAccess"),
		selectedDrawerUsername: pickBoardField(current, incoming, "selectedDrawerUsername"),
		templateType: pickBoardField(current, incoming, "templateType"),
		timerStartedAt: pickBoardField(current, incoming, "timerStartedAt"),
		timerDurationSeconds: pickBoardField(current, incoming, "timerDurationSeconds"),
		timerStatus: pickBoardField(current, incoming, "timerStatus"),
		backgroundImageUrl: pickBoardField(current, incoming, "backgroundImageUrl"),
		backgroundImageContentType: pickBoardField(current, incoming, "backgroundImageContentType"),
		presenterUsername: pickBoardField(current, incoming, "presenterUsername"),
		presenterModeEnabled: pickBoardField(current, incoming, "presenterModeEnabled"),
	};
}

function pickBoardField<Key extends keyof CanvasBoardSessionDto>(
	current: CanvasBoardSessionDto,
	incoming: CanvasBoardSessionDto,
	key: Key
): CanvasBoardSessionDto[Key] {
	return Object.prototype.hasOwnProperty.call(incoming, key) ? incoming[key] : current[key];
}

function upsertNote(
	notesByBoardId: Record<number, CanvasStickyNoteDto[]>,
	boardId: number,
	note: CanvasStickyNoteDto
): void {
	const notes = notesByBoardId[boardId] ?? [];
	const exists = notes.some((item) => item.id === note.id);
	notesByBoardId[boardId] = exists
		? notes.map((item) => (item.id === note.id ? note : item))
		: [...notes, note];
}

function upsertVote(
	votesByBoardId: Record<number, CanvasNoteVoteDto[]>,
	boardId: number,
	vote: CanvasNoteVoteDto
): void {
	const votes = votesByBoardId[boardId] ?? [];
	const exists = votes.some((item) => item.noteId === vote.noteId && item.userId === vote.userId);
	votesByBoardId[boardId] = exists
		? votes.map((item) => (item.noteId === vote.noteId && item.userId === vote.userId ? vote : item))
		: [...votes, vote];
}
