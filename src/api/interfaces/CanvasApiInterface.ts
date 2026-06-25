import type {
	CanvasBoardSessionDto,
	CanvasNoteVoteDto,
	CanvasSnapshotDto,
	CanvasStickyNoteDto,
	CreateCanvasBoardRequest,
	CreateCanvasStickyNoteRequest,
	UpdateCanvasBoardTemplateRequest,
	UpdateCanvasBoardPermissionsRequest,
	UpdateCanvasPresenterRequest,
	UpdateCanvasStickyNoteRequest,
} from "./CanvasDtos";

export interface CanvasApiInterface {
	createCanvasBoard: (
		callId: number,
		request: CreateCanvasBoardRequest
	) => Promise<CanvasBoardSessionDto>;
	getActiveCanvasBoards: (callId: number) => Promise<CanvasBoardSessionDto[]>;
	getCanvasBoard: (callId: number, boardId: number) => Promise<CanvasBoardSessionDto>;
	getCanvasSnapshot: (callId: number, boardId: number) => Promise<CanvasSnapshotDto>;
	clearCanvasBoard: (callId: number, boardId: number) => Promise<void>;
	undoLastCanvasStroke: (callId: number, boardId: number) => Promise<void>;
	updateCanvasBoardPermissions: (
		callId: number,
		boardId: number,
		request: UpdateCanvasBoardPermissionsRequest
	) => Promise<CanvasBoardSessionDto>;
	updateCanvasBoardTemplate: (
		callId: number,
		boardId: number,
		request: UpdateCanvasBoardTemplateRequest
	) => Promise<CanvasBoardSessionDto>;
	startCanvasTimer: (callId: number, boardId: number, durationSeconds: number) => Promise<CanvasBoardSessionDto>;
	stopCanvasTimer: (callId: number, boardId: number) => Promise<CanvasBoardSessionDto>;
	resetCanvasTimer: (callId: number, boardId: number) => Promise<CanvasBoardSessionDto>;
	uploadCanvasBackgroundImage: (callId: number, boardId: number, file: File) => Promise<CanvasBoardSessionDto>;
	updateCanvasPresenter: (
		callId: number,
		boardId: number,
		request: UpdateCanvasPresenterRequest
	) => Promise<CanvasBoardSessionDto>;
	getCanvasStickyNotes: (callId: number, boardId: number) => Promise<CanvasStickyNoteDto[]>;
	createCanvasStickyNote: (
		callId: number,
		boardId: number,
		request: CreateCanvasStickyNoteRequest
	) => Promise<CanvasStickyNoteDto>;
	updateCanvasStickyNote: (
		callId: number,
		boardId: number,
		noteId: number,
		request: UpdateCanvasStickyNoteRequest
	) => Promise<CanvasStickyNoteDto>;
	deleteCanvasStickyNote: (callId: number, boardId: number, noteId: number) => Promise<void>;
	voteCanvasNote: (callId: number, boardId: number, noteId: number) => Promise<CanvasNoteVoteDto>;
	unvoteCanvasNote: (callId: number, boardId: number, noteId: number) => Promise<void>;
	getCanvasBoardVotes: (callId: number, boardId: number) => Promise<CanvasNoteVoteDto[]>;
	closeCanvasBoard: (callId: number, boardId: number) => Promise<void>;
}
