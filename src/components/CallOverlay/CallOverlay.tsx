import { useDispatch, useSelector } from "react-redux";
import { useEffect, useState, useRef } from "react";
import cn from "classnames";
import { Phone } from "lucide-react";
import styles from "./CallOverlay.module.css";
import type { AppDispatch, RootState } from "../../store/store";
import { callActions } from "../../store/slices/call.slice";
import { CallJoinDevices } from "./CallJoinDevices";
import { soundPlayer } from "../../utils/soundPlayer";
import { notificationPresentation } from '../../utils/notificationPolicy';

export function CallOverlay() {
  const call = useSelector((s: RootState) => s.call);
  const soundsEnabled = useSelector((s: RootState) => notificationPresentation(s.device, 'call').sound);
  const dispatch = useDispatch<AppDispatch>();
  const accepting = useRef(false);
  const [showSetup, setShowSetup] = useState(false);
  const rooms = useSelector((s: RootState) => s.room.rooms);
  const users = useSelector((s: RootState) => s.users.byId);
  const wsStatus = useSelector((s: RootState) => s.websocket.status);
  const me = useSelector((s: RootState) => s.user.myUser);
  const target = rooms.find((r) => r.id === call.chatRoomId);
  const title =
    target?.type === "GROUP"
      ? target.name
      : target?.memberIds
          .filter((id) => id !== me?.id)
          .map((id) => users[id]?.displayName || users[id]?.username)
          .filter(Boolean)
          .join(", ");
  useEffect(() => {
    accepting.current = false;
    setShowSetup(false);
  }, [call.callId, call.status, wsStatus]);

  useEffect(() => {
    if (call.status === "incoming_ringing" && soundsEnabled) {
      soundPlayer.startCallRingtone();
    } else {
      soundPlayer.stopCallRingtone();
    }

    return () => {
      soundPlayer.stopCallRingtone();
    };
  }, [call.status, soundsEnabled]);

  const isIncoming = call.status === "incoming_ringing";
  const isOutgoing = call.status === "outgoing_ringing";

  if (!isIncoming && !isOutgoing) return null;

  const handleAccept = () => {
    if (!call.callId || accepting.current) return;
    accepting.current = true;

    dispatch({
      type: "call/sendAccept",
      payload: {
        callId: call.callId,
        chatRoomId: call.chatRoomId ?? undefined,
      },
    });
  };

  const handleDecline = () => {
    if (call.callId) {
      dispatch({
        type: "call/sendDecline",
        payload: {
          callId: call.callId,
          chatRoomId: call.chatRoomId ?? undefined,
        },
      });
    }
    dispatch(callActions.endCall());
  };

  if (isOutgoing) {
    return (
      <div className={styles["outgoing-card"]}>
        <div className={styles["outgoing-copy"]}>
          <div className={styles["outgoing-title"]}>
            Вызов · {title || "Участник"}
          </div>
          <div className={styles["outgoing-subtitle"]}>Ожидаем ответа…</div>
        </div>
        <button
          className={cn(styles["btn"], styles["decline-button"])}
          disabled={!call.callId}
          onClick={handleDecline}
          aria-label={isOutgoing ? "Отменить вызов" : "Отклонить"}
          title={isOutgoing ? "Отменить вызов" : "Отклонить"}
        >
          <Phone color="white" size={20} />
        </button>
      </div>
    );
  }

  return (
    <div
      className={styles["backdrop"]}
      role="region"
      aria-label="Входящий звонок"
    >
      <div className={styles["modal"]} onClick={(e) => e.stopPropagation()}>
        <div className={styles["header"]}>
          Входящий звонок · {title || call.callerUsername}
        </div>

        <button
          type="button"
          className={styles["setup-toggle"]}
          onClick={() => setShowSetup((v) => !v)}
          aria-expanded={showSetup}
        >
          Устройства перед входом
        </button>
        {showSetup && <CallJoinDevices />}
        <div className={styles["body"]}>
          <button
            className={cn(styles["btn"], styles["accept-button"])}
            disabled={wsStatus !== "connected"}
            onClick={handleAccept}
            aria-label="Принять"
            title="Принять"
          >
            <Phone color="white" size={20} />
          </button>

          <button
            className={cn(styles["btn"], styles["decline-button"])}
            disabled={!call.callId}
            onClick={handleDecline}
            aria-label={isOutgoing ? "Отменить вызов" : "Отклонить"}
            title={isOutgoing ? "Отменить вызов" : "Отклонить"}
          >
            <Phone color="white" size={20} />
          </button>
        </div>
      </div>
    </div>
  );
}
