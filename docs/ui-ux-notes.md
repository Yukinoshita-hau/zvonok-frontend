# UI/UX Notes (chat + voice zones)

## 1) Key interaction zones and files
- App shell / navigation: `src/layouts/AppLayouts/AppLayout.tsx`, `src/components/NavigateBar/NavigateBar.tsx`.
- DM shell and primary header actions: `src/pages/DmChat/DmChat.tsx`.
- DM message stream and context actions: `src/components/DmItemsList/DmItemsList.tsx`.
- Inbox list zones (rooms/friends): `src/pages/InboxLayout/InboxLayout.tsx`, `src/components/RoomListItem/RoomListItem.tsx`, `src/components/FriendListItem/FriendListItem.tsx`.
- Room settings + member interactions: `src/components/RoomSettingModal/RoomSettingModal.tsx`, `src/components/RoomMembersList/RoomMembersList.tsx`.
- Reusable compact profile popout: `src/components/UserMiniCard/*`.

## 2) Primary vs secondary actions
- **Primary actions** (always visible / fast):
  - Send message (composer send button, Enter).
  - Start call from DM header.
  - Open room settings from DM header.
  - Open DM from room/friend rows.
  - Open user identity popout from DM header, friend row, member row.
- **Secondary actions** (contextual):
  - Message edit/delete/reply in message context menu.
  - Remove friend action (row hover + profile popout secondary action).
  - Add friend action in user popout, plus lightweight shortcut in DM header for unknown contact.

## 3) Where user mini-card opens and behavior
- Opens from:
  - DM header identity block (`DmChat`).
  - Friend list item identity area (`FriendListItem`).
  - Room members list row (`RoomMembersList`).
- Displays:
  - Display name, username, status, basic about fallback.
  - Relationship state (`friend`, `none`, `outgoing`, `incoming`, `self`).
  - Contextual actions: Message, Add friend, Remove friend, or neutral status indicator.
- Interaction behavior:
  - `Escape` closes.
  - Outside click closes.
  - Card receives focus on open.
  - Position is anchor-based with viewport-safe fallback.

## 4) Friend/profile actions placement and rationale
- Add friend is shown in the mini-card as the canonical profile action (closest to user identity object).
- For fast DM usage, Add friend also appears in DM header only for private chats with non-friends.
- Remove friend remains available via hover on friend row and in profile popout (secondary, destructive action).

## 5) Header actions and contextual actions structure
- DM header now uses a clearer hierarchy:
  - Left: clickable identity block (avatar + title) -> profile entry point.
  - Right: utility actions (Add friend when relevant, call, settings).
- Message actions stay contextual in right-click menu to avoid action noise in each row.
- Member/friend row identity has explicit clickable affordance for profile inspection.

## 6) UX trade-offs
- Kept architecture and data contracts unchanged (Redux slices, WS action strings, API payloads untouched).
- Profile popout uses visual-only data fallback for `aboutMe` when unavailable in local entity.
- Incoming/outgoing friend request actions in popout are intentionally read-only labels (no new flows introduced).

## 7) Manual QA checklist
1. Open DM, click avatar/name in header -> popout opens near anchor, closes on outside click/Escape.
2. In DM with non-friend, confirm Add friend appears and dispatches existing action.
3. Open inbox friends tab, click friend identity -> popout opens; Message jumps into existing DM behavior.
4. In room settings modal, click member row -> popout opens; Add/Remove friend action dispatches existing actions.
5. Confirm message right-click context menu still works (Reply/Edit/Delete).
6. Confirm call start from DM header still works.
7. Keyboard: tab to identity buttons, open card, Escape closes and focus is preserved predictably.

## 8) Follow-up improvements via this doc
- Add `aboutMe` hydration to mini-card when lightweight profile fetch is available (assumption: no fast endpoint wired in current view models).
- Add non-hover fallback for destructive row actions on touch/narrow layouts.
- Normalize status indicators (dot color + text) between friends, members, and message headers.
- Open question: whether incoming request should support quick accept/reject directly in popout (requires product decision + backend/event validation).
