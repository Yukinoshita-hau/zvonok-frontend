import { useMemo } from "react";
import type { CanvasBoardSessionDto } from "../../../../api/interfaces/CanvasDtos";
import { getCanvasPermissionState } from "../../../../utils/canvasPermissions";

interface UseCanvasPermissionsParams {
	board: CanvasBoardSessionDto;
	currentUsername: string;
	managerUsername?: string | null;
	canDraw: boolean;
}

export function useCanvasPermissions({
	board,
	currentUsername,
	managerUsername,
	canDraw,
}: UseCanvasPermissionsParams) {
	const boardForPermissions = board;
	const permissionState = useMemo(() => getCanvasPermissionState({
		board: boardForPermissions,
		currentUsername,
		managerUsername,
	}), [boardForPermissions, currentUsername, managerUsername]);

	return {
		boardForPermissions,
		permissionState,
		effectiveCanDraw: canDraw && permissionState.canDrawCanvas,
	};
}
