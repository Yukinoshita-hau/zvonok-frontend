import { X } from "lucide-react";
import { DmChat } from "../../pages/DmChat/DmChat";
import styles from "./CallUi.module.css";

export function CallChatPanel({
  roomId,
  onClose,
}: {
  roomId: number;
  onClose: () => void;
}) {
  return (
    <aside className={styles["call-chat-panel"]} aria-label="Чат звонка">
      <div className={styles["call-chat-header"]}>
        <span>Переписка звонка</span>
        <button
          type="button"
          onClick={onClose}
          title="Закрыть чат"
          aria-label="Закрыть чат"
        >
          <X size={16} />
        </button>
      </div>
      <DmChat key={roomId} embeddedRoomId={roomId} />
    </aside>
  );
}
