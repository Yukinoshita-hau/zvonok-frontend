import { createAsyncThunk, createSlice, type PayloadAction } from "@reduxjs/toolkit";
import { codeSessionApi } from "../../api/codeSessionApi";
import type {
	CodeCursorDto,
	CodeRunResultDto,
	CodeSessionContentSyncPayload,
	CodeSessionCursorSyncPayload,
	CodeSessionDto,
	CodeSessionEventDto,
	CodeSessionEventPayloadDto,
	CodeSessionLanguageChangePayload,
	CodeSessionStdinSyncPayload,
	CreateCodeSessionRequestDto,
} from "../../api/interfaces/codeSessionTypes";

export interface RemoteCursorState {
	userId: string;
	username: string;
	displayName: string;
	cursor: CodeCursorDto;
	updatedAt: number;
}

interface CodeSessionState {
	activeSessionByCallId: Record<number, CodeSessionDto | undefined>;
	contentBySessionId: Record<number, string>;
	stdinBySessionId: Record<number, string>;
	languageBySessionId: Record<number, string>;
	resultBySessionId: Record<number, CodeRunResultDto | null | undefined>;
	runningBySessionId: Record<number, boolean | undefined>;
	runErrorBySessionId: Record<number, string | null | undefined>;
	remoteCursorsBySessionId: Record<number, Record<string, RemoteCursorState>>;
	loadingByCallId: Record<number, boolean | undefined>;
	errorByCallId: Record<number, string | null | undefined>;
}

export interface CodeSessionSubscriptionPayload {
	callSessionId: number;
	sessionId?: number | null;
}

export interface CodeSessionPublishPayload {
	sessionId: number;
	payload:
		| CodeSessionContentSyncPayload
		| CodeSessionStdinSyncPayload
		| CodeSessionLanguageChangePayload
		| CodeSessionCursorSyncPayload;
}

const initialState: CodeSessionState = {
	activeSessionByCallId: {},
	contentBySessionId: {},
	stdinBySessionId: {},
	languageBySessionId: {},
	resultBySessionId: {},
	runningBySessionId: {},
	runErrorBySessionId: {},
	remoteCursorsBySessionId: {},
	loadingByCallId: {},
	errorByCallId: {},
};

export const fetchActiveCodeSession = createAsyncThunk(
	"codeSession/fetchActive",
	async (callSessionId: number) => {
		const session = await codeSessionApi.getActiveSession(callSessionId);
		return { callSessionId, session };
	}
);

export const createCodeSession = createAsyncThunk(
	"codeSession/create",
	async (request: CreateCodeSessionRequestDto) => {
		const session = await codeSessionApi.createSession(request);
		return { callSessionId: request.callSessionId, session };
	}
);

export const grantCodeSessionEditor = createAsyncThunk(
	"codeSession/grantEditor",
	async ({ sessionId, username }: { sessionId: number; username: string }) => {
		const session = await codeSessionApi.grantEditor(sessionId, username);
		return session;
	}
);

export const revokeCodeSessionEditor = createAsyncThunk(
	"codeSession/revokeEditor",
	async (sessionId: number) => codeSessionApi.revokeEditor(sessionId)
);

export const runCodeSession = createAsyncThunk(
	"codeSession/run",
	async (sessionId: number) => {
		const result = await codeSessionApi.runSession(sessionId);
		return { sessionId, result };
	}
);

export const closeCodeSession = createAsyncThunk(
	"codeSession/close",
	async (sessionId: number) => {
		await codeSessionApi.closeSession(sessionId);
		return sessionId;
	}
);

export const codeSessionSlice = createSlice({
	name: "codeSession",
	initialState,
	reducers: {
		applySessionEvent: (state, action: PayloadAction<CodeSessionEventDto>) => {
			applySessionEvent(state, action.payload);
		},
		setLocalContent: (state, action: PayloadAction<{ sessionId: number; code: string }>) => {
			state.contentBySessionId[action.payload.sessionId] = action.payload.code;
		},
		setLocalStdin: (state, action: PayloadAction<{ sessionId: number; stdin: string }>) => {
			state.stdinBySessionId[action.payload.sessionId] = action.payload.stdin;
		},
		setLocalLanguage: (state, action: PayloadAction<{ sessionId: number; language: string; code?: string }>) => {
			state.languageBySessionId[action.payload.sessionId] = action.payload.language;
			if (typeof action.payload.code === "string") {
				state.contentBySessionId[action.payload.sessionId] = action.payload.code;
			}
		},
		clearRemoteCursors: (state, action: PayloadAction<number>) => {
			delete state.remoteCursorsBySessionId[action.payload];
		},
		subscribeCodeSession: (_state, _action: PayloadAction<CodeSessionSubscriptionPayload>) => {},
		unsubscribeCodeSession: (_state, _action: PayloadAction<CodeSessionSubscriptionPayload>) => {},
		sendCodeContentSync: (_state, _action: PayloadAction<CodeSessionPublishPayload>) => {},
		sendCodeStdinSync: (_state, _action: PayloadAction<CodeSessionPublishPayload>) => {},
		sendCodeLanguageChange: (_state, _action: PayloadAction<CodeSessionPublishPayload>) => {},
		sendCodeCursorSync: (_state, _action: PayloadAction<CodeSessionPublishPayload>) => {},
	},
	extraReducers: (builder) => {
		builder
			.addCase(fetchActiveCodeSession.pending, (state, action) => {
				state.loadingByCallId[action.meta.arg] = true;
				state.errorByCallId[action.meta.arg] = null;
			})
			.addCase(fetchActiveCodeSession.fulfilled, (state, action) => {
				state.loadingByCallId[action.payload.callSessionId] = false;
				setActiveSession(state, action.payload.callSessionId, action.payload.session);
			})
			.addCase(fetchActiveCodeSession.rejected, (state, action) => {
				state.loadingByCallId[action.meta.arg] = false;
				state.errorByCallId[action.meta.arg] = action.error.message ?? "Не удалось загрузить Code Session";
			})
			.addCase(createCodeSession.fulfilled, (state, action) => {
				setActiveSession(state, action.payload.callSessionId, action.payload.session);
			})
			.addCase(grantCodeSessionEditor.fulfilled, (state, action) => {
				setActiveSession(state, getSessionCallId(action.payload), action.payload);
			})
			.addCase(revokeCodeSessionEditor.fulfilled, (state, action) => {
				setActiveSession(state, getSessionCallId(action.payload), action.payload);
			})
			.addCase(runCodeSession.pending, (state, action) => {
				state.runningBySessionId[action.meta.arg] = true;
				state.runErrorBySessionId[action.meta.arg] = null;
			})
			.addCase(runCodeSession.fulfilled, (state, action) => {
				state.runningBySessionId[action.payload.sessionId] = false;
				state.runErrorBySessionId[action.payload.sessionId] = null;
				if (action.payload.result) {
					state.resultBySessionId[action.payload.sessionId] = action.payload.result;
				}
			})
			.addCase(runCodeSession.rejected, (state, action) => {
				state.runningBySessionId[action.meta.arg] = false;
				state.runErrorBySessionId[action.meta.arg] = action.error.message ?? "Не удалось выполнить код";
			})
			.addCase(closeCodeSession.fulfilled, (state, action) => {
				closeSessionById(state, action.payload);
			});
	},
});

function applySessionEvent(state: CodeSessionState, event: CodeSessionEventDto) {
	const type = event.eventType ?? event.type ?? event.payload?.eventType ?? event.payload?.type;
	const payload = event.payload ?? null;
	const session = event.session ??
		event.codeSession ??
		payload?.session ??
		payload?.codeSession ??
		(getPayloadSession(payload));
	const sessionId = resolveSessionId(state, event, session);

	if (type === "CODE_SESSION_CREATED" && session) {
		setActiveSession(state, getSessionCallId(session, event), session);
		return;
	}

	if (type === "CODE_SESSION_CLOSED") {
		if (sessionId) closeSessionById(state, sessionId);
		return;
	}

	if (!sessionId) return;

	if (session) {
		setActiveSession(state, getSessionCallId(session, event), session);
	}

	switch (type) {
		case "CODE_CONTENT_SYNC":
			setStringValue(state.contentBySessionId, sessionId, event.code ?? payload?.code ?? payload?.content);
			break;
		case "CODE_STDIN_SYNC":
			setStringValue(state.stdinBySessionId, sessionId, event.stdin ?? payload?.stdin);
			break;
		case "CODE_LANGUAGE_CHANGED":
			setStringValue(state.languageBySessionId, sessionId, event.language ?? payload?.language);
			setStringValue(state.contentBySessionId, sessionId, event.code ?? payload?.code ?? payload?.content);
			break;
		case "CODE_CURSOR_SYNC":
			applyCursorEvent(state, sessionId, event);
			break;
		case "CODE_ACCESS_GRANTED":
		case "CODE_ACCESS_REVOKED":
			updateActiveEditor(state, sessionId, event.activeEditor ?? payload?.activeEditor ?? session?.activeEditor ?? null);
			break;
		case "CODE_RUN_STARTED":
			state.runningBySessionId[sessionId] = true;
			break;
		case "CODE_RUN_FINISHED": {
			const result = resolveRunResult(event);
			state.runningBySessionId[sessionId] = false;
			state.runErrorBySessionId[sessionId] = null;
			if (result) state.resultBySessionId[sessionId] = result;
			break;
		}
		default:
			break;
	}
}

function setActiveSession(state: CodeSessionState, callSessionId: number | null, session: CodeSessionDto | null) {
	if (!callSessionId) return;
	if (!session) {
		delete state.activeSessionByCallId[callSessionId];
		return;
	}

	state.activeSessionByCallId[callSessionId] = session;
	state.contentBySessionId[session.id] = session.code ?? state.contentBySessionId[session.id] ?? "";
	state.stdinBySessionId[session.id] = session.stdin ?? state.stdinBySessionId[session.id] ?? "";
	state.languageBySessionId[session.id] = session.language ?? state.languageBySessionId[session.id] ?? "javascript";
	state.resultBySessionId[session.id] =
		resolveSessionRunResult(session) ??
		state.resultBySessionId[session.id] ??
		null;
	state.runningBySessionId[session.id] = Boolean(session.running);
}

function closeSessionById(state: CodeSessionState, sessionId: number) {
	Object.entries(state.activeSessionByCallId).forEach(([callSessionId, session]) => {
		if (session?.id === sessionId) delete state.activeSessionByCallId[Number(callSessionId)];
	});
	delete state.contentBySessionId[sessionId];
	delete state.stdinBySessionId[sessionId];
	delete state.languageBySessionId[sessionId];
	delete state.resultBySessionId[sessionId];
	delete state.runningBySessionId[sessionId];
	delete state.runErrorBySessionId[sessionId];
	delete state.remoteCursorsBySessionId[sessionId];
}

function applyCursorEvent(state: CodeSessionState, sessionId: number, event: CodeSessionEventDto) {
	const cursor = resolveCursor(event);
	if (!cursor) return;
	const payload = event.payload ?? null;
	const sender = normalizeUser(event.sender ?? payload?.sender ?? null);
	const userId = String(
		event.senderId ??
		payload?.senderId ??
		event.userId ??
		payload?.userId ??
		sender?.id ??
		event.senderUsername ??
		payload?.senderUsername ??
		event.username ??
		payload?.username ??
		sender?.username ??
		""
	);
	if (!userId) return;

	const cursors = state.remoteCursorsBySessionId[sessionId] ?? {};
	cursors[userId] = {
		userId,
		username: event.senderUsername ?? payload?.senderUsername ?? event.username ?? payload?.username ?? sender?.username ?? userId,
		displayName: event.senderDisplayName ??
			payload?.senderDisplayName ??
			event.displayName ??
			payload?.displayName ??
			sender?.displayName ??
			event.senderUsername ??
			payload?.senderUsername ??
			event.username ??
			payload?.username ??
			sender?.username ??
			userId,
		cursor,
		updatedAt: Date.now(),
	};
	state.remoteCursorsBySessionId[sessionId] = cursors;
}

function resolveRunResult(event: CodeSessionEventDto): CodeRunResultDto | null {
	const payload = event.payload ?? null;
	const nested = event.runResult ?? event.result ?? event.output ??
		event.lastRunResult ??
		payload?.runResult ??
		payload?.result ??
		payload?.output ??
		payload?.lastRunResult ??
		null;

	if (isRunResult(nested)) return nested;

	return buildRunResult(event) ?? (payload ? buildRunResult(payload) : null);
}

function resolveSessionRunResult(session: CodeSessionDto): CodeRunResultDto | null {
	if (session.lastRunResult) return session.lastRunResult;
	if (!session.lastStatus) return null;

	return {
		status: session.lastStatus,
		stdout: session.lastOutput ?? "",
		exitCode: session.lastExitCode ?? 0,
		executionTimeMs: session.lastExecutionTimeMs ?? 0,
	};
}

function buildRunResult(source: CodeSessionEventDto | CodeSessionEventPayloadDto): CodeRunResultDto | null {
	const status = source.status ?? source.lastStatus;
	if (!status) return null;
	const output = typeof source.output === "string" ? source.output : undefined;

	return {
		status,
		stdout: source.stdout ?? source.outputText ?? output ?? source.lastOutput ?? source.stderr ?? "",
		exitCode: source.exitCode ?? source.lastExitCode ?? 0,
		executionTimeMs: source.executionTimeMs ?? source.lastExecutionTimeMs ?? 0,
	};
}

function isRunResult(value: unknown): value is CodeRunResultDto {
	if (!value || typeof value !== "object") return false;
	return "status" in value && "stdout" in value;
}

function resolveCursor(event: CodeSessionEventDto): CodeCursorDto | null {
	const payload = event.payload ?? null;
	return (
		buildCursor(event.cursor, payload, event) ??
		buildCursor(payload?.cursor, payload, event) ??
		(payload ? buildCursor(payload, event) : null) ??
		buildCursor(event, payload)
	);
}

interface CursorFields {
	lineNumber?: number | null;
	column?: number | null;
	selectionStartLineNumber?: number | null;
	selectionStartColumn?: number | null;
	selectionEndLineNumber?: number | null;
	selectionEndColumn?: number | null;
}

function buildCursor(
	source: CursorFields | null | undefined,
	...fallbackSources: Array<CursorFields | null | undefined>
): CodeCursorDto | null {
	if (!source) return null;
	const sources = [source, ...fallbackSources];
	const lineNumber = resolveCursorNumber(sources, "lineNumber");
	const column = resolveCursorNumber(sources, "column");
	const selectionStartLineNumber = resolveCursorNumber(sources, "selectionStartLineNumber") ?? lineNumber;
	const selectionStartColumn = resolveCursorNumber(sources, "selectionStartColumn") ?? column;
	const selectionEndLineNumber = resolveCursorNumber(sources, "selectionEndLineNumber") ?? lineNumber;
	const selectionEndColumn = resolveCursorNumber(sources, "selectionEndColumn") ?? column;

	if (
		lineNumber == null ||
		column == null ||
		selectionStartLineNumber == null ||
		selectionStartColumn == null ||
		selectionEndLineNumber == null ||
		selectionEndColumn == null
	) {
		return null;
	}

	return {
		lineNumber,
		column,
		selectionStartLineNumber,
		selectionStartColumn,
		selectionEndLineNumber,
		selectionEndColumn,
	};
}

function resolveCursorNumber(sources: CursorFields[], field: keyof CursorFields): number | null {
	for (const source of sources) {
		const value = source?.[field];
		if (typeof value === "number" && Number.isFinite(value)) return value;
	}
	return null;
}

function updateActiveEditor(
	state: CodeSessionState,
	sessionId: number,
	activeEditor: CodeSessionDto["activeEditor"]
) {
	Object.entries(state.activeSessionByCallId).forEach(([callSessionId, session]) => {
		if (session?.id !== sessionId) return;
		state.activeSessionByCallId[Number(callSessionId)] = { ...session, activeEditor };
	});
}

export default codeSessionSlice.reducer;
export const codeSessionActions = codeSessionSlice.actions;

function resolveSessionId(
	state: CodeSessionState,
	event: CodeSessionEventDto,
	session: CodeSessionDto | null
): number | null {
	if (event.sessionId) return event.sessionId;
	if (event.codeSessionId) return event.codeSessionId;
	if (event.payload?.sessionId) return event.payload.sessionId;
	if (event.payload?.codeSessionId) return event.payload.codeSessionId;
	if (session?.id) return session.id;

	const callSessionId = event.callSessionId ?? event.payload?.callSessionId;
	if (callSessionId) return state.activeSessionByCallId[callSessionId]?.id ?? null;

	return getOnlyActiveSessionId(state);
}

function setStringValue(target: Record<number, string>, sessionId: number, value: string | null | undefined) {
	if (typeof value === "string") target[sessionId] = value;
}

function normalizeUser(user: CodeSessionDto["activeEditor"]): { id?: number | string | null; username: string; displayName?: string | null } | null {
	if (!user) return null;
	if (typeof user === "string") return { username: user };
	return user;
}

function getPayloadSession(payload: CodeSessionEventPayloadDto | null): CodeSessionDto | null {
	if (!payload?.id) return null;
	if (!payload.callSessionId && !payload.code && !payload.language && !payload.lastStatus && !payload.lastOutput) return null;

	return payload as unknown as CodeSessionDto;
}

function getSessionCallId(session: CodeSessionDto, event?: CodeSessionEventDto): number | null {
	return session.callSessionId ??
		session.callId ??
		event?.callSessionId ??
		event?.payload?.callSessionId ??
		null;
}

function getOnlyActiveSessionId(state: CodeSessionState): number | null {
	const activeSessions = Object.values(state.activeSessionByCallId)
		.filter((session): session is CodeSessionDto => Boolean(session));

	return activeSessions.length === 1 ? activeSessions[0].id : null;
}
