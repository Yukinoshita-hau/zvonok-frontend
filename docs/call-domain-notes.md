# Call Domain Notes

## Responsible Modules

- `src/components/ActiveCallOverlay/ActiveCallOverlay.tsx` owns the active `LiveKitRoom`, call presentation modes, hidden bubble, and room-level call helpers.
- `src/components/ActiveCallOverlay/MiniCallDock.tsx` renders minimized call controls.
- `src/components/ActiveCallOverlay/MiniSpeakingStatus.tsx` renders aggregated LiveKit speaking state in minimized mode.
- `src/components/ActiveCallOverlay/CallHotkeys.tsx` owns the global in-call microphone hotkey.
- `src/components/ActiveCallOverlay/CallAudioLayer.tsx` renders subscribed remote microphone and screen share audio tracks.
- `src/components/CallUi/CallUi.tsx` renders expanded call participants, camera tracks, selected screen share, screen-share tile states, and main controls.
- `src/components/CallUi/MicrophoneToggleButton.tsx` toggles the real LiveKit microphone track and is reused by expanded and minimized controls.
- `src/components/CallUi/useMicrophoneCaptureOptions.ts` builds selected microphone/noise suppression capture options from Redux device settings.
- `src/components/CallUi/CallParticipantTile.tsx` renders each participant tile and uses LiveKit `participant.isSpeaking` / `participant.isMicrophoneEnabled`.
- `src/components/CallUi/CallQualityController.tsx` applies active camera and screen share quality changes inside the LiveKit room context.
- `src/utils/callQuality.ts` defines camera, microphone-adjacent, and screen share capture/publish quality helpers.
- `src/store/slices/call.slice.ts` stores call status, LiveKit credentials, selected screen share track, and presentation mode. It does not store microphone mute or speaking state.
- `src/store/slices/device.slice.ts` stores selected devices, noise suppression, camera quality, screen share quality, and connection-test recommendation.

## Track Creation And Publishing

- Microphone publishing is triggered through LiveKit React `useTrackToggle` / `TrackToggle` with `Track.Source.Microphone`.
- `useMicrophoneCaptureOptions.ts` applies the selected microphone device and noise suppression options to microphone creation.
- Camera publishing is triggered by `TrackToggle` with `Track.Source.Camera` in `CallUi.tsx`.
- Screen share publishing is triggered by `TrackToggle` with `Track.Source.ScreenShare` in `CallUi.tsx`.
- Multiple screen shares use a Discord-like model: participant tiles stay visible, the selected share opens in the main screen, and non-selected shares show static tile badges/placeholders instead of live previews.
- Normal calls do not manually call `createLocalTracks`, `createScreenTracks`, or `publishTrack`; LiveKit React delegates to `room.localParticipant.setMicrophoneEnabled`, `setCameraEnabled`, and `setScreenShareEnabled`.
- `getScreenShareCaptureOptions()` requests screen share audio with `audio: true` and `systemAudio: "include"`. LiveKit publishes `Track.Source.ScreenShareAudio` only when the browser/source returns an audio track from `getDisplayMedia`.
- `CallUi.tsx` shows a local note when screen share video is active but no local `Track.Source.ScreenShareAudio` publication exists.
- `CallUi.tsx` uses `RemoteTrackPublication.setSubscribed(...)` to keep non-selected remote screen share video unsubscribed where LiveKit allows it.
- `CallAudioLayer.tsx` renders remote `Track.Source.ScreenShareAudio` only for the participant whose screen share is selected.
- The app keeps LiveKit room `autoSubscribe` enabled globally; screen share optimization is done with targeted `setSubscribed(false)` after publications appear. Switching the whole room to `autoSubscribe: false` would require a broader manual subscription flow for microphone and camera too.

## Speaking, Events, And Hotkeys

- Speaking UI uses LiveKit participant state through `useParticipants()` and `participant.isSpeaking`.
- Expanded participant tiles highlight a speaking participant in `CallParticipantTile.tsx`.
- Minimized speaking status aggregates current speakers in `MiniSpeakingStatus.tsx`.
- Local speaking has priority and displays `Вы говорите`.
- Remote speaking displays up to three names and then `+ ещё N`.
- A short hold window smooths speaking state after LiveKit reports no active speaker, reducing flicker without fake timer-based speech.
- Existing room events are used in `CallQualityController.tsx`: `RoomEvent.ConnectionQualityChanged` plus local sender stats.
- The in-call mute hotkey is `Ctrl+Alt+M`, implemented in `CallHotkeys.tsx` through `room.localParticipant.setMicrophoneEnabled(...)`.
- The hotkey accepts the physical Latin `M` key and Cyrillic `ь`/`м` key values to work predictably across English and Russian keyboard layouts.
- The hotkey ignores key repeat, focused editable targets, and open modal-like DOM markers: `input`, `textarea`, `select`, `contenteditable`, `[aria-modal="true"]`, `[role="dialog"]`, and `[data-state="open"]`.

## Browser And LiveKit Limits

- Screen share audio is browser/source dependent. The frontend can request audio, but cannot force the browser picker to include or return an audio track.
- Common limitation: browser-tab audio may require the user to enable the browser's "share tab audio" or equivalent picker option.
- If no screen share audio track is returned, screen share video should continue and remote playback remains limited to video.
- The expanded call UI exposes this as a source/browser limitation note while local screen share video is active.
- Non-selected remote screen shares may still appear as publications/metadata, but should not be rendered as live `<VideoTrack>` previews.
- `CallAudioLayer.tsx` filters out local, unsubscribed, muted, and missing audio tracks before rendering.
- Screen share resolution should not be restarted silently during an active share because browsers may show a picker again or interrupt capture.
- Changing `LiveKitRoom options` during a call can recreate the LiveKit room; keep active quality changes in `TrackToggle` props and `CallQualityController`.

## Safe Vs Risky Changes

Safe:
- Tune speaking hold timing in `MiniSpeakingStatus.tsx`.
- Adjust minimized call layout and labels in `ActiveCallOverlay.module.css`.
- Tune quality presets in `src/utils/callQuality.ts`.
- Improve screen share audio copy/tooltips without changing LiveKit publishing flow.

Risky:
- Adding a Redux mirror for microphone mute or speaking state.
- Replacing LiveKit `useTrackToggle` / `TrackToggle` with custom publish/unpublish logic.
- Changing call status strings or WebSocket call payloads without backend confirmation.
- Recreating `LiveKitRoom` when device, quality, or presentation mode changes.
- Restarting active screen share capture to force audio or resolution changes.

## Known Edge Cases

- `Ctrl+Alt+M` should not toggle microphone while the user types in chat, edits a message, selects an input, uses contenteditable content, or has a modal with a known open marker.
- Holding `Ctrl+Alt+M` should not repeatedly toggle mute because repeat keydown events are ignored.
- Minimized mute button and expanded mute button must show the same LiveKit microphone state.
- If local and remote participants speak at the same time, minimized status shows local priority: `Вы говорите`.
- If four or more remote participants speak, minimized status shows the first three plus `+ ещё N`.
- Screen share video without audio is expected when the browser/source does not provide an audio track.
- The screen audio limitation note should appear for local screen share video without local `ScreenShareAudio`.
- Remote screen share audio only plays for the currently selected screen share participant.
- When the selected screen share ends, `CallUi.tsx` should select the next available screen share or clear selected state.
- Leaving, reconnecting, or rejoining should reset call slice state through existing call lifecycle reducers.

## Manual QA Checklist

- Start an outgoing DM call and accept an incoming call.
- Toggle microphone in expanded call controls.
- Minimize the call and toggle microphone from the mini button.
- Press `Ctrl+Alt+M` once and confirm one mute state change.
- Hold `Ctrl+Alt+M` and confirm there is no rapid repeated toggling.
- Focus chat input, message edit input, and any textarea/select/contenteditable target; confirm the hotkey does not toggle microphone.
- In minimized mode, test speaking status with nobody speaking, local speaking, one remote speaker, two remote speakers, three remote speakers, and four or more remote speakers.
- Confirm the wave animation appears only when speaking status is active.
- Start screen share from a source with audio support and confirm remote audio playback.
- Start screen share from a source without audio or without selecting shared audio; confirm video continues and the call does not fail.
- Confirm the screen audio limitation note appears only when local screen share video is active without local screen audio.
- Start two or more simultaneous screen shares and confirm only the selected share is rendered in the main screen.
- Confirm screen-sharing participants show tile badges/placeholders and open the main screen share on click.
- Confirm remote screen share audio switches when selecting a different participant's screen share.
- Leave call, rejoin, and verify call state resets.
- Verify outgoing accept, incoming accept, decline, busy, and end events still follow existing WebSocket flow.

## Future Call UX Work

- Use this document first when adding push-to-talk, device switching during a call, per-participant volume, screen share status badges, or call diagnostics.
- Prefer extending the existing LiveKit room-context components instead of duplicating call state in Redux.
- Open question: if product needs explicit "screen audio not shared" runtime feedback, add a small local screen share audio detector based on local `Track.Source.ScreenShareAudio` publication presence after share starts.
