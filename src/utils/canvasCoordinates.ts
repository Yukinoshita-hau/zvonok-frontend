import type { PointerEvent as ReactPointerEvent } from "react";
import type { CanvasPointDto } from "../api/interfaces/CanvasDtos";

export function clamp01(value: number): number {
	return Math.min(1, Math.max(0, value));
}

export function getNormalizedPoint(
	event: PointerEvent | ReactPointerEvent,
	element: HTMLElement
): CanvasPointDto {
	const rect = element.getBoundingClientRect();
	const width = Math.max(1, rect.width);
	const height = Math.max(1, rect.height);

	return {
		x: clamp01((event.clientX - rect.left) / width),
		y: clamp01((event.clientY - rect.top) / height),
	};
}

export function denormalizePoint(
	point: CanvasPointDto,
	width: number,
	height: number
): { x: number; y: number } {
	return {
		x: point.x * width,
		y: point.y * height,
	};
}
