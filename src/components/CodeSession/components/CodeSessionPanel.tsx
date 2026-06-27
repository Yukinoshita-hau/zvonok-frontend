import { Check, ChevronDown, Maximize2, Minimize2, Play, RotateCcw } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type CSSProperties, type FocusEvent, type KeyboardEvent } from "react";
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

type ResultTab = "console" | "stdin";
type SidebarTab = "tools" | "console" | "editor";

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
	fontFamily: "default",
	wordWrap: true,
	minimap: false,
	lineNumbers: true,
	renderWhitespace: false,
	bracketPairs: true,
	indentGuides: true,
	folding: true,
	selectionHighlight: true,
	renderLineHighlight: true,
	smoothScrolling: true,
	quickSuggestions: false,
	smoothCursor: true,
	formatOnPaste: true,
	fontLigatures: false,
	cursorStyle: "line",
	cursorWidth: 2,
	accentColor: "#38bdf8",
	terminalAccent: "#22c55e",
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
	const [resultTab, setResultTab] = useState<ResultTab>("console");
	const [sidebarTab, setSidebarTab] = useState<SidebarTab>("tools");
	const [isLanguageMenuOpen, setIsLanguageMenuOpen] = useState(false);
	const [sidebarWidth, setSidebarWidth] = useState(360);
	const [isResizingSidebar, setIsResizingSidebar] = useState(false);
	const [isEditorExpanded, setIsEditorExpanded] = useState(false);
	const mainLayoutRef = useRef<HTMLDivElement | null>(null);

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

	useEffect(() => {
		if (!isResizingSidebar) return;

		const handleMouseMove = (event: MouseEvent) => {
			const rect = mainLayoutRef.current?.getBoundingClientRect();
			if (!rect) return;

			const maxWidth = Math.min(620, rect.width * 0.52);
			const nextWidth = Math.min(Math.max(event.clientX - rect.left, 230), maxWidth);
			setSidebarWidth(nextWidth);
		};
		const stopResize = () => setIsResizingSidebar(false);

		document.body.style.cursor = "col-resize";
		document.body.style.userSelect = "none";
		window.addEventListener("mousemove", handleMouseMove);
		window.addEventListener("mouseup", stopResize);

		return () => {
			document.body.style.cursor = "";
			document.body.style.userSelect = "";
			window.removeEventListener("mousemove", handleMouseMove);
			window.removeEventListener("mouseup", stopResize);
		};
	}, [isResizingSidebar]);

	const sessionStatus = getSessionStatus(realtime.isRunning, realtime.runError, realtime.result?.status);
	const canRun = Boolean(realtime.session && realtime.canEdit && !realtime.isRunning);
	const canChangeEditorState = realtime.canEdit && !realtime.isRunning;
	const languageLabel = getLanguageLabel(languages, realtime.language);

	const runCode = useCallback(() => {
		if (!canRun) return;
		setSidebarTab("console");
		setResultTab("console");
		realtime.run();
	}, [canRun, realtime]);

	const resetTemplate = useCallback(() => {
		if (!realtime.session || !canChangeEditorState) return;
		realtime.changeCode(getDefaultTemplate(realtime.language));
	}, [canChangeEditorState, realtime]);

	const handleLanguageSelect = useCallback((language: string) => {
		if (!canChangeEditorState || language === realtime.language) {
			setIsLanguageMenuOpen(false);
			return;
		}

		realtime.changeLanguage(language);
		setIsLanguageMenuOpen(false);
	}, [canChangeEditorState, realtime]);

	const handleLanguageMenuBlur = useCallback((event: FocusEvent<HTMLDivElement>) => {
		if (event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget)) return;
		setIsLanguageMenuOpen(false);
	}, []);

	const handleKeyDown = useCallback((event: KeyboardEvent<HTMLDivElement>) => {
		if (!(event.ctrlKey || event.metaKey) || event.key !== "Enter") return;
		event.preventDefault();
		runCode();
	}, [runCode]);
	const rootStyle = {
		"--code-accent-color": editorSettings.accentColor,
		"--code-terminal-accent": editorSettings.terminalAccent,
	} as CSSProperties;

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
		<div className={styles.root} style={rootStyle} onKeyDown={handleKeyDown}>
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

			<div
				ref={mainLayoutRef}
				className={styles.mainLayout}
				data-editor-expanded={isEditorExpanded ? "true" : undefined}
				style={{ "--code-sidebar-width": `${sidebarWidth}px` } as CSSProperties}
			>
				<aside className={styles.sidebar} aria-label="Панель Code Session">
					<nav className={styles.sidebarTabs} aria-label="Разделы Code Session">
						<button
							type="button"
							className={styles.sidebarTab}
							data-active={sidebarTab === "tools" ? "true" : undefined}
							onClick={() => setSidebarTab("tools")}
						>
							Инструменты
						</button>
						<button
							type="button"
							className={styles.sidebarTab}
							data-active={sidebarTab === "console" ? "true" : undefined}
							onClick={() => setSidebarTab("console")}
						>
							Консоль
						</button>
						<button
							type="button"
							className={styles.sidebarTab}
							data-active={sidebarTab === "editor" ? "true" : undefined}
							onClick={() => setSidebarTab("editor")}
						>
							Редактор
						</button>
					</nav>

					<div className={styles.sidebarPanelBody}>
						{sidebarTab === "tools" && (
							<>
								<section className={styles.sidebarSection}>
									<div className={styles.sidebarTitle}>Доступ</div>
									<CodeParticipantsBar
										role={realtime.role}
										activeEditor={realtime.activeEditor}
										participantOptions={realtime.participantOptions}
										canManageAccess={isCurrentUserHost}
										onGrantEditor={realtime.grantEditor}
										onRevokeEditor={realtime.revokeEditor}
									/>
								</section>

								<section className={styles.sidebarSection}>
									<CodeTemplateMenu
										language={realtime.language}
										templates={CODE_TEMPLATES}
										disabled={!canChangeEditorState}
										onApply={(template) => realtime.changeCode(template.code)}
									/>
								</section>

								<section className={styles.sidebarSection}>
									<div className={styles.sidebarTitle}>Мои шаблоны</div>
									<div className={styles.sidebarHint}>
										Здесь можно будет закреплять свои заготовки. Сейчас доступны быстрые шаблоны выше.
									</div>
								</section>
							</>
						)}

						{sidebarTab === "console" && (
							<section className={styles.resultShell}>
								<div className={styles.resultTabs}>
									<button
										type="button"
										className={styles.resultTab}
										data-active={resultTab === "console" ? "true" : undefined}
										onClick={() => setResultTab("console")}
									>
										Терминал
									</button>
									<button
										type="button"
										className={styles.resultTab}
										data-active={resultTab === "stdin" ? "true" : undefined}
										onClick={() => setResultTab("stdin")}
									>
										STDIN
									</button>
								</div>
								<div className={styles.resultContent}>
									{resultTab === "console" ? (
										<CodeOutputPanel
											result={realtime.result}
											error={realtime.runError}
											isRunning={realtime.isRunning}
										/>
									) : (
										<CodeStdinPanel
											value={realtime.stdin}
											disabled={!canChangeEditorState}
											onChange={realtime.changeStdin}
										/>
									)}
								</div>
							</section>
						)}

						{sidebarTab === "editor" && (
							<section className={styles.sidebarSection}>
								<div className={styles.sidebarTitle}>Редактор</div>
								<CodeEditorSettingsPanel
									settings={editorSettings}
									onChange={setEditorSettings}
								/>
							</section>
						)}
					</div>
				</aside>

				<button
					type="button"
					className={styles.splitResizeHandle}
					onMouseDown={() => {
						setIsEditorExpanded(false);
						setIsResizingSidebar(true);
					}}
					aria-label="Изменить ширину панели"
					title="Потянуть, чтобы изменить ширину панели"
				/>

				<div className={styles.workspace}>
					<div className={styles.editorShell}>
						<div className={styles.editorCardHeader}>
							<div className={styles.fileBadge}>
								<span className={styles.fileDot} />
								<span className={styles.fileBadgeText}>{getFileName(realtime.language)}</span>
							</div>

							<div className={styles.editorHeaderControls}>
								<div
									className={styles.inlineLanguageMenu}
									onBlur={handleLanguageMenuBlur}
								>
									<button
										type="button"
										className={styles.inlineLanguageButton}
										onClick={() => setIsLanguageMenuOpen((isOpen) => !isOpen)}
										disabled={!canChangeEditorState || isLoadingLanguages}
										aria-haspopup="listbox"
										aria-expanded={isLanguageMenuOpen}
									>
										<span>{languageLabel}</span>
										<ChevronDown size={14} />
									</button>

									{isLanguageMenuOpen && (
										<div className={styles.languageMenuPopup} role="listbox">
											{languages.map((item) => (
												<button
													key={item.language}
													type="button"
													className={styles.languageMenuItem}
													onClick={() => handleLanguageSelect(item.language)}
													role="option"
													aria-selected={item.language === realtime.language}
												>
													{item.language === realtime.language && <Check size={14} />}
													<span>{item.displayName}</span>
												</button>
											))}
											{languages.length === 0 && (
												<button type="button" className={styles.languageMenuItem} disabled>
													<span>{isLoadingLanguages ? "Загрузка..." : realtime.language}</span>
												</button>
											)}
										</div>
									)}
								</div>

								<button
									type="button"
									className={styles.editorIconButton}
									onClick={resetTemplate}
									disabled={!canChangeEditorState}
									title="Сбросить код на шаблон"
									aria-label="Сбросить код на шаблон"
								>
									<RotateCcw size={15} />
								</button>
								<button
									type="button"
									className={styles.editorIconButton}
									onClick={() => setIsEditorExpanded((expanded) => !expanded)}
									title={isEditorExpanded ? "Показать левую панель" : "Развернуть редактор"}
									aria-label={isEditorExpanded ? "Показать левую панель" : "Развернуть редактор"}
								>
									{isEditorExpanded ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
								</button>
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

						<div className={styles.editorRunBar}>
							<div className={styles.editorRunMeta}>
								<span>{realtime.code.split("\n").length} строк</span>
								<span>{realtime.canEdit ? "Можно редактировать" : "Только просмотр"}</span>
							</div>
							<button
								type="button"
								className={styles.editorRunButton}
								onClick={runCode}
								disabled={!canRun}
								title="Запустить код"
							>
								{realtime.isRunning ? <span className={styles.spinner} /> : <Play size={15} />}
								<span>{realtime.isRunning ? "Выполняется..." : "Run"}</span>
							</button>
						</div>
					</div>
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

function getLanguageLabel(languages: AvailableLanguageDto[], language: string): string {
	return languages.find((item) => item.language === language)?.displayName ?? language;
}
