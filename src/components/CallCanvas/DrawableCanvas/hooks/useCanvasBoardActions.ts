import { useCallback, useState } from "react";
import { useDispatch } from "react-redux";
import type {
	CanvasBoardSessionDto,
	CanvasDrawingAccess,
	CanvasPointDto,
	CanvasStickyNoteDto,
	CanvasTemplateType,
} from "../../../../api/interfaces/CanvasDtos";
import {
	canvasActions,
	clearCanvasBoard,
	closeCanvasBoard,
	createSnapshotWhiteboard,
	createCanvasStickyNote,
	deleteCanvasStickyNote,
	resetCanvasTimer,
	startCanvasTimer,
	stopCanvasTimer,
	undoLastCanvasStroke,
	unvoteCanvasNote,
	updateCanvasBoardPermissions,
	updateCanvasBoardTemplate,
	updateCanvasPresenter,
	updateCanvasStickyNote,
	voteCanvasNote,
} from "../../../../store/slices/canvas.slice";
import { toastActions } from "../../../../store/slices/toast.slice";
import type { AppDispatch } from "../../../../store/store";
import { DEFAULT_NOTE_HEIGHT, DEFAULT_NOTE_WIDTH, NOTE_COLORS } from "../DrawableCanvas.constants";
import { findScreenShareVideo } from "../utils/canvasDomUtils";

interface UseCanvasBoardActionsParams {
	callId: number;
	board: CanvasBoardSessionDto;
	boardForPermissions: CanvasBoardSessionDto;
	activeUsername: string;
	canManageCanvas: boolean;
	effectiveCanDraw: boolean;
	notesLength: number;
	onExit: () => void;
}

export function useCanvasBoardActions({
	callId,
	board,
	boardForPermissions,
	activeUsername,
	canManageCanvas,
	effectiveCanDraw,
	notesLength,
	onExit,
}: UseCanvasBoardActionsParams) {
	const [isBusy, setIsBusy] = useState(false);
	const [isClearConfirmOpen, setIsClearConfirmOpen] = useState(false);
	const dispatch = useDispatch<AppDispatch>();

	const showToast = useCallback((title: string, message: string) => {
		dispatch(toastActions.showToast({
			id: crypto.randomUUID(),
			type: "error",
			title,
			message,
		}));
	}, [dispatch]);

	const runBoardOperation = useCallback(async (
		operation: () => Promise<unknown>,
		title: string,
		fallbackMessage: string
	) => {
		setIsBusy(true);
		try {
			await operation();
		} catch (error) {
			showToast(title, error instanceof Error ? error.message : fallbackMessage);
		} finally {
			setIsBusy(false);
		}
	}, [showToast]);

	const createStickyAtPoint = useCallback((point: CanvasPointDto) => {
		if (!effectiveCanDraw) return;
		const colorIndex = notesLength % NOTE_COLORS.length;
		void dispatch(createCanvasStickyNote({
			callId,
			boardId: board.id,
			request: {
				text: "Новая заметка",
				color: NOTE_COLORS[colorIndex],
				x: point.x,
				y: point.y,
				width: DEFAULT_NOTE_WIDTH,
				height: DEFAULT_NOTE_HEIGHT,
			},
		})).unwrap().catch((error) => {
			showToast("Заметка", error instanceof Error ? error.message : "Не удалось создать стикер");
		});
	}, [board.id, callId, dispatch, effectiveCanDraw, notesLength, showToast]);

	const clear = useCallback(async () => {
		if (!canManageCanvas) return;
		await runBoardOperation(async () => {
			await dispatch(clearCanvasBoard({ callId, boardId: board.id })).unwrap();
			dispatch(canvasActions.applyCanvasDrawEvent({ type: "BOARD_CLEAR", boardId: board.id }));
			setIsClearConfirmOpen(false);
		}, "Доска", "Не удалось очистить доску");
	}, [board.id, callId, canManageCanvas, dispatch, runBoardOperation]);

	const undo = useCallback(async () => {
		await runBoardOperation(
			() => dispatch(undoLastCanvasStroke({ callId, boardId: board.id })).unwrap(),
			"Доска",
			"Не удалось отменить последний штрих"
		);
	}, [board.id, callId, dispatch, runBoardOperation]);

	const changePermission = useCallback(async (
		drawingAccess: CanvasDrawingAccess,
		selectedDrawerUsername: string | null
	) => {
		if (!canManageCanvas) return;
		await runBoardOperation(async () => {
			await dispatch(updateCanvasBoardPermissions({
				callId,
				boardId: boardForPermissions.id,
				request: { drawingAccess, selectedDrawerUsername },
			})).unwrap();

			await dispatch(updateCanvasPresenter({
				callId,
				boardId: board.id,
				request: {
					presenterModeEnabled: drawingAccess === "SELECTED_PARTICIPANT" && Boolean(selectedDrawerUsername),
					presenterUsername: drawingAccess === "SELECTED_PARTICIPANT" ? selectedDrawerUsername : null,
				},
			})).unwrap();
		},
			"Права доски",
			"Не удалось обновить права рисования"
		);
	}, [board.id, boardForPermissions.id, callId, canManageCanvas, dispatch, runBoardOperation]);

	const changeTemplate = useCallback(async (templateType: CanvasTemplateType) => {
		if (!canManageCanvas) return;
		await runBoardOperation(
			() => dispatch(updateCanvasBoardTemplate({
				callId,
				boardId: board.id,
				request: { templateType },
			})).unwrap(),
			"Шаблон",
			"Не удалось обновить шаблон доски"
		);
	}, [board.id, callId, canManageCanvas, dispatch, runBoardOperation]);

	const close = useCallback(async () => {
		if (!canManageCanvas) return;
		await runBoardOperation(async () => {
			await dispatch(closeCanvasBoard({ callId, boardId: board.id })).unwrap();
			onExit();
		}, "Доска", "Не удалось закрыть доску");
	}, [board.id, callId, canManageCanvas, dispatch, onExit, runBoardOperation]);

	const startTimer = useCallback((durationSeconds: number) => {
		if (!canManageCanvas) return;
		void runBoardOperation(
			() => dispatch(startCanvasTimer({ callId, boardId: board.id, durationSeconds })).unwrap(),
			"Таймер",
			"Не удалось запустить таймер"
		);
	}, [board.id, callId, canManageCanvas, dispatch, runBoardOperation]);

	const stopTimer = useCallback(() => {
		if (!canManageCanvas) return;
		void runBoardOperation(
			() => dispatch(stopCanvasTimer({ callId, boardId: board.id })).unwrap(),
			"Таймер",
			"Не удалось остановить таймер"
		);
	}, [board.id, callId, canManageCanvas, dispatch, runBoardOperation]);

	const resetTimer = useCallback(() => {
		if (!canManageCanvas) return;
		void runBoardOperation(
			() => dispatch(resetCanvasTimer({ callId, boardId: board.id })).unwrap(),
			"Таймер",
			"Не удалось сбросить таймер"
		);
	}, [board.id, callId, canManageCanvas, dispatch, runBoardOperation]);

	const updateNote = useCallback((noteId: number, patch: Partial<CanvasStickyNoteDto>) => {
		void dispatch(updateCanvasStickyNote({
			callId,
			boardId: board.id,
			noteId,
			request: patch,
		})).unwrap().catch((error) => {
			showToast("Заметка", error instanceof Error ? error.message : "Не удалось обновить заметку");
		});
	}, [board.id, callId, dispatch, showToast]);

	const deleteNote = useCallback((noteId: number) => {
		void dispatch(deleteCanvasStickyNote({ callId, boardId: board.id, noteId })).unwrap().catch((error) => {
			showToast("Заметка", error instanceof Error ? error.message : "Не удалось удалить заметку");
		});
	}, [board.id, callId, dispatch, showToast]);

	const toggleVote = useCallback((noteId: number, hasVoted: boolean) => {
		const action = hasVoted
			? unvoteCanvasNote({ callId, boardId: board.id, noteId, userId: activeUsername })
			: voteCanvasNote({ callId, boardId: board.id, noteId });
		void dispatch(action).unwrap().catch((error) => {
			showToast("Голос", error instanceof Error ? error.message : "Не удалось поставить голос");
		});
	}, [activeUsername, board.id, callId, dispatch, showToast]);

	const captureBackground = useCallback(async () => {
		if (!canManageCanvas) return;
		const video = findScreenShareVideo(board.id);
		if (!video || !video.videoWidth || !video.videoHeight) {
			showToast("Снимок экрана", "Нет готовой трансляции экрана");
			return;
		}

		const captureCanvas = document.createElement("canvas");
		captureCanvas.width = video.videoWidth;
		captureCanvas.height = video.videoHeight;
		const context = captureCanvas.getContext("2d");
		if (!context) {
			showToast("Снимок экрана", "Не удалось подготовить снимок");
			return;
		}

		context.drawImage(video, 0, 0, captureCanvas.width, captureCanvas.height);
		const blob = await new Promise<Blob | null>((resolve) => captureCanvas.toBlob(resolve, "image/png", 0.92));
		if (!blob) {
			showToast("Снимок экрана", "Не удалось сохранить снимок экрана");
			return;
		}

		await runBoardOperation(
			() => dispatch(createSnapshotWhiteboard({
				callId,
				file: new File([blob], "screen-share-snapshot.png", { type: "image/png" }),
			})).unwrap(),
			"Снимок экрана",
			"Не удалось создать доску со снимком"
		);
	}, [board.id, callId, canManageCanvas, dispatch, runBoardOperation, showToast]);

	const changePresenter = useCallback(async (
		presenterModeEnabled: boolean,
		presenterUsername: string | null
	) => {
		if (!canManageCanvas) return;
		await runBoardOperation(async () => {
			await dispatch(updateCanvasPresenter({
				callId,
				boardId: board.id,
				request: { presenterModeEnabled, presenterUsername },
			})).unwrap();

			if (presenterModeEnabled && presenterUsername) {
				await dispatch(updateCanvasBoardPermissions({
					callId,
					boardId: boardForPermissions.id,
					request: {
						drawingAccess: "SELECTED_PARTICIPANT",
						selectedDrawerUsername: presenterUsername,
					},
				})).unwrap();
			}
		},
			"Режим ведущего",
			"Не удалось обновить режим ведущего"
		);
	}, [board.id, boardForPermissions.id, callId, canManageCanvas, dispatch, runBoardOperation]);

	return {
		isBusy,
		isClearConfirmOpen,
		setIsClearConfirmOpen,
		createStickyAtPoint,
		clear,
		undo,
		changePermission,
		changeTemplate,
		close,
		startTimer,
		stopTimer,
		resetTimer,
		updateNote,
		deleteNote,
		toggleVote,
		captureBackground,
		changePresenter,
	};
}
