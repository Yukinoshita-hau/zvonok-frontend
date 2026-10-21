import { describe, it, expect, vi } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import { roomApi } from '../src/api/roomApi';
import reducer, { messageActions, jumpToRoomMessage, fetchRoomMessages } from '../src/store/slices/message.slice';
import type { ShortMessage } from '../src/entities/shortMessage';
const msg = (id: number, eventType: ShortMessage['eventType'] = 'MESSAGE'): ShortMessage => ({ id, content: '', room: { id: 1, type: 'GROUP' }, eventType, type: 'DEFAULT', senderId: 1, sentAt: '', editedAt: null, replyToMessageId: null, replyPreview: null, attachments: [] });
describe('room attachment navigation and invalidation', () => {
  it('replaces history with a bounded context and fences old pending history', () => {
    let state = reducer(undefined, messageActions.setActiveRoom(1));
    state = reducer(state, fetchRoomMessages.pending('old', { roomId: 1 }));
    state = reducer(state, jumpToRoomMessage.pending('jump', { roomId: 1, messageId: 2 }));
    state = reducer(state, jumpToRoomMessage.fulfilled([msg(1), msg(2), msg(3)], 'jump', { roomId: 1, messageId: 2 }));
    state = reducer(state, fetchRoomMessages.fulfilled({ messages: [msg(100)] }, 'old', { roomId: 1 }));
    expect(state.messages.map(m => m.id)).toEqual([1, 2, 3]);
    expect(state.jumpTargetId).toBe(2); expect(state.isAtBottom).toBe(false);
  });
  it('ignores a context from the previous room and preserves live deletions', () => {
    let state = reducer(undefined, messageActions.setActiveRoom(1));
    state = reducer(state, jumpToRoomMessage.pending('jump', { roomId: 1, messageId: 2 }));
    state = reducer(state, messageActions.execEventMessage(msg(2, 'MESSAGE_DELETE')));
    state = reducer(state, jumpToRoomMessage.fulfilled([msg(1), msg(2)], 'jump', { roomId: 1, messageId: 2 }));
    expect(state.messages.map(m => m.id)).toEqual([1]);
    state = reducer(state, messageActions.setActiveRoom(9));
    state = reducer(state, jumpToRoomMessage.fulfilled([msg(1)], 'jump', { roomId: 1, messageId: 2 }));
    expect(state.messages).toEqual([]);
  });
  it('invalidates only for current-room attachments or deletion', () => {
    let state = reducer(undefined, messageActions.setActiveRoom(1));
    state = reducer(state, messageActions.execEventMessage(msg(1)));
    expect(state.libraryRevision).toBe(0);
    state = reducer(state, messageActions.execEventMessage(msg(1, 'MESSAGE_DELETE')));
    expect(state.libraryRevision).toBe(1);
  });
  it('consumes a jump and keeps distant live messages out of the bounded history window', () => {
    let state = reducer(undefined, messageActions.setActiveRoom(1));
    state = reducer(state, jumpToRoomMessage.pending('jump', { roomId: 1, messageId: 2 }));
    state = reducer(state, jumpToRoomMessage.fulfilled([msg(1), msg(2), msg(3)], 'jump', { roomId: 1, messageId: 2 }));
    state = reducer(state, messageActions.jumpPositioned(2));
    state = reducer(state, messageActions.execEventMessage(msg(1000)));
    expect(state.jumpTargetId).toBeNull();
    expect(state.messages.map(m => m.id)).toEqual([1, 2, 3]);
    expect(state.live[1000].id).toBe(1000);
  });
  it('resync of an old context loads one recent page instead of walking all intervening history', async () => {
    const store = configureStore({ reducer: { message: reducer } });
    store.dispatch(messageActions.setActiveRoom(1));
    store.dispatch(jumpToRoomMessage.pending('jump', { roomId: 1, messageId: 2 }));
    store.dispatch(jumpToRoomMessage.fulfilled([msg(1), msg(2), msg(3)], 'jump', { roomId: 1, messageId: 2 }));
    const get = vi.spyOn(roomApi, 'getRoomMessage').mockResolvedValue({ data: Array.from({ length: 15 }, (_, index) => ({ ...msg(1000 + index), sender: { id: 1, username: 'alice' } })) } as never);
    try {
      await store.dispatch(fetchRoomMessages({ roomId: 1, resync: true })).unwrap();
      expect(get).toHaveBeenCalledTimes(1);
      expect(store.getState().message.historyContext).toBe(false);
    } finally { get.mockRestore(); }
  });
});
