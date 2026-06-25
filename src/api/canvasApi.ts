import { api } from "./api";
import type { CanvasApiInterface } from "./interfaces/CanvasApiInterface";
import type {
	CanvasBoardSessionDto,
	CanvasNoteVoteDto,
	CanvasSnapshotDto,
	CanvasStickyNoteDto,
	CreateCanvasBoardRequest,
	CreateCanvasStickyNoteRequest,
	UpdateCanvasBoardTemplateRequest,
	UpdateCanvasBoardPermissionsRequest,
	UpdateCanvasPresenterRequest,
	UpdateCanvasStickyNoteRequest,
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

	updateCanvasBoardTemplate: async (
		callId: number,
		boardId: number,
		request: UpdateCanvasBoardTemplateRequest
	): Promise<CanvasBoardSessionDto> => {
		const { data } = await api.patch<CanvasBoardSessionDto>(
			`/calls/${callId}/boards/${boardId}/template`,
			request
		);
		return data;
	},

	startCanvasTimer: async (
		callId: number,
		boardId: number,
		durationSeconds: number
	): Promise<CanvasBoardSessionDto> => {
		const { data } = await api.post<CanvasBoardSessionDto>(
			`/calls/${callId}/boards/${boardId}/timer/start`,
			{ durationSeconds }
		);
		return data;
	},

	stopCanvasTimer: async (callId: number, boardId: number): Promise<CanvasBoardSessionDto> => {
		const { data } = await api.post<CanvasBoardSessionDto>(`/calls/${callId}/boards/${boardId}/timer/stop`);
		return data;
	},

	resetCanvasTimer: async (callId: number, boardId: number): Promise<CanvasBoardSessionDto> => {
		const { data } = await api.post<CanvasBoardSessionDto>(`/calls/${callId}/boards/${boardId}/timer/reset`);
		return data;
	},

	uploadCanvasBackgroundImage: async (
		callId: number,
		boardId: number,
		file: File
	): Promise<CanvasBoardSessionDto> => {
		const formData = new FormData();
		formData.append("file", file);
		const { data } = await api.post<CanvasBoardSessionDto>(
			`/calls/${callId}/boards/${boardId}/background-image`,
			formData
		);
		return data;
	},

	updateCanvasPresenter: async (
		callId: number,
		boardId: number,
		request: UpdateCanvasPresenterRequest
	): Promise<CanvasBoardSessionDto> => {
		const { data } = await api.patch<CanvasBoardSessionDto>(
			`/calls/${callId}/boards/${boardId}/presenter`,
			request
		);
		return data;
	},

	getCanvasStickyNotes: async (callId: number, boardId: number): Promise<CanvasStickyNoteDto[]> => {
		const { data } = await api.get<CanvasStickyNoteDto[]>(`/calls/${callId}/boards/${boardId}/notes`);
		return data;
	},

	createCanvasStickyNote: async (
		callId: number,
		boardId: number,
		request: CreateCanvasStickyNoteRequest
	): Promise<CanvasStickyNoteDto> => {
		const { data } = await api.post<CanvasStickyNoteDto>(`/calls/${callId}/boards/${boardId}/notes`, request);
		return data;
	},

	updateCanvasStickyNote: async (
		callId: number,
		boardId: number,
		noteId: number,
		request: UpdateCanvasStickyNoteRequest
	): Promise<CanvasStickyNoteDto> => {
		const { data } = await api.patch<CanvasStickyNoteDto>(
			`/calls/${callId}/boards/${boardId}/notes/${noteId}`,
			request
		);
		return data;
	},

	deleteCanvasStickyNote: async (callId: number, boardId: number, noteId: number): Promise<void> => {
		await api.delete(`/calls/${callId}/boards/${boardId}/notes/${noteId}`);
	},

	voteCanvasNote: async (callId: number, boardId: number, noteId: number): Promise<CanvasNoteVoteDto> => {
		const { data } = await api.post<CanvasNoteVoteDto>(`/calls/${callId}/boards/${boardId}/notes/${noteId}/vote`);
		return data;
	},

	unvoteCanvasNote: async (callId: number, boardId: number, noteId: number): Promise<void> => {
		await api.delete(`/calls/${callId}/boards/${boardId}/notes/${noteId}/vote`);
	},

	getCanvasBoardVotes: async (callId: number, boardId: number): Promise<CanvasNoteVoteDto[]> => {
		const { data } = await api.get<CanvasNoteVoteDto[]>(`/calls/${callId}/boards/${boardId}/votes`);
		return data;
	},

	closeCanvasBoard: async (callId: number, boardId: number): Promise<void> => {
		await api.delete(`/calls/${callId}/boards/${boardId}`);
	},
};
