import { LiveKitRoom } from "@livekit/components-react";
import { useDispatch, useSelector, useStore } from "react-redux";
import { useEffect, useMemo, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { BackupCodecPolicy, type RoomOptions } from "livekit-client";
import styles from "./ActiveCallOverlay.module.css";
import type { AppDispatch, RootState } from "../../store/store";
import { CallUi } from "../CallUi/CallUi";
import {
  callActions,
  endConference,
  restoreCallSession,
  takeCallHere,
} from "../../store/slices/call.slice";
import { CallMediaOwner, mediaRenewRetryDelay } from "./CallMediaOwner";
import { CallLifecycle } from "./CallLifecycle";
import { scheduleCallRecovery } from "./callRecovery";
import { CallAudioLayer } from "./CallAudioLayer";
import { CallHotkeys } from "./CallHotkeys";
import { MiniCallDock } from "./MiniCallDock";
import { MicrophoneSettingsSync } from "../CallUi/MicrophoneSettingsSync";
import { getActiveCall } from "../../store/slices/activeCall.slice";
import { CodecDebugLayer } from "../CodecDebugLayer/CodecDebugLayer";
import { MicrophoneProcessorSync } from "../CallUi/MicrophoneProcessorSync";
import { MediaDiagnostics } from "../CallUi/MediaDiagnostics";
import { CallMicrophoneProvider } from "../CallUi/CallMicrophoneProvider";

export function ActiveCallOverlay() {
  const dispatch = useDispatch<AppDispatch>();
  const store = useStore<RootState>();
  const navigate = useNavigate();
  const call = useSelector((s: RootState) => s.call);
  const myUsername = useSelector((s: RootState) => s.user.myUser?.username);
  const recoveryStarted = useRef<number | null>(null);
  const handleConnectionError = useCallback(() => {
    if (call.livekitRoomName)
      dispatch(
        callActions.mediaConnectionChanged({
          roomName: call.livekitRoomName,
          generation: call.mediaGeneration,
          status: "disconnected",
        }),
      );
  }, [dispatch, call.livekitRoomName, call.mediaGeneration]);

  useEffect(() => {
    if (call.mediaState === "connected" || !call.livekitRoomName)
      recoveryStarted.current = null;
    if (
      call.mediaState !== "disconnected" ||
      !call.callId ||
      !call.livekitRoomName
    )
      return;
    recoveryStarted.current ??= Date.now();
    const roomName = call.livekitRoomName,
      generation = call.mediaGeneration;
    return scheduleCallRecovery(
      () => dispatch(restoreCallSession()),
      () => dispatch(callActions.mediaSessionEnded({ roomName, generation })),
      recoveryStarted.current,
      Number(import.meta.env.VITE_CALL_RECOVERY_MS) || 90000,
    );
  }, [
    dispatch,
    call.mediaState,
    call.callId,
    call.livekitRoomName,
    call.mediaGeneration,
  ]);

  const isCallActive =
    call.status === "connecting" || call.status === "in_call";
  const isExpanded = call.presentationMode === "expanded";
  const isMinimized = call.presentationMode === "minimized";
  const isHidden = call.presentationMode === "hidden";
  const isCinemaMode = call.isTheaterMode;
  useEffect(() => {
    if (call.mediaOwnership !== "TRANSFERRING" || !call.callId) return;
    const callId = call.callId;
    let stopped = false,
      timer: ReturnType<typeof setTimeout>,
      failures = 0;
    const deadline = setTimeout(() => {
      stopped = true;
      clearTimeout(timer);
      dispatch(callActions.mediaTransferTimedOut(callId));
    }, 30000);
    const attempt = async () => {
      if (stopped || store.getState().call.mediaOwnership !== "TRANSFERRING")
        return;
      const result = await dispatch(takeCallHere(callId));
      if (stopped || store.getState().call.mediaOwnership !== "TRANSFERRING")
        return;
      if (takeCallHere.fulfilled.match(result)) failures = 0;
      else failures++;
      timer = setTimeout(() => void attempt(), mediaRenewRetryDelay(failures));
    };
    void attempt();
    return () => {
      stopped = true;
      clearTimeout(timer);
      clearTimeout(deadline);
    };
  }, [dispatch, store, call.mediaOwnership, call.callId]);

  useEffect(() => {
    if (call.chatRoomId !== null) {
      dispatch(getActiveCall(call.chatRoomId));
    }
  }, [dispatch, call.chatRoomId]);

  const roomOptions: RoomOptions = useMemo(() => {
    return {
      // Keep the existing audio-element playback path and make LiveKit close
      // its AudioContext as part of Room teardown.
      webAudioMix: false,
      audioCaptureDefaults: {
        autoGainControl: false,
        echoCancellation: false,
        noiseSuppression: false,
        voiceIsolation: false,
        channelCount: 1,
        sampleRate: 48000,
        sampleSize: 16,
      },
      adaptiveStream: true,
      dynacast: true,
      publishDefaults: {
        videoCodec: "av1",
        scalabilityMode: "L3T3_KEY",
        backupCodec: { codec: "vp8" },
        backupCodecPolicy: BackupCodecPolicy.PREFER_REGRESSION,
        dtx: true,
        red: true,
        simulcast: true,
      },
    };
  }, []);

  if (
    call.callId &&
    !call.participantToken &&
    (call.mediaOwnership === "PASSIVE" ||
      call.mediaOwnership === "TRANSFERRING")
  ) {
    return (
      <div
        className={
          isExpanded
            ? `${styles["call-shell"]} ${styles["passive-stage"]}`
            : styles["passive-card"]
        }
        role="status"
      >
        <span>
          {call.mediaOwnership === "TRANSFERRING"
            ? "Освобождаем звонок на другом клиенте…"
            : "Звонок открыт на другом клиенте"}
        </span>
        <button
          type="button"
          disabled={call.mediaOwnership === "TRANSFERRING"}
          onClick={() => dispatch(takeCallHere(call.callId!))}
        >
          Перенести звонок сюда
        </button>
        {call.error && <span role="alert">{call.error}</span>}
        {isExpanded && (
          <button
            type="button"
            onClick={() =>
              dispatch(callActions.setPresentationMode("minimized"))
            }
          >
            Вернуться к перепискам
          </button>
        )}
      </div>
    );
  }
  if (!isCallActive || !call.serverUrl || !call.participantToken) {
    return null;
  }

  const handleOpenChat = () => {
    if (!call.chatRoomId) return;
    navigate(`/dm?roomId=${call.chatRoomId}`);
  };

  return (
    <>
      <LiveKitRoom
        key={`${call.livekitRoomName}:${call.mediaGeneration}`}
        serverUrl={call.serverUrl}
        token={call.participantToken}
        connect={true}
        options={roomOptions}
        className={styles["host-room"]}
        onError={handleConnectionError}
      >
        <CallMicrophoneProvider
          callId={call.callId ?? "unknown"}
          generation={call.mediaGeneration}
        >
          {call.callId && (
            <CallMediaOwner
              callId={call.callId}
              generation={call.mediaGeneration}
            />
          )}
          {import.meta.env.DEV &&
            import.meta.env.VITE_MEDIA_DIAGNOSTICS === "true" && (
              <MediaDiagnostics
                callId={call.callId}
                generation={call.mediaGeneration}
              />
            )}
          <CallLifecycle
            roomName={call.livekitRoomName!}
            generation={call.mediaGeneration}
          />
          {import.meta.env.VITE_LIVEKIT_DEBUG === "true" && <CodecDebugLayer />}
          <CallAudioLayer />
          <CallHotkeys />
          <MicrophoneSettingsSync />
          <MicrophoneProcessorSync />

          {
            <div
              hidden={!isExpanded}
              inert={!isExpanded}
              data-call-stage
              className={[
                styles["call-shell"],
                call.isCallFocusMode ? styles["call-shell-focus"] : "",
                isCinemaMode ? styles["call-shell-cinema"] : "",
              ].join(" ")}
            >
              <div className={styles["room-container"]}>
                {call.mediaState !== "connected" && (
                  <span className={styles['recovery-status']} role="status">Восстанавливаем соединение…</span>
                )}
                <CallUi
                  visible={isExpanded}
                  hasChat={Boolean(call.chatRoomId)}
                  isFocusMode={call.isCallFocusMode}
                  isCinemaMode={call.isTheaterMode}
                  onHide={() =>
                    dispatch(callActions.setPresentationMode("minimized"))
                  }
                  onMinimize={() =>
                    dispatch(callActions.setPresentationMode("minimized"))
                  }
                  onToggleCinema={() =>
                    dispatch(callActions.setTheaterMode(!call.isTheaterMode))
                  }
                />
              </div>
            </div>
          }

          {(
            <MiniCallDock
              visible={isMinimized || isHidden}
              hasChat={Boolean(call.chatRoomId)}
              onOpenChat={handleOpenChat}
              onExpand={() =>
                dispatch(callActions.setPresentationMode("expanded"))
              }
              onEnd={() => {
                if (call.conferenceCode) {
                  if (call.isConferenceHost) dispatch(endConference(call.conferenceCode));
                  else dispatch(callActions.leaveCallLocally());
                  return;
                }
                const isHost = Boolean(
                  myUsername && call.hostUsername === myUsername,
                );
                const type =
                  call.roomType === "PRIVATE" || isHost
                    ? "call/sendEnd"
                    : "call/sendLeave";
                dispatch({
                  type,
                  payload: {
                    callId: call.callId,
                    chatRoomId: call.chatRoomId ?? undefined,
                  },
                });
                dispatch(callActions.endCallLocally());
              }}
            />
          )}
        </CallMicrophoneProvider>
      </LiveKitRoom>
    </>
  );
}
