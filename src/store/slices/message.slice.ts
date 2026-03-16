import { createAsyncThunk, createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { ShortMessage } from "../../entities/shortMessage";
import type { GetRoomMessageParams } from "../../api/interfaces/GetRoomMessagesParams";
import { roomApi } from "../../api/roomApi";

export interface MessageState {
	messages: ShortMessage[];
	status: "idle" | "loading" | "succeeded" | "failed";
	error: string | null;
	hasMore: boolean;
	oldestMessageId: number | null;
	activeRoomId: number | null;
	pendingPrivateUsername: string | null;
	isAtBottom: boolean;
	newDividerMessageId: number | null;
}

const initialState: MessageState = {
	messages: [],
	status: "idle",
	error: null,
	hasMore: true,
	oldestMessageId: null,
	activeRoomId: null,
	pendingPrivateUsername: null,
	isAtBottom: false,
	newDividerMessageId: null
};

export const fetchRoomMessages = createAsyncThunk(
	"message/fetchRoomMessages",
	async (params: GetRoomMessageParams, thunkAPI) => {
		try {
			const { data } = await roomApi.getRoomMessage(params);
			return { data, beforeMessageId: params.beforeMessageId };
		} catch (e: any) {
			return thunkAPI.rejectWithValue(e?.message ?? "Failed to load message");
		}
	}
)

export const messageSlice = createSlice({
	name: "message",
	initialState: initialState,
	reducers: {
		execEventMessage: (currentState, action: PayloadAction<ShortMessage>) => {
			const incomingMessage = action.payload;
			console.log("Reducer caught event:", incomingMessage.eventType, "for ID:", incomingMessage.id);

			const isForActiveRoom = currentState.activeRoomId !== null &&
				incomingMessage.room?.id === currentState.activeRoomId;


			if (!isForActiveRoom) {
				return;
			}

			switch (incomingMessage.eventType) {
				case "MESSAGE": {
					const isDuplicate = currentState.messages.some(msg => msg.id === incomingMessage.id);
					if (!isDuplicate) {
						currentState.messages.push(incomingMessage);
					}
					break;
				}

				case "MESSAGE_EDIT": {
					const index = currentState.messages.findIndex(msg => msg.id === incomingMessage.id)
					if (index !== -1) {
						currentState.messages[index] = {
							...currentState.messages[index],
							content: incomingMessage.content,
							type: incomingMessage.type,
							eventType: incomingMessage.eventType
						}
					}
					break;
				}

				case "MESSAGE_DELETE": {
					currentState.messages = currentState.messages.filter(msg => msg.id !== incomingMessage.id);
					break;
				}
			}

		},
		setIsAtBottom: (currentState, action: PayloadAction<boolean>) => {
			currentState.isAtBottom = action.payload;
		},
		sendMessage: (currentState, action: PayloadAction<{
			roomId: string | number;
			content: string
		}>) => { },
		sendPrivateMessage: (currentState, action: PayloadAction<{
			receiver: string,
			content: string
		}>) => { },
		editMessage: (currentState, action: PayloadAction<{
			messageId: number;
			newContent: string
		}>) => { },
		deleteMessage: (currentState, action: PayloadAction<{
			messageId: number;
		}>) => { },
		clearMessages: (currentState) => {
			currentState.messages = [];
			currentState.oldestMessageId = null;
			currentState.hasMore = true;
			currentState.status = "idle";
		},
		setPendingPrivate: (currentState, action: PayloadAction<string | null>) => {
			currentState.pendingPrivateUsername = action.payload;
		},
		setActiveRoom: (currentState, action: PayloadAction<number | null>) => {
			currentState.activeRoomId = action.payload;
			if (action.payload === null) {
				currentState.newDividerMessageId = null;
			}
		},
		setNewDividerMessageId: (currentState, action: PayloadAction<number | null>) => {
			currentState.newDividerMessageId = action.payload;
		},
	},
	extraReducers: builder => {
		builder
			.addCase(fetchRoomMessages.pending, currentState => {
				currentState.status = "loading";
				currentState.error = null;
			})
			.addCase(fetchRoomMessages.fulfilled, (currentState, action) => {
				currentState.status = "succeeded";
				const newMessages = action.payload.data;
				const isPagination = action.payload.beforeMessageId !== undefined;

				if (isPagination) {
					currentState.messages = [...newMessages, ...currentState.messages];
				} else {
					currentState.messages = newMessages;
				}

				if (currentState.messages.length > 0) {
					currentState.oldestMessageId = currentState.messages[0].id;
				}

				currentState.hasMore = newMessages.length === 15;
			})
			.addCase(fetchRoomMessages.rejected, (currentState, action) => {
				currentState.status = "failed";
				currentState.error = typeof action.payload === "string" ? action.payload : "Unknown error";
			})
	}
});

export default messageSlice.reducer;
export const messageActions = messageSlice.actions;
