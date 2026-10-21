import { useCallback, useEffect, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import type { RootState } from '../store/store';
import { roomAttachmentsApi, type AttachmentFilters, type AttachmentPage } from '../api/roomAttachmentsApi';

export function useRoomAttachments(roomId: number, filters: AttachmentFilters) {
  const revision = useSelector((s: RootState) => s.message.libraryRevision);
  const [page, setPage] = useState<AttachmentPage>({ items: [], nextCursor: null });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const request = useRef<AbortController | null>(null);
  const scope = `${roomId}:${filters.category}:${filters.filenameQuery}:${filters.sortDirection}:${revision}:${retry}`;
  const currentScope = useRef(scope); currentScope.current = scope;
  const load = useCallback(async (cursor: string | null) => {
    request.current?.abort();
    const controller = new AbortController(); request.current = controller;
    setLoading(true); setError('');
    try {
      const { data } = await roomAttachmentsApi.list(roomId, filters, cursor, controller.signal);
      if (controller.signal.aborted || currentScope.current !== scope) return;
      setPage(old => ({ items: cursor ? [...old.items, ...data.items.filter(item => !old.items.some(previous => previous.attachment.id === item.attachment.id))] : data.items, nextCursor: data.nextCursor }));
    } catch {
      if (!controller.signal.aborted && currentScope.current === scope) {
        // Do not retain private metadata after membership is lost or an authorization check fails.
        setPage({ items: [], nextCursor: null }); setError('Не удалось получить файлы. Проверьте доступ к переписке.');
      }
    } finally { if (!controller.signal.aborted && currentScope.current === scope) setLoading(false); }
  }, [roomId, filters.category, filters.filenameQuery, filters.sortDirection, scope]);
  useEffect(() => {
    setPage({ items: [], nextCursor: null });
    void load(null);
    return () => { request.current?.abort(); };
  }, [load]);
  return { ...page, loading, error, refresh: () => setRetry(value => value + 1), more: () => { if (!loading && page.nextCursor) void load(page.nextCursor); } };
}
