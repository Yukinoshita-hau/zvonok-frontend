import { api } from "./api";
import type {
	AvailableLanguageDto,
	CodeRunRequestDto,
	CodeRunResponseDto,
} from "./interfaces/codeRunTypes";

export const codeRunApi = {
	getAvailableLanguages: async (): Promise<AvailableLanguageDto[]> => {
		const { data } = await api.get<AvailableLanguageDto[]>("/code-runs/languages");
		return data;
	},

	runCode: async (request: CodeRunRequestDto): Promise<CodeRunResponseDto> => {
		const { data } = await api.post<CodeRunResponseDto>("/code-runs", request);
		return data;
	},
};
