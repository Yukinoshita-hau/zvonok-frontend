import type { CSSProperties } from "react";
import styles from "./CanvasPresenceLayer.module.css";

export interface RemoteCursorState {
	userId: string;
	x: number;
	y: number;
	color: string;
	updatedAt: number;
}

export interface LaserPointState {
	id: string;
	userId: string;
	x: number;
	y: number;
	color: string;
	createdAt: number;
}

export interface LaserTrailState {
	userId: string;
	points: LaserPointState[];
	active: boolean;
}

interface CanvasPresenceLayerProps {
	cursors: RemoteCursorState[];
	laserTrails: LaserTrailState[];
	now: number;
	opacity?: number;
}

const LASER_POINT_TTL_MS = 1200;

export function CanvasPresenceLayer({ cursors, laserTrails, now, opacity = 1 }: CanvasPresenceLayerProps) {
	return (
		<div className={styles.layer} style={{ opacity }} aria-hidden="true">
			{laserTrails.flatMap((trail) => trail.points.map((point) => {
				const age = now - point.createdAt;
				const opacity = Math.max(0, 1 - age / LASER_POINT_TTL_MS);

				return (
					<span
						key={point.id}
						className={styles.laserPoint}
						style={{
							left: `${point.x * 100}%`,
							top: `${point.y * 100}%`,
							backgroundColor: point.color,
							"--laser-opacity": opacity,
							"--laser-color": point.color,
						} as CSSProperties}
					/>
				);
			}))}

			{cursors.map((cursor) => (
				<div
					key={cursor.userId}
					className={styles.cursor}
					style={{
						left: `${cursor.x * 100}%`,
						top: `${cursor.y * 100}%`,
						"--cursor-color": cursor.color,
					} as CSSProperties}
				>
					<span className={styles.cursorPointer} />
					<span className={styles.cursorLabel}>{shortenName(cursor.userId)}</span>
				</div>
			))}
		</div>
	);
}

function shortenName(userId: string): string {
	if (userId.length <= 16) return userId;
	return `${userId.slice(0, 14)}...`;
}
