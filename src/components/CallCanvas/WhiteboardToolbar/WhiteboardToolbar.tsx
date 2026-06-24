import { useRef, useState } from "react";
import {
	ChevronDown,
	ChevronUp,
	Eraser,
	Eye,
	EyeOff,
	Grid3X3,
	Lock,
	Pencil,
	Radio,
	RotateCcw,
	ShieldCheck,
	Sparkles,
	Trash2,
	Undo2,
	UserRound,
	Users,
	X,
} from "lucide-react";
import styles from "./WhiteboardToolbar.module.css";
import type { CanvasDrawingAccess, CanvasInteractionTool } from "../../../api/interfaces/CanvasDtos";
import type { CanvasParticipantOption } from "../CallCanvas.types";

type CanvasBackgroundMode = "grid" | "dots" | "clean";

interface WhiteboardToolbarProps {
	color: string;
	width: number;
	tool: CanvasInteractionTool;
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
	backgroundMode: CanvasBackgroundMode;
	isOverlayHidden: boolean;
	overlayOpacity: number;
	onColorChange: (color: string) => void;
	onWidthChange: (width: number) => void;
	onToolChange: (tool: CanvasInteractionTool) => void;
	onUndo: () => void;
	onClear: () => void;
	onClose?: () => void;
	onExit: () => void;
	onPermissionChange: (drawingAccess: CanvasDrawingAccess, selectedDrawerUsername: string | null) => void;
	onBackgroundModeChange: (mode: CanvasBackgroundMode) => void;
	onToggleOverlayHidden: () => void;
	onOverlayOpacityChange: (opacity: number) => void;
}

const BASE_COLORS = ["#111827", "#f8fafc", "#ef4444", "#f97316", "#22c55e", "#38bdf8", "#a855f7"];

export function WhiteboardToolbar({
	color,
	width,
	tool,
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
	backgroundMode,
	isOverlayHidden,
	overlayOpacity,
	onColorChange,
	onWidthChange,
	onToolChange,
	onUndo,
	onClear,
	onClose,
	onExit,
	onPermissionChange,
	onBackgroundModeChange,
	onToggleOverlayHidden,
	onOverlayOpacityChange,
}: WhiteboardToolbarProps) {
	const permissionsRef = useRef<HTMLDetailsElement>(null);
	const [isCollapsed, setIsCollapsed] = useState(false);
	const colors = [userColor, ...BASE_COLORS.filter((item) => item !== userColor)];
	const isOverlay = variant === "overlay";
	const toolsDisabled = isBusy || !canDraw;
	const accessTitle = getAccessTitle(drawingAccess, selectedDrawerUsername);
	const collapsedAccessText = getCollapsedAccessText(drawingAccess, selectedDrawerUsername);
	const readonlyTitle = readOnlyReason ?? accessTitle;

	const applyPermission = (nextAccess: CanvasDrawingAccess, nextUsername: string | null) => {
		permissionsRef.current?.removeAttribute("open");
		onPermissionChange(nextAccess, nextUsername);
	};

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
				<button
					type="button"
					className={tool === "PEN" ? styles.activeButton : styles.button}
					onClick={() => onToolChange("PEN")}
					disabled={toolsDisabled}
					title={canDraw ? "Карандаш" : readonlyTitle}
					aria-label="Карандаш"
				>
					<Pencil size={17} />
				</button>
				<button
					type="button"
					className={tool === "ERASER" ? styles.activeButton : styles.button}
					onClick={() => onToolChange("ERASER")}
					disabled={toolsDisabled}
					title={canDraw ? "Ластик" : readonlyTitle}
					aria-label="Ластик"
				>
					<Eraser size={17} />
				</button>
				<button
					type="button"
					className={tool === "LASER" ? styles.laserActiveButton : styles.laserButton}
					onClick={() => onToolChange("LASER")}
					disabled={toolsDisabled}
					title={canDraw ? "Лазерная указка" : readonlyTitle}
					aria-label="Лазерная указка"
				>
					<Radio size={17} />
				</button>
			</div>

			<div className={styles.colors} aria-label="Цвет линии">
				{colors.map((item, index) => (
					<button
						key={`${item}-${index}`}
						type="button"
						className={item === color ? styles.activeColor : styles.color}
						style={{ backgroundColor: item }}
						onClick={() => onColorChange(item)}
						disabled={toolsDisabled}
						aria-label={index === 0 ? "Мой цвет" : `Цвет ${item}`}
						title={index === 0 ? "Мой цвет" : item}
					/>
				))}
			</div>

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

			{!isOverlay && (
				<div className={styles.segmented} aria-label="Фон доски">
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
						title="Чисто"
						aria-label="Чистый фон"
					>
						<span className={styles.cleanDot} />
					</button>
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
					<label className={styles.opacityLabel}>
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

			<div className={styles.statusGroup}>
				<span className={canDraw ? styles.accessBadge : styles.readOnlyBadge} title={readonlyTitle}>
					{canDraw ? <ShieldCheck size={14} /> : <Lock size={14} />}
					{canDraw ? accessTitle : readonlyTitle}
				</span>
				{canManage && (
					<details ref={permissionsRef} className={styles.permissionsMenu}>
						<summary className={styles.permissionsTrigger} title="Права рисования" aria-label="Права рисования">
							<Users size={15} />
							<span>Права</span>
							<ChevronDown size={14} />
						</summary>
						<div className={styles.permissionsPanel}>
							<button
								type="button"
								className={drawingAccess === "EVERYONE" ? styles.permissionActive : styles.permissionItem}
								onClick={() => applyPermission("EVERYONE", null)}
							>
								<Users size={15} />
								<span>Все</span>
							</button>
							<button
								type="button"
								className={drawingAccess === "HOSTS_ONLY" ? styles.permissionActive : styles.permissionItem}
								onClick={() => applyPermission("HOSTS_ONLY", null)}
							>
								<ShieldCheck size={15} />
								<span>Орги</span>
							</button>
							<button
								type="button"
								className={drawingAccess === "VIEW_ONLY" ? styles.permissionActive : styles.permissionItem}
								onClick={() => applyPermission("VIEW_ONLY", null)}
							>
								<Lock size={15} />
								<span>Просмотр</span>
							</button>
							<div className={styles.permissionDivider} />
							<div className={styles.permissionLabel}>Маркер</div>
							<div className={styles.participantList}>
								{participantOptions.map((participant) => {
									const hasMarker = drawingAccess === "SELECTED_PARTICIPANT" &&
										selectedDrawerUsername === participant.username;

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
											{!hasMarker && participant.role === "HOST" && (
												<span className={styles.rolePill}>Орг</span>
											)}
										</button>
									);
								})}
							</div>
						</div>
					</details>
				)}
			</div>

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
				<button
					type="button"
					className={styles.button}
					onClick={onExit}
					title="Выйти из доски"
					aria-label="Выйти из доски"
				>
					<X size={18} />
				</button>
			</div>
		</div>
	);
}

function getToolIcon(tool: CanvasInteractionTool, size: number) {
	if (tool === "ERASER") return <Eraser size={size} />;
	if (tool === "LASER") return <Radio size={size} />;
	return <Pencil size={size} />;
}

function getToolLabel(tool: CanvasInteractionTool): string {
	if (tool === "ERASER") return "Ластик";
	if (tool === "LASER") return "Лазер";
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
