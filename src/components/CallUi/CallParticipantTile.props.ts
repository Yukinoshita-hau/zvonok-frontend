import type { TrackReference } from "@livekit/components-react";
import type { Participant } from "livekit-client";

export interface CallParticipantTileProps {
	participant: Participant;
	videoTrack?: TrackReference;
	avatarUrl?: string | null;
	className: string;
	isScreenSharing?: boolean;
	isScreenShareSelected?: boolean;
	onOpenScreenShare?: () => void;
}

