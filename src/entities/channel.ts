export type ChannelType = "TEXT" | "VOICE" | "ANNOUNCEMENT";

export interface Channel {
	id: number;
	name: string;
	type: ChannelType;
	userLimit: number | null;
	slowModeSeconds: number | null;
	isActive: boolean | null;
	createdAt: string | null;
	position: number | null;
	topic: string | null;
	nsfw: boolean | null;
}
