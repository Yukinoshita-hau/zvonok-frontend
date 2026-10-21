import { api } from './api';
import axios from 'axios';

export interface MediaAccess {
  attachmentId: number;
  url: string;
  expiresAt: string;
  mimeType: string;
  byteSize: number;
  variant: 'original';
  rangeCapable: boolean;
}
export function mediaAccessError(error: unknown) {
  if (axios.isCancel(error)) return 'cancelled';
  if (axios.isAxiosError(error)) {
    if ([401, 403, 404].includes(error.response?.status ?? 0)) return 'denied';
    if (error.response?.status === 415) return 'unsupported';
  }
  return 'network';
}

export class MediaAccessClient {
  isExpired(access: MediaAccess) { return Date.parse(access.expiresAt) <= Date.now(); }
  canRenew(access: MediaAccess, attempts: number) {
    return attempts < 2 && Date.parse(access.expiresAt) <= Date.now() + 30_000;
  }
  private pending = new Map<number, { controller: AbortController; promise: Promise<MediaAccess>; users: number }>();
  acquire(id: number) {
    let entry = this.pending.get(id);
    if (!entry) {
      const controller = new AbortController();
      const promise = api.post<MediaAccess>(`/message-attachments/${id}/playback-access`, undefined,
        { signal: controller.signal }).then(({ data }) => data);
      entry = { controller, promise, users: 0 };
      this.pending.set(id, entry);
      const current = entry;
      void promise.finally(() => { if (this.pending.get(id) === current) this.pending.delete(id); }).catch(() => {});
    }
    entry.users++;
    let released = false;
    const current = entry;
    return { promise: entry.promise, release: () => {
      if (released) return;
      released = true;
      if (--current.users === 0) {
        current.controller.abort();
        if (this.pending.get(id) === current) this.pending.delete(id);
      }
    } };
  }
}
export const mediaAccessClient = new MediaAccessClient();
