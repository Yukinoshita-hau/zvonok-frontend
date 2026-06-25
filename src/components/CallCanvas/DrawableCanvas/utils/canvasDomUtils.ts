export function findScreenShareVideo(boardId: number): HTMLVideoElement | null {
	const root = document.querySelector(`[data-canvas-overlay-root="${boardId}"]`)?.parentElement;
	return root?.querySelector("video") ?? document.querySelector("video");
}
