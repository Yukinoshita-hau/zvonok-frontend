import type { TrackReference } from "@livekit/components-react";
import type { Participant } from "livekit-client";
import type { MouseEvent } from "react";

export interface CallParticipantTileProps {
	participant: Participant;
	videoTrack?: TrackReference;
	avatarUrl?: string | null;
	className: string;
	isScreenSharing?: boolean;
	isScreenShareSelected?: boolean;
	onOpenScreenShare?: () => void;
	onContextMenu?: (event: MouseEvent<HTMLButtonElement>) => void;
}
