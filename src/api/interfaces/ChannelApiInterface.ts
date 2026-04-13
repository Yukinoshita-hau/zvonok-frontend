import type { AxiosResponse } from "axios";
import type { GetChannelMessageParams } from "./GetChannelMessageParams";
import type { ChannelMessage } from "../../entities/channelMessage";
import type { Channel } from "../../entities/channel";
import type { GetChannelParams } from "./GetChannelParams";


export interface ChannelApiInterface {
	getChannelMessage: (params: GetChannelMessageParams) => Promise<AxiosResponse<ChannelMessage[]>>	
	getChannel: (params: GetChannelParams) => Promise<AxiosResponse<Channel>>;
}
