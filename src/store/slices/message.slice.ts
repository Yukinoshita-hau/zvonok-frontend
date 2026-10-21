import { createAsyncThunk, createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { AppDispatch, RootState } from "../store";
import type { ShortMessage, ShortMessageResponse } from "../../entities/shortMessage";
import type { GetRoomMessageParams } from "../../api/interfaces/GetRoomMessagesParams";
import { roomApi } from "../../api/roomApi";
import { messageApi } from "../../api/messageApi";
import { api } from '../../api/api';
import type { MessageReaderDto } from "../../api/interfaces/MessageReadersDto";
import { normalizeMessage, normalizeMessages } from "../../utils/normalizeMessage";
import { usersActions } from "./users.slice";
import { fetchMyRooms } from "./room.slice";
import { messageAttachmentsApi } from "../../api/messageAttachmentsApi";
import type { AttachmentType } from "../../api/interfaces/MessageAttachmentDtos";

export interface MessageState {
    jumpTargetId: number | null;
    historyContext: boolean;
    libraryRevision: number;
	requests: Record<string, string>;
	live: Record<number, ShortMessage>;
	messages: ShortMessage[];
	status: "idle" | "loading" | "succeeded" | "failed";
	error: string | null;
	hasMore: boolean;
	oldestMessageId: number | null;
	activeRoomId: number | null;
	isAtBottom: boolean;
	newDividerMessageId: number | null;
	replyTarget: {
		messageId: number;
		authorDisplayName: string;
		snippet: string;
		deleted: boolean;
	} | null;
}

const initialState: MessageState = {
    jumpTargetId: null,
    historyContext: false,
    libraryRevision: 0,
	requests: {},
	live: {},
	messages: [],
	status: "idle",
	error: null,
	hasMore: true,
	oldestMessageId: null,
	activeRoomId: null,
	isAtBottom: false,
	newDividerMessageId: null,
	replyTarget: null,
};

export const fetchRoomMessages = createAsyncThunk<
	{
		messages: ShortMessage[];
		beforeMessageId?: number;
	},
	GetRoomMessageParams & { resync?: boolean },
	{
		dispatch: AppDispatch;
		state: RootState;
		rejectValue: string;
	}
>(
	"message/fetchRoomMessages",
	async (params, thunkAPI) => {
		try {
			const state = thunkAPI.getState();
			const assertCurrent = () => {
				const current = thunkAPI.getState().message;
				const key = String(params.beforeMessageId ?? "latest");
				if (current.activeRoomId !== params.roomId || current.requests[key] !== thunkAPI.requestId) {
					throw new Error("History request superseded");
				}
			};
			assertCurrent();
			const floor = params.resync && !state.message.historyContext ? state.message.oldestMessageId : null;
			let { data } = await roomApi.getRoomMessage(params);
			assertCurrent();
			// Walk actual history pages to the previously loaded boundary, including long outages.
			if (floor !== null) {
				let page = data as ShortMessageResponse[];
				while (page.length === (params.limit ?? 15)) {
					const cursor = Math.min(...page.map(message => message.id));
					if (cursor <= floor) break;
					page = (await roomApi.getRoomMessage({ ...params, beforeMessageId: cursor })).data;
					assertCurrent();
					if (page.some(message => message.id >= cursor)) throw new Error("History cursor did not advance");
					data = [...data, ...page];
				}
			}

			const { messages, users } = normalizeMessages(data as ShortMessageResponse[]);

			thunkAPI.dispatch(usersActions.upsertUsers(users));

			return {
				messages,
				beforeMessageId: params.beforeMessageId,
			};
		} catch (e: unknown) {
			const message = e instanceof Error ? e.message : "Failed to load message";
			return thunkAPI.rejectWithValue(message);
		}
	}
);

export const jumpToRoomMessage = createAsyncThunk(
    'message/jumpToRoomMessage',
    async ({ roomId, messageId }: { roomId: number; messageId: number }, thunkAPI) => {
        const { data } = await api.get<ShortMessageResponse[]>(`/rooms/${roomId}/messages/${messageId}/context`, { signal: thunkAPI.signal, timeout: 15000 });
        const normalized = normalizeMessages(data);
        if ((thunkAPI.getState() as RootState).message.activeRoomId !== roomId) throw new Error('Room changed');
        thunkAPI.dispatch(usersActions.upsertUsers(normalized.users));
        return normalized.messages;
    }
);

export const getMessagesReaders = createAsyncThunk(
	"message/getMessagesReaders",
	async (body: MessageReaderDto, thunkAPI) => {
		try {
			const { data } = await messageApi.getMessageReaders(body);
			return data;
		} catch (e: unknown) {
			const message = e instanceof Error ? e.message : "Failed to load message readers";
			return thunkAPI.rejectWithValue(message);
		}
	}
);

export const clearRoomMessages = createAsyncThunk<
	number,
	{ roomId: number },
	{
		dispatch: AppDispatch;
		rejectValue: string;
	}
>(
	"message/clearRoomMessages",
	async ({ roomId }, thunkAPI) => {
		try {
			await roomApi.clearRoomMessages({ roomId });
            thunkAPI.dispatch(fetchMyRooms());
            await thunkAPI.dispatch(fetchRoomMessages({ roomId, resync: true }));
			return roomId;
		} catch (e: unknown) {
			const message = e instanceof Error ? e.message : "Failed to clear room messages";
			return thunkAPI.rejectWithValue(message);
		}
	}
);

export const sendMessageWithAttachments = createAsyncThunk<
	void,
	{
		roomId: number;
		content?: string;
		files: File[];
		clientRequestId?: string;
		replyToMessageId?: number | null;
		attachmentType?: AttachmentType;
		durationMs?: number | null;
	},
	{
		dispatch: AppDispatch;
		rejectValue: string;
	}
>(
	"message/sendMessageWithAttachments",
	async ({ roomId, content, files, clientRequestId, replyToMessageId, attachmentType, durationMs }, thunkAPI) => {
		try {
			const response = await messageAttachmentsApi.sendMessageWithAttachments(roomId, {
				clientRequestId,
				content,
				files,
				replyToMessageId,
				attachmentType,
				durationMs,
			});
            const normalized = normalizeMessage(response);
            thunkAPI.dispatch(usersActions.upsertUser(normalized.user));
            thunkAPI.dispatch(messageActions.execEventMessage(normalized.message));
            thunkAPI.dispatch(fetchMyRooms());
		} catch (e: unknown) {
			const message = e instanceof Error ? e.message : "Failed to send attachments";
			return thunkAPI.rejectWithValue(message);
		}
	}
);

export const messageSlice = createSlice({
	name: "message",
	initialState,
	reducers: {
		execEventMessage: (state, action: PayloadAction<ShortMessage>) => {
			const incomingMessage = action.payload;

			const isForActiveRoom =
				state.activeRoomId !== null &&
				incomingMessage.room?.id === state.activeRoomId;

			if (!isForActiveRoom) {
				return;
			}
            if (incomingMessage.eventType === 'MESSAGE_DELETE' || incomingMessage.attachments?.length) state.libraryRevision++;
			const previous = state.live[incomingMessage.id] ?? state.messages.find(message => message.id === incomingMessage.id);
            if (previous?.eventType === "MESSAGE_DELETE") return;
            if (previous && incomingMessage.eventType === "MESSAGE" && previous.eventType === "MESSAGE_EDIT") {
                if (!state.messages.some(message => message.id === previous.id)) {
                    state.messages.push(previous);
                    state.messages.sort(compareMessages);
                }
                return;
            }
            if (previous?.editedAt && incomingMessage.eventType === "MESSAGE_EDIT" &&
                (!incomingMessage.editedAt || incomingMessage.editedAt < previous.editedAt)) return;
            state.live[incomingMessage.id] = incomingMessage;

			switch (incomingMessage.eventType) {
				case "MESSAGE": {
					const isDuplicate = state.messages.some(
						msg => msg.id === incomingMessage.id
					);

					if (!isDuplicate && !state.historyContext) {
						state.messages.push(incomingMessage);
						state.messages.sort(compareMessages);
					}

					break;
				}

				case "MESSAGE_EDIT": {
					const message = state.messages.find(
						msg => msg.id === incomingMessage.id
					);

					if (message) {
						message.content = incomingMessage.content;
						message.type = incomingMessage.type;
						message.eventType = incomingMessage.eventType;
						message.editedAt = incomingMessage.editedAt;
						message.replyPreview = incomingMessage.replyPreview;
						message.attachments = incomingMessage.attachments;
					}

					break;
				}

				case "MESSAGE_DELETE": {
					state.messages = state.messages.filter(
						msg => msg.id !== incomingMessage.id
					);

					break;
				}
			}
		},

		setIsAtBottom: (state, action: PayloadAction<boolean>) => {
			state.isAtBottom = action.payload;
		},

		sendMessage: (
			_state,
			_action: PayloadAction<{
				roomId: string | number;
				content: {
					content: string;
					replyToMessageId: number | null;
				};
			}>
		) => {},

		startReply: (
			state,
			action: PayloadAction<{
				messageId: number;
				authorDisplayName: string;
				snippet: string;
				deleted: boolean;
			}>
		) => {
			state.replyTarget = action.payload;
		},

		cancelReply: (state) => {
			state.replyTarget = null;
		},

		sendPrivateMessage: (
			_state,
			_action: PayloadAction<{
				receiver: string;
				content: string;
			}>
		) => {},

		editMessage: (
			_state,
			_action: PayloadAction<{
				messageId: number;
				newContent: string;
			}>
		) => {},

		deleteMessage: (
			_state,
			_action: PayloadAction<{
				messageId: number;
			}>
		) => {},

		markMessageRead: (
			_state,
			_action: PayloadAction<{
				messageId: number;
			}>
		) => {},

		messageReadUpdate: (
			state,
			action: PayloadAction<{
				messageId: number;
				readBy: string;
			}>
		) => {
			const { messageId, readBy } = action.payload;
			const message = state.messages.find(m => m.id === messageId);

			if (message) {
				if (!message.readBy) message.readBy = [];

				if (!message.readBy.includes(readBy)) {
					message.readBy.push(readBy);
				}
			}
		},

		clearMessages: (state) => {
            state.jumpTargetId = null;
            state.historyContext = false;
			state.requests = {};
			state.live = {};
			state.messages = [];
			state.oldestMessageId = null;
			state.hasMore = true;
			state.status = "idle";
			state.replyTarget = null;
		},

		setActiveRoom: (state, action: PayloadAction<number | null>) => {
			if (state.activeRoomId !== action.payload) {
				Object.assign(state, initialState);
			}
			state.activeRoomId = action.payload;
			state.replyTarget = null;

			if (action.payload === null) {
				state.newDividerMessageId = null;
			}
		},

		setNewDividerMessageId: (state, action: PayloadAction<number | null>) => {
			state.newDividerMessageId = action.payload;
		},
        jumpPositioned: (state, action: PayloadAction<number>) => {
            if (state.jumpTargetId === action.payload) state.jumpTargetId = null;
        },
	},

	extraReducers: builder => {
		builder
            .addCase(jumpToRoomMessage.pending, (state, action) => {
                if (state.activeRoomId !== action.meta.arg.roomId) return;
                state.requests = { context: action.meta.requestId };
                state.jumpTargetId = null;
            })
            .addCase(jumpToRoomMessage.fulfilled, (state, action) => {
                if (state.activeRoomId !== action.meta.arg.roomId || state.requests.context !== action.meta.requestId) return;
                state.requests = {};
                const rows = action.payload.filter(m => state.live[m.id]?.eventType !== 'MESSAGE_DELETE').map(m => state.live[m.id] ?? m);
                state.messages = rows.sort(compareMessages);
                state.oldestMessageId = rows[0]?.id ?? null;
                state.hasMore = true;
                state.historyContext = true;
                state.status = 'succeeded';
                state.isAtBottom = false;
                state.jumpTargetId = action.meta.arg.messageId;
            })
            .addCase(jumpToRoomMessage.rejected, (state, action) => {
                if (state.requests.context === action.meta.requestId) delete state.requests.context;
            })
			.addCase(fetchRoomMessages.pending, (state, action) => {
				if (action.meta.arg.roomId !== state.activeRoomId) return;
				if (action.meta.arg.resync) {
                    state.libraryRevision++;
					state.live = {};
					state.requests = {};
				}
				state.requests[String(action.meta.arg.beforeMessageId ?? "latest")] = action.meta.requestId;
				state.status = "loading";
				state.error = null;
			})

			.addCase(fetchRoomMessages.fulfilled, (state, action) => {
				const key = String(action.meta.arg.beforeMessageId ?? "latest");
				if (action.meta.arg.roomId !== state.activeRoomId || state.requests[key] !== action.meta.requestId) return;
				delete state.requests[key];
				state.status = "succeeded";
				if (action.meta.arg.resync) {
                    state.historyContext = false;
                    state.jumpTargetId = null;
                }

				const newMessages = action.payload.messages;
				const hadHistory = state.oldestMessageId !== null;

				const merged = new Map<number, ShortMessage>();
				const visibleIds = new Set(state.messages.map(message => message.id));
				if (!action.meta.arg.resync) state.messages.forEach(message => merged.set(message.id, message));
				newMessages.forEach(message => merged.set(message.id, message));
				Object.values(state.live).forEach(message => {
					if (message.eventType === "MESSAGE_DELETE") merged.delete(message.id);
					else if (message.eventType === "MESSAGE" || merged.has(message.id) || visibleIds.has(message.id)) {
						merged.set(message.id, message);
					}
				});
				state.messages = [...merged.values()].sort(compareMessages);

				state.oldestMessageId = state.messages.length > 0
					? Math.min(...state.messages.map(message => message.id)) : null;

				if (!action.meta.arg.resync || !hadHistory || newMessages.length === 0) {
					state.hasMore = newMessages.length === (action.meta.arg.limit ?? 15);
				}
			})

			.addCase(fetchRoomMessages.rejected, (state, action) => {
				const key = String(action.meta.arg.beforeMessageId ?? "latest");
				if (action.meta.arg.roomId !== state.activeRoomId || state.requests[key] !== action.meta.requestId) return;
				delete state.requests[key];
				state.status = "failed";
				state.error =
					typeof action.payload === "string"
						? action.payload
						: "Unknown error";
			})

			.addCase(getMessagesReaders.fulfilled, (state, action) => {
				action.payload.forEach(({ messageId, readers }) => {
					const message = state.messages.find(m => m.id === messageId);

					if (message) {
						message.readBy = readers;
					}
				});
			})
            .addCase(clearRoomMessages.fulfilled, (state, action) => {
                if (state.activeRoomId !== action.payload) return;
                state.replyTarget = null;
                state.newDividerMessageId = null;
            });
	},
});

export default messageSlice.reducer;
export const messageActions = messageSlice.actions;

function compareMessages(a: ShortMessage, b: ShortMessage) {
	return a.id - b.id;
}
