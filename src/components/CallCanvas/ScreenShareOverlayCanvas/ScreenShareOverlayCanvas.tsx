import { useLayoutEffect, useState } from "react";
import { DrawableCanvas } from "../DrawableCanvas/DrawableCanvas";
import type { CanvasBoardSessionDto } from "../../../api/interfaces/CanvasDtos";
import type { CanvasParticipantOption } from "../CallCanvas.types";
import styles from "./ScreenShareOverlayCanvas.module.css";

interface ScreenShareOverlayCanvasProps {
	callId: number;
	board: CanvasBoardSessionDto;
	canDraw: boolean;
	currentUsername?: string | null;
	managerUsername?: string | null;
	participantOptions?: CanvasParticipantOption[];
	onExit: () => void;
}

interface OverlayRect {
	left: number;
	top: number;
	width: number;
	height: number;
}

export function ScreenShareOverlayCanvas({
	callId,
	board,
	canDraw,
	currentUsername,
	managerUsername,
	participantOptions,
	onExit,
}: ScreenShareOverlayCanvasProps) {
	const [overlayRect, setOverlayRect] = useState<OverlayRect | null>(null);

	useLayoutEffect(() => {
		let frameId = 0;
		const root = document.querySelector(`[data-canvas-overlay-root="${board.id}"]`)?.parentElement;
		const video = root?.querySelector("video") ?? null;

		if (!root || !video) {
			setOverlayRect(null);
			return;
		}

		const updateOverlayRect = () => {
			frameId = 0;
			const nextRect = getContainedVideoRect(root, video);
			setOverlayRect(nextRect);
		};

		const scheduleUpdate = () => {
			if (frameId) return;
			frameId = window.requestAnimationFrame(updateOverlayRect);
		};

		const resizeObserver = new ResizeObserver(scheduleUpdate);
		resizeObserver.observe(root);
		resizeObserver.observe(video);
		video.addEventListener("loadedmetadata", scheduleUpdate);
		window.addEventListener("resize", scheduleUpdate);
		scheduleUpdate();

		return () => {
			if (frameId) window.cancelAnimationFrame(frameId);
			resizeObserver.disconnect();
			video.removeEventListener("loadedmetadata", scheduleUpdate);
			window.removeEventListener("resize", scheduleUpdate);
		};
	}, [board.id]);

	return (
		<div
			className={styles.overlay}
			data-canvas-overlay-root={board.id}
			style={overlayRect ? {
				left: overlayRect.left,
				top: overlayRect.top,
				width: overlayRect.width,
				height: overlayRect.height,
			} : undefined}
		>
			<DrawableCanvas
				callId={callId}
				board={board}
				canDraw={canDraw}
				currentUsername={currentUsername}
				managerUsername={managerUsername}
				participantOptions={participantOptions}
				variant="overlay"
				onExit={onExit}
			/>
		</div>
	);
}

function getContainedVideoRect(root: HTMLElement, video: HTMLVideoElement): OverlayRect {
	const rootRect = root.getBoundingClientRect();
	const videoRect = video.getBoundingClientRect();
	const intrinsicWidth = video.videoWidth || videoRect.width;
	const intrinsicHeight = video.videoHeight || videoRect.height;

	if (!intrinsicWidth || !intrinsicHeight || !videoRect.width || !videoRect.height) {
		return {
			left: videoRect.left - rootRect.left,
			top: videoRect.top - rootRect.top,
			width: videoRect.width,
			height: videoRect.height,
		};
	}

	const videoRatio = intrinsicWidth / intrinsicHeight;
	const boxRatio = videoRect.width / videoRect.height;
	let width = videoRect.width;
	let height = videoRect.height;
	let left = videoRect.left;
	let top = videoRect.top;

	if (videoRatio > boxRatio) {
		height = width / videoRatio;
		top += (videoRect.height - height) / 2;
	} else {
		width = height * videoRatio;
		left += (videoRect.width - width) / 2;
	}

	return {
		left: left - rootRect.left,
		top: top - rootRect.top,
		width,
		height,
	};
}
