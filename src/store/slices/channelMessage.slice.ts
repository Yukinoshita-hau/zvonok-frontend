import { createAsyncThunk, createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { ChannelMessage } from "../../entities/channelMessage";
import { channelApi } from "../../api/channelApi";

export interface ChannelMessageState {
	messages: ChannelMessage[];
	status: "idle" | "loading" | "succeeded" | "failed";
	error: string | null;
	hasMore: boolean;
	oldestMessageId: number | null;
	activeChannelId: number | null;
	isAtBottom: boolean;
}

const initialState: ChannelMessageState = {
	messages: [],
	status: "idle",
	error: null,
	hasMore: true,
	oldestMessageId: null,
	activeChannelId: null,
	isAtBottom: false
};

export const fetchChannelMessages = createAsyncThunk(
	"channelMessage/fetchChannelMessages",
	async (
		params: {
			serverId: number;
			channelFolderId: number;
			channelId: number;
			beforeMessageId?: number;
			limit?: number;
		},
		thunkAPI
	) => {
		try {
			const { data } = await channelApi.getChannelMessage(params);
			return { data, beforeMessageId: params.beforeMessageId };
		} catch (e: any) {
			return thunkAPI.rejectWithValue(e?.message ?? "Failed to load channel messages");
		}
	}
);

export const channelMessageSlice = createSlice({
	name: "channelMessage",
	initialState,
	reducers: {
		execEventChannelMessage: (currentState, action: PayloadAction<ChannelMessage>) => {
			const incomingMessage = action.payload;

			const isForActiveChannel =
				currentState.activeChannelId !== null &&
				incomingMessage.channelId === currentState.activeChannelId;

			if (!isForActiveChannel) return;

			switch (incomingMessage.eventType) {
				case "MESSAGE": {
					const exists = currentState.messages.some(m => m.id === incomingMessage.id);
					if (!exists) {
						currentState.messages.push(incomingMessage);
					}
					break;
				}
				case "MESSAGE_EDIT": {
					const index = currentState.messages.findIndex(m => m.id === incomingMessage.id);
					if (index !== -1) {
						currentState.messages[index] = {
							...currentState.messages[index],
							content: incomingMessage.content,
							type: incomingMessage.type,
							eventType: incomingMessage.eventType,
							editedAt: incomingMessage.editedAt
						};
					}
					break;
				}
				case "MESSAGE_DELETE": {
					currentState.messages = currentState.messages.filter(m => m.id !== incomingMessage.id);
					break;
				}
			}
		},

		setActiveChannel: (currentState, action: PayloadAction<number | null>) => {
			currentState.activeChannelId = action.payload;
		},

		setIsAtBottom: (currentState, action: PayloadAction<boolean>) => {
			currentState.isAtBottom = action.payload;
		},

		sendChannelMessage: (
			currentState,
			action: PayloadAction<{ channelId: string | number; content: string }>
		) => { },

		clearChannelMessages: (currentState) => {
			currentState.messages = [];
			currentState.oldestMessageId = null;
			currentState.hasMore = true;
			currentState.status = "idle";
			currentState.error = null;
		}
	},
	extraReducers: builder => {
		builder
			.addCase(fetchChannelMessages.pending, currentState => {
				currentState.status = "loading";
				currentState.error = null;
			})
			.addCase(fetchChannelMessages.fulfilled, (currentState, action) => {
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
			.addCase(fetchChannelMessages.rejected, (currentState, action) => {
				currentState.status = "failed";
				currentState.error =
					typeof action.payload === "string" ? action.payload : "Unknown error";
			});
	}
});

export default channelMessageSlice.reducer;
export const channelMessageActions = channelMessageSlice.actions;
