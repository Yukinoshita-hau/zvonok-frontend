import { useDispatch, useSelector } from "react-redux";
import type { AppDispatch, RootState } from "../../../store/store";
import { canvasActions } from "../../../store/slices/canvas.slice";
import { selectFocusedCanvasBoard } from "../../../store/selectors/canvas.selectors";
import { DrawableCanvas } from "../DrawableCanvas/DrawableCanvas";
import styles from "./WhiteboardFocus.module.css";

interface WhiteboardFocusProps {
	callId: number;
}

export function WhiteboardFocus({ callId }: WhiteboardFocusProps) {
	const dispatch = useDispatch<AppDispatch>();
	const board = useSelector((state: RootState) => selectFocusedCanvasBoard(state));

	if (!board) {
		return (
			<div className={styles.empty}>
				<div className={styles.emptyTitle}>Доска закрыта</div>
				<div className={styles.emptySubtitle}>Вернитесь к участникам или откройте новую доску.</div>
				<button
					type="button"
					className={styles.emptyButton}
					onClick={() => dispatch(canvasActions.clearFocusedCanvasBoard())}
				>
					К участникам
				</button>
			</div>
		);
	}

	return (
		<div className={styles.root}>
			<DrawableCanvas
				callId={callId}
				board={board}
				canDraw
				variant="whiteboard"
				onExit={() => dispatch(canvasActions.clearFocusedCanvasBoard())}
			/>
		</div>
	);
}
