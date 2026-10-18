import { createContext, useCallback, useContext, useLayoutEffect, useMemo, type ReactNode } from "react";
import { useRoomContext } from "@livekit/components-react";
import type { AudioCaptureOptions, TrackPublishOptions } from "livekit-client";
import { createLiveKitMicrophoneOwner } from "./MicrophoneCaptureOwner";
import { store } from "../../store/store";

const CallMicrophoneContext = createContext<ReturnType<typeof createLiveKitMicrophoneOwner> | null>(null);

export function CallMicrophoneProvider({
	callId,
	generation,
	children,
}: {
	callId: number | string;
	generation: number;
	children: ReactNode;
}) {
	const room = useRoomContext();
	const isCallCurrent = useCallback(() => {
		const call = store.getState().call;
		return call.callId === callId && call.mediaGeneration === generation && (call.status === "connecting" || call.status === "in_call");
	}, [callId, generation]);
	const owner = useMemo(() => createLiveKitMicrophoneOwner(room, callId, generation, isCallCurrent), [room, callId, generation, isCallCurrent]);
	useLayoutEffect(() => () => owner.dispose(), [owner]);
	return <CallMicrophoneContext.Provider value={owner}>{children}</CallMicrophoneContext.Provider>;
}

export function useCallMicrophoneOwner() {
	const owner = useContext(CallMicrophoneContext);
	if (!owner) throw new Error("Call microphone controls must be inside CallMicrophoneProvider");
	return owner;
}

export type CallMicrophoneOptions = {
	capture: AudioCaptureOptions;
	publish: TrackPublishOptions;
};
