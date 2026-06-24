import type {
	CanvasBoardSessionDto,
	CanvasSnapshotDto,
	CreateCanvasBoardRequest,
	UpdateCanvasBoardPermissionsRequest,
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
	closeCanvasBoard: (callId: number, boardId: number) => Promise<void>;
}
