import type {
	CanvasBoardSessionDto,
	CanvasSnapshotDto,
	CreateCanvasBoardRequest,
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
	closeCanvasBoard: (callId: number, boardId: number) => Promise<void>;
}

