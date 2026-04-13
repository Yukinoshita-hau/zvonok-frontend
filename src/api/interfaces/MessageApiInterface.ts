import type { AxiosResponse } from "axios";
import type { GetMessagesReaders } from "./GetMessagesReaders";
import type { MessageReaderDto } from "./MessageReadersDto";


export interface MessageApiInterface {
	getMessageReaders: (body: MessageReaderDto) => Promise<AxiosResponse<GetMessagesReaders[]>>	
}
