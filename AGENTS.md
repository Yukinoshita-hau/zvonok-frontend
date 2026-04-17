# AGENTS.md - Zvonok Frontend

## Scope
- This guide is for future Codex sessions working in this repository.
- Use only repository-confirmed patterns.
- If a rule is uncertain, mark it as `likely pattern`.

## Stack
- Frontend: React 19 + TypeScript 5.9 + Vite 7 (`@vitejs/plugin-react-swc`).
- State: Redux Toolkit (`@reduxjs/toolkit`) + `react-redux`.
- Routing: `react-router-dom` 7 with nested layouts/routes in `src/App.tsx`.
- HTTP: `axios` through shared instance in `src/api/api.ts`.
- Realtime: STOMP over WebSocket via `@stomp/stompjs` (`sockjs-client` present in deps).
- Calls/media: LiveKit (`livekit-client`, `@livekit/components-react`, `@livekit/krisp-noise-filter`).
- Styling: CSS Modules (`*.module.css`) + global theme variables in `src/index.css`.

## Project Structure
- App bootstrap: `src/main.tsx` (Redux `Provider` + `App`).
- Routing/auth guard/init: `src/App.tsx`, `src/helpers/RequireAuth.tsx`, `src/helpers/AppInitializer.tsx`.
- Domain models: `src/entities/*`.
- API layer: `src/api/*` and contracts in `src/api/interfaces/*`.
- State layer: `src/store/*` with:
  - `slices/*` (feature state + reducers + async thunks)
  - `middlewares/websocket.middleware.ts` (realtime side effects)
  - `interfaces/*` (action/event/type contracts)
- UI composition:
  - `src/layouts/*` for top-level shells
  - `src/pages/*` for route-level screens
  - `src/components/*` for reusable UI blocks
- Utilities: `src/utils/*`.

## Architecture Patterns
- Feature-oriented Redux slices with `createSlice` + `createAsyncThunk`.
- Async status/error tracked in slice state (`idle/loading/succeeded/failed`).
- Global reset on logout is centralized in `src/store/store.ts` (`action.type == "user/logout"`).
- Realtime command-style actions use empty reducers in slices (example: `message/sendMessage`) and are executed in `src/store/middlewares/websocket.middleware.ts`.
- Auth bootstrap flow:
  - `AuthInitializator` refreshes token and fetches current user.
  - `RequireAuth` blocks routes until `isAuthChecked`.
- API wrappers are typed and grouped by domain (`*Api.ts`).

## Naming And Code Style (Observed)
- React components are function components with hooks.
- Typed Redux hooks usage is common: `useDispatch<AppDispatch>()`, `useSelector((s: RootState) => ...)`.
- Components/pages are PascalCase (`DmChat.tsx`, `AppLayout.tsx`).
- Co-location pattern for component files:
  - `ComponentName.tsx`
  - `ComponentName.module.css`
  - optional `ComponentName.props.ts`
- Redux slice files follow `*.slice.ts`.
- Async thunk/action names are namespaced string literals (`"message/fetchRoomMessages"`).
- API files follow `*Api.ts`, interfaces are in `src/api/interfaces`.
- Java code style: not applicable (`.java` files not found).

## State Management Rules
- Do not bypass `src/api/api.ts` for authenticated HTTP calls; token refresh/interceptors are defined there.
- Keep logout semantics intact:
  - `userActions.logout` clears user auth state.
  - root reducer reset in `store.ts` clears app state.
- Keep realtime command actions aligned with middleware switch cases (type strings must match exactly).
- Keep message/channel pagination behavior consistent:
  - prepend on pagination fetch
  - reset state on room/channel switch where currently implemented.
- Keep UI theme changes through `uiSlice.setTheme` (sync with `localStorage` key `app-theme`).

## Realtime / WebSocket Rules
- Connection lifecycle is started from `AppLayout` when websocket status is `idle`.
- Token source for WS connect is `state.user.accessToken`.
- WS client creation is centralized in `src/services/websocket.service.ts`.
- Subscribe/publish paths are centralized in `src/store/interfaces/wsPathes.ts`.
- Channel realtime currently unsubscribes old `/topic/channel.*` subscriptions before creating a new channel subscription.
- Message read updates and room unread counters depend on the current `message.slice` + `DmItemsList` interaction; preserve this flow.

## API / Integration Rules
- Keep domain API wrappers typed (Axios generics and interface contracts).
- Base API URL is currently hardcoded in `src/api/baseApi.ts` (`PREFIX`).
- LiveKit token retrieval flows through backend API (`src/api/livekitApi.ts`) and `call/getToken`.
- `likely pattern`: some endpoint method choices/URL composition in API files appear inconsistent and should be changed only with backend contract confirmation.

## Commands
- Dev: `npm run dev`
- Build: `npm run build`
- Lint: `npm run lint`
- Preview: `npm run preview`
- Tests: no test runner/test script found in repository (`likely pattern`: tests not set up yet).
- ESLint config file is not present in repo root (`likely pattern`: external or not yet committed config).

## Risk Zones (Do Not Break)
- Auth bootstrap and token refresh chain (`AuthInitializator` + axios interceptors).
- Root store reset behavior on `user/logout`.
- WS middleware subscriptions/publications and path constants coupling.
- Unread/read flow in DM messaging (scroll + mark-read + room unread state interactions).
- Call state machine and LiveKit token flow (`incoming_ringing`/`outgoing_ringing`/`connecting`/`in_call`).

## Anti-Patterns To Avoid
- Do not add direct `axios` calls in components/slices bypassing `src/api/api.ts`.
- Do not dispatch ad-hoc WS action type strings that are not handled in websocket middleware.
- Do not move WS path strings out of `wsPathes.ts` into scattered literals.
- Do not change slice action type names used by middleware without synchronized updates.
- Do not introduce non-co-located styling conventions when editing existing components (follow `*.module.css` pattern).
- `likely pattern`: avoid editing `src/store/interfaces/*` contracts aggressively without checking real usage, as part looks legacy/partially unused.

## Call audio rules
- Audio device settings must be applied to the actual active microphone track, not only stored in Redux.
- When microphone settings change, verify whether the track must be recreated or restarted.
- Mute/unmute must affect the real published audio track, not only UI state.
- For call issues, always inspect LiveKit track creation, publication, and subscription flow before changing UI.
- Prefer minimal reliable fixes over large call architecture rewrites.
