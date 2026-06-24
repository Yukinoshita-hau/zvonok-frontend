import type { CanvasBoardSessionDto, CanvasDrawingAccess } from "../api/interfaces/CanvasDtos";

export interface CanvasPermissionState {
	drawingAccess: CanvasDrawingAccess;
	selectedDrawerUsername: string | null;
	canManageCanvas: boolean;
	canDrawCanvas: boolean;
	readOnlyReason: string | null;
}

export function getCanvasPermissionState({
	board,
	currentUsername,
	isCurrentUserHost,
}: {
	board: CanvasBoardSessionDto;
	currentUsername: string | null | undefined;
	isCurrentUserHost: boolean;
}): CanvasPermissionState {
	const drawingAccess = board.drawingAccess ?? "EVERYONE";
	const selectedDrawerUsername = board.selectedDrawerUsername ?? null;
	const isCreator = Boolean(currentUsername && currentUsername === board.createdBy);
	const canManageCanvas = isCreator || isCurrentUserHost;

	if (drawingAccess === "VIEW_ONLY") {
		return {
			drawingAccess,
			selectedDrawerUsername,
			canManageCanvas,
			canDrawCanvas: false,
			readOnlyReason: getReadOnlyReason(drawingAccess, selectedDrawerUsername),
		};
	}

	if (drawingAccess === "EVERYONE") {
		return {
			drawingAccess,
			selectedDrawerUsername,
			canManageCanvas,
			canDrawCanvas: true,
			readOnlyReason: null,
		};
	}

	if (canManageCanvas) {
		return {
			drawingAccess,
			selectedDrawerUsername,
			canManageCanvas,
			canDrawCanvas: true,
			readOnlyReason: null,
		};
	}

	if (drawingAccess === "SELECTED_PARTICIPANT" && currentUsername === selectedDrawerUsername) {
		return {
			drawingAccess,
			selectedDrawerUsername,
			canManageCanvas,
			canDrawCanvas: true,
			readOnlyReason: null,
		};
	}

	return {
		drawingAccess,
		selectedDrawerUsername,
		canManageCanvas,
		canDrawCanvas: false,
		readOnlyReason: getReadOnlyReason(drawingAccess, selectedDrawerUsername),
	};
}

function getReadOnlyReason(
	drawingAccess: CanvasDrawingAccess,
	selectedDrawerUsername: string | null
): string {
	if (drawingAccess === "HOSTS_ONLY") return "Рисуют только ведущие";
	if (drawingAccess === "SELECTED_PARTICIPANT") {
		return selectedDrawerUsername
			? `Маркер у ${selectedDrawerUsername}`
			: "Маркер никому не передан";
	}
	if (drawingAccess === "VIEW_ONLY") return "Только просмотр";
	return "Рисование недоступно";
}
