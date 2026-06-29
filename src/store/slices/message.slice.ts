import { createAsyncThunk, createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { ShortMessage, ShortMessageResponse } from "../../entities/shortMessage";
import type { GetRoomMessageParams } from "../../api/interfaces/GetRoomMessagesParams";
import { roomApi } from "../../api/roomApi";
import { messageApi } from "../../api/messageApi";
import type { MessageReaderDto } from "../../api/interfaces/MessageReadersDto";
import { normalizeMessages } from "../../utils/normalizeMessage";
import { usersActions } from "./users.slice";
import { messageAttachmentsApi } from "../../api/messageAttachmentsApi";
import type { AttachmentType } from "../../api/interfaces/MessageAttachmentDtos";

export interface MessageState {
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
	GetRoomMessageParams,
	{
		rejectValue: string;
	}
>(
	"message/fetchRoomMessages",
	async (params, thunkAPI) => {
		try {
			const { data } = await roomApi.getRoomMessage(params);

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

export const sendMessageWithAttachments = createAsyncThunk<
	void,
	{
		roomId: number;
		content?: string;
		files: File[];
		replyToMessageId?: number | null;
		attachmentType?: AttachmentType;
		durationMs?: number | null;
	},
	{
		rejectValue: string;
	}
>(
	"message/sendMessageWithAttachments",
	async ({ roomId, content, files, replyToMessageId, attachmentType, durationMs }, thunkAPI) => {
		try {
			await messageAttachmentsApi.sendMessageWithAttachments(roomId, {
				content,
				files,
				replyToMessageId,
				attachmentType,
				durationMs,
			});
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

			switch (incomingMessage.eventType) {
				case "MESSAGE": {
					const isDuplicate = state.messages.some(
						msg => msg.id === incomingMessage.id
					);

					if (!isDuplicate) {
						state.messages.push(incomingMessage);
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
			state,
			action: PayloadAction<{
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
			state,
			action: PayloadAction<{
				receiver: string;
				content: string;
			}>
		) => {},

		editMessage: (
			state,
			action: PayloadAction<{
				messageId: number;
				newContent: string;
			}>
		) => {},

		deleteMessage: (
			state,
			action: PayloadAction<{
				messageId: number;
			}>
		) => {},

		markMessageRead: (
			state,
			action: PayloadAction<{
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
			state.messages = [];
			state.oldestMessageId = null;
			state.hasMore = true;
			state.status = "idle";
			state.replyTarget = null;
		},

		setActiveRoom: (state, action: PayloadAction<number | null>) => {
			state.activeRoomId = action.payload;
			state.replyTarget = null;

			if (action.payload === null) {
				state.newDividerMessageId = null;
			}
		},

		setNewDividerMessageId: (state, action: PayloadAction<number | null>) => {
			state.newDividerMessageId = action.payload;
		},
	},

	extraReducers: builder => {
		builder
			.addCase(fetchRoomMessages.pending, state => {
				state.status = "loading";
				state.error = null;
			})

			.addCase(fetchRoomMessages.fulfilled, (state, action) => {
				state.status = "succeeded";

				const newMessages = action.payload.messages;
				const isPagination = action.payload.beforeMessageId !== undefined;

				if (isPagination) {
					state.messages = [...newMessages, ...state.messages];
				} else {
					state.messages = newMessages;
				}

				if (state.messages.length > 0) {
					state.oldestMessageId = state.messages[0].id;
				}

				state.hasMore = newMessages.length === 15;
			})

			.addCase(fetchRoomMessages.rejected, (state, action) => {
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
			});
	},
});

export default messageSlice.reducer;
export const messageActions = messageSlice.actions;
