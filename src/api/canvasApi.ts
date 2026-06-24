import { api } from "./api";
import type { CanvasApiInterface } from "./interfaces/CanvasApiInterface";
import type {
	CanvasBoardSessionDto,
	CanvasSnapshotDto,
	CreateCanvasBoardRequest,
	UpdateCanvasBoardPermissionsRequest,
} from "./interfaces/CanvasDtos";

export const canvasApi: CanvasApiInterface = {
	createCanvasBoard: async (
		callId: number,
		request: CreateCanvasBoardRequest
	): Promise<CanvasBoardSessionDto> => {
		const { data } = await api.post<CanvasBoardSessionDto>(`/calls/${callId}/boards`, request);
		return data;
	},

	getActiveCanvasBoards: async (callId: number): Promise<CanvasBoardSessionDto[]> => {
		const { data } = await api.get<CanvasBoardSessionDto[]>(`/calls/${callId}/boards`);
		return data;
	},

	getCanvasBoard: async (callId: number, boardId: number): Promise<CanvasBoardSessionDto> => {
		const { data } = await api.get<CanvasBoardSessionDto>(`/calls/${callId}/boards/${boardId}`);
		return data;
	},

	getCanvasSnapshot: async (callId: number, boardId: number): Promise<CanvasSnapshotDto> => {
		const { data } = await api.get<CanvasSnapshotDto>(`/calls/${callId}/boards/${boardId}/snapshot`);
		return data;
	},

	clearCanvasBoard: async (callId: number, boardId: number): Promise<void> => {
		await api.post(`/calls/${callId}/boards/${boardId}/clear`);
	},

	undoLastCanvasStroke: async (callId: number, boardId: number): Promise<void> => {
		await api.post(`/calls/${callId}/boards/${boardId}/undo`);
	},

	updateCanvasBoardPermissions: async (
		callId: number,
		boardId: number,
		request: UpdateCanvasBoardPermissionsRequest
	): Promise<CanvasBoardSessionDto> => {
		const { data } = await api.patch<CanvasBoardSessionDto>(
			`/calls/${callId}/boards/${boardId}/permissions`,
			request
		);
		return data;
	},

	closeCanvasBoard: async (callId: number, boardId: number): Promise<void> => {
		await api.delete(`/calls/${callId}/boards/${boardId}`);
	},
};
