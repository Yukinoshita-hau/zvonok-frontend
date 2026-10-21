import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { MessageAttachment } from '../../api/interfaces/MessageAttachmentDtos';
import { mediaAccessClient } from '../../api/MediaAccessClient';
import type { MediaAccess } from '../../api/MediaAccessClient';
import { downloadAttachmentOriginal } from '../../api/messageAttachmentsApi';
import { useModalFocus } from '../../hooks/useModalFocus';
import { previewKind } from './documentPreview';
import { StreamingAttachment } from './StreamingAttachment';
import styles from './AttachmentViewer.module.css';

const PdfViewer = lazy(() => import('./PdfViewer'));
const ImageViewer = lazy(() => import('./ImageViewer'));
const TextViewer = lazy(() => import('./TextViewer'));

export default function AttachmentViewer({ attachments, initial, author, date, onClose }: { attachments: MessageAttachment[]; initial: number; author?: string; date?: string; onClose: () => void }) {
  const [index, setIndex] = useState(initial);
  const attachment = attachments[index];
  const kind = import.meta.env.VITE_PRIVATE_MEDIA_STREAMING === 'true' ? previewKind(attachment) : 'download';
  const [access, setAccess] = useState<MediaAccess | null>(null);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const [downloading, setDownloading] = useState(false);
  const retries = useRef(0);
  const download = useRef<AbortController | null>(null);
  const modal = useModalFocus(true, onClose);
  useEffect(() => {
    setAccess(previous => previous?.attachmentId === attachment.id ? previous : null); setError('');
    if (kind === 'download' || kind === 'media') return;
    let active = true;
    const lease = mediaAccessClient.acquire(attachment.id);
    void lease.promise.then(value => { if (active) setAccess(value); }).catch(() => { if (active) setError('Файл недоступен'); });
    return () => { active = false; lease.release(); };
  }, [attachment.id, kind, revision]);
  useEffect(() => () => { download.current?.abort(); }, [attachment.id]);
  useEffect(() => {
    if (kind !== 'pdf' || !access || access.attachmentId !== attachment.id) return;
    // Renew before another Range is needed: PDF.js can still be waiting on a failed expired Range.
    const timer = setTimeout(() => {
      if (retries.current >= 2) setError('Срок доступа истёк. Повторите запрос.');
      else { retries.current++; setRevision(value => value + 1); }
    }, Math.max(0, Date.parse(access.expiresAt) - Date.now()));
    return () => clearTimeout(timer);
  }, [access, kind, attachment.id]);
  const failed = useCallback(() => {
    if (access && mediaAccessClient.canRenew(access, retries.current)) { retries.current++; setRevision(value => value + 1); }
    else setError('Файл недоступен или повреждён');
  }, [access]);
  const save = async () => {
    if (download.current) return;
    const controller = new AbortController(); download.current = controller; setDownloading(true); setError('');
    try {
      await downloadAttachmentOriginal(attachment, controller.signal);
    } catch { if (!controller.signal.aborted) setError('Файл недоступен'); }
    finally { if (download.current === controller) { download.current = null; setDownloading(false); } }
  };
  return createPortal(<div className={styles.overlay}><div ref={modal} className={styles.dialog} role="dialog" aria-modal="true" aria-label={attachment.originalFileName || 'Вложение'} tabIndex={-1}>
    <header className={styles.header}><div>{attachment.originalFileName || 'Вложение'}<small>{attachment.contentType || 'Файл'} · {Math.ceil((attachment.sizeBytes || 0) / 1024)} КиБ {author && `· ${author}`} {date && `· ${new Date(date).toLocaleString()}`}</small></div>
      <button disabled={index === 0} onClick={() => { retries.current = 0; setIndex(index - 1); }} aria-label="Предыдущее вложение">←</button>
      <span>{index + 1} / {attachments.length}</span><button disabled={index >= attachments.length - 1} onClick={() => { retries.current = 0; setIndex(index + 1); }} aria-label="Следующее вложение">→</button>
      <button disabled={downloading} onClick={() => void save()}>{downloading ? 'Скачивание…' : 'Скачать оригинал'}</button><button onClick={onClose} aria-label="Закрыть просмотрщик">Закрыть</button>
    </header><div className={styles.content}>
      {error ? <div role="alert">{error} <button onClick={() => { retries.current = 0; setError(''); setAccess(null); setRevision(value => value + 1); }}>Повторить</button></div>
        : kind === 'download' ? <p>Встроенный предпросмотр недоступен. Скачайте оригинал.</p>
        : kind === 'media' ? <StreamingAttachment key={attachment.id} attachment={attachment} />
        : !access || access.attachmentId !== attachment.id ? <p role="status">Получение доступа…</p> : <Suspense fallback={<p role="status">Загрузка просмотрщика…</p>}>
          {kind === 'pdf' ? <PdfViewer key={attachment.id} url={access.url} onError={failed} />
            : kind === 'image' ? <ImageViewer key={attachment.id} url={access.url} name={attachment.originalFileName} onError={failed} />
            : <TextViewer key={attachment.id} url={access.url} size={attachment.sizeBytes} onError={failed} />}
        </Suspense>}
    </div></div></div>, document.body);
}
