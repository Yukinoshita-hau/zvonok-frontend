import { useEffect, useRef, useState } from 'react';
import { Image as ImageIcon } from 'lucide-react';
import type { MessageAttachment } from '../../api/interfaces/MessageAttachmentDtos';
import { mediaAccessClient } from '../../api/MediaAccessClient';
import { queueImagePreview } from './previewQueue';

export function ImagePreview({ attachment: a, paused }: { attachment: MessageAttachment; paused: boolean }) {
  const element = useRef<HTMLSpanElement>(null);
  const [visible, setVisible] = useState(false);
  const [url, setUrl] = useState('');
  // shortcut: only small bounded raster originals, use dedicated variants when the backend supplies them.
  const eligible = import.meta.env.VITE_PRIVATE_MEDIA_STREAMING === 'true' && a.type === 'IMAGE' &&
    ['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(a.contentType) &&
    a.sizeBytes > 0 && a.sizeBytes <= 256 * 1024 && !!a.width && !!a.height && a.width * a.height <= 2_000_000;
  useEffect(() => {
    if (!eligible || !element.current) return;
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting));
    observer.observe(element.current); return () => observer.disconnect();
  }, [eligible]);
  useEffect(() => {
    if (!eligible || !visible || paused || url) return;
    let live = true;
    let lease: ReturnType<typeof mediaAccessClient.acquire> | undefined;
    const image = new window.Image();
    image.crossOrigin = 'anonymous';
    image.referrerPolicy = 'no-referrer';
    const cancel = queueImagePreview(async () => {
      if (!live) return;
      lease = mediaAccessClient.acquire(a.id);
      try {
        const access = await lease.promise;
        if (!live) return;
        image.src = access.url;
        await image.decode();
        if (live) setUrl(access.url);
      } finally { lease.release(); }
    });
    return () => { live = false; cancel(); lease?.release(); image.src = ''; };
  }, [a.id, eligible, visible, paused, url]);
  return <span ref={element} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%' }}>{url ? <img src={url} alt="" loading="lazy" crossOrigin="anonymous" referrerPolicy="no-referrer" /> : <ImageIcon size={28} />}</span>;
}
