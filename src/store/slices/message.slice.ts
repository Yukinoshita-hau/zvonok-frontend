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
}

const initialState: MessageState = {
	messages: [],
	status: "idle",
	error: null,
	hasMore: true,
	oldestMessageId: null,
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
		addMessage: (currentState, action: PayloadAction<ShortMessage>) => {
			const incomingMessage = action.payload;

			const isDuplicate = currentState.messages.some(m => m.id === incomingMessage.id);
			if (isDuplicate) {
				return;
			}

			if (currentState.messages.length > 0) {
				const currentActiveRoomId = currentState.messages[0].room.id;

				if (incomingMessage.room.id === currentActiveRoomId) {
					currentState.messages.push(incomingMessage);
				}
			} else {
				currentState.messages.push(incomingMessage);
			}

		},
		sendMessage: (currentState, action: PayloadAction<{
			roomId: string | number;
			content: string
		}>) => { },
		clearMessages: (currentState) => {
			currentState.messages = [];
			currentState.oldestMessageId = null;
			currentState.hasMore = true;
			currentState.status = "idle";
		}
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
