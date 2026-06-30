import { api } from "./api";
import type { InviteJoinResponseDto, InvitePreviewDto } from "./interfaces/InviteDtos";

const INVITE_API_PREFIX = "/invites";

export const inviteApi = {
	getPreview: (token: string) =>
		api.get<InvitePreviewDto>(`${INVITE_API_PREFIX}/${token}`),

	join: (token: string) =>
		api.post<InviteJoinResponseDto>(`${INVITE_API_PREFIX}/${token}/join`),
};
