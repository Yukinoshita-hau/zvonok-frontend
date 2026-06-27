import type { CodeRunResponseDto, ExecutionResponseStatus } from "./codeRunTypes";

export type CodeAccessRole = "HOST" | "EDITOR" | "VIEWER";

export type CodeSessionEventType =
	| "CODE_SESSION_CREATED"
	| "CODE_SESSION_CLOSED"
	| "CODE_CONTENT_SYNC"
	| "CODE_STDIN_SYNC"
	| "CODE_LANGUAGE_CHANGED"
	| "CODE_CURSOR_SYNC"
	| "CODE_ACCESS_GRANTED"
	| "CODE_ACCESS_REVOKED"
	| "CODE_RUN_STARTED"
	| "CODE_RUN_FINISHED";

export interface CodeSessionUserDto {
	id?: number | string | null;
	username: string;
	displayName?: string | null;
}

export interface CodeRunResultDto extends CodeRunResponseDto {
	status: ExecutionResponseStatus;
}

export interface CodeCursorDto {
	lineNumber: number;
	column: number;
	selectionStartLineNumber: number;
	selectionStartColumn: number;
	selectionEndLineNumber: number;
	selectionEndColumn: number;
}

export interface CodeSessionDto {
	id: number;
	callSessionId?: number;
	callId?: number;
	language: string;
	code: string;
	stdin: string;
	active: boolean;
	currentUserRole?: CodeAccessRole | null;
	createdBy?: CodeSessionUserDto | string | null;
	host?: CodeSessionUserDto | string | null;
	activeEditor?: CodeSessionUserDto | string | null;
	lastRunResult?: CodeRunResultDto | null;
	lastOutput?: string | null;
	lastStatus?: ExecutionResponseStatus | null;
	lastExitCode?: number | null;
	lastExecutionTimeMs?: number | null;
	running?: boolean;
	createdAt?: string | null;
	updatedAt?: string | null;
}

export interface CreateCodeSessionRequestDto {
	callSessionId: number;
	language?: string;
	code?: string;
	stdin?: string;
}

export interface CodeSessionContentSyncPayload {
	code: string;
}

export interface CodeSessionStdinSyncPayload {
	stdin: string;
}

export interface CodeSessionLanguageChangePayload {
	language: string;
	code?: string | null;
}

export interface CodeSessionCursorSyncPayload extends CodeCursorDto {}

export interface CodeSessionEventDto {
	type: CodeSessionEventType;
	eventType?: CodeSessionEventType | null;
	sessionId?: number | null;
	codeSessionId?: number | null;
	callSessionId?: number | null;
	session?: CodeSessionDto | null;
	codeSession?: CodeSessionDto | null;
	id?: number | null;
	roomId?: number | null;
	active?: boolean | null;
	senderId?: number | string | null;
	senderUsername?: string | null;
	senderDisplayName?: string | null;
	sender?: CodeSessionUserDto | string | null;
	userId?: number | string | null;
	username?: string | null;
	displayName?: string | null;
	code?: string | null;
	stdin?: string | null;
	language?: string | null;
	cursor?: CodeCursorDto | null;
	activeEditor?: CodeSessionUserDto | string | null;
	runResult?: CodeRunResultDto | null;
	lastRunResult?: CodeRunResultDto | null;
	result?: CodeRunResultDto | null;
	output?: CodeRunResultDto | string | null;
	outputText?: string | null;
	stderr?: string | null;
	lastOutput?: string | null;
	status?: ExecutionResponseStatus | null;
	lastStatus?: ExecutionResponseStatus | null;
	stdout?: string | null;
	exitCode?: number | null;
	lastExitCode?: number | null;
	executionTimeMs?: number | null;
	lastExecutionTimeMs?: number | null;
	lineNumber?: number | null;
	column?: number | null;
	selectionStartLineNumber?: number | null;
	selectionStartColumn?: number | null;
	selectionEndLineNumber?: number | null;
	selectionEndColumn?: number | null;
	payload?: CodeSessionEventPayloadDto | null;
	timestamp?: string | null;
}

export interface CodeSessionEventPayloadDto {
	type?: CodeSessionEventType | null;
	eventType?: CodeSessionEventType | null;
	sessionId?: number | null;
	codeSessionId?: number | null;
	callSessionId?: number | null;
	session?: CodeSessionDto | null;
	codeSession?: CodeSessionDto | null;
	id?: number | null;
	roomId?: number | null;
	active?: boolean | null;
	senderId?: number | string | null;
	senderUsername?: string | null;
	senderDisplayName?: string | null;
	sender?: CodeSessionUserDto | string | null;
	userId?: number | string | null;
	username?: string | null;
	displayName?: string | null;
	code?: string | null;
	content?: string | null;
	stdin?: string | null;
	language?: string | null;
	cursor?: CodeCursorDto | null;
	activeEditor?: CodeSessionUserDto | string | null;
	runResult?: CodeRunResultDto | null;
	lastRunResult?: CodeRunResultDto | null;
	result?: CodeRunResultDto | null;
	output?: CodeRunResultDto | string | null;
	outputText?: string | null;
	stderr?: string | null;
	lastOutput?: string | null;
	status?: ExecutionResponseStatus | null;
	lastStatus?: ExecutionResponseStatus | null;
	stdout?: string | null;
	exitCode?: number | null;
	lastExitCode?: number | null;
	executionTimeMs?: number | null;
	lastExecutionTimeMs?: number | null;
	lineNumber?: number | null;
	column?: number | null;
	selectionStartLineNumber?: number | null;
	selectionStartColumn?: number | null;
	selectionEndLineNumber?: number | null;
	selectionEndColumn?: number | null;
}
