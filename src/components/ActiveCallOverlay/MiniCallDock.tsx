import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { GripHorizontal, Maximize2, MessageSquare, MonitorUp, PhoneOff, Users, Video, ExternalLink } from "lucide-react";
import { useDispatch, useSelector } from "react-redux";
import { useLocation } from "react-router-dom";
import type { RootState } from "../../store/store";
import { callActions } from "../../store/slices/call.slice";
import { resolveMediaUrl } from "../../utils/mediaUrl";
import { useCallParticipants } from "../CallUi/hooks/useCallParticipants";
import { clampDock, snapDock } from "./dockPosition";
import { MicrophoneToggleButton } from "../CallUi/MicrophoneToggleButton";
import styles from "./ActiveCallOverlay.module.css";
import { MiniSpeakingStatus } from "./MiniSpeakingStatus";
import { ExternalCallDockBridge } from './ExternalCallDockBridge';

interface MiniCallDockProps {
  visible?: boolean;
  hasChat: boolean;
  onOpenChat: () => void;
  onExpand: () => void;
  onEnd: () => void;
}

export function MiniCallDock({ visible = true, hasChat, onOpenChat, onExpand, onEnd }: MiniCallDockProps) {
  const dispatch = useDispatch();
  const location = useLocation();
  const call = useSelector((state: RootState) => state.call);
  const chat = useSelector((state: RootState) => state.room.rooms.find(r => r.id === call.chatRoomId));
  const { participantCards, availableScreenTracks } = useCallParticipants();
  const people = participantCards.filter(c => !c.isScreenShareCard);
  const remote = people.find(c => !c.participant.isLocal);
  const screen = availableScreenTracks[0];
  const camera = people.find(c => c.videoTrack);
  const mediaSource = screen?.participant.name || camera?.displayName;
  const title = chat?.name || (call.roomType === "GROUP" ? "Групповой звонок" : call.peerUsernames.join(", ") || remote?.displayName || "Звонок");
  const avatar = resolveMediaUrl(chat?.avatarUrl || remote?.avatarUrl);
  const inCallChat = location.pathname === "/dm" && new URLSearchParams(location.search).get("roomId") === String(call.chatRoomId);
  const [elapsed, setElapsed] = useState(0);
  const dock = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; left: number; top: number; width: number; height: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const [position, setPosition] = useState<{ x: number; y: number } | null>(() => {
    try { const p = JSON.parse(localStorage.getItem("zvonok.callDock") || "null"); return p && Number.isFinite(p.x) && Number.isFinite(p.y) ? { x: p.x, y: p.y } : null; } catch { return null; }
  });
  const currentPosition = useRef(position);
  const move = (p: { x: number; y: number } | null, persist = false) => {
    currentPosition.current = p; setPosition(p);
    if (persist) {
      try { if (p) localStorage.setItem("zvonok.callDock", JSON.stringify(p)); else localStorage.removeItem("zvonok.callDock"); } catch { /* Storage may be unavailable. */ }
    }
  };
  useEffect(() => {
    if (!visible) return;
    const tick = () => setElapsed(call.callStartedAtMs ? Math.max(0, Math.floor((Date.now() - call.callStartedAtMs) / 1000)) : 0);
    tick(); const timer = window.setInterval(tick, 1000); return () => clearInterval(timer);
  }, [call.callStartedAtMs, visible]);
  useLayoutEffect(() => {
    const clamp = () => {
      const p = currentPosition.current, rect = dock.current?.getBoundingClientRect();
      if (!p || !rect?.width || !visible) return;
      const next = clampDock(p.x, p.y, rect.width, rect.height, innerWidth, innerHeight);
      if (next.x !== p.x || next.y !== p.y) move(next, true);
    };
    const observer = new ResizeObserver(clamp);
    if (dock.current) observer.observe(dock.current);
    window.addEventListener("resize", clamp); window.visualViewport?.addEventListener("resize", clamp);
    clamp(); return () => { observer.disconnect(); window.removeEventListener("resize", clamp); window.visualViewport?.removeEventListener("resize", clamp); };
  }, [visible, Boolean(position)]);
  const finishDrag = (snap: boolean) => {
    const start = drag.current, p = currentPosition.current;
    drag.current = null; setDragging(false);
    if (start && p) move(snap ? snapDock(p.x, p.y, start.width, start.height, innerWidth, innerHeight) : p, true);
  };
  const expand = () => {
    onExpand();
    requestAnimationFrame(() => document.querySelector<HTMLButtonElement>('[data-call-stage] [aria-label="Свернуть звонок"]')?.focus({ preventScroll: true }));
  };
  const watch = () => {
    if (screen) {
      dispatch(callActions.setSelectedScreenTrackSid(screen.publication.trackSid));
      dispatch(callActions.setContentPresentation({ primaryKey: `screen:${screen.publication.trackSid}`, sourceManual: true }));
    }
    dispatch(callActions.setLayoutIntent(screen ? "screen" : "grid")); expand();
  };
  const connected = call.mediaState === "connected";
  return (
    <>
    {window.zvonokDesktop?.dock && <ExternalCallDockBridge title={title} onEnd={onEnd} />}
    <div ref={dock} className={styles["mini-dock"]} data-call-dock data-floating={Boolean(position)} data-dragging={dragging}
      hidden={!visible} inert={!visible} aria-label="Панель звонка"
      style={position ? { left: position.x, top: position.y, bottom: "auto" } : undefined}>
      <header className={styles["dock-header"]}>
        <span className={styles["dock-avatar"]} aria-hidden="true">{avatar ? <img src={avatar} alt="" /> : call.roomType === "GROUP" ? <Users size={18} /> : title[0]?.toUpperCase()}</span>
        <strong className={styles["dock-title"]} title={title}>{title}</strong>
        <span className={styles["dock-timer"]} aria-label="Длительность звонка">{Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, "0")}</span>
        <button type="button" className={styles["dock-drag"]} aria-label="Переместить панель звонка" title="Перетащите или используйте стрелки. Home — вернуть в sidebar"
          onDoubleClick={() => move(null, true)}
          onPointerDown={event => {
            if (event.button !== 0 || innerWidth < 700) return;
            const rect = dock.current!.getBoundingClientRect();
            drag.current = { x: event.clientX, y: event.clientY, left: rect.left, top: rect.top, width: Math.min(296, innerWidth - 16), height: rect.height };
            setDragging(true); event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={event => { const start = drag.current; if (start) move(clampDock(start.left + event.clientX - start.x, start.top + event.clientY - start.y, start.width, start.height, innerWidth, innerHeight)); }}
          onPointerUp={event => { finishDrag(true); if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); }}
          onPointerCancel={() => finishDrag(false)} onLostPointerCapture={() => finishDrag(false)}
          onKeyDown={event => {
            if (event.key === "Home") { event.preventDefault(); move(null, true); return; }
            const delta = { ArrowLeft: [-16, 0], ArrowRight: [16, 0], ArrowUp: [0, -16], ArrowDown: [0, 16] }[event.key];
            if (!delta || innerWidth < 700) return;
            const rect = dock.current!.getBoundingClientRect(); event.preventDefault();
            move(clampDock(rect.left + delta[0], rect.top + delta[1], Math.min(296, innerWidth - 16), rect.height, innerWidth, innerHeight), true);
          }}><GripHorizontal size={18} /></button>
      </header>
      <div className={styles["dock-live"]} data-recovering={!connected}>
        <div role="status" hidden={connected} className={styles["dock-connection"]}>{call.mediaState === "connecting" ? "Подключение…" : "Восстанавливаем соединение…"}</div>
        <div hidden={!connected}><MiniSpeakingStatus /></div>
      </div>
      <div className={styles["dock-media"]} hidden={!screen && !camera} inert={!screen && !camera}>
        <button type="button" onClick={watch} title={mediaSource} aria-label={screen ? "Смотреть трансляцию" : "Смотреть видео"}>
          {screen ? <MonitorUp size={16} /> : <Video size={16} />}
          <span>{screen ? "Смотреть трансляцию" : "Смотреть видео"}<small>{mediaSource}</small></span><Maximize2 size={14} />
        </button>
      </div>
      <div className={styles["mini-actions"]}>
        {window.zvonokDesktop?.dock && <button type="button" className={styles['mini-button']} aria-label="Вынести панель звонка" title="Вынести панель звонка" onClick={() => { void window.zvonokDesktop!.dock!.open().catch(() => window.alert('Не удалось открыть панель звонка. Повторите.')); }}><ExternalLink size={18} /></button>}
        <MicrophoneToggleButton className={`${styles["mini-button"]} ${styles["mini-mic-button"]}`} enabledLabel="" disabledLabel="" showIcon iconSize={19} />
        {hasChat && !inCallChat && <button type="button" className={styles["mini-button"]} aria-label="Чат звонка" title="Чат звонка" data-tooltip="Чат звонка" onClick={onOpenChat}><MessageSquare size={19} /></button>}
        <button type="button" className={styles["mini-button"]} aria-label="Развернуть" title="Развернуть звонок" data-tooltip="Развернуть звонок" onClick={expand}><Maximize2 size={19} /></button>
        <button type="button" className={styles["mini-leave"]} aria-label="Завершить" title="Завершить звонок" data-tooltip="Завершить звонок" onClick={onEnd}><PhoneOff size={19} /></button>
      </div>
    </div>
    </>
  );
}
