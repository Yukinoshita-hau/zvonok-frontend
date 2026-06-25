export type CanvasBoardMode = "WHITEBOARD" | "SCREEN_OVERLAY";

export type CanvasBackground = "WHITE" | "BLACK" | "TRANSPARENT";

export type CanvasTool = "PEN" | "ERASER";

export type CanvasInteractionTool = CanvasTool | "LASER" | "STICKY" | "REACTION";

export type CanvasTemplateType =
	| "CLEAN"
	| "DOTS"
	| "GRID"
	| "KANBAN"
	| "BUG_TRIAGE"
	| "ARCHITECTURE"
	| "RETROSPECTIVE"
	| "BRAINSTORM";

export type CanvasReactionType =
	| "THUMBS_UP"
	| "FIRE"
	| "QUESTION"
	| "CHECK"
	| "EYES";

export type CanvasTimerStatus = "STOPPED" | "RUNNING" | "FINISHED";

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
	| "LASER_END"
	| "REACTION"
	| "VIEWPORT_CHANGED";

export type CanvasBoardLifecycleEventType =
	| "BOARD_CREATED"
	| "BOARD_CLOSED"
	| "BOARD_CLEARED"
	| "BOARD_PERMISSIONS_UPDATED"
	| "BOARD_TEMPLATE_UPDATED"
	| "BOARD_TIMER_STARTED"
	| "BOARD_TIMER_STOPPED"
	| "BOARD_TIMER_RESET"
	| "BOARD_BACKGROUND_UPDATED"
	| "BOARD_PRESENTER_UPDATED";

export type CanvasBoardObjectEventType =
	| "NOTE_CREATED"
	| "NOTE_UPDATED"
	| "NOTE_DELETED"
	| "NOTE_VOTED"
	| "NOTE_UNVOTED";

export interface CreateCanvasBoardRequest {
	mode: CanvasBoardMode;
	background: CanvasBackground;
}

export interface UpdateCanvasBoardPermissionsRequest {
	drawingAccess: CanvasDrawingAccess;
	selectedDrawerUsername: string | null;
}

export interface UpdateCanvasBoardTemplateRequest {
	templateType: CanvasTemplateType;
}

export interface UpdateCanvasPresenterRequest {
	presenterModeEnabled: boolean;
	presenterUsername: string | null;
}

export interface CreateCanvasStickyNoteRequest {
	text: string;
	color: string;
	x: number;
	y: number;
	width: number;
	height: number;
}

export interface UpdateCanvasStickyNoteRequest {
	text?: string;
	color?: string;
	x?: number;
	y?: number;
	width?: number;
	height?: number;
	zIndex?: number;
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
	templateType?: CanvasTemplateType;
	timerStartedAt?: string | null;
	timerDurationSeconds?: number | null;
	timerStatus?: CanvasTimerStatus;
	backgroundImageUrl?: string | null;
	backgroundImageCreatedBy?: string | null;
	backgroundImageCreatedAt?: string | null;
	presenterUsername?: string | null;
	presenterModeEnabled?: boolean;
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
	reaction?: CanvasReactionType | null;
	zoom?: number | null;
	timestamp?: string | null;
}

export interface CanvasStickyNoteDto {
	id: number;
	boardId: number;
	noteKey: string;
	createdBy: string;
	text: string;
	color: string;
	x: number;
	y: number;
	width: number;
	height: number;
	zIndex: number;
	createdAt: string;
	updatedAt: string;
}

export interface CanvasNoteVoteDto {
	noteId: number;
	userId: string;
	createdAt: string;
}

export interface CanvasBoardObjectEventDto {
	type: CanvasBoardObjectEventType;
	boardId: number;
	note?: CanvasStickyNoteDto | null;
	noteId?: number | null;
	vote?: CanvasNoteVoteDto | null;
	userId?: string | null;
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
	notes?: CanvasStickyNoteDto[];
	votes?: CanvasNoteVoteDto[];
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
