# Call Domain Notes

## RoomSetting participants architecture

- `RoomSettingModal` now renders `RoomMembersPanel` and stores local state for selected member + anchor rect.
- Participant rows are isolated in `RoomMemberRow` (avatar, displayName, username, status, `you` badge).
- Profile popover is isolated in `RoomMemberProfilePopover` and reuses `UserProfileCard`.
- Data source remains `room.memberIds + users.byId (UserMini)` only; no backend DTO changes.

## User profile card/popover architecture

- Content uses existing `UserProfileCard`.
- Popover opens from RoomSetting member click.
- Dismiss behavior: outside click and Escape via `useDismissibleLayer`.
- Popover position is clamped to viewport.

## Focus vs Cinema mode

- Focus mode: previous behavior remains (selected screen share + participants visible).
- Cinema mode: dedicated immersive layout using `TheaterModeView` + `CinemaModeOverlayControls`, rendered as full-window in-app stage.
- Cinema mode requires selected screen share (`selectedScreenTrackSid`).
- Escape exits cinema mode.
- If selected stream ends/unavailable, cinema mode auto-exits.
- `selectedScreenTrackSid` and `CallAudioLayer` routing are unchanged.

## Screen share quality grid

- Screen share presets expanded and grouped: Base / Gaming / Crystal / Godlike.
- UI moved to `ScreenShareQualityGrid` with grouped cards and `Show experimental modes` toggle.
- Requested extreme presets are marked as Experimental / best-effort with bandwidth warnings.
- Runtime summary keeps requested vs actual FPS/resolution and fallback notes.

## Experimental heavy modes and limitations

- Presets like 1080p300 / 4K120 / 8K60 are showcase-only best-effort presets.
- Browser/source/GPU/OS may reduce FPS and resolution.
- Fallback reporting is surfaced in runtime info.

## Microphone quality modes

- Added `micQualitySetting`: Economy / Balanced / Studio Voice / Gaming Voice.
- Presets are defined in `utils/microphoneQuality.ts`.
- `useMicrophoneCaptureOptions` now composes quality preset + manual noise/echo/agc toggles.
- `MicrophoneSettingsSync` still applies updates to active mic track through the existing safe path.

## Noise suppression baseline/enhanced plan

- Baseline WebRTC suppression remains active through `noiseSuppression + voiceIsolation` constraints where supported.
- Studio and Gaming presets tune defaults, but manual toggles are still respected.
- Krisp/enhanced suppression is still not enabled in this pass.
- Safe future path: optional dynamic import + support check + single processor attachment + fallback.

## Safe / risky call UI changes

Safe in this pass:
- modular RoomSetting components;
- modular quality selectors;
- cinema mode as an in-app layout state.

Risky (unchanged intentionally):
- LiveKitRoom lifecycle;
- websocket call contracts;
- `CallAudioLayer` selected-stream audio routing.

## Manual QA checklist

1. RoomSetting opens and member rows are readable.
2. Clicking member opens profile popover; Escape/outside click closes it.
3. Long displayName/username truncates safely.
4. Focus mode still shows participants with selected stream.
5. Cinema mode opens only when screen share is selected.
6. Cinema mode exits by Escape and by selected stream ending.
7. Screen-share quality cards show grouped presets and experimental warnings.
8. Runtime requested vs actual settings are visible after screen share publishing.
9. Mic quality modes switch without breaking mute/unmute.
10. Device switching and mic capture re-apply remain stable.
