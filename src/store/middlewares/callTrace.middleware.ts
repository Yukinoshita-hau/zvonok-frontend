import type { Middleware } from '@reduxjs/toolkit';
import type { RootState } from '../store';
import { mediaHeaders } from '../../api/mediaClient';
import { session } from '../../api/api';

// Explicitly opt in for one document; no credentials or action payloads enter this trace.
export const callTraceMiddleware: Middleware<{}, RootState> = api => {
  let remaining = 250;
  return next => action => {
    const before = api.getState();
    const result = next(action);
    try {
      if (remaining === 0 || sessionStorage.getItem('zvonok.callTrace') !== '1') return result;
      const after = api.getState(), event = action as { type: string; payload?: {type?: string} };
      if (!/^(call|websocket|user)\//.test(event.type)) return result;
      if (before.call === after.call && before.websocket === after.websocket && before.user === after.user) return result;
      remaining--;
      console.table([{
        monotonicMs: Math.round(performance.now()), wallMs: Date.now(),
        client: mediaHeaders['X-Media-Client-Id'], callId: after.call.callId,
        generation: after.call.mediaGeneration, previous: before.call.status, next: after.call.status,
        source: event.type, previousOwner: before.call.mediaOwnership, owner: after.call.mediaOwnership,
        sourceEvent: /^CALL_[A-Z_]+$/.test(event.payload?.type ?? '') ? event.payload?.type : undefined,
        stomp: after.websocket.status, livekit: after.call.mediaState,
        authHydrated: after.user.isAuthChecked, authStatus: after.user.status,
        authRefreshing: session.refreshing,
      }]);
    } catch { /* Diagnostics must never interrupt a transition. */ }
    return result;
  };
};
