import { Eraser, Eye, EyeOff, Grid3X3, Pencil, Radio, RotateCcw, Sparkles, Trash2, X } from "lucide-react";
import styles from "./WhiteboardToolbar.module.css";
import type { CanvasInteractionTool } from "../../../api/interfaces/CanvasDtos";

type CanvasBackgroundMode = "grid" | "dots" | "clean";

interface WhiteboardToolbarProps {
	color: string;
	width: number;
	tool: CanvasInteractionTool;
	variant?: "whiteboard" | "overlay";
	userColor: string;
	canClose?: boolean;
	isBusy?: boolean;
	backgroundMode: CanvasBackgroundMode;
	isOverlayHidden: boolean;
	overlayOpacity: number;
	onColorChange: (color: string) => void;
	onWidthChange: (width: number) => void;
	onToolChange: (tool: CanvasInteractionTool) => void;
	onClear: () => void;
	onClose?: () => void;
	onExit: () => void;
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
	canClose = false,
	isBusy = false,
	backgroundMode,
	isOverlayHidden,
	overlayOpacity,
	onColorChange,
	onWidthChange,
	onToolChange,
	onClear,
	onClose,
	onExit,
	onBackgroundModeChange,
	onToggleOverlayHidden,
	onOverlayOpacityChange,
}: WhiteboardToolbarProps) {
	const colors = [userColor, ...BASE_COLORS.filter((item) => item !== userColor)];
	const isOverlay = variant === "overlay";

	return (
		<div className={styles.toolbar}>
			<div className={styles.dragHandle} aria-hidden="true" />

			<div className={styles.group}>
				<button
					type="button"
					className={tool === "PEN" ? styles.activeButton : styles.button}
					onClick={() => onToolChange("PEN")}
					title="Карандаш"
					aria-label="Карандаш"
				>
					<Pencil size={17} />
				</button>
				<button
					type="button"
					className={tool === "ERASER" ? styles.activeButton : styles.button}
					onClick={() => onToolChange("ERASER")}
					title="Ластик"
					aria-label="Ластик"
				>
					<Eraser size={17} />
				</button>
				<button
					type="button"
					className={tool === "LASER" ? styles.laserActiveButton : styles.laserButton}
					onClick={() => onToolChange("LASER")}
					title="Лазерная указка"
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

			<div className={styles.group}>
				<button
					type="button"
					className={styles.button}
					onClick={onClear}
					disabled={isBusy}
					title="Очистить доску"
					aria-label="Очистить доску"
				>
					<RotateCcw size={17} />
				</button>
				{canClose && onClose && (
					<button
						type="button"
						className={styles.dangerButton}
						onClick={onClose}
						disabled={isBusy}
						title="Закрыть доску для всех"
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
