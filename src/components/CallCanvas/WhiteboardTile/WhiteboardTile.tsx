import { Brush, Sparkles } from "lucide-react";
import type { CanvasBoardSessionDto } from "../../../api/interfaces/CanvasDtos";
import { StringToColor } from "../../../utils/stringHelpers";
import styles from "./WhiteboardTile.module.css";

interface WhiteboardTileProps {
	board: CanvasBoardSessionDto;
	className?: string;
	isFocused?: boolean;
	onOpen: () => void;
}

export function WhiteboardTile({ board, className, isFocused = false, onOpen }: WhiteboardTileProps) {
	const creatorColor = StringToColor(board.createdBy || "board");

	return (
		<button
			type="button"
			className={[className, styles.tile, isFocused ? styles.focused : ""].filter(Boolean).join(" ")}
			onClick={onOpen}
			title="Открыть совместную доску"
		>
			<div className={styles.preview}>
				<div className={styles.paper}>
					<span className={styles.line} />
					<span className={styles.lineShort} />
					<span className={styles.curve} />
					<span className={styles.dotOne} />
					<span className={styles.dotTwo} />
				</div>
				<div className={styles.badge}>
					<Brush size={14} />
				</div>
				<div className={styles.spark}>
					<Sparkles size={13} />
				</div>
			</div>
			<div className={styles.name}>
				<span className={styles.title}>Доска</span>
				<span className={styles.owner}>
					<span className={styles.ownerDot} style={{ backgroundColor: creatorColor }} />
					{board.createdBy}
				</span>
			</div>
		</button>
	);
}
