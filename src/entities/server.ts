import type { ChannelFolder } from "./channelFoldier";

export interface Server {
	id: number;
	name: string;
	inviteCode: string;
	maxMembers: number;
	memberCount: number;
	ownerId: number;
	ownerName: string;
	createdAt: string;
	channelFolders: ChannelFolder[]; // нужен отдельный интерфейс	
}
