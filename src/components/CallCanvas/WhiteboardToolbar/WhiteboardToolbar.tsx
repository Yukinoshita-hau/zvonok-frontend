import { useRef, useState } from "react";
import {
	ChevronDown,
	ChevronUp,
	Eraser,
	Eye,
	EyeOff,
	Grid3X3,
	Image,
	Lock,
	MoreHorizontal,
	Pencil,
	Presentation,
	Radio,
	RotateCcw,
	ShieldCheck,
	Smile,
	Sparkles,
	StickyNote,
	Timer,
	Trash2,
	Undo2,
	UserRound,
	Users,
	X,
} from "lucide-react";
import styles from "./WhiteboardToolbar.module.css";
import type {
	CanvasDrawingAccess,
	CanvasInteractionTool,
	CanvasReactionType,
	CanvasTemplateType,
	CanvasTimerStatus,
} from "../../../api/interfaces/CanvasDtos";
import type { CanvasParticipantOption } from "../CallCanvas.types";

type CanvasBackgroundMode = "grid" | "dots" | "clean";

interface WhiteboardToolbarProps {
	color: string;
	width: number;
	tool: CanvasInteractionTool;
	reaction: CanvasReactionType;
	variant?: "whiteboard" | "overlay";
	userColor: string;
	canDraw: boolean;
	canManage: boolean;
	canClose?: boolean;
	isBusy?: boolean;
	readOnlyReason: string | null;
	drawingAccess: CanvasDrawingAccess;
	selectedDrawerUsername: string | null;
	participantOptions: CanvasParticipantOption[];
	templateType: CanvasTemplateType;
	timerStatus: CanvasTimerStatus;
	isPresenterModeEnabled: boolean;
	presenterUsername: string | null;
	currentUsername: string;
	backgroundMode: CanvasBackgroundMode;
	isOverlayHidden: boolean;
	overlayOpacity: number;
	onColorChange: (color: string) => void;
	onWidthChange: (width: number) => void;
	onToolChange: (tool: CanvasInteractionTool) => void;
	onReactionChange: (reaction: CanvasReactionType) => void;
	onUndo: () => void;
	onClear: () => void;
	onClose?: () => void;
	onExit: () => void;
	onPermissionChange: (drawingAccess: CanvasDrawingAccess, selectedDrawerUsername: string | null) => void;
	onTemplateChange: (templateType: CanvasTemplateType) => void;
	onCaptureBackground: () => void;
	onPresenterChange: (enabled: boolean, presenterUsername: string | null) => void;
	onStartTimer: (durationSeconds: number) => void;
	onStopTimer: () => void;
	onResetTimer: () => void;
	onBackgroundModeChange: (mode: CanvasBackgroundMode) => void;
	onToggleOverlayHidden: () => void;
	onOverlayOpacityChange: (opacity: number) => void;
}

const BASE_COLORS = ["#111827", "#f8fafc", "#ef4444", "#f97316", "#22c55e", "#38bdf8", "#a855f7"];

const TEMPLATES: Array<{ type: CanvasTemplateType; label: string }> = [
	{ type: "CLEAN", label: "Чисто" },
	{ type: "DOTS", label: "Точки" },
	{ type: "GRID", label: "Сетка" },
	{ type: "KANBAN", label: "Канбан" },
	{ type: "BUG_TRIAGE", label: "Разбор багов" },
	{ type: "ARCHITECTURE", label: "Архитектура" },
	{ type: "RETROSPECTIVE", label: "Ретро" },
	{ type: "BRAINSTORM", label: "Идеи" },
];

const REACTIONS: Array<{ type: CanvasReactionType; label: string; emoji: string }> = [
	{ type: "THUMBS_UP", label: "Нравится", emoji: "👍" },
	{ type: "FIRE", label: "Огонь", emoji: "🔥" },
	{ type: "QUESTION", label: "Вопрос", emoji: "❓" },
	{ type: "CHECK", label: "Готово", emoji: "✅" },
	{ type: "EYES", label: "Смотрю", emoji: "👀" },
];

export function WhiteboardToolbar({
	color,
	width,
	tool,
	reaction,
	variant = "whiteboard",
	userColor,
	canDraw,
	canManage,
	canClose = false,
	isBusy = false,
	readOnlyReason,
	drawingAccess,
	selectedDrawerUsername,
	participantOptions,
	templateType,
	timerStatus,
	isPresenterModeEnabled,
	presenterUsername,
	currentUsername,
	backgroundMode,
	isOverlayHidden,
	overlayOpacity,
	onColorChange,
	onWidthChange,
	onToolChange,
	onReactionChange,
	onUndo,
	onClear,
	onClose,
	onExit,
	onPermissionChange,
	onTemplateChange,
	onCaptureBackground,
	onPresenterChange,
	onStartTimer,
	onStopTimer,
	onResetTimer,
	onBackgroundModeChange,
	onToggleOverlayHidden,
	onOverlayOpacityChange,
}: WhiteboardToolbarProps) {
	const permissionsRef = useRef<HTMLDetailsElement>(null);
	const moreRef = useRef<HTMLDetailsElement>(null);
	const [isCollapsed, setIsCollapsed] = useState(false);
	const colors = [userColor, ...BASE_COLORS.filter((item) => item !== userColor)];
	const isOverlay = variant === "overlay";
	const toolsDisabled = isBusy || !canDraw;
	const accessTitle = getAccessTitle(drawingAccess, selectedDrawerUsername);
	const collapsedAccessText = getCollapsedAccessText(drawingAccess, selectedDrawerUsername);
	const readonlyTitle = readOnlyReason ?? accessTitle;
	const showInlineDrawingControls = !isOverlay;

	const applyPermission = (nextAccess: CanvasDrawingAccess, nextUsername: string | null) => {
		permissionsRef.current?.removeAttribute("open");
		moreRef.current?.removeAttribute("open");
		onPermissionChange(nextAccess, nextUsername);
	};

	const closeMore = () => moreRef.current?.removeAttribute("open");

	if (isCollapsed) {
		return (
			<button
				type="button"
				className={`${styles.collapsedToolbar} ${isOverlay ? styles.overlayCollapsedToolbar : ""}`}
				onClick={() => setIsCollapsed(false)}
				title="Показать панель рисования"
				aria-label="Показать панель рисования"
			>
				<span className={styles.collapsedColor} style={{ backgroundColor: color }} />
				{getToolIcon(tool, 17)}
				<span className={styles.collapsedText}>{getToolLabel(tool)}</span>
				<span className={styles.collapsedAccess}>{collapsedAccessText}</span>
				<ChevronDown size={15} />
			</button>
		);
	}

	return (
		<div className={`${styles.toolbar} ${isOverlay ? styles.overlayToolbar : ""}`}>
			<button
				type="button"
				className={styles.collapseButton}
				onClick={() => setIsCollapsed(true)}
				title="Скрыть инструменты"
				aria-label="Скрыть инструменты"
			>
				<ChevronUp size={16} />
			</button>

			<div className={styles.dragHandle} aria-hidden="true" />

			<div className={styles.group}>
				<ToolButton tool="PEN" activeTool={tool} disabled={toolsDisabled} title={canDraw ? "Карандаш" : readonlyTitle} onToolChange={onToolChange} />
				<ToolButton tool="ERASER" activeTool={tool} disabled={toolsDisabled} title={canDraw ? "Ластик" : readonlyTitle} onToolChange={onToolChange} />
				<ToolButton tool="LASER" activeTool={tool} disabled={toolsDisabled} title={canDraw ? "Лазерная указка" : readonlyTitle} onToolChange={onToolChange} />
				<ToolButton tool="STICKY" activeTool={tool} disabled={toolsDisabled} title={canDraw ? "Стикер" : readonlyTitle} onToolChange={onToolChange} />
				<ToolButton tool="REACTION" activeTool={tool} disabled={toolsDisabled} title={canDraw ? "Реакция" : readonlyTitle} onToolChange={onToolChange} />
			</div>

			{showInlineDrawingControls && (
				<>
					<ColorPicker colors={colors} color={color} disabled={toolsDisabled} onColorChange={onColorChange} />

					<label className={styles.sliderLabel}>
						<span>{width}px</span>
						<input
							type="range"
							min={2}
							max={14}
							value={width}
							disabled={toolsDisabled}
							onChange={(event) => onWidthChange(Number(event.target.value))}
							aria-label="Толщина линии"
						/>
					</label>
				</>
			)}

			{showInlineDrawingControls && (
				<div className={styles.segmented} aria-label="Локальный фон">
					<button
						type="button"
						className={backgroundMode === "dots" ? styles.segmentActive : styles.segment}
						onClick={() => onBackgroundModeChange("dots")}
						title="Точки"
						aria-label="Фон точками"
					>
						<Sparkles size={15} />
					</button>
					<button
						type="button"
						className={backgroundMode === "grid" ? styles.segmentActive : styles.segment}
						onClick={() => onBackgroundModeChange("grid")}
						title="Сетка"
						aria-label="Фон сеткой"
					>
						<Grid3X3 size={15} />
					</button>
					<button
						type="button"
						className={backgroundMode === "clean" ? styles.segmentActive : styles.segment}
						onClick={() => onBackgroundModeChange("clean")}
						title="Чистый фон"
						aria-label="Чистый фон"
					>
						<span className={styles.cleanDot} />
					</button>
				</div>
			)}

			{showInlineDrawingControls && tool === "REACTION" && (
				<div className={styles.reactionGroup} aria-label="Реакция">
					{REACTIONS.map((item) => (
						<button
							key={item.type}
							type="button"
							className={reaction === item.type ? styles.reactionActive : styles.reactionButton}
							onClick={() => onReactionChange(item.type)}
							title={item.label}
							aria-label={item.label}
						>
							{item.emoji}
						</button>
					))}
				</div>
			)}

			{isOverlay && (
				<div className={styles.overlayControls}>
					<button
						type="button"
						className={isOverlayHidden ? styles.activeButton : styles.button}
						onClick={onToggleOverlayHidden}
						title={isOverlayHidden ? "Показать разметку локально" : "Скрыть разметку локально"}
						aria-label={isOverlayHidden ? "Показать разметку локально" : "Скрыть разметку локально"}
					>
						{isOverlayHidden ? <EyeOff size={17} /> : <Eye size={17} />}
					</button>
				</div>
			)}

			{showInlineDrawingControls && (
				<div className={styles.statusGroup}>
					<span className={canDraw ? styles.accessBadge : styles.readOnlyBadge} title={readonlyTitle}>
						{canDraw ? <ShieldCheck size={14} /> : <Lock size={14} />}
						{canDraw ? accessTitle : readonlyTitle}
					</span>
				</div>
			)}

			<div className={styles.group}>
				<button
					type="button"
					className={styles.button}
					onClick={onUndo}
					disabled={isBusy}
					title="Отменить мой последний штрих"
					aria-label="Отменить мой последний штрих"
				>
					<Undo2 size={17} />
				</button>
			</div>

			<details ref={moreRef} className={styles.moreMenu}>
				<summary className={styles.moreTrigger} title="Ещё" aria-label="Ещё">
					<MoreHorizontal size={17} />
				</summary>
				<div className={styles.morePanel}>
					{isOverlay && (
						<div className={styles.moreSection}>
							<div className={styles.moreTitle}><Pencil size={14} /> Кисть</div>
							<ColorPicker colors={colors} color={color} disabled={toolsDisabled} onColorChange={onColorChange} variant="menu" />
							<label className={styles.menuSlider}>
								<span>{width}px</span>
								<input
									type="range"
									min={2}
									max={14}
									value={width}
									disabled={toolsDisabled}
									onChange={(event) => onWidthChange(Number(event.target.value))}
									aria-label="Толщина линии"
								/>
							</label>
							<div className={styles.inlineStatus}>
								{canDraw ? <ShieldCheck size={14} /> : <Lock size={14} />}
								<span>{canDraw ? accessTitle : readonlyTitle}</span>
							</div>
						</div>
					)}

					{isOverlay && (
						<div className={styles.moreSection}>
							<div className={styles.moreTitle}><Eye size={14} /> Разметка</div>
							<label className={styles.menuSlider}>
								<span>{Math.round(overlayOpacity * 100)}%</span>
								<input
									type="range"
									min={0.2}
									max={1}
									step={0.05}
									value={overlayOpacity}
									onChange={(event) => onOverlayOpacityChange(Number(event.target.value))}
									aria-label="Прозрачность разметки"
								/>
							</label>
						</div>
					)}

					<div className={styles.moreSection}>
						<div className={styles.moreTitle}><Smile size={14} /> Реакция</div>
						<div className={styles.reactionGrid}>
							{REACTIONS.map((item) => (
								<button
									key={item.type}
									type="button"
									className={reaction === item.type ? styles.permissionActive : styles.permissionItem}
									onClick={() => {
										onReactionChange(item.type);
										onToolChange("REACTION");
										closeMore();
									}}
								>
									<span>{item.emoji}</span>
									<span>{item.label}</span>
								</button>
							))}
						</div>
					</div>

					{canManage && !isOverlay && (
						<>
							<div className={styles.moreSection}>
								<div className={styles.moreTitle}><Timer size={14} /> Таймер: {getTimerStatusLabel(timerStatus)}</div>
								<div className={styles.timerGrid}>
									<button type="button" onClick={() => onStartTimer(60)}>1м</button>
									<button type="button" onClick={() => onStartTimer(180)}>3м</button>
									<button type="button" onClick={() => onStartTimer(300)}>5м</button>
									<button type="button" onClick={onStopTimer}>Стоп</button>
									<button type="button" onClick={onResetTimer}>Сброс</button>
								</div>
							</div>

							<div className={styles.moreSection}>
								<div className={styles.moreTitle}><Sparkles size={14} /> Доска</div>
								<div className={styles.templateGrid}>
									{TEMPLATES.map((item) => (
										<button
											key={item.type}
											type="button"
											className={templateType === item.type ? styles.permissionActive : styles.permissionItem}
											onClick={() => {
												onTemplateChange(item.type);
												closeMore();
											}}
										>
											<span>{item.label}</span>
										</button>
									))}
								</div>
								<button
									type="button"
									className={styles.permissionItem}
									onClick={() => {
										onCaptureBackground();
										closeMore();
									}}
								>
									<Image size={15} />
									<span>Снимок экрана в доску</span>
								</button>
							</div>
						</>
					)}

					{canManage && (
						<div className={styles.moreSection}>
							<div className={styles.moreTitle}><Presentation size={14} /> Доступ</div>
							<div className={styles.presenterActions}>
								<button
									type="button"
									className={isPresenterModeEnabled ? styles.permissionActive : styles.permissionItem}
									onClick={() => {
										onPresenterChange(true, currentUsername);
										closeMore();
									}}
								>
									Стать ведущим
								</button>
								<button
									type="button"
									className={!isPresenterModeEnabled ? styles.permissionActive : styles.permissionItem}
									onClick={() => {
										onPresenterChange(false, null);
										closeMore();
									}}
								>
									Отключить режим
								</button>
							</div>
							<details ref={permissionsRef} className={styles.permissionsMenu}>
								<summary className={styles.permissionsTrigger} title="Права рисования" aria-label="Права рисования">
									<Users size={15} />
									<span>Права рисования</span>
									<ChevronDown size={14} />
								</summary>
								<div className={styles.permissionsPanel}>
									<button type="button" className={drawingAccess === "EVERYONE" ? styles.permissionActive : styles.permissionItem} onClick={() => applyPermission("EVERYONE", null)}>
										<Users size={15} /><span>Все</span>
									</button>
									<button type="button" className={drawingAccess === "HOSTS_ONLY" ? styles.permissionActive : styles.permissionItem} onClick={() => applyPermission("HOSTS_ONLY", null)}>
										<ShieldCheck size={15} /><span>Орги</span>
									</button>
									<button type="button" className={drawingAccess === "VIEW_ONLY" ? styles.permissionActive : styles.permissionItem} onClick={() => applyPermission("VIEW_ONLY", null)}>
										<Lock size={15} /><span>Просмотр</span>
									</button>
									<div className={styles.permissionDivider} />
									<div className={styles.permissionLabel}>Маркер</div>
									<div className={styles.participantList}>
										{participantOptions.map((participant) => {
											const hasMarker = drawingAccess === "SELECTED_PARTICIPANT" && selectedDrawerUsername === participant.username;
											return (
												<button
													key={participant.username}
													type="button"
													className={hasMarker ? styles.permissionActive : styles.permissionItem}
													onClick={() => applyPermission("SELECTED_PARTICIPANT", participant.username)}
												>
													<UserRound size={15} />
													<span>{participant.displayName}</span>
													{hasMarker && <span className={styles.markerPill}>Маркер</span>}
													{!hasMarker && participant.role === "HOST" && <span className={styles.rolePill}>Орг</span>}
												</button>
											);
										})}
									</div>
								</div>
							</details>
						</div>
					)}

					<div className={styles.dangerGroup}>
						<button
							type="button"
							className={styles.button}
							onClick={onClear}
							disabled={isBusy || !canManage}
							title={canManage ? "Очистить доску" : "Очищать доску может только организатор"}
							aria-label="Очистить доску"
						>
							<RotateCcw size={17} />
						</button>
						{canClose && onClose && (
							<button
								type="button"
								className={styles.dangerButton}
								onClick={onClose}
								disabled={isBusy || !canManage}
								title={canManage ? "Закрыть доску для всех" : "Закрывать доску может только организатор"}
								aria-label="Закрыть доску для всех"
							>
								<Trash2 size={17} />
							</button>
						)}
						<button type="button" className={styles.button} onClick={onExit} title="Выйти из доски" aria-label="Выйти из доски">
							<X size={18} />
						</button>
					</div>
				</div>
			</details>
		</div>
	);
}

function ColorPicker({
	colors,
	color,
	disabled,
	variant = "inline",
	onColorChange,
}: {
	colors: string[];
	color: string;
	disabled: boolean;
	variant?: "inline" | "menu";
	onColorChange: (color: string) => void;
}) {
	return (
		<div className={variant === "menu" ? styles.menuColors : styles.colors} aria-label="Цвет линии">
			{colors.map((item, index) => (
				<button
					key={`${item}-${index}`}
					type="button"
					className={item === color ? styles.activeColor : styles.color}
					style={{ backgroundColor: item }}
					onClick={() => onColorChange(item)}
					disabled={disabled}
					aria-label={index === 0 ? "Мой цвет" : `Цвет ${item}`}
					title={index === 0 ? "Мой цвет" : item}
				/>
			))}
		</div>
	);
}

function ToolButton({
	tool,
	activeTool,
	disabled,
	title,
	onToolChange,
}: {
	tool: CanvasInteractionTool;
	activeTool: CanvasInteractionTool;
	disabled: boolean;
	title: string;
	onToolChange: (tool: CanvasInteractionTool) => void;
}) {
	const activeClass = tool === "LASER" && activeTool === "LASER"
		? styles.laserActiveButton
		: activeTool === tool ? styles.activeButton : tool === "LASER" ? styles.laserButton : styles.button;

	return (
		<button
			type="button"
			className={activeClass}
			onClick={() => onToolChange(tool)}
			disabled={disabled}
			title={title}
			aria-label={title}
		>
			{getToolIcon(tool, 17)}
		</button>
	);
}

function getToolIcon(tool: CanvasInteractionTool, size: number) {
	if (tool === "ERASER") return <Eraser size={size} />;
	if (tool === "LASER") return <Radio size={size} />;
	if (tool === "STICKY") return <StickyNote size={size} />;
	if (tool === "REACTION") return <Smile size={size} />;
	return <Pencil size={size} />;
}

function getToolLabel(tool: CanvasInteractionTool): string {
	if (tool === "ERASER") return "Ластик";
	if (tool === "LASER") return "Лазер";
	if (tool === "STICKY") return "Стикер";
	if (tool === "REACTION") return "Реакция";
	return "Карандаш";
}

function getAccessTitle(
	drawingAccess: CanvasDrawingAccess,
	selectedDrawerUsername: string | null
): string {
	if (drawingAccess === "HOSTS_ONLY") return "Орги";
	if (drawingAccess === "SELECTED_PARTICIPANT") return selectedDrawerUsername ? `Маркер: ${selectedDrawerUsername}` : "Маркер";
	if (drawingAccess === "VIEW_ONLY") return "Просмотр";
	return "Все";
}

function getCollapsedAccessText(
	drawingAccess: CanvasDrawingAccess,
	selectedDrawerUsername: string | null
): string {
	if (drawingAccess === "HOSTS_ONLY") return "Орги";
	if (drawingAccess === "SELECTED_PARTICIPANT") return selectedDrawerUsername ? `Маркер: ${selectedDrawerUsername}` : "Маркер";
	if (drawingAccess === "VIEW_ONLY") return "Просмотр";
	return "Все";
}

function getTimerStatusLabel(status: CanvasTimerStatus): string {
	if (status === "RUNNING") return "идёт";
	if (status === "FINISHED") return "готово";
	return "остановлен";
}
