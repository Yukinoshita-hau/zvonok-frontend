export function shouldSendCanvasPoint(
	lastSentAt: number,
	lastPoint: { x: number; y: number } | null,
	nextPoint: { x: number; y: number },
	now: number
): boolean {
	if (now - lastSentAt < 24) return false;
	if (!lastPoint) return true;

	const dx = nextPoint.x - lastPoint.x;
	const dy = nextPoint.y - lastPoint.y;
	return Math.sqrt(dx * dx + dy * dy) >= 0.003;
}

