export interface AvailableLanguageDto {
	language: string;
	displayName: string;
}

export type ExecutionResponseStatus =
	| "SUCCESS"
	| "COMPILATION_ERROR"
	| "RUNTIME_ERROR"
	| "TIME_LIMIT_EXCEEDED"
	| "INTERNAL_ERROR";

export interface CodeRunRequestDto {
	language: string;
	code: string;
	stdin: string;
}

export interface CodeRunResponseDto {
	status: ExecutionResponseStatus;
	stdout: string;
	exitCode: number;
	executionTimeMs: number;
}
