import type { StrokeRenderState } from "../api/interfaces/CanvasDtos";
import { denormalizePoint } from "./canvasCoordinates";

export function resizeCanvasToDisplaySize(canvas: HTMLCanvasElement): {
	width: number;
	height: number;
} {
	const rect = canvas.getBoundingClientRect();
	const dpr = window.devicePixelRatio || 1;
	const width = Math.max(1, Math.floor(rect.width));
	const height = Math.max(1, Math.floor(rect.height));
	const targetWidth = Math.floor(width * dpr);
	const targetHeight = Math.floor(height * dpr);

	if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
		canvas.width = targetWidth;
		canvas.height = targetHeight;
	}

	const ctx = canvas.getContext("2d");

	if (ctx) {
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
	}

	return { width, height };
}

export function renderStrokes(
	canvas: HTMLCanvasElement,
	strokes: StrokeRenderState[]
): void {
	const ctx = canvas.getContext("2d");
	if (!ctx) return;

	const { width, height } = resizeCanvasToDisplaySize(canvas);
	ctx.clearRect(0, 0, width, height);

	strokes.forEach((stroke) => drawStroke(ctx, stroke, width, height));
}

function drawStroke(
	ctx: CanvasRenderingContext2D,
	stroke: StrokeRenderState,
	width: number,
	height: number
): void {
	if (stroke.points.length === 0) return;

	ctx.save();
	ctx.lineCap = "round";
	ctx.lineJoin = "round";
	ctx.lineWidth = stroke.width;

	if (stroke.tool === "ERASER") {
		ctx.globalCompositeOperation = "destination-out";
		ctx.strokeStyle = "rgba(0, 0, 0, 1)";
	} else {
		ctx.globalCompositeOperation = "source-over";
		ctx.strokeStyle = stroke.color;
	}

	const first = denormalizePoint(stroke.points[0], width, height);
	ctx.beginPath();
	ctx.moveTo(first.x, first.y);

	if (stroke.points.length === 1) {
		ctx.lineTo(first.x + 0.01, first.y + 0.01);
	} else {
		for (let index = 1; index < stroke.points.length; index++) {
			const point = denormalizePoint(stroke.points[index], width, height);
			ctx.lineTo(point.x, point.y);
		}
	}

	ctx.stroke();
	ctx.restore();
}
