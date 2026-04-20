# Message replies frontend notes

## Files and responsibilities
- `src/store/slices/message.slice.ts`
  - Stores `replyTarget` (`messageId`, `authorDisplayName`, `snippet`, `deleted`).
  - Provides reply actions: `startReply`, `cancelReply`.
  - Resets reply target on room switch and `clearMessages`.
- `src/pages/DmChat/DmChat.tsx`
  - Renders composer-level reply preview above input.
  - Sends `replyToMessageId` in `messageActions.sendMessage` payload.
  - Clears reply target after send and on explicit cancel.
- `src/components/DmItemsList/DmItemsList.tsx`
  - Adds `Reply` context-menu action.
  - Renders per-message reply block from `replyPreview`/`replyToMessageId`.
  - Handles click-to-jump to parent message (if loaded) and temporary highlight.
  - Shows fallback notice if parent message is not currently loaded.
- `src/components/DmItemsList/DmItemsList.module.css`
  - Styles for inline reply block, jump highlight, and missing-parent notice.
- `src/pages/DmChat/DmChat.module.css`
  - Styles for composer reply preview and cancel action.

## Reply target state
- Location: `message` slice in Redux.
- Shape is intentionally minimal and predictable:
  - `messageId`
  - `authorDisplayName`
  - `snippet`
  - `deleted`
- Not storing full message object avoids stale/duplicated state.

## Data flow (fetch/ws -> render)
- Backend already includes `replyToMessageId` and `replyPreview` in `ShortMessage` payload.
- Existing fetch (`fetchRoomMessages`) and websocket reducer (`execEventMessage`) already keep these fields in `messages` as part of full message objects.
- UI rendering uses only message DTO fields:
  - composer uses slice `replyTarget` (local user selection)
  - message bubble uses `message.replyPreview` and `message.replyToMessageId`
- No websocket middleware changes are required for reply metadata transport.

## Jump to original message
- Reply block click checks current `messageRefs` map (`messageId -> element`).
- If parent exists in loaded list:
  - smooth scroll to parent (`block: center`)
  - set temporary `highlightedMessageId`
  - auto-clear highlight via timeout
- If parent is missing from loaded list:
  - no hard failure
  - show short fallback notice in message list
- No heavy backfill loading is triggered to avoid pagination/scroll regressions.

## Known limitations
- Jump works only for messages currently loaded in memory.
- No threaded/nested replies (single-level UX only, by design).
- Reply action is available in context menu; no separate hover icon was added.
- Missing/deleted parent shows fallback text; no attempt to reconstruct full parent message.

## Safe vs risky changes
- Safe:
  - tweaking reply preview text/styles
  - updating fallback wording
  - adjusting highlight timeout/duration
- Risky:
  - changing `message/sendMessage` payload contract (`replyToMessageId` name/type)
  - altering room-switch resets in `message.slice.ts`
  - modifying scroll/pagination behavior in `DmItemsList` without regression checks

## Manual QA checklist
1. Reply to own message.
2. Reply to another user's message.
3. Reply to a message that itself is a reply.
4. Cancel reply in composer.
5. Send with Enter while reply is active.
6. Verify outgoing payload includes `replyToMessageId` (or `null` when no reply).
7. Verify reply block renders in sent/received messages.
8. Click reply block when parent is loaded -> scroll + temporary highlight.
9. Click reply block when parent not loaded -> fallback notice, no crash.
10. Switch room while reply is active -> reply preview resets.
11. Confirm edit/delete/read-marker/new-divider/day-divider behavior still works.
12. Verify upward pagination still restores scroll position.

## Open questions / assumptions
- Assumption: backend continues to provide `replyPreview` for parent-unavailable cases.
- Assumption: deleted parents are represented via `replyPreview.deleted` and/or missing parent in list.
- Open question: should reply action also be exposed for touch/mobile UI beyond context menu.
