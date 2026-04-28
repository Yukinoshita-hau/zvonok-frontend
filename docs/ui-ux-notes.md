# UI/UX Notes (Call + Room settings)

## Confirmed improvements in this pass

- RoomSetting participants are now structured with identity hierarchy:
  - displayName (primary)
  - username (secondary)
  - status indicator
  - avatar/fallback
  - `you` badge
- Member click opens profile popover in-place without leaving RoomSetting.
- Cinema mode is separated from Focus mode and behaves as immersive stream-only view.
- Screen-share quality selection is grouped and warns for heavy/experimental presets.
- Mic quality uses intent-based presets (Economy/Balanced/Studio/Gaming).

## Open assumptions / constraints

- Extreme video presets are request-level only; no guarantee of exact FPS/resolution.
- Actual applied values depend on browser/device/OS and capture source.
- No backend changes were introduced.
- Krisp/enhanced suppression remains a future step with explicit fallback design.
