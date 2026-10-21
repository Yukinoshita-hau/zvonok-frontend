import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { File, Image, Film, Music, Download, CornerUpLeft, X } from 'lucide-react';
import type { AttachmentCategory, RoomAttachmentItem } from '../../api/roomAttachmentsApi';
import { useRoomAttachments } from '../../hooks/useRoomAttachments';
import { useModalFocus } from '../../hooks/useModalFocus';
import { useVirtualRows } from '../DmItemsList/useVirtualRows';
import { downloadAttachmentOriginal } from '../../api/messageAttachmentsApi';
import styles from './RoomAttachments.module.css';
import { ImagePreview } from './ImagePreview';

const AttachmentViewer = lazy(() => import('../MessageAttachments/AttachmentViewer'));
const categories: [AttachmentCategory, string][] = [['all', 'Все'], ['media', 'Медиа'], ['image', 'Изображения'], ['video', 'Видео'], ['document', 'Файлы'], ['audio', 'Аудио']];
export function RoomAttachments({ roomId, onClose, onJump }: { roomId: number; onClose: () => void; onJump: (id: number) => void }) {
  const [category, setCategory] = useState<AttachmentCategory>('media');
  const [query, setQuery] = useState('');
  const [filenameQuery, setFilenameQuery] = useState('');
  const [sortDirection, setSort] = useState<'asc' | 'desc'>('desc');
  const [viewer, setViewer] = useState<RoomAttachmentItem | null>(null);
  const [downloadId, setDownloadId] = useState<number | null>(null);
  const [downloadError, setDownloadError] = useState('');
  const download = useRef<AbortController | null>(null);
  useEffect(() => () => download.current?.abort(), []);
  useEffect(() => { const timer = setTimeout(() => setFilenameQuery(query.trim()), 300); return () => clearTimeout(timer); }, [query]);
  const data = useRoomAttachments(roomId, { category, filenameQuery, sortDirection });
  useEffect(() => { if (data.error) setViewer(null); }, [data.error]);
  const modal = useModalFocus(true, onClose);
  const scroll = useRef<HTMLDivElement>(null);
  const [columns, setColumns] = useState(4);
  const grid = ['media', 'image', 'video'].includes(category);
  useEffect(() => {
    if (!scroll.current) return;
    const observer = new ResizeObserver(([entry]) => setColumns(Math.max(1, Math.floor(entry.contentRect.width / 160))));
    observer.observe(scroll.current); return () => observer.disconnect();
  }, []);
  const rows = useMemo(() => {
    const count = grid ? columns : 1;
    return Array.from({ length: Math.ceil(data.items.length / count) }, (_, index) => ({ key: String(data.items[index * count].attachment.id), type: 'attachment', items: data.items.slice(index * count, index * count + count) }));
  }, [data.items, columns, grid]);
  const windowed = useVirtualRows(rows, scroll, false, undefined, 1);
  useEffect(() => { if (scroll.current) scroll.current.scrollTop = 0; }, [category, filenameQuery, sortDirection]);
  const save = async (item: RoomAttachmentItem) => {
    if (download.current) return;
    const controller = new AbortController(); download.current = controller; setDownloadId(item.attachment.id); setDownloadError('');
    try { await downloadAttachmentOriginal(item.attachment, controller.signal); }
    catch { if (!controller.signal.aborted) setDownloadError('Не удалось скачать файл'); }
    finally { if (!controller.signal.aborted) setDownloadId(null); download.current = null; }
  };
  return createPortal(<div className={styles.overlay}><section className={styles.panel} role="dialog" aria-modal="true" aria-label="Медиа и файлы" tabIndex={-1} ref={modal}>
    <header><h2>Медиа и файлы</h2><button onClick={onClose} aria-label="Закрыть библиотеку"><X size={18} /></button></header>
    <nav aria-label="Тип вложений">{categories.map(([value, label]) => <button key={value} aria-pressed={category === value} onClick={() => setCategory(value)}>{label}</button>)}</nav>
    <div className={styles.filters}><input aria-label="Поиск по имени файла" placeholder="Найти файл…" maxLength={128} value={query} onChange={event => setQuery(event.target.value)} />{query && <button aria-label="Очистить поиск" onClick={() => setQuery('')}><X size={16} /></button>}
      <select aria-label="Сортировка по дате" value={sortDirection} onChange={event => setSort(event.target.value as 'asc' | 'desc')}><option value="desc">Сначала новые</option><option value="asc">Сначала старые</option></select></div>
    {downloadError && <p role="alert">{downloadError}</p>}
    <div className={styles.results} ref={scroll} aria-busy={data.loading}>
      <div style={windowed.enabled ? { position: 'relative', height: windowed.total } : undefined}>
        {windowed.rows.map(({ item: row, index }) => <div key={row.key} data-virtual-key={row.key} ref={element => windowed.bind(row.key, element)} className={grid ? styles.grid : styles.list} style={{ ...(grid ? { gridTemplateColumns: `repeat(${columns}, minmax(0,1fr))` } : {}), ...(windowed.enabled ? { position: 'absolute', width: '100%', top: windowed.offsets[index] } : {}) }}>
          {row.items.map(item => {
            const a = item.attachment;
            const Icon = a.type === 'IMAGE' ? Image : ['VIDEO', 'VIDEO_NOTE'].includes(a.type) ? Film : a.type === 'AUDIO' ? Music : File;
            return <article key={a.id} className={grid ? styles.tile : styles.file}>
              <button className={styles.open} onClick={() => setViewer(item)} aria-label={`Открыть ${a.originalFileName}`}>
                <span className={styles.preview}>{grid && a.type === 'IMAGE' ? <ImagePreview attachment={a} paused={!!viewer} /> : <Icon size={grid ? 28 : 22} />}{a.durationMs != null && <small>{Math.floor(a.durationMs / 60000)}:{String(Math.floor(a.durationMs / 1000) % 60).padStart(2, '0')}</small>}</span>
                <span className={styles.copy}><strong title={a.originalFileName}>{a.originalFileName}</strong><small>{a.contentType} · {new Intl.NumberFormat('ru', { maximumFractionDigits: 1 }).format(a.sizeBytes / 1024)} КиБ</small><small className={styles.byline} title={`${item.authorName} · ${new Date(item.sentAt).toLocaleString('ru')}`}><span>{item.authorName}</span><time dateTime={item.sentAt}>{new Date(item.sentAt).toLocaleDateString('ru')}</time></small></span>
              </button>
              <div className={styles.actions}><button disabled={downloadId !== null} onClick={() => void save(item)} aria-label={`Скачать ${a.originalFileName}`} title="Скачать оригинал"><Download size={15} /></button><button onClick={() => onJump(item.messageId)} aria-label={`Перейти к сообщению: ${a.originalFileName}`} title="Перейти к сообщению"><CornerUpLeft size={15} /></button></div>
            </article>;
          })}
        </div>)}
      </div>
      {data.loading && <p role="status">Загрузка файлов…</p>}
      {data.error ? <p role="alert">{data.error} <button onClick={data.refresh}>Повторить</button></p> : !data.loading && !data.items.length && <p>Файлы не найдены</p>}
      {data.nextCursor && <button className={styles.more} disabled={data.loading} onClick={data.more}>Показать ещё</button>}
    </div>
    {viewer && <Suspense fallback={<p role="status">Загрузка просмотрщика…</p>}><AttachmentViewer key={viewer.attachment.id} attachments={[viewer.attachment]} initial={0} author={viewer.authorName} date={viewer.sentAt} onClose={() => setViewer(null)} /></Suspense>}
  </section></div>, document.body);
}
