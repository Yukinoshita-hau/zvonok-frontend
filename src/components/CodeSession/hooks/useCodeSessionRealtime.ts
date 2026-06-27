import { useCallback, useEffect, useMemo, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import type { CanvasParticipantOption } from "../../CallCanvas/CallCanvas.types";
import type { AppDispatch, RootState } from "../../../store/store";
import {
	codeSessionActions,
	createCodeSession,
	fetchActiveCodeSession,
	grantCodeSessionEditor,
	revokeCodeSessionEditor,
	runCodeSession,
} from "../../../store/slices/codeSession.slice";
import type {
	CodeAccessRole,
	CodeCursorDto,
	CodeRunResultDto,
	CodeSessionDto,
	CodeSessionUserDto,
} from "../../../api/interfaces/codeSessionTypes";

const CONTENT_SYNC_INTERVAL_MS = 100;
const CURSOR_SYNC_DELAY_MS = 120;

const CODE_TEMPLATES: Record<string, string> = {
	java: `import java.io.BufferedReader;
import java.io.InputStreamReader;

public class Main {
    public static void main(String[] args) throws Exception {
        BufferedReader reader = new BufferedReader(new InputStreamReader(System.in));
        String input = reader.readLine();

        System.out.println("Hello from Zvonok");
        if (input != null && !input.isBlank()) {
            System.out.println("stdin: " + input);
        }
    }
}`,
	javascript: `const fs = require("fs");
const input = fs.readFileSync(0, "utf8").trim();

console.log("Hello from Zvonok");
if (input) {
  console.log("stdin:", input);
}`,
};

interface UseCodeSessionRealtimeParams {
	callSessionId: number;
	currentUserId?: number | string | null;
	currentUsername?: string | null;
	isCurrentUserHost: boolean;
	participantOptions: CanvasParticipantOption[];
}

export function useCodeSessionRealtime({
	callSessionId,
	currentUserId,
	currentUsername,
	isCurrentUserHost,
	participantOptions,
}: UseCodeSessionRealtimeParams) {
	const dispatch = useDispatch<AppDispatch>();
	const session = useSelector((state: RootState) => state.codeSession.activeSessionByCallId[callSessionId] ?? null);
	const isLoading = useSelector((state: RootState) => Boolean(state.codeSession.loadingByCallId[callSessionId]));
	const error = useSelector((state: RootState) => state.codeSession.errorByCallId[callSessionId] ?? null);
	const code = useSelector((state: RootState) => session ? state.codeSession.contentBySessionId[session.id] ?? session.code : "");
	const stdin = useSelector((state: RootState) => session ? state.codeSession.stdinBySessionId[session.id] ?? session.stdin : "");
	const language = useSelector((state: RootState) => session ? state.codeSession.languageBySessionId[session.id] ?? session.language : "javascript");
	const result = useSelector((state: RootState) => session ? state.codeSession.resultBySessionId[session.id] ?? getSessionRunResult(session) : null);
	const isRunning = useSelector((state: RootState) => session ? Boolean(state.codeSession.runningBySessionId[session.id]) : false);
	const runError = useSelector((state: RootState) => session ? state.codeSession.runErrorBySessionId[session.id] ?? null : null);
	const remoteCursors = useSelector((state: RootState) => session ? state.codeSession.remoteCursorsBySessionId[session.id] ?? {} : {});

	const activeEditor = normalizeUser(session?.activeEditor ?? null);
	const role = useMemo<CodeAccessRole>(() => {
		if (session?.currentUserRole) return session.currentUserRole;
		if (isCurrentUserHost) return "HOST";
		const userMatchesEditor = Boolean(
			activeEditor &&
			(
				(currentUserId != null && activeEditor.id != null && String(activeEditor.id) === String(currentUserId)) ||
				(currentUsername && activeEditor.username === currentUsername)
			)
		);
		return userMatchesEditor ? "EDITOR" : "VIEWER";
	}, [activeEditor, currentUserId, currentUsername, isCurrentUserHost, session?.currentUserRole]);
	const canEdit = role === "HOST" || role === "EDITOR";

	const contentTimerRef = useRef<number | null>(null);
	const stdinTimerRef = useRef<number | null>(null);
	const cursorTimerRef = useRef<number | null>(null);
	const lastContentSyncAtRef = useRef(0);
	const lastStdinSyncAtRef = useRef(0);
	const pendingContentRef = useRef<string | null>(null);
	const pendingStdinRef = useRef<string | null>(null);
	const pendingCursorRef = useRef<CodeCursorDto | null>(null);

	useEffect(() => {
		void dispatch(fetchActiveCodeSession(callSessionId));

		return () => {
			if (contentTimerRef.current) window.clearTimeout(contentTimerRef.current);
			if (stdinTimerRef.current) window.clearTimeout(stdinTimerRef.current);
			if (cursorTimerRef.current) window.clearTimeout(cursorTimerRef.current);
			pendingContentRef.current = null;
			pendingStdinRef.current = null;
			pendingCursorRef.current = null;
			if (session?.id) dispatch(codeSessionActions.clearRemoteCursors(session.id));
		};
	}, [callSessionId, dispatch, session?.id]);

	useEffect(() => {
		if (!session || !isRunning) return;

		const intervalId = window.setInterval(() => {
			void dispatch(fetchActiveCodeSession(callSessionId));
		}, 1200);

		return () => window.clearInterval(intervalId);
	}, [callSessionId, dispatch, isRunning, session?.id]);

	const createSession = useCallback(() => {
		void dispatch(createCodeSession({
			callSessionId,
			language: "javascript",
			code: CODE_TEMPLATES.javascript,
			stdin: "",
		}));
	}, [callSessionId, dispatch]);

	const changeCode = useCallback((nextCode: string) => {
		if (!session || !canEdit) return;
		dispatch(codeSessionActions.setLocalContent({ sessionId: session.id, code: nextCode }));

		pendingContentRef.current = nextCode;
		const sendContent = () => {
			if (pendingContentRef.current == null) return;
			lastContentSyncAtRef.current = Date.now();
			dispatch(codeSessionActions.sendCodeContentSync({
				sessionId: session.id,
				payload: { code: pendingContentRef.current },
			}));
			pendingContentRef.current = null;
			contentTimerRef.current = null;
		};

		const elapsed = Date.now() - lastContentSyncAtRef.current;
		if (elapsed >= CONTENT_SYNC_INTERVAL_MS) {
			if (contentTimerRef.current) {
				window.clearTimeout(contentTimerRef.current);
				contentTimerRef.current = null;
			}
			sendContent();
			return;
		}

		if (contentTimerRef.current) return;
		contentTimerRef.current = window.setTimeout(sendContent, CONTENT_SYNC_INTERVAL_MS - elapsed);
	}, [canEdit, dispatch, session]);

	const changeStdin = useCallback((nextStdin: string) => {
		if (!session || !canEdit) return;
		dispatch(codeSessionActions.setLocalStdin({ sessionId: session.id, stdin: nextStdin }));

		pendingStdinRef.current = nextStdin;
		const sendStdin = () => {
			if (pendingStdinRef.current == null) return;
			lastStdinSyncAtRef.current = Date.now();
			dispatch(codeSessionActions.sendCodeStdinSync({
				sessionId: session.id,
				payload: { stdin: pendingStdinRef.current },
			}));
			pendingStdinRef.current = null;
			stdinTimerRef.current = null;
		};

		const elapsed = Date.now() - lastStdinSyncAtRef.current;
		if (elapsed >= CONTENT_SYNC_INTERVAL_MS) {
			if (stdinTimerRef.current) {
				window.clearTimeout(stdinTimerRef.current);
				stdinTimerRef.current = null;
			}
			sendStdin();
			return;
		}

		if (stdinTimerRef.current) return;
		stdinTimerRef.current = window.setTimeout(sendStdin, CONTENT_SYNC_INTERVAL_MS - elapsed);
	}, [canEdit, dispatch, session]);

	const changeLanguage = useCallback((nextLanguage: string) => {
		if (!session || !canEdit) return;
		dispatch(codeSessionActions.setLocalLanguage({ sessionId: session.id, language: nextLanguage }));
		dispatch(codeSessionActions.sendCodeLanguageChange({
			sessionId: session.id,
			payload: { language: nextLanguage },
		}));
	}, [canEdit, dispatch, session]);

	const sendCursor = useCallback((cursor: CodeCursorDto) => {
		if (!session) return;
		const hasSelection = hasCodeSelection(cursor);

		if (hasSelection) {
			if (cursorTimerRef.current) {
				window.clearTimeout(cursorTimerRef.current);
				cursorTimerRef.current = null;
			}
			pendingCursorRef.current = null;
			dispatch(codeSessionActions.sendCodeCursorSync({
				sessionId: session.id,
				payload: cursor,
			}));
			return;
		}

		if (pendingCursorRef.current && hasCodeSelection(pendingCursorRef.current)) {
			return;
		}

		pendingCursorRef.current = cursor;
		if (cursorTimerRef.current) return;

		cursorTimerRef.current = window.setTimeout(() => {
			cursorTimerRef.current = null;
			if (!pendingCursorRef.current) return;
			dispatch(codeSessionActions.sendCodeCursorSync({
				sessionId: session.id,
				payload: pendingCursorRef.current,
			}));
			pendingCursorRef.current = null;
		}, CURSOR_SYNC_DELAY_MS);
	}, [dispatch, session]);

	const run = useCallback(() => {
		if (!session || !canEdit || isRunning) return;
		void dispatch(runCodeSession(session.id));
	}, [canEdit, dispatch, isRunning, session]);

	const grantEditor = useCallback((username: string) => {
		if (!session || !isCurrentUserHost) return;
		void dispatch(grantCodeSessionEditor({ sessionId: session.id, username }));
	}, [dispatch, isCurrentUserHost, session]);

	const revokeEditor = useCallback(() => {
		if (!session || !isCurrentUserHost) return;
		void dispatch(revokeCodeSessionEditor(session.id));
	}, [dispatch, isCurrentUserHost, session]);

	return {
		session,
		isLoading,
		error,
		code,
		stdin,
		language,
		result,
		isRunning,
		runError,
		role,
		canEdit,
		activeEditor,
		remoteCursors,
		participantOptions,
		canCreateSession: isCurrentUserHost && !session,
		createSession,
		changeCode,
		changeStdin,
		changeLanguage,
		sendCursor,
		run,
		grantEditor,
		revokeEditor,
	};
}

function hasCodeSelection(cursor: CodeCursorDto): boolean {
	return cursor.selectionStartLineNumber !== cursor.selectionEndLineNumber ||
		cursor.selectionStartColumn !== cursor.selectionEndColumn;
}

function normalizeUser(user: CodeSessionDto["activeEditor"]): CodeSessionUserDto | null {
	if (!user) return null;
	if (typeof user === "string") return { username: user };
	return user;
}

function getSessionRunResult(session: CodeSessionDto): CodeRunResultDto | null {
	if (session.lastRunResult) return session.lastRunResult;
	if (!session.lastStatus) return null;

	return {
		status: session.lastStatus,
		stdout: session.lastOutput ?? "",
		exitCode: session.lastExitCode ?? 0,
		executionTimeMs: session.lastExecutionTimeMs ?? 0,
	};
}
