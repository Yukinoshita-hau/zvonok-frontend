# Rhythm Module Specification Document (MSD)

## Goal
Provide an embedded frontend rhythm game MVP (4-key vertical scrolling) inside the existing app without backend dependencies.

## MVP scope
- 4 lanes, default keybinds: D/F/J/K (`event.code`: `KeyD`, `KeyF`, `KeyJ`, `KeyK`).
- Canvas 2D rendering.
- Audio selected from local file input.
- Time model based on `audio.currentTime`.
- `requestAnimationFrame` loop for rendering + MISS processing.
- Judgment buckets: MARVELOUS/PERFECT/GREAT/GOOD/BAD/MISS.
- Score/combo/accuracy/max combo + result panel.

## Non-goals (v1)
- No backend API.
- No server leaderboard.
- No map editor UI.
- No multiplayer sync.
- No replay serializer/player.
- No production hold-note behavior beyond type placeholders.

## Architecture
- `model/`: runtime and map typings + demo map.
- `engine/`: pure functions (timing, judgment, scoring, map validation).
- `hooks/`: `useRhythmGame` orchestration (audio state, input, miss loop, lifecycle).
- `components/`: controls, settings, HUD, canvas, results.
- `pages/`: `RhythmGamePage` composition.

## Timing model
- Source of truth: `audio.currentTime * 1000`.
- Effective note time:
  - `effective = note.timeMs + map.offsetMs + inputOffsetMs`.
- Offset sign:
  - Positive `inputOffsetMs` delays expected hit time.
  - Negative `inputOffsetMs` makes expected hit time earlier.

## Input model
- Keyboard listeners on `window`.
- Ignore repeats and editable DOM targets.
- Hit detection chooses closest unjudged note in pressed lane by minimal `abs(diffMs)` within MISS window.

## Scoring model
- Pure scoring update per judgment.
- Max score normalized to `1_000_000` from per-note max `320`.
- Accuracy computed from judged notes only (100% before first judgment).
- BAD/MISS break combo.

## Game loop
- `requestAnimationFrame` runs while status is `playing`.
- Each frame:
  1. Read current audio time.
  2. Mark overdue unjudged notes as MISS.
  3. Finish when all notes judged or audio ended.
- No per-note timers and no FPS-dependent movement.

## Canvas rendering
- Canvas is render-only (no gameplay mutations).
- Note Y-position recomputed each frame from time-to-hit and `approachTimeMs`.
- HiDPI scaling with devicePixelRatio.
- Responsive card layout with 4-lane grid visuals and hit line near top.

## Future backend integration
Planned API surface (not implemented):
- `GET /api/rhythm/maps`
- `GET /api/rhythm/maps/{id}`
- `POST /api/rhythm/scores`
- `GET /api/rhythm/maps/{id}/leaderboard`

## Future leaderboard
- Persist score, accuracy, combo and metadata per map/user.
- Rank endpoints + pagination.

## Future map editor
- Timeline/grid editor.
- Snap/division tools.
- Audio waveform and offset calibration helpers.

## Future multiplayer (WebSocket/STOMP)
- Challenge rooms.
- Ready state sync + deterministic start time.
- Real-time score/combo/judgment delta broadcasting.

## Notes
- Web Audio API can be added later for tighter scheduling/calibration if required.

## Visual System
- Dark arcade/neon style with strong lane readability.
- Circular notes, receptor circles, hit flashes, and subdued guide lines.

## Theme Tokens
- Centralized in `src/features/rhythm/theme/rhythmTheme.ts`.
- Includes lane colors, pressed overlays, panel colors, and judgment colors.

## Stage Rendering Layers
1. Background layer (gradient + dim overlay)
2. Stage/lane layer (lane fills, separators, frame feel)
3. Guides layer (barlines from BPM)
4. Receptor + hit line layer
5. Notes layer (circular gradient notes)
6. FX layer (hit ring pulses)
7. HUD/UI layer (React panels)

## Planned Skin/Theming Support
- Background preset switching (`nebula`, `grid`, `aurora`) already exposed.
- Next step: configurable full noteskin packs (colors/shapes/effects) from JSON tokens.
