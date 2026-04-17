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
	bannerUrl: string;
	isPrivate: boolean;
	channelFolders: ChannelFolder[]; // нужен отдельный интерфейс	
}
