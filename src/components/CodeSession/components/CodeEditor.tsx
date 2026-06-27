import Editor from "@monaco-editor/react";
import type { OnMount } from "@monaco-editor/react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { CodeCursorDto } from "../../../api/interfaces/codeSessionTypes";
import { useRemoteCursors } from "../hooks/useRemoteCursors";
import type { RemoteCursorState } from "../../../store/slices/codeSession.slice";

export interface CodeEditorSettings {
	fontSize: number;
	tabSize: number;
	fontFamily: "default" | "mono" | "system";
	wordWrap: boolean;
	minimap: boolean;
	lineNumbers: boolean;
	renderWhitespace: boolean;
	bracketPairs: boolean;
	indentGuides: boolean;
	folding: boolean;
	selectionHighlight: boolean;
	renderLineHighlight: boolean;
	smoothScrolling: boolean;
	quickSuggestions: boolean;
	smoothCursor: boolean;
	formatOnPaste: boolean;
	fontLigatures: boolean;
	cursorStyle: "line" | "block" | "underline";
	cursorWidth: number;
	accentColor: string;
	terminalAccent: string;
}

interface CodeEditorProps {
	value: string;
	language: string;
	readOnly?: boolean;
	settings: CodeEditorSettings;
	onChange: (value: string) => void;
	onRun?: () => void;
	onCursorChange?: (cursor: CodeCursorDto) => void;
	remoteCursors?: Record<string, RemoteCursorState>;
}

export function CodeEditor({
	value,
	language,
	readOnly = false,
	settings,
	onChange,
	onRun,
	onCursorChange,
	remoteCursors = {},
}: CodeEditorProps) {
	const [editorInstance, setEditorInstance] = useState<Parameters<OnMount>[0] | null>(null);
	const onRunRef = useRef(onRun);
	const onCursorChangeRef = useRef(onCursorChange);

	useEffect(() => {
		onRunRef.current = onRun;
	}, [onRun]);

	useEffect(() => {
		onCursorChangeRef.current = onCursorChange;
	}, [onCursorChange]);

	useRemoteCursors(editorInstance, remoteCursors);

	const handleMount = useCallback<OnMount>((editor, monaco) => {
		setEditorInstance(editor);

		editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => onRunRef.current?.());
		const notifyCursor = (selectionOverride?: {
			startLineNumber: number;
			startColumn: number;
			endLineNumber: number;
			endColumn: number;
			positionLineNumber?: number;
			positionColumn?: number;
		}) => {
			const position = editor.getPosition();
			const selection = selectionOverride ?? editor.getSelection();
			if (!position || !selection) return;
			const cursor = {
				lineNumber: selectionOverride?.positionLineNumber ?? position.lineNumber,
				column: selectionOverride?.positionColumn ?? position.column,
				selectionStartLineNumber: selection.startLineNumber,
				selectionStartColumn: selection.startColumn,
				selectionEndLineNumber: selection.endLineNumber,
				selectionEndColumn: selection.endColumn,
			};
			onCursorChangeRef.current?.(cursor);
		};

		const cursorDisposable = editor.onDidChangeCursorPosition((event) => {
			if (isProgrammaticCursorChange(event.reason, monaco.editor.CursorChangeReason)) {
				return;
			}
			notifyCursor();
		});
		const selectionDisposable = editor.onDidChangeCursorSelection((event) => {
			if (isProgrammaticCursorChange(event.reason, monaco.editor.CursorChangeReason)) {
				return;
			}
			notifyCursor(event.selection);
		});
		editor.onDidDispose(() => {
			cursorDisposable.dispose();
			selectionDisposable.dispose();
		});
	}, []);

	return (
		<Editor
			value={value}
			language={toMonacoLanguage(language)}
			theme="vs-dark"
			onChange={(nextValue) => onChange(nextValue ?? "")}
			onMount={handleMount}
			options={{
				automaticLayout: true,
				hideCursorInOverviewRuler: true,
				fontSize: settings.fontSize,
				fontFamily: getEditorFontFamily(settings.fontFamily),
				fontLigatures: settings.fontLigatures,
				formatOnPaste: settings.formatOnPaste,
				minimap: { enabled: settings.minimap },
				lineNumbers: settings.lineNumbers ? "on" : "off",
				overviewRulerBorder: false,
				overviewRulerLanes: 0,
				bracketPairColorization: { enabled: settings.bracketPairs },
				cursorStyle: settings.cursorStyle,
				cursorWidth: settings.cursorWidth,
				cursorBlinking: settings.smoothCursor ? "smooth" : "blink",
				cursorSmoothCaretAnimation: settings.smoothCursor ? "on" : "off",
				folding: settings.folding,
				guides: {
					indentation: settings.indentGuides,
					bracketPairs: settings.bracketPairs,
				},
				parameterHints: { enabled: false },
				quickSuggestions: settings.quickSuggestions,
				renderLineHighlight: settings.renderLineHighlight ? "line" : "none",
				renderWhitespace: settings.renderWhitespace ? "selection" : "none",
				readOnly,
				scrollBeyondLastLine: false,
				selectionHighlight: settings.selectionHighlight,
				smoothScrolling: settings.smoothScrolling,
				suggestOnTriggerCharacters: false,
				tabSize: settings.tabSize,
				wordBasedSuggestions: "off",
				wordWrap: settings.wordWrap ? "on" : "off",
			}}
		/>
	);
}

function toMonacoLanguage(language: string): string {
	if (language === "javascript") return "javascript";
	if (language === "java") return "java";
	return language;
}

function getEditorFontFamily(fontFamily: CodeEditorSettings["fontFamily"]): string | undefined {
	if (fontFamily === "mono") return "Consolas, 'SFMono-Regular', 'Courier New', monospace";
	if (fontFamily === "system") return "ui-monospace, Menlo, Monaco, Consolas, monospace";
	return undefined;
}

function isProgrammaticCursorChange(
	reason: number,
	cursorChangeReason: { ContentFlush: number; RecoverFromMarkers: number }
): boolean {
	return reason === cursorChangeReason.ContentFlush ||
		reason === cursorChangeReason.RecoverFromMarkers;
}
