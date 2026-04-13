export interface GetChannelMessageParams {
	serverId: number;
	channelFolderId: number;
	channelId: number;
	beforeMessageId?: number;
	limit?: number;
}
