import { memo, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useDispatch, useSelector } from "react-redux";
import { callActions } from "../../store/slices/call.slice";
import type { RootState } from "../../store/store";
import type { ParticipantCard } from "./hooks/useCallParticipants";
import { useContainerSize } from "./hooks/useContainerSize";
import { CallParticipantTile } from "./CallParticipantTile";
import { clampPan, clampSplitRatio, contentOrientation, resizeSplitWithKey, splitOrientation, zoomGeometry } from "./contentGeometry";
import type { MediaSourcePresentation, ParticipantPresentation } from "./sourcePresentation";
import styles from "./ContentView.module.css";
import type { ParticipantContextMenuAnchor } from "./ParticipantsGrid";

const statusLabels = { available: "", paused: "Трансляция приостановлена", reconnecting: "Источник недоступен · Восстанавливаем соединение…", loading: "Ожидаем видео…" };

const SourceSurface = memo(function SourceSurface({ source, cinema }: { source: MediaSourcePresentation; cinema: boolean }) {
  const { ref, width, height } = useContainerSize();
  const [zoom, setZoom] = useState<number | "fit">("fit");
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);
  const [actualSize, setActualSize] = useState<{ width: number; height: number } | null>(null);
  const reset = () => { setZoom("fit"); setPan({ x: 0, y: 0 }); };
  useEffect(() => { reset(); setActualSize(null); }, [source.key, cinema]);
  const sw = actualSize?.width || source.width || 1920;
  const sh = actualSize?.height || source.height || sw / source.aspectRatio;
  const fitGeometry = zoomGeometry(width, height, sw, sh, "fit");
  const geometry = zoomGeometry(width, height, sw, sh, source.type === "screen" ? zoom : "fit");
  const x = clampPan(pan.x, geometry.panX), y = clampPan(pan.y, geometry.panY);
  const screen = source.type === "screen";
  const state = source.availability === "paused" && !screen ? "Камера выключена" : statusLabels[source.availability];
  const measureVideo = useCallback((videoWidth: number, videoHeight: number) => {
    setActualSize(previous => previous?.width === videoWidth && previous?.height === videoHeight
      ? previous : { width: videoWidth, height: videoHeight });
  }, []);
  const videoTile = useMemo(() => <CallParticipantTile cardId={`content:${source.key}`} participant={source.card.participant}
    videoTrack={source.trackRef} avatarUrl={source.card.avatarUrl} displayName={source.displayName}
    isScreenShareCard={source.type === "screen"} className={styles.tile} onVideoDimensions={measureVideo} />, [source, measureVideo]);
  return <section className={styles.source} data-content-source={source.key}>
    <header className={styles.sourceHeader} data-cinema-toolbar>
      <span title={source.displayName}>{source.displayName}</span>
      {screen && <>
        <select aria-label={`Масштаб: ${source.displayName}`} value={zoom} onChange={e => {
          setZoom(e.target.value === "fit" ? "fit" : Number(e.target.value)); setPan({ x: 0, y: 0 });
        }}>
          <option value="fit">Fit</option><option value="100">100%</option><option value="125">125%</option><option value="150">150%</option>
        </select>
        <button type="button" onClick={reset} aria-label={`Сбросить масштаб: ${source.displayName}`}>Reset</button>
      </>}
    </header>
    <div ref={ref} className={styles.viewport} data-zoom={zoom} data-panning={Boolean(drag.current)}
      tabIndex={screen ? 0 : undefined} aria-label={screen ? `Область трансляции ${source.displayName}. Стрелки — перемещение, Home — Fit` : undefined}
      onDoubleClick={screen ? reset : undefined}
      onPointerDown={e => {
        if (!screen || zoom === "fit" || e.button !== 0) return;
        e.preventDefault(); e.currentTarget.focus();
        drag.current = { x: e.clientX, y: e.clientY, panX: x, panY: y };
        e.currentTarget.setPointerCapture(e.pointerId);
      }}
      onPointerMove={e => {
        const start = drag.current;
        if (start) setPan({ x: clampPan(start.panX + e.clientX - start.x, geometry.panX), y: clampPan(start.panY + e.clientY - start.y, geometry.panY) });
      }}
      onPointerUp={e => { drag.current = null; if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId); }}
      onPointerCancel={() => { drag.current = null; }} onLostPointerCapture={() => { drag.current = null; }}
      onKeyDown={e => {
        if (!screen) return;
        if (e.key === "Home") { e.preventDefault(); reset(); return; }
        const delta = { ArrowLeft: [40, 0], ArrowRight: [-40, 0], ArrowUp: [0, 40], ArrowDown: [0, -40] }[e.key];
        if (!delta || zoom === "fit") return;
        e.preventDefault(); setPan({ x: clampPan(x + delta[0], geometry.panX), y: clampPan(y + delta[1], geometry.panY) });
      }}>
      <div className={styles.surface} style={screen ? { width: fitGeometry.width, height: fitGeometry.height,
        transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px)) scale(${fitGeometry.width ? geometry.width / fitGeometry.width : 1})` } : undefined}>
        {videoTile}
      </div>
      {state && <div role="status" className={styles.status}>{state}</div>}
    </div>
  </section>;
});

function SourcePicker({ sources, value, exclude, label, onChange }: {
  sources: MediaSourcePresentation[]; value: string; exclude?: string; label: string; onChange: (key: string) => void;
}) {
  return <label className={styles.picker}><span>{label}</span><select aria-label={label} value={value} onChange={e => onChange(e.target.value)}>
    {sources.map(s => <option key={s.key} value={s.key} disabled={s.key === exclude}>
      {s.displayName}{s.availability !== "available" ? ` · ${s.availability === "paused" ? "Пауза" : "Ожидание"}` : ""}
    </option>)}
  </select></label>;
}

export function ContentView({ sources, people, primary, secondary, cinema, onOpenCard, onOpenContextMenu, volumeControl }: {
  sources: MediaSourcePresentation[]; people: ParticipantPresentation[]; cinema: boolean;
  primary: MediaSourcePresentation | null; secondary: MediaSourcePresentation | null;
  onOpenCard: (card: ParticipantCard) => void; volumeControl?: ReactNode;
  onOpenContextMenu?: (card: ParticipantCard, anchor: ParticipantContextMenuAnchor) => void;
}) {
  const dispatch = useDispatch();
  const intent = useSelector((s: RootState) => s.call.content);
  const { ref, width, height } = useContainerSize();
  const splitBox = useContainerSize();
  const splitRef = useRef<HTMLDivElement>(null);
  const dividerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const ratioRef = useRef(intent.ratio);
  const [stripPage, setStripPage] = useState(0);
  const [smallStripExpanded, setSmallStripExpanded] = useState(false);
  const compactStrip = width < 560 || height < 320;
  const stripHidden = intent.stripHidden || (compactStrip && !smallStripExpanded);
  const patch = (value: Parameters<typeof callActions.setContentPresentation>[0]) => dispatch(callActions.setContentPresentation(value));
  const split = intent.split && Boolean(secondary);
  const orientation = splitOrientation(splitBox.width, splitBox.height,
    [primary?.aspectRatio ?? 16 / 9, secondary?.aspectRatio ?? 16 / 9], intent.arrangement);
  const stripSide = contentOrientation(width, height) === "side";
  const capacity = stripSide ? Math.max(1, Math.floor((height - 44) / 104)) : Math.max(1, Math.floor(width / 130));
  // A camera already visible in Split represents its person; do not decode it twice in the strip.
  const stripPeople = people.filter(p => ![primary, ...(split ? [secondary] : [])].some(s => s?.type === "camera" && s.ownerIdentity === p.participantIdentity));
  const pages = Math.max(1, Math.ceil(stripPeople.length / capacity));
  const page = Math.min(stripPage, pages - 1);
  const drawRatio = (value: number) => {
    ratioRef.current = clampSplitRatio(value);
    splitRef.current?.style.setProperty("--split-ratio", `${ratioRef.current}%`);
    dividerRef.current?.setAttribute("aria-valuenow", String(Math.round(ratioRef.current)));
  };
  useEffect(() => { if (!dragging.current) drawRatio(intent.ratio); }, [intent.ratio]);
  const finishDrag = () => {
    if (!dragging.current) return;
    dragging.current = false; patch({ ratio: ratioRef.current });
  };
  if (!primary) return <div role="status">Источник завершён. Выберите камеру или трансляцию.</div>;
  return <div ref={ref} className={styles.content} data-content-view data-strip={stripSide ? "side" : "bottom"}>
    <div className={styles.toolbar} data-cinema-toolbar>
      <SourcePicker sources={sources} value={primary.key} exclude={split ? secondary?.key : undefined} label="Смотреть" onChange={key => patch({ primaryKey: key, sourceManual: true })} />
      <button type="button" aria-pressed={split} disabled={sources.length < 2 && !split} onClick={() => {
        patch(split ? { split: false } : { split: true, secondaryKey: (sources.find(s => s.key !== primary.key && s.ownerIdentity === primary.ownerIdentity && s.type === "camera") ?? sources.find(s => s.key !== primary.key))?.key ?? null });
      }}>Split</button>
      {split && <>
        <SourcePicker sources={sources} value={secondary!.key} exclude={primary.key} label="Второй источник" onChange={key => patch({ secondaryKey: key, sourceManual: true })} />
        <select aria-label="Расположение Split" value={intent.arrangement} onChange={e => patch({ arrangement: e.target.value as typeof intent.arrangement })}>
          <option value="auto">Авто Split</option><option value="side">Рядом</option><option value="stacked">Друг над другом</option>
        </select>
      </>}
      <button type="button" aria-expanded={!stripHidden} onClick={() => {
        if (compactStrip) { setSmallStripExpanded(stripHidden); patch({ stripHidden: false }); }
        else patch({ stripHidden: !intent.stripHidden });
      }}>
        {stripHidden ? "Показать участников" : "Скрыть участников"}
      </button>
      {volumeControl}
    </div>
    <div className={styles.body} data-strip-hidden={stripHidden || cinema || !stripPeople.length}>
      <div ref={splitBox.ref} className={styles.splitBox}>
        <div ref={splitRef} className={styles.split} data-split={split} data-orientation={orientation}
          style={{ "--split-ratio": `${intent.ratio}%` } as CSSProperties}>
          <SourceSurface source={primary} cinema={cinema} />
          <div ref={dividerRef} role="separator" tabIndex={split ? 0 : -1} hidden={!split}
            className={styles.divider} aria-label="Размер областей Split" aria-orientation={orientation === "side" ? "vertical" : "horizontal"}
            aria-valuemin={30} aria-valuemax={70} aria-valuenow={intent.ratio}
            onDoubleClick={() => { drawRatio(50); patch({ ratio: 50 }); }}
            onPointerDown={e => {
              if (e.button !== 0) return;
              e.preventDefault(); e.currentTarget.focus(); dragging.current = true; e.currentTarget.setPointerCapture(e.pointerId);
            }}
            onPointerMove={e => {
              if (!dragging.current || !splitRef.current) return;
              const r = splitRef.current.getBoundingClientRect();
              drawRatio((orientation === "side" ? (e.clientX - r.left) / r.width : (e.clientY - r.top) / r.height) * 100);
            }}
            onPointerUp={e => { finishDrag(); if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId); }}
            onPointerCancel={finishDrag} onLostPointerCapture={finishDrag}
            onKeyDown={e => {
              const value = resizeSplitWithKey(e.key, intent.ratio, orientation === "side");
              if (value === null) return;
              e.preventDefault(); drawRatio(value); patch({ ratio: value });
            }} />
          {split && <SourceSurface source={secondary!} cinema={cinema} />}
        </div>
      </div>
      <aside className={styles.strip} hidden={stripHidden || cinema || !stripPeople.length} aria-label="Участники звонка">
        <div className={styles.people}>
          {stripPeople.slice(page * capacity, (page + 1) * capacity).map(person => <CallParticipantTile
            key={person.participantIdentity} cardId={`person:${person.participantIdentity}`} participant={person.card.participant}
            videoTrack={person.card.videoTrack} avatarUrl={person.card.avatarUrl} displayName={person.displayName}
            className={styles.person} onOpenFocus={() => onOpenCard(person.card)}
            onContextMenu={onOpenContextMenu ? event => {
              event.preventDefault(); event.stopPropagation();
              onOpenContextMenu(person.card, event.currentTarget.getBoundingClientRect());
            } : undefined} />)}
        </div>
        {pages > 1 && <nav className={styles.pagination} aria-label="Страницы участников">
          <button type="button" aria-label="Предыдущие участники" disabled={page === 0} onClick={() => setStripPage(page - 1)}>‹</button>
          <span>{page + 1}/{pages}</span>
          <button type="button" aria-label="Следующие участники" disabled={page === pages - 1} onClick={() => setStripPage(page + 1)}>›</button>
        </nav>}
      </aside>
    </div>
  </div>;
}
