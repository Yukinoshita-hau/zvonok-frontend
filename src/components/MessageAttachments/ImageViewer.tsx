import { useEffect, useRef, useState } from 'react';
import styles from './AttachmentViewer.module.css';

export default function ImageViewer({ url, name, onError }: { url: string; name: string; onError: () => void }) {
  const stage = useRef<HTMLDivElement>(null);
  const image = useRef<HTMLImageElement>(null);
  const drag = useRef<{ x: number; y: number; left: number; top: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [loading, setLoading] = useState(true);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  useEffect(() => {
    const element = image.current;
    if (!element) return;
    element.src = url;
    return () => { element.removeAttribute('src'); };
  }, [url]);
  const reset = () => { setZoom(1); setOffset({ x: 0, y: 0 }); };
  const clampOffset = (x: number, y: number, scale: number) => {
    const box = stage.current, img = image.current;
    const mx = Math.max(0, ((img?.clientWidth ?? 0) * scale - (box?.clientWidth ?? 0)) / 2);
    const my = Math.max(0, ((img?.clientHeight ?? 0) * scale - (box?.clientHeight ?? 0)) / 2);
    return { x: Math.max(-mx, Math.min(mx, x)), y: Math.max(-my, Math.min(my, y)) };
  };
  const scaleTo = (value: number, x = 0, y = 0) => {
    const next = Math.max(1, Math.min(8, value)), ratio = next / zoom;
    setOffset(clampOffset(x - (x - offset.x) * ratio, y - (y - offset.y) * ratio, next)); setZoom(next);
  };
  return <><div className={styles.toolbar}>
    <button onClick={() => scaleTo(zoom / 1.25)} aria-label="Уменьшить изображение">−</button><span>{Math.round(zoom * 100)}%</span>
    <button onClick={() => scaleTo(zoom * 1.25)} aria-label="Увеличить изображение">+</button>
    <button onClick={reset}>Вписать / сбросить</button>
    <button onClick={() => scaleTo((image.current?.naturalWidth ?? 1) / (image.current?.clientWidth || 1))}>Реальный размер</button>
    {loading && <span role="status">Загрузка изображения…</span>}
  </div><div ref={stage} className={styles.imageStage}
    onWheel={event => { const rect = event.currentTarget.getBoundingClientRect(); scaleTo(zoom * (event.deltaY < 0 ? 1.15 : 1 / 1.15), event.clientX - rect.left - rect.width / 2, event.clientY - rect.top - rect.height / 2); }}
    onDoubleClick={event => { const rect = event.currentTarget.getBoundingClientRect(); scaleTo(zoom === 1 ? 2 : 1, event.clientX - rect.left - rect.width / 2, event.clientY - rect.top - rect.height / 2); }}
    onPointerDown={event => { if (event.button !== 0) return; event.currentTarget.setPointerCapture(event.pointerId); drag.current = { x: event.clientX, y: event.clientY, left: offset.x, top: offset.y }; }}
    onPointerMove={event => { if (drag.current) setOffset(clampOffset(drag.current.left + event.clientX - drag.current.x, drag.current.top + event.clientY - drag.current.y, zoom)); }}
    onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}>
    <img ref={image} src={url} crossOrigin="anonymous" referrerPolicy="no-referrer" alt={name} draggable={false} onError={onError} onLoad={() => setLoading(false)}
      style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})` }} />
  </div></>;
}
