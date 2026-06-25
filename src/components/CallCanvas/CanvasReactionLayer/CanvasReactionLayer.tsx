import type { CanvasReactionType } from "../../../api/interfaces/CanvasDtos";
import styles from "./CanvasReactionLayer.module.css";

export interface CanvasReactionState {
	id: string;
	x: number;
	y: number;
	reaction: CanvasReactionType;
	createdAt: number;
}

interface CanvasReactionLayerProps {
	reactions: CanvasReactionState[];
	now: number;
}

const REACTION_EMOJI: Record<CanvasReactionType, string> = {
	THUMBS_UP: "👍",
	FIRE: "🔥",
	QUESTION: "❓",
	CHECK: "✅",
	EYES: "👀",
};

const REACTION_TTL_MS = 1800;

export function CanvasReactionLayer({ reactions, now }: CanvasReactionLayerProps) {
	return (
		<div className={styles.layer} aria-hidden="true">
			{reactions.map((reaction) => {
				const age = now - reaction.createdAt;
				const opacity = Math.max(0, 1 - age / REACTION_TTL_MS);

				return (
					<span
						key={reaction.id}
						className={styles.reaction}
						style={{
							left: `${reaction.x * 100}%`,
							top: `${reaction.y * 100}%`,
							opacity,
						}}
					>
						{REACTION_EMOJI[reaction.reaction]}
					</span>
				);
			})}
		</div>
	);
}
