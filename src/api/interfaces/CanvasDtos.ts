export type CanvasBoardMode = "WHITEBOARD" | "SCREEN_OVERLAY";

export type CanvasBackground = "WHITE" | "BLACK" | "TRANSPARENT";

export type CanvasTool = "PEN" | "ERASER";

export type CanvasInteractionTool = CanvasTool | "LASER";

export type CanvasDrawingAccess =
	| "EVERYONE"
	| "HOSTS_ONLY"
	| "SELECTED_PARTICIPANT"
	| "VIEW_ONLY";

export type CanvasDrawEventType =
	| "STROKE_START"
	| "STROKE_POINT"
	| "STROKE_END"
	| "STROKE_REMOVED"
	| "BOARD_CLEAR"
	| "CURSOR_MOVE"
	| "CURSOR_LEAVE"
	| "LASER_POINT"
	| "LASER_END";

export type CanvasBoardLifecycleEventType =
	| "BOARD_CREATED"
	| "BOARD_CLOSED"
	| "BOARD_CLEARED"
	| "BOARD_PERMISSIONS_UPDATED";

export interface CreateCanvasBoardRequest {
	mode: CanvasBoardMode;
	background: CanvasBackground;
}

export interface UpdateCanvasBoardPermissionsRequest {
	drawingAccess: CanvasDrawingAccess;
	selectedDrawerUsername: string | null;
}

export interface CanvasBoardSessionDto {
	id: number;
	callId: number;
	roomId: number | null;
	mode: CanvasBoardMode;
	background: CanvasBackground;
	createdBy: string;
	createdAt: string;
	active: boolean;
	drawingAccess?: CanvasDrawingAccess;
	selectedDrawerUsername?: string | null;
}

export interface CanvasDrawEventDto {
	type: CanvasDrawEventType;
	boardId: number;
	strokeId?: string | null;
	userId?: string | null;
	x?: number | null;
	y?: number | null;
	color?: string | null;
	width?: number | null;
	tool?: CanvasTool | null;
	timestamp?: string | null;
}

export interface CanvasPointDto {
	x: number;
	y: number;
}

export interface CanvasStrokeDto {
	id: string;
	userId: string;
	color: string;
	width: number;
	tool: CanvasTool;
	points: CanvasPointDto[];
}

export interface CanvasSnapshotDto {
	boardId: number;
	strokes: CanvasStrokeDto[];
}

export interface CanvasBoardEventDto {
	type: CanvasBoardLifecycleEventType;
	board: CanvasBoardSessionDto;
}

export interface StrokeRenderState {
	id: string;
	userId: string;
	color: string;
	width: number;
	tool: CanvasTool;
	points: CanvasPointDto[];
	ended?: boolean;
}
