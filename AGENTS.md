# AGENTS.md - Zvonok Frontend

## Project overview
- React + TypeScript + Vite frontend.
- Rhythm game module: `src/features/rhythm`.

## Build/check commands
- `npm run dev`
- `npm run lint`
- `npm run build`
- `npm run preview`

## Frontend conventions
- Keep existing routing/auth/layout/navigation intact (`src/App.tsx`, `RequireAuth`, `AppLayout`).
- Use CSS Modules and typed TS modules.

## Rhythm module conventions
- Gameplay rendering is Canvas 2D based.
- Timing source is `audio.currentTime` (ms conversion).
- `requestAnimationFrame` drives render and miss checks.
- Note position is always recomputed from song time.
- `engine/scoring` and `engine/judgment` remain pure.
- Visual tokens live in `src/features/rhythm/theme/rhythmTheme.ts`.

## Docs
- Rhythm docs are under `docs/rhythm`.
- Read before major rhythm changes:
  - `docs/rhythm/MSD.md`
  - `docs/rhythm/MAP_FORMAT.md`
