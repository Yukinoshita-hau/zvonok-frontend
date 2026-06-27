import { useEffect, useMemo, useRef, useState } from "react";
import type { OnMount } from "@monaco-editor/react";
import type { editor } from "monaco-editor";
import { StringToColor } from "../../../utils/stringHelpers";
import type { RemoteCursorState } from "../../../store/slices/codeSession.slice";

type MonacoEditor = Parameters<OnMount>[0];
const CURSOR_VISIBLE_MS = 3200;
const CURSOR_LABEL_VISIBLE_MS = 1200;

export function useRemoteCursors(
	editorInstance: MonacoEditor | null,
	remoteCursors: Record<string, RemoteCursorState>
) {
	const decorationIdsRef = useRef<string[]>([]);
	const [now, setNow] = useState(() => Date.now());

	useEffect(() => {
		if (Object.keys(remoteCursors).length === 0) return;
		const intervalId = window.setInterval(() => setNow(Date.now()), 900);
		return () => window.clearInterval(intervalId);
	}, [remoteCursors]);

	const visibleCursors = useMemo(() => {
		return Object.fromEntries(
			Object.entries(remoteCursors)
				.filter(([, cursor]) => now - cursor.updatedAt <= CURSOR_VISIBLE_MS)
		);
	}, [now, remoteCursors]);

	useEffect(() => {
		if (!editorInstance) return;

		injectCursorStyles(visibleCursors, now);

		const decorations = Object.values(visibleCursors).flatMap((remoteCursor) => {
			const classSuffix = getCursorClassSuffix(remoteCursor.userId);
			const cursor = remoteCursor.cursor;
			const range = {
				startLineNumber: cursor.lineNumber,
				startColumn: cursor.column,
				endLineNumber: cursor.lineNumber,
				endColumn: cursor.column,
			};
			const selectionRange = getOrderedRange(cursor);

			const items: editor.IModelDeltaDecoration[] = [{
				range,
				options: {
					beforeContentClassName: `codeRemoteCursorLine codeRemoteCursorLine-${classSuffix}`,
					afterContentClassName: `codeRemoteCursorLabel codeRemoteCursorLabel-${classSuffix}`,
					stickiness: 1,
				},
			}];

			if (!isCollapsedSelection(cursor)) {
				items.push({
					range: selectionRange,
					options: {
						className: `codeRemoteSelection codeRemoteSelection-${classSuffix}`,
						inlineClassName: `codeRemoteSelection codeRemoteSelection-${classSuffix}`,
						inlineClassNameAffectsLetterSpacing: false,
						stickiness: 1,
					},
				});
			}

			return items;
		});

		decorationIdsRef.current = editorInstance.deltaDecorations(decorationIdsRef.current, decorations);

		return () => {
			decorationIdsRef.current = editorInstance.deltaDecorations(decorationIdsRef.current, []);
		};
	}, [editorInstance, now, visibleCursors]);
}

function injectCursorStyles(remoteCursors: Record<string, RemoteCursorState>, now: number) {
	const styleId = "code-session-remote-cursors";
	let style = document.getElementById(styleId) as HTMLStyleElement | null;
	if (!style) {
		style = document.createElement("style");
		style.id = styleId;
		document.head.appendChild(style);
	}

	style.textContent = Object.values(remoteCursors).map((cursor) => {
		const suffix = getCursorClassSuffix(cursor.userId);
		const color = StringToColor(cursor.username || cursor.userId);
		const label = cssEscapeContent(cursor.displayName || cursor.username || cursor.userId);
		const age = now - cursor.updatedAt;
		const cursorOpacity = Math.max(0.08, 1 - age / CURSOR_VISIBLE_MS);
		const labelOpacity = age <= CURSOR_LABEL_VISIBLE_MS ? 1 : 0;
		return `
.codeRemoteCursorLine-${suffix} { color: ${color}; border-left-color: ${color}; opacity: ${cursorOpacity.toFixed(2)}; }
.codeRemoteCursorLabel-${suffix}::after { content: "${label}"; background: ${color}; opacity: ${labelOpacity}; }
.codeRemoteSelection-${suffix} { background: ${colorWithAlpha(color, 0.3)} !important; background-color: ${colorWithAlpha(color, 0.3)} !important; outline: 1px solid ${colorWithAlpha(color, 0.38)}; }
`;
	}).join("\n");
}

function getCursorClassSuffix(value: string): string {
	return value.replace(/[^a-zA-Z0-9_-]/g, "_");
}

function cssEscapeContent(value: string): string {
	return value.replace(/\\/g, "\\\\").replace(/"/g, "\\\"");
}

function colorWithAlpha(color: string, alpha: number): string {
	if (color.startsWith("hsl(")) {
		return color.replace(/^hsl\((.*)\)$/u, `hsla($1, ${alpha})`);
	}

	if (color.startsWith("#")) {
		const normalized = color.replace("#", "");
		const red = Number.parseInt(normalized.slice(0, 2), 16);
		const green = Number.parseInt(normalized.slice(2, 4), 16);
		const blue = Number.parseInt(normalized.slice(4, 6), 16);
		if ([red, green, blue].every(Number.isFinite)) return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
	}

	return color;
}

function isCollapsedSelection(cursor: RemoteCursorState["cursor"]): boolean {
	return cursor.selectionStartLineNumber === cursor.selectionEndLineNumber &&
		cursor.selectionStartColumn === cursor.selectionEndColumn;
}

function getOrderedRange(cursor: RemoteCursorState["cursor"]) {
	const startsAfterEnd =
		cursor.selectionStartLineNumber > cursor.selectionEndLineNumber ||
		(
			cursor.selectionStartLineNumber === cursor.selectionEndLineNumber &&
			cursor.selectionStartColumn > cursor.selectionEndColumn
		);

	return startsAfterEnd
		? {
			startLineNumber: cursor.selectionEndLineNumber,
			startColumn: cursor.selectionEndColumn,
			endLineNumber: cursor.selectionStartLineNumber,
			endColumn: cursor.selectionStartColumn,
		}
		: {
			startLineNumber: cursor.selectionStartLineNumber,
			startColumn: cursor.selectionStartColumn,
			endLineNumber: cursor.selectionEndLineNumber,
			endColumn: cursor.selectionEndColumn,
		};
}
