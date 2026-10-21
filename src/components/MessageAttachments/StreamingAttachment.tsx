import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import type { MessageAttachment } from '../../api/interfaces/MessageAttachmentDtos';
import { mediaAccessClient, mediaAccessError } from '../../api/MediaAccessClient';
import type { MediaAccess } from '../../api/MediaAccessClient';
import { downloadAttachmentOriginal } from '../../api/messageAttachmentsApi';
import { attachmentMedia } from './playback';
import { useModalFocus } from '../../hooks/useModalFocus';
import styles from './StreamingAttachment.module.css';

const VideoPlayer = lazy(() => import('./VideoPlayer'));
export function StreamingAttachment({ attachment }: { attachment: MessageAttachment }) {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [access, setAccess] = useState<MediaAccess | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const downloadRequest = useRef<AbortController | null>(null);
  useEffect(() => () => downloadRequest.current?.abort(), []);
  const media = useRef<HTMLMediaElement | null>(null);
  const retries = useRef(0);
  const playing = useRef(false);
  const recovering = useRef(false);
  const saved = useRef<{ time: number; playing: boolean; volume: number; muted: boolean; rate: number } | null>(null);
  const [revision, setRevision] = useState(0);
  const unregister = useRef<(() => void) | null>(null);
  const modal = useModalFocus(expanded, () => setExpanded(false));
  const onElement = useCallback((element: HTMLMediaElement | null) => {
    unregister.current?.(); unregister.current = null;
    media.current = element;
    if (element) {
      unregister.current = attachmentMedia.register(element);
      // Mounted only by an explicit Play action, never by scrolling into view.
      if (saved.current?.playing !== false) void element.play().catch(() => setBusy(false));
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    let current = true;
    const lease = mediaAccessClient.acquire(attachment.id);
    setBusy(true); setError('');
    void lease.promise.then(data => { if (current) setAccess(data); }).catch(reason => {
      if (!current || mediaAccessError(reason) === 'cancelled') return;
      media.current?.pause();
      recovering.current = false;
      setAccess(null);
      setError(mediaAccessError(reason) === 'denied' ? 'Доступ к файлу больше недоступен' : 'Не удалось получить видео. Повторите запрос.');
    }).finally(() => { if (current) setBusy(false); });
    return () => { current = false; lease.release(); };
  }, [open, attachment.id, revision]);

  useEffect(() => {
    const element = modal.current;
    if (!element || !open) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting && !expanded) {
        media.current?.pause(); setOpen(false); setAccess(null);
        saved.current = null; recovering.current = false;
      }
    }, { rootMargin: '600px' });
    observer.observe(element);
    return () => observer.disconnect();
  }, [open, expanded, modal]);

  const close = () => { media.current?.pause(); setOpen(false); setExpanded(false); setAccess(null); setError(''); saved.current = null; recovering.current = false; };
  const recover = () => {
    const element = media.current;
    if (!element || !access || recovering.current) return;
    // An opaque cross-origin media error cannot prove expiry; retry only near the known deadline.
    if (mediaAccessClient.canRenew(access, retries.current)) {
      retries.current++; recovering.current = true;
      saved.current = { time: element.currentTime, playing: playing.current, volume: element.volume,
        muted: element.muted, rate: element.playbackRate };
      element.pause(); setRevision(value => value + 1);
    } else setError(element.error?.code === 4 || element.error?.code === 3
      ? 'Формат или кодек не поддерживается либо файл повреждён. Скачайте оригинал.'
      : 'Ошибка сети при воспроизведении. Повторите запрос.');
  };
  const download = async () => {
    if (downloading) return;
    const controller = new AbortController(); downloadRequest.current = controller;
    setDownloading(true);
    try {
      await downloadAttachmentOriginal(attachment, controller.signal);
    } catch { if (!controller.signal.aborted) setError('Не удалось скачать оригинал'); }
    finally { downloadRequest.current = null; setDownloading(false); }
  };
  return <div data-attachment-player={attachment.id} className={expanded ? styles.expanded : styles.card} ref={modal}
    role={expanded ? 'dialog' : undefined} aria-modal={expanded || undefined}
    aria-label={expanded ? attachment.originalFileName : undefined} tabIndex={expanded ? -1 : undefined}>
    <div className={styles.surface} style={{ aspectRatio: attachment.type === 'AUDIO' ? undefined
      : attachment.width && attachment.width > 0 && attachment.height && attachment.height > 0
        ? `${attachment.width} / ${attachment.height}` : '16 / 9' }}>
      {!open && <button className={styles.placeholder} onClick={() => { retries.current = 0; setOpen(true); }}>
        ▶ Воспроизвести {attachment.type === 'AUDIO' ? 'аудио' : 'видео'}
        {attachment.durationMs ? ` · ${Math.round(attachment.durationMs / 1000)} с` : ''}
      </button>}
      {open && access && <Suspense fallback={<span role="status">Загрузка плеера…</span>}>
        <VideoPlayer src={access.url} audio={attachment.type === 'AUDIO'} onElement={onElement}
          crossOrigin="anonymous" onPlay={event => { playing.current = true; attachmentMedia.activate(event.currentTarget); }}
          onPause={event => { if (!event.currentTarget.error) playing.current = false; }}
          onSeeking={() => { if (access && mediaAccessClient.isExpired(access)) recover(); }}
          onVolumeChange={event => attachmentMedia.saveVolume(event.currentTarget)}
          onWaiting={() => setBusy(true)} onPlaying={() => setBusy(false)} onCanPlay={() => setBusy(false)}
          onError={recover} onLoadedMetadata={event => {
            recovering.current = false;
            const element = event.currentTarget, state = saved.current;
            if (!state) return;
            element.currentTime = state.time; element.volume = state.volume; element.muted = state.muted;
            element.playbackRate = state.rate; saved.current = null;
            if (state.playing) void element.play().catch(() => setError('Нажмите Play для продолжения'));
          }} />
      </Suspense>}
      {busy && open && <span role="status">Буферизация…</span>}
    </div>
    <div className={styles.actions}>
      <span title={attachment.originalFileName}>{attachment.originalFileName}</span>
      {open && <button onClick={() => setExpanded(value => !value)}>{expanded ? 'Свернуть' : 'Развернуть'}</button>}
      {open && <button onClick={close}>Закрыть видео</button>}
      <button disabled={downloading} onClick={() => void download()}>Скачать оригинал</button>
    </div>
    {error && <div role="alert">{error} <button onClick={() => { retries.current = 0; setOpen(true); setRevision(value => value + 1); }}>Повторить</button></div>}
  </div>;
}
