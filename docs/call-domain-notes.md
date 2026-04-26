# Call Domain Notes

## 1. Screen share quality presets

Source of truth: `src/utils/callQuality.ts`.

- `low`: 1280x720, 5 FPS, 0.8 Mbps.
- `medium`: 1920x1080, 15 FPS, 2.5 Mbps.
- `high`: 1920x1080, 30 FPS, 5 Mbps.
- `game60`: 1920x1080, 60 FPS, 8 Mbps.
- `game120`: 1920x1080, 120 FPS, 12 Mbps (experimental).

Screen-share capture options are requested as ideal values (`resolution.width/height/frameRate`) and remain best-effort at browser/WebRTC level.

## 2. Gaming screen share modes

- `game60` prioritizes smoother motion and lower perceived latency compared to regular screen presets.
- `game120` is marked experimental in UI and quality metadata.
- For high-FPS modes, publish defaults prefer `maintain-framerate` for screen share encoding.

## 3. Why 1080p120 is experimental / best effort

`1080p120` is not guaranteed because real output depends on:

- browser implementation of `getDisplayMedia`;
- selected source type (tab/window/monitor);
- OS and GPU/encoder limits;
- monitor refresh rate and source rendering rate;
- current CPU/upload/network constraints.

Runtime logic in `CallQualityController` reads `track.getSourceTrackSettings().frameRate` when available. For `game120` it applies fallback chain:

- if actual FPS < 100 and >= 55 → fallback to `game60` sender encoding;
- if actual FPS < 55 → fallback to `high` sender encoding.

UI in Voice/Video settings shows requested FPS, actual FPS, active applied mode, and fallback reason.

## 4. Per-user volume architecture

- Local-only preference, no backend mutation.
- Preferences are stored in Redux `device.participantVolumes` and persisted in `localStorage` key `device-preferences-v2`.
- Key dimensions:
  - `participantIdentity`;
  - `source` (`microphone` or `screenShareAudio`).
- Value range in current MVP: `0..100` (no boost above 100%).
- UI surface: in-call `Audio Mix` panel in `CallUi`.

## 5. Screen share audio volume architecture

- Separate slider/key from microphone volume.
- Screen-share-audio slider appears only when remote `Track.Source.ScreenShareAudio` track exists.
- Playback logic remains centralized in `CallAudioLayer`.
- `CallAudioLayer` keeps existing behavior: screen-share-audio plays only for currently selected screen-share participant.

## 6. Input sensitivity / voice threshold architecture

Current implementation is safe MVP (frontend-only):

- Setting is named `Input sensitivity / Voice activity threshold`.
- It does not modify published microphone track.
- It is used for local speaking UI thresholding and meter feedback.
- Auto/manual toggle:
  - auto threshold baseline: 30%;
  - manual threshold range: 5..90.

Related toggles in device settings:

- noise suppression;
- echo cancellation;
- auto gain control.

These map to browser capture constraints in `useMicrophoneCaptureOptions` and microphone preview constraints in `VoiceVideoSetting`.

## 7. Noise gate / WebAudio limitations

Full realtime mic processing (noise gate/high-pass/filter chain) is intentionally not included in this PR because it requires:

- stable WebAudio processing graph for outgoing mic;
- republish/restart coordination with LiveKit mute/unmute;
- robust handling of device switching and reconnects;
- careful artifact/performance testing across browsers.

Open question: whether to implement processed outgoing track replacement in a dedicated follow-up after call-flow regression tests.

## 8. Safe vs risky call/audio changes

Safe in this iteration:

- extending preset tables and UI mode selection;
- runtime sender-encoding fallback for screen-share game120;
- local-only per-user volume preferences;
- speaking UI threshold tuning without touching published mic track.

Risky (kept out of scope):

- recreating `LiveKitRoom` on setting changes;
- hidden screen-share restart / re-prompt from settings change;
- replacing raw mic publish path with always-on WebAudio processor;
- changing websocket call contracts.

## 9. Manual QA for call/audio/screen-share features

1. Select each legacy screen preset (`low/medium/high`) and start share.
2. Select `game60`, start share, confirm call remains stable.
3. Select `game120`, start share, verify fallback info if actual FPS is lower.
4. Switch screen-share mode while active share is running; confirm no room recreation.
5. Verify camera + screen share simultaneous behavior.
6. Open `Audio Mix`, change remote mic volume, reset to default.
7. If participant shares audio, adjust separate stream volume.
8. Reconnect/rejoin and confirm volumes are re-applied.
9. Toggle input sensitivity auto/manual and observe local speaking/meter behavior.
10. Confirm mute/unmute and device selection still work.

## 10. Future improvements

- Optional WebAudio gain stage for >100% per-user boost (separate guarded feature flag).
- Full outgoing mic processing pipeline (noise gate + optional high-pass filter) with controlled republish path.
- Better automatic input-threshold calibration against ambient noise floor.
- Live call diagnostics panel (send/recv bitrate, FPS, packet loss) with recommendations.
- Optional backend sync for user AV preferences across devices (currently local only).
