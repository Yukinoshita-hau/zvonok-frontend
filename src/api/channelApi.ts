import type { Channel } from "../entities/channel";
import type { ChannelMessage } from "../entities/channelMessage";
import { api } from "./api";
import type { ChannelApiInterface } from "./interfaces/ChannelApiInterface";
import type { GetChannelMessageParams } from "./interfaces/GetChannelMessageParams";
import type { GetChannelParams } from "./interfaces/GetChannelParams";
import { SERVER_API_PREFIX } from "./serverApi";

const CHANNEL_FOLDER_API_PREFIX = "/channel-folders"
const CHANNEL_API_PREFIX = "/channels"

export const channelApi: ChannelApiInterface = {
	getChannelMessage: ({ serverId,
		channelFolderId,
		channelId,
		beforeMessageId,
		limit }: GetChannelMessageParams) => api.post<ChannelMessage[]>(`${SERVER_API_PREFIX}/${serverId}
							${CHANNEL_FOLDER_API_PREFIX}/${channelFolderId}
							${CHANNEL_API_PREFIX}/${channelId}/messages`, {
			params: {
				beforeMessageId,
				limit
			}
		}),
	getChannel: ({
		serverId,
		channelFolderId,
		channelId
	}: GetChannelParams) => api.post<Channel>(`${SERVER_API_PREFIX}/${serverId}
			${CHANNEL_FOLDER_API_PREFIX}/${channelFolderId}
			${CHANNEL_API_PREFIX}/${channelId}`)

}
