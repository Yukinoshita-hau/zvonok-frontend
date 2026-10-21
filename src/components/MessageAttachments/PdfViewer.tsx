import { useEffect, useRef, useState } from 'react';
import { getDocument, GlobalWorkerOptions, TextLayer } from 'pdfjs-dist';
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import 'pdfjs-dist/web/pdf_viewer.css';
import styles from './AttachmentViewer.module.css';

GlobalWorkerOptions.workerSrc = workerUrl;

export default function PdfViewer({ url, onError }: { url: string; onError: () => void }) {
  const [document, setDocument] = useState<PDFDocumentProxy | null>(null);
  const [page, setPage] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [fit, setFit] = useState<'width' | 'page' | null>('page');
  const [bounds, setBounds] = useState({ width: 800, height: 500 });
  const [loading, setLoading] = useState(true);
  const scroll = useRef<HTMLDivElement>(null);
  const host = useRef<HTMLDivElement>(null);
  const currentScale = useRef(1);

  useEffect(() => {
    let active = true;
    setDocument(null); setLoading(true);
    const task = getDocument({ url, withCredentials: false, disableAutoFetch: true, disableStream: true,
      rangeChunkSize: 65536, enableXfa: false, maxImageSize: 16_777_216, canvasMaxAreaInBytes: 32 * 1024 * 1024 });
    void task.promise.then(doc => { if (active) { setPage(value => Math.min(value, doc.numPages)); setDocument(doc); } })
      .catch(() => { if (active) onError(); });
    return () => { active = false; void task.destroy().catch(() => {}).finally(() => TextLayer.cleanup()); };
  }, [url, onError]);

  useEffect(() => {
    const element = scroll.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setBounds({ width: entry.contentRect.width - 24, height: entry.contentRect.height - 24 }));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!document || !host.current) return;
    let active = true, render: RenderTask | undefined, text: TextLayer | undefined, textTask: Promise<unknown> | undefined;
    const container = host.current;
    const canvas = window.document.createElement('canvas');
    const layer = window.document.createElement('div');
    layer.className = 'textLayer';
    container.replaceChildren(canvas, layer);
    setLoading(true);
    void (async () => {
      const pdfPage = await document.getPage(page);
      if (!active) return;
      const base = pdfPage.getViewport({ scale: 1, rotation });
      const scale = fit === 'width' ? Math.max(.1, bounds.width / base.width)
        : fit === 'page' ? Math.max(.1, Math.min(bounds.width / base.width, bounds.height / base.height)) : zoom;
      const viewport = pdfPage.getViewport({ scale, rotation });
      currentScale.current = scale;
      const ratio = Math.min(window.devicePixelRatio || 1, 2, Math.sqrt(8_000_000 / (viewport.width * viewport.height)), 8192 / Math.max(viewport.width, viewport.height));
      canvas.width = Math.max(1, Math.floor(viewport.width * ratio)); canvas.height = Math.max(1, Math.floor(viewport.height * ratio));
      canvas.style.width = `${viewport.width}px`; canvas.style.height = `${viewport.height}px`;
      container.style.width = `${viewport.width}px`; container.style.height = `${viewport.height}px`;
      container.style.setProperty('--scale-factor', String(scale));
      container.style.setProperty('--total-scale-factor', String(scale));
      render = pdfPage.render({ canvas, viewport, transform: [ratio, 0, 0, ratio, 0, 0] });
      await render.promise;
      if (!active) return;
      text = new TextLayer({ container: layer, viewport, textContentSource: pdfPage.streamTextContent() });
      textTask = text.render();
      await textTask;
      pdfPage.cleanup();
      if (active) setLoading(false);
    })().catch(reason => { if (active && reason?.name !== 'RenderingCancelledException') onError(); });
    return () => {
      active = false; render?.cancel(); text?.cancel(); container.replaceChildren();
      void (textTask ?? Promise.resolve()).catch(() => {}).finally(() => TextLayer.cleanup());
      // Release the backing buffer after an in-flight renderer has stopped using it.
      void (render?.promise ?? Promise.resolve()).catch(() => {}).finally(() => { canvas.width = 0; canvas.height = 0; });
    };
  }, [document, page, zoom, rotation, fit, bounds, onError]);

  const changePage = (value: number) => { setPage(Math.max(1, Math.min(document?.numPages ?? 1, value || 1))); scroll.current?.scrollTo(0, 0); };
  return <><div className={styles.toolbar}>
    <button disabled={!document || page <= 1} onClick={() => changePage(page - 1)} aria-label="Предыдущая страница">←</button>
    <label>Страница <input aria-label="Страница PDF" type="number" min={1} max={document?.numPages ?? 1} value={page} onChange={event => changePage(Number(event.target.value))} style={{ width: 75 }} /></label>
    <span>/ {document?.numPages ?? '…'}</span>
    <button disabled={!document || page >= document.numPages} onClick={() => changePage(page + 1)} aria-label="Следующая страница">→</button>
    <button onClick={() => { setFit(null); setZoom(Math.max(.25, currentScale.current / 1.25)); }} aria-label="Уменьшить PDF">−</button>
    <button onClick={() => { setFit(null); setZoom(Math.min(4, currentScale.current * 1.25)); }} aria-label="Увеличить PDF">+</button>
    <button onClick={() => setFit('width')}>По ширине</button><button onClick={() => setFit('page')}>Страница целиком</button>
    <button onClick={() => setRotation(value => (value + 90) % 360)}>Повернуть</button>
    {loading && <span role="status">Загрузка PDF…</span>}
  </div><div ref={scroll} className={styles.pdfScroll}><div ref={host} className={styles.pdfPage} /></div></>;
}
