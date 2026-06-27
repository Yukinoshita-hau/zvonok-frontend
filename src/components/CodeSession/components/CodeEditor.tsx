import Editor from "@monaco-editor/react";
import type { OnMount } from "@monaco-editor/react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { CodeCursorDto } from "../../../api/interfaces/codeSessionTypes";
import { useRemoteCursors } from "../hooks/useRemoteCursors";
import type { RemoteCursorState } from "../../../store/slices/codeSession.slice";

export interface CodeEditorSettings {
	fontSize: number;
	tabSize: number;
	wordWrap: boolean;
	minimap: boolean;
	lineNumbers: boolean;
	renderWhitespace: boolean;
	bracketPairs: boolean;
	smoothCursor: boolean;
	formatOnPaste: boolean;
	fontLigatures: boolean;
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
		const notifyCursor = () => {
			const position = editor.getPosition();
			const selection = editor.getSelection();
			if (!position || !selection) return;
			onCursorChangeRef.current?.({
				lineNumber: position.lineNumber,
				column: position.column,
				selectionStartLineNumber: selection.startLineNumber,
				selectionStartColumn: selection.startColumn,
				selectionEndLineNumber: selection.endLineNumber,
				selectionEndColumn: selection.endColumn,
			});
		};

		const cursorDisposable = editor.onDidChangeCursorPosition(notifyCursor);
		const selectionDisposable = editor.onDidChangeCursorSelection(notifyCursor);
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
				fontLigatures: settings.fontLigatures,
				formatOnPaste: settings.formatOnPaste,
				minimap: { enabled: settings.minimap },
				lineNumbers: settings.lineNumbers ? "on" : "off",
				overviewRulerBorder: false,
				overviewRulerLanes: 0,
				bracketPairColorization: { enabled: settings.bracketPairs },
				cursorBlinking: settings.smoothCursor ? "smooth" : "blink",
				cursorSmoothCaretAnimation: settings.smoothCursor ? "on" : "off",
				parameterHints: { enabled: false },
				quickSuggestions: false,
				renderWhitespace: settings.renderWhitespace ? "selection" : "none",
				readOnly,
				scrollBeyondLastLine: false,
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
