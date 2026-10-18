# Stage 10.2 media investigation

Use only the labelled isolated Stage10.1 PostgreSQL and LiveKit 1.13.10 stack and test accounts. No S3 is needed; the user's provider is unpaid/unavailable and must not be contacted. Do not change production token lifetime, SDK, codecs, transports, call/grace timers or security policies.

## Start

1. Save current Git/source baseline. Inspect existing container labels and ports. Start only `zvonok-stage10-1-livekit` after verifying label `zvonok.acceptance=stage10-1` and image1.13.10. Backend `ops/stage10-1/start.ps1 -Resume -JwtMilliseconds 15000` starts the known labelled test PostgreSQL and uses `zvonok_stage10_1`, `ddl-auto=validate`. Never run `create/update` against an unknown DB. Credentials remain in ignored `backend/stage10-1-evidence/runtime.env`; do not print them. No S3 container/proxy is required.
2. Start Vite from frontend with `VITE_API_URL=http://127.0.0.1:18080/api`, `VITE_WS_URL=ws://127.0.0.1:18080/api/ws-raw`, `VITE_MEDIA_DIAGNOSTICS=true`, host127.0.0.1, port13000, strict port. Diagnostic component is gated by both DEV and this explicit flag. Keep app source frozen during every measured series; HMR runs do not qualify as acceptance.
3. Existing bundled Playwright is reused through Stage10.1 `common.cjs`; no new framework. `STAGE10_PLAYWRIGHT` may point to another already installed Playwright module.

## Run

```powershell
$env:STAGE102_COUNT='30'
$env:STAGE102_VARIANTS='legacy,delayed,simultaneous,after-connected,refresh,stomp-publish,delay-A-token,delay-B-token,preconnect-A,preconnect'
node scripts/stage10-2/dm-investigation.cjs
```

One set of isolated accounts and one DM are reused within each series. Calls end before the next attempt, checking PeerConnections, captured tracks, contexts and DB CallSession count. Two-way acceptance requires growth of inbound bytes on both clients and positive current connected outbound bytes. The original30s audio deadline is retained. Checkpoints occur before connection, on SDK connect/subscription/publication, at microphone request, 1/3/5/10s and before teardown. Contexts are kept alive until diagnostic traces have been saved, including terminal state.

Variants: legacy sequential clicks,800ms delayed accept, simultaneous microphone clicks, connected-before-click, real refresh requests, STOMP close while real capture completion is delayed500ms, successful A/B token responses delayed700ms, and controlled successful RTC signalling until attempted early mic use. Delays are harness ordering controls, not product timers or fabricated media failures. `preconnect-A` gates only A; `preconnect` gates both. Routing must be installed **before navigation/constructor instrumentation**, otherwise cached native WebSocket constructors bypass the Playwright shim. Route hits and actual microphone request connection states are saved; a route label alone is not proof of ordering.

After the fix, the early button is disabled. The harness records `preconnectGuardObserved`, releases the successful handshake, and clicks after the actual connection. No fake RTP, muted samples, failed server or forged publication is used to manufacture the regression. On the preserved before-fix trace, the user request `true` while connecting is followed by SDK initial `false`, ACK then TrackMuted and one-way RTP. Do not reset the user's current checkout to recreate it: use saved baseline in a separately reviewed copy if needed.

For actual RNNoise worklet observation set `STAGE102_RNNOISE=1`; this dispatches the existing device setting on the isolated client before capture. It does not disable RNNoise. For a cancellation diagnostic use `STAGE102_COUNT=1` and `STAGE102_VARIANTS=pending-exit`; it records immediate cleanup and watches through the SDK's existing15s disconnected-publication timeout. This is a cleanup observation window, not an increased audio deadline. A live pending capture after hangup must not be hidden by the final eventual-cleanup PASS.

Run `node scripts/stage10-2/group-regression.cjs` for three-party GROUP, real STOMP reconnect, two incoming audio tracks per client, and cleanup. Set RNNoise env for worklet checks. Preserve previous `group-results.json` and traces before repeating.

## Evidence and analysis

`stage10-2-evidence/dm-results-*.json` contains exact PASS/FAIL and terminal cleanup. `trial-*-before-end-{A,B}.json` preserves the full monotonic event sequence and stats before end; terminal files retain the close sequence. Identity aliases are A/B outside traces and p1/p2 within each client; no JWT, cookie, API key, raw SDP, IP candidate addresses or device labels are recorded. IDs are opaque track/call IDs. Browser clocks have explicit wall/monotonic anchors; never assume perfect synchronization with Docker UTC logs.

Run `node scripts/stage10-2/sfu-evidence.cjs <UTC-ISO-start>` to extract allowlisted server track/state/RTP fields from the labelled SFU. It deliberately does not save raw signalling logs/SDP/tokens. Correlate by Call ID + track SID and direction, not pseudonymous server identity numbering. Then `node scripts/stage10-2/analyze.cjs` creates the cross-client pipeline table and aggregate counts. HMR overlap times are read from ignored run metadata hmr-times.json; keep separate run evidence rather than inventing universal exclusions.

Positive AudioTrack play resolution, attached HTML audio, running AudioContext and nonzero energy do not prove audible hardware output. RNNoise destroy messages prove destroy requested, not a WASM heap audit or hardware audio quality.

## Regression and stop

Run frontend `npm test`, `npm run build`, `npm run build:electron`. Backend test commands are in Stage10.1 regression script; use JDK21 and Testcontainers, never external DB overrides. Do not package over a running Windows jar.

Before stopping, save sanitized SFU evidence, run the Stage10 read-only audit SQL explicitly against `zvonok_stage10_1` and this stage's `server-audit.cjs`. Close all contexts. Verify process command lines and stop only own Vite13000/backend18080 and the known labelled test SFU/PostgreSQL. Keep database/evidence; do not delete unknown containers or existing S3 objects. Stage11/Hub is outside this work.

