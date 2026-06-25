import type { CanvasTemplateType } from "../../../api/interfaces/CanvasDtos";
import styles from "./CanvasTemplateLayer.module.css";

interface CanvasTemplateLayerProps {
	templateType?: CanvasTemplateType;
	backgroundImageUrl?: string | null;
}

const TEMPLATE_LABELS: Record<Exclude<CanvasTemplateType, "CLEAN" | "DOTS" | "GRID">, string[]> = {
	KANBAN: ["To do", "In progress", "Done"],
	BUG_TRIAGE: ["Problem", "Cause", "Fix"],
	ARCHITECTURE: ["Context", "Services", "Data / Events"],
	RETROSPECTIVE: ["Went well", "Problems", "Actions"],
	BRAINSTORM: ["Ideas", "Topic", "Next"],
};

export function CanvasTemplateLayer({ templateType = "DOTS", backgroundImageUrl }: CanvasTemplateLayerProps) {
	const labels = templateType in TEMPLATE_LABELS
		? TEMPLATE_LABELS[templateType as keyof typeof TEMPLATE_LABELS]
		: null;

	return (
		<div className={`${styles.layer} ${styles[templateType.toLowerCase()]}`} aria-hidden="true">
			{backgroundImageUrl && (
				<img className={styles.backgroundImage} src={backgroundImageUrl} alt="" draggable={false} />
			)}
			{labels && (
				<div className={styles.columns}>
					{labels.map((label) => (
						<div key={label} className={styles.column}>
							<span>{label}</span>
						</div>
					))}
				</div>
			)}
		</div>
	);
}
