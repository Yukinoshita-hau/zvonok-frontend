# Call Domain Notes

## Participant context menu architecture

- Entry point: `CallUi.tsx` stores `participantMenu` state (`x`, `y`, `participantIdentity`).
- Trigger: right-click (`onContextMenu`) on `CallParticipantTile`.
- Menu UI: `src/components/CallUi/ParticipantContextMenu/ParticipantContextMenu.tsx`.
- Volume controls inside menu: `ParticipantVolumeMenu` + shared `ParticipantVolumeRow`.
- Dismiss behavior: `useDismissibleLayer` (Escape, scroll, resize) + outside click container close.
- Positioning: menu coordinates are clamped to viewport before opening.

## User profile/popover architecture

- Popover state lives in `CallUi.tsx` (`profilePopover`).
- UI component: `src/components/CallUi/UserProfilePopover/UserProfilePopover.tsx`.
- Content reuses existing `UserProfileCard` component.
- Open path: context menu action `Open profile`.
- Close path: outside click + Escape/scroll/resize via `useDismissibleLayer`.

## Camera preview architecture and cleanup rules

- Camera preview was extracted from monolithic settings logic:
  - hook: `src/components/VoiceVideoSetting/CameraPreview/useCameraPreview.ts`
  - UI: `CameraPreviewCard` + `CameraPreviewState`
- Preview capture source: `getUserMedia` only (not published to LiveKit room).
- Capture constraints use existing quality helpers (`getCameraCaptureOptions` + camera quality preset resolution).
- Cleanup rules:
  1. stop old preview tracks before creating a new stream;
  2. clear `video.srcObject = null` on re-create and unmount;
  3. stop all preview tracks on component cleanup.
- Error states are explicit: `denied`, `not_found`, `no_device`, `error`.

## Noise suppression architecture

- Device settings live in `device.slice.ts` (`noiseSuppression`, `echoCancellation`, `autoGainControl`).
- Capture options builder: `useMicrophoneCaptureOptions.ts`.
- Microphone toggle/hotkey uses those options when enabling mic.
- Runtime sync pass: `MicrophoneSettingsSync` re-applies capture options to active local mic track when settings change and mic is enabled.
- This keeps the behavior in frontend + LiveKit API boundaries without backend changes.

## Enhanced noise suppression / Krisp plan

Current status: Krisp is **not enabled in this pass** to avoid call-flow regressions.

Safe integration plan:
1. Add optional "Enhanced noise suppression" toggle in device settings.
2. Dynamic import `@livekit/krisp-noise-filter` only when toggle is enabled.
3. Check support via Krisp support API before applying processor.
4. Apply processor only to current local microphone track.
5. On mic track change/recreate, re-attach processor once (no duplicate processors).
6. On toggle off / unsupported / error, dispose processor and fallback to standard WebRTC noise suppression.

Open question: exact processor lifecycle hooks for the current LiveKit track re-creation path should be validated in browser matrix before default rollout.

## Theater mode architecture

- Call state expanded with `isTheaterMode` in `call.slice.ts`.
- Trigger points:
  - dedicated control button in `CallUi`;
  - context menu action `Open theater mode`.
- View component: `src/components/CallUi/TheaterMode/TheaterModeView.tsx`.
- Theater mode uses existing selected screen-share flow (`selectedScreenTrackSid`) and does not alter screen-audio routing semantics.
- Escape exits theater mode.
- If selected screen share disappears, theater mode auto-exits.

## Safe/risky call UI changes

Safe:
- presentation refactor into small UI components;
- context menus and popovers with local UI state;
- camera preview via isolated `getUserMedia` stream;
- microphone settings re-apply using existing LiveKit participant API.

Risky:
- modifying `CallAudioLayer` subscribe/playback semantics;
- reworking `LiveKitRoom` props/lifecycle;
- changing websocket call contracts;
- introducing heavyweight audio processing in active call path without fallback.

## Manual QA checklist

1. Right-click on participant tile opens menu.
2. Menu is clamped in viewport and closes by Escape/outside click/scroll/resize.
3. Left-click screen-share selection still works.
4. Context menu mic volume changes only target participant mic audio.
5. Stream volume row appears only when screen-share-audio exists.
6. Profile popover opens and closes predictably.
7. Camera preview updates after camera device change.
8. Camera preview updates after camera quality change.
9. Closing settings releases preview stream.
10. Active call camera publish flow remains stable while preview is used.
11. Noise/echo/agc toggles re-apply to active mic track when mic is enabled.
12. Theater mode opens selected screen share in focused layout.
13. Escape exits theater mode.
14. Ending selected screen share exits theater mode safely.
15. Minimized/expanded/hidden call modes still work.
16. Screen-share audio routing continues to follow selected screen-share participant.
