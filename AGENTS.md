# AGENTS.md - Zvonok Frontend

## Project overview
- React 19 + TypeScript + Vite frontend.
- Main app routing is in `src/App.tsx` with auth bootstrap via `AuthInitializator` and protected app content via `RequireAuth`.
- Rhythm game module is located in `src/features/rhythm`.

## Build/check commands
- `npm run dev`
- `npm run lint`
- `npm run build`
- `npm run preview`

## Frontend conventions
- Use TypeScript and React function components.
- Use CSS Modules for component/page styles.
- Keep feature logic separated from rendering.
- Reuse existing app patterns and avoid global style regressions.

## Rhythm module conventions
- Rendering must use Canvas 2D.
- Timing source must be `audio.currentTime` (converted to ms).
- `requestAnimationFrame` is used for rendering and time-based MISS detection.
- Note position is computed from current song time each frame (not incremental per-frame movement).
- Scoring and judgment logic must remain pure functions in `src/features/rhythm/engine`.
- Rhythm docs are in `docs/rhythm`.
- Before large rhythm-module changes, read:
  - `docs/rhythm/MSD.md`
  - `docs/rhythm/MAP_FORMAT.md`

## Do not break
- Do not break existing routing/auth/layout/navigation flows in `src/App.tsx` and related layouts.
- Do not remove or bypass existing Redux/auth/bootstrap behavior.

## Future extension points
- Backend map API integration.
- Leaderboard and score upload.
- Beatmap editor.
- Replay format and playback.
- Multiplayer challenge via WebSocket/STOMP.
