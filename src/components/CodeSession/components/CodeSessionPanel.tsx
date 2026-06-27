import { useCallback, useEffect, useState, type KeyboardEvent } from "react";
import { CodeEditor, type CodeEditorSettings } from "./CodeEditor";
import { CodeEditorSettingsPanel } from "./CodeEditorSettingsPanel";
import { CodeOutputPanel } from "./CodeOutputPanel";
import { CodeParticipantsBar } from "./CodeParticipantsBar";
import { CodeStdinPanel } from "./CodeStdinPanel";
import { CodeTemplateMenu, type CodeTemplateOption } from "./CodeTemplateMenu";
import { CodeToolbar } from "./CodeToolbar";
import { codeRunApi } from "../../../api/codeRunApi";
import type { AvailableLanguageDto } from "../../../api/interfaces/codeRunTypes";
import type { CodeSessionStatus } from "./CodeStatusBadge";
import type { CanvasParticipantOption } from "../../CallCanvas/CallCanvas.types";
import { useCodeSessionRealtime } from "../hooks/useCodeSessionRealtime";
import styles from "../styles/CodeSessionPanel.module.css";

interface CodeSessionPanelProps {
	callSessionId: number;
	currentUserId?: number | string | null;
	currentUsername?: string | null;
	isCurrentUserHost: boolean;
	participantOptions: CanvasParticipantOption[];
	onClose: () => void;
}

const CODE_TEMPLATES: CodeTemplateOption[] = [
	{
		id: "java-stdin",
		language: "java",
		label: "Java stdin",
		description: "BufferedReader и вывод результата",
		code: `import java.io.BufferedReader;
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
	},
	{
		id: "java-array-sum",
		language: "java",
		label: "Java массив",
		description: "Сумма чисел из stdin",
		code: `import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.util.Arrays;

public class Main {
    public static void main(String[] args) throws Exception {
        BufferedReader reader = new BufferedReader(new InputStreamReader(System.in));
        int sum = Arrays.stream(reader.readLine().trim().split("\\\\s+"))
            .mapToInt(Integer::parseInt)
            .sum();

        System.out.println(sum);
    }
}`,
	},
	{
		id: "java-classic",
		language: "java",
		label: "Java classic",
		description: "Минимальный Main",
		code: `public class Main {
    public static void main(String[] args) {
        System.out.println("Hello from Zvonok");
    }
}`,
	},
	{
		id: "js-stdin",
		language: "javascript",
		label: "JS stdin",
		description: "Чтение stdin через fs",
		code: `const fs = require("fs");
const input = fs.readFileSync(0, "utf8").trim();

console.log("Hello from Zvonok");
if (input) {
  console.log("stdin:", input);
}`,
	},
	{
		id: "js-lines",
		language: "javascript",
		label: "JS строки",
		description: "Обработка построчного ввода",
		code: `const fs = require("fs");
const lines = fs.readFileSync(0, "utf8").trim().split(/\\r?\\n/);

for (const [index, line] of lines.entries()) {
  console.log(\`\${index + 1}: \${line}\`);
}`,
	},
	{
		id: "js-array-sum",
		language: "javascript",
		label: "JS массив",
		description: "Сумма чисел из stdin",
		code: `const fs = require("fs");
const numbers = fs.readFileSync(0, "utf8").trim().split(/\\s+/).map(Number);

console.log(numbers.reduce((sum, value) => sum + value, 0));`,
	},
];

const DEFAULT_EDITOR_SETTINGS: CodeEditorSettings = {
	fontSize: 14,
	tabSize: 4,
	wordWrap: true,
	minimap: false,
	lineNumbers: true,
	renderWhitespace: false,
	bracketPairs: true,
	smoothCursor: true,
	formatOnPaste: true,
	fontLigatures: false,
};

export function CodeSessionPanel({
	callSessionId,
	currentUserId,
	currentUsername,
	isCurrentUserHost,
	participantOptions,
	onClose,
}: CodeSessionPanelProps) {
	const realtime = useCodeSessionRealtime({
		callSessionId,
		currentUserId,
		currentUsername,
		isCurrentUserHost,
		participantOptions,
	});
	const [languages, setLanguages] = useState<AvailableLanguageDto[]>([]);
	const [isLoadingLanguages, setIsLoadingLanguages] = useState(false);
	const [languageError, setLanguageError] = useState<string | null>(null);
	const [editorSettings, setEditorSettings] = useState<CodeEditorSettings>(DEFAULT_EDITOR_SETTINGS);

	useEffect(() => {
		let isMounted = true;
		setIsLoadingLanguages(true);
		codeRunApi.getAvailableLanguages()
			.then((items) => {
				if (isMounted) setLanguages(items);
			})
			.catch((error: unknown) => {
				if (isMounted) setLanguageError(error instanceof Error ? error.message : "Не удалось загрузить языки");
			})
			.finally(() => {
				if (isMounted) setIsLoadingLanguages(false);
			});

		return () => {
			isMounted = false;
		};
	}, []);

	const sessionStatus = getSessionStatus(realtime.isRunning, realtime.runError, realtime.result?.status);
	const canRun = Boolean(realtime.session && realtime.canEdit && !realtime.isRunning);

	const runCode = useCallback(() => {
		if (!canRun) return;
		realtime.run();
	}, [canRun, realtime]);

	const resetTemplate = useCallback(() => {
		if (!realtime.session || !realtime.canEdit) return;
		realtime.changeCode(getDefaultTemplate(realtime.language));
	}, [realtime]);

	const handleKeyDown = useCallback((event: KeyboardEvent<HTMLDivElement>) => {
		if (!(event.ctrlKey || event.metaKey) || event.key !== "Enter") return;
		event.preventDefault();
		runCode();
	}, [runCode]);

	if (realtime.isLoading && !realtime.session) {
		return (
			<div className={styles.root}>
				<div className={styles.loadingState}>Загружаем Code Session...</div>
			</div>
		);
	}

	if (!realtime.session) {
		return (
			<div className={styles.root}>
				<div className={styles.emptySession}>
					<div className={styles.emptySessionTitle}>Code Session не создан</div>
					<div className={styles.emptySessionText}>
						{realtime.canCreateSession
							? "Создайте live-редактор, чтобы участники звонка видели код и результат запуска."
							: "Ждем, пока host создаст Code Session."}
					</div>
					{realtime.error && <div className={styles.emptySessionError}>{realtime.error}</div>}
					{realtime.canCreateSession && (
						<button type="button" className={styles.createSessionButton} onClick={realtime.createSession}>
							Создать Code Session
						</button>
					)}
					<button type="button" className={styles.secondaryButton} onClick={onClose}>
						Закрыть
					</button>
				</div>
			</div>
		);
	}

	return (
		<div className={styles.root} onKeyDown={handleKeyDown}>
			<CodeToolbar
				languages={languages}
				language={realtime.language}
				isLoadingLanguages={isLoadingLanguages}
				isRunning={realtime.isRunning}
				sessionStatus={sessionStatus}
				canEdit={realtime.canEdit}
				canRun={canRun}
				canResetTemplate={realtime.canEdit}
				onLanguageChange={realtime.changeLanguage}
				onRun={runCode}
				onResetTemplate={resetTemplate}
				onClose={onClose}
			/>
			{languageError && <div className={styles.languageError}>{languageError}</div>}
			<CodeTemplateMenu
				language={realtime.language}
				templates={CODE_TEMPLATES}
				disabled={!realtime.canEdit || realtime.isRunning}
				onApply={(template) => realtime.changeCode(template.code)}
			/>
			<CodeParticipantsBar
				role={realtime.role}
				activeEditor={realtime.activeEditor}
				participantOptions={realtime.participantOptions}
				canManageAccess={isCurrentUserHost}
				onGrantEditor={realtime.grantEditor}
				onRevokeEditor={realtime.revokeEditor}
			/>

			<div className={styles.body}>
				<div className={styles.editorShell}>
					<div className={styles.editorCardHeader}>
						<div className={styles.fileBadge}>
							<span className={styles.fileDot} />
							<strong>{getFileName(realtime.language)}</strong>
							<span>{realtime.language}</span>
						</div>
						<div className={styles.editorMeta}>
							<span>{realtime.canEdit ? "Редактирование" : "Только просмотр"}</span>
							<span>{realtime.code.split("\n").length} строк</span>
						</div>
					</div>
					<div className={styles.editorFrame}>
						<CodeEditor
							value={realtime.code}
							language={realtime.language}
							readOnly={!realtime.canEdit || realtime.isRunning}
							settings={editorSettings}
							onChange={realtime.changeCode}
							onRun={runCode}
							onCursorChange={realtime.sendCursor}
							remoteCursors={realtime.remoteCursors}
						/>
					</div>
					<CodeEditorSettingsPanel
						settings={editorSettings}
						onChange={setEditorSettings}
					/>
				</div>

				<div className={styles.sidePanel}>
					<CodeStdinPanel
						value={realtime.stdin}
						disabled={!realtime.canEdit || realtime.isRunning}
						onChange={realtime.changeStdin}
					/>
					<CodeOutputPanel
						result={realtime.result}
						error={realtime.runError}
						isRunning={realtime.isRunning}
					/>
				</div>
			</div>
		</div>
	);
}

function getSessionStatus(isRunning: boolean, error: string | null, resultStatus?: string): CodeSessionStatus {
	if (isRunning) return "running";
	if (error) return "failed";
	if (resultStatus === "SUCCESS") return "success";
	if (resultStatus) return "failed";
	return "ready";
}

function getFileName(language: string): string {
	if (language === "java") return "Main.java";
	if (language === "javascript") return "main.js";
	return `main.${language}`;
}

function getDefaultTemplate(language: string): string {
	return CODE_TEMPLATES.find((template) => template.language === language)?.code ?? "";
}
