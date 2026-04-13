
import { api } from "./api";
import type { MessageApiInterface } from "./interfaces/MessageApiInterface";
import type { MessageReaderDto } from "./interfaces/MessageReadersDto";

const MESSAGE_API_PREFIX = "/messages";

export const messageApi: MessageApiInterface = {
	getMessageReaders: (body: MessageReaderDto) => api.post(`${MESSAGE_API_PREFIX}/readers`, body)
}
