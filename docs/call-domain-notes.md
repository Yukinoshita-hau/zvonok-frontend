# Call Domain Notes

## Modules And Entry Points

- `src/components/ActiveCallOverlay/ActiveCallOverlay.tsx` owns the active `LiveKitRoom`, stable base `RoomOptions`, call window modes, and the in-room `CallAudioLayer` / `CallQualityController`.
- `src/components/CallUi/CallUi.tsx` renders participants, camera tracks, screen share tracks, and the `TrackToggle` controls for microphone, camera, and screen share.
- `src/components/CallUi/CallQualityController.tsx` applies active camera/screen share quality changes and Auto mode inside the LiveKit room context.
- `src/components/VoiceVideoSetting/VoiceVideoSetting.tsx` owns device selection, microphone preview, camera quality, screen share quality, and connection test UI.
- `src/store/slices/device.slice.ts` stores selected camera/microphone, noise suppression, camera quality, screen share quality, and the last connection test result.
- `src/store/slices/call.slice.ts` stores call state, LiveKit room name, credentials, selected screen share track, and call presentation mode.
- `src/api/livekitApi.ts` gets LiveKit credentials from `/livekit/token?room=...`.
- `src/pages/DmChat/DmChat.tsx`, `src/components/CallOverlay/CallOverlay.tsx`, and `src/store/middlewares/websocket.middleware.ts` coordinate invite, accept, decline, token retrieval, and end-call flow.

## Track Creation And Publishing

- Camera publishing is triggered by `TrackToggle` with `source={Track.Source.Camera}` in `CallUi.tsx`.
- Screen share publishing is triggered by `TrackToggle` with `source={Track.Source.ScreenShare}` in `CallUi.tsx`.
- The project does not manually call `createLocalTracks`, `createScreenTracks`, or `publishTrack` for normal calls. LiveKit React calls `room.localParticipant.setCameraEnabled(...)` and `setScreenShareEnabled(...)` through the `TrackToggle` hook.
- Microphone publishing is triggered by `TrackToggle` with `source={Track.Source.Microphone}` and receives the selected device/noise suppression capture options from Redux.
- Screen share audio is rendered by `CallAudioLayer` if LiveKit publishes a `Track.Source.ScreenShareAudio` track. Current frontend screen share capture options do not force screen audio.

## Quality, Bitrate, Resolution, FPS

- Quality presets live in `src/utils/callQuality.ts`.
- Camera presets prioritize natural video and stable motion:
  - low: `640x360`, `15fps`, `500kbps`
  - medium: `1280x720`, `24fps`, `1.5Mbps`
  - high: `1920x1080`, `30fps`, `3Mbps`
- Screen share presets prioritize readable UI/text:
  - low: `1280x720`, `5fps`, `800kbps`
  - medium: `1920x1080`, `15fps`, `2.5Mbps`
  - high: `1920x1080`, `30fps`, `5Mbps`
- `CallUi.tsx` passes capture and publish options to `TrackToggle`, so newly enabled tracks start with the selected quality.
- `CallQualityController.tsx` applies quality changes to already published local tracks:
  - camera bitrate/FPS can be changed through the active `RTCRtpSender` parameters;
  - camera resolution is changed with `LocalVideoTrack.restartTrack(...)`;
  - screen share bitrate/FPS/layers can be changed through sender parameters and `setPublishingQuality(...)`;
  - screen share capture resolution is applied on the next screen share start.

## Auto Mode And Connection Test

- Auto mode uses real LiveKit/WebRTC signals:
  - `RoomEvent.ConnectionQualityChanged`
  - `LocalVideoTrack.getSenderStats()`
  - sender `RTCRtpSender` parameters
- Auto downgrade order is implemented as pressure steps:
  - lower bitrate first;
  - then lower FPS;
  - then step down the effective preset/resolution where safe.
- Auto upgrades only after a longer stable window. Screen share uses longer cooldowns than camera to avoid frequent readability changes.
- The connection test in `VoiceVideoSetting.tsx` opens a temporary LiveKit room, publishes an animated canvas video track, and samples local sender stats.
- The test asks the existing backend token endpoint for `quality-test-{userId}`.
- Active call participant tokens are not reused, because a second LiveKit connection with the same identity can disrupt the current call.
- LiveKit `ConnectionCheck.checkConnectionProtocol()` is intentionally not used because it force-switches UDP/TCP via reconnect simulation, which can fail in valid environments where TCP reconnect is unavailable or slow.
- Browser download throughput is not faked. The UI only shows a download hint from the browser Network Information API when available.

## Current Limitations

- Assumption: the backend allows temporary LiveKit rooms named `quality-test-{userId}` through the existing token endpoint. If it does not, connection test needs a backend token route.
- Frontend-only code cannot reliably measure real download throughput without a backend endpoint or test asset.
- Screen share resolution should not be silently restarted during an active share because browsers may require a new picker or interrupt the capture session.
- Changing `LiveKitRoom options` during a call can recreate the LiveKit `Room`. Keep quality changes inside `TrackToggle` props and `CallQualityController`.
- `adaptiveStream`, `dynacast`, and LiveKit simulcast remain enabled. Do not disable them unless there is a confirmed LiveKit/SFU issue.

## Safe Vs Risky Changes

Safe:
- Adjust numeric presets in `src/utils/callQuality.ts`.
- Tune Auto mode cooldowns and thresholds in `CallQualityController.tsx`.
- Improve connection test UI copy and recommendation thresholds.
- Add backend-specific connection test API wrapper if the backend exposes it.

Risky:
- Replacing `TrackToggle` with hand-written publish/unpublish logic without matching LiveKit behavior.
- Recreating `LiveKitRoom` on quality/device setting changes during an active call.
- Changing call status strings or WebSocket call action payloads without backend confirmation.
- Restarting active screen share capture to force resolution changes.
- Editing DM unread/read flows while working on calls.

## Known Edge Cases

- Unsupported camera constraints can make `restartTrack(...)` fail. The controller logs the error and avoids hiding it behind silent fallback logic.
- Fast manual quality changes are coalesced before applying to active tracks.
- Auto mode can only adapt published local tracks; it waits until camera or screen share is actually enabled.
- If the temporary connection test token is rejected, manual quality and Auto mode still work, but no pre-call recommendation is available.
- Browser Network Information API is not available in all browsers, so download hint may be unavailable.

## Manual QA Checklist

- Start a call with camera quality Low, Medium, High, and Auto.
- Start screen share with screen share quality Low, Medium, High, and Auto.
- Change camera quality during a call and confirm the call does not reconnect.
- Change screen share quality during active sharing and confirm there is no hidden browser picker.
- Use camera and screen share together; set Auto for one stream and Manual for the other.
- Run connection test during an active call and outside a call.
- Apply recommendations, then switch both streams to Auto.
- Leave the call and confirm call state resets.
- Verify incoming accept, outgoing accept, decline, busy/end events still work.

## Backend Follow-Up Plan

If the existing `/livekit/token?room=quality-test-{userId}` flow is not allowed, add a dedicated backend endpoint:

- Route: `POST /api/livekit/connection-test-token` or `GET /api/livekit/connection-test-token`.
- Optional request DTO: `{ "scope": "connection-test" }`.
- Response DTO: `{ "serverUrl": string, "participantToken": string, "roomName": string, "expiresAt"?: string }`.
- Token permissions: join only a temporary test room, publish test audio/video, short TTL, no access to user call rooms.
- Frontend usage: call `livekitApi.getConnectionTestToken()`, connect to a temporary LiveKit room, publish a canvas video track, then sample `LocalVideoTrack.getSenderStats()`.

Optional real download test:

- Route: `GET /api/network-test/download?size=...`.
- Return generated bytes with cache disabled.
- Frontend measures elapsed time and bytes received, then combines that with LiveKit upload/RTT/jitter/loss metrics.
