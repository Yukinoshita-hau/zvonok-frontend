import { useEffect, useState } from 'react';
import { readTextPreview, TEXT_PREVIEW_BYTES } from './documentPreview';

export default function TextViewer({ url, size, onError }: { url: string; size: number; onError: () => void }) {
  const [text, setText] = useState<string | null>(null);
  const [copied, setCopied] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    setText(null);
    void fetch(url, { signal: controller.signal, credentials: 'omit', referrerPolicy: 'no-referrer',
      headers: { Range: `bytes=0-${TEXT_PREVIEW_BYTES - 1}` } })
      .then(readTextPreview).then(value => { if (!controller.signal.aborted) setText(value); })
      .catch(() => { if (!controller.signal.aborted) onError(); });
    return () => controller.abort();
  }, [url, onError]);
  if (text === null) return <p role="status">Загрузка текста…</p>;
  return <><div><button onClick={() => { void navigator.clipboard.writeText(text).then(() => setCopied('Скопировано')).catch(() => setCopied('Выделите текст и скопируйте вручную')); }}>Копировать текст</button> <span role="status">{copied}</span>
    {size > TEXT_PREVIEW_BYTES && <p>Показаны первые 256 КиБ. Скачайте оригинал для полного текста.</p>}</div>
    <pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', overflow: 'auto', minHeight: 0, flex: 1, userSelect: 'text' }}>{text}</pre></>;
}
