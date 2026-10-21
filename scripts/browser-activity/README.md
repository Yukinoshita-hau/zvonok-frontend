# Local Browser Activity acceptance

Use Java 21 and the existing Maven cache to package `C:/project/zvonok-backend` before running `start.ps1`. Do not package over a jar held open by an acceptance Java process; stop that process first with `stop.ps1`.

`start.ps1` creates a separate `activity_acceptance` PostgreSQL database on loopback 55432, separate voice LiveKit on 48880/48881/48882 and a host Core process on 18080. It builds a pinned acceptance frontend on 3018, with `VITE_BROWSER_ACTIVITY=true`, using the existing components. It does not modify running Core Docker or its database/network. The Browser Worker retains its guard network, sandbox, private X11, no media secrets and restricted HTTPS proxy.

Local keys are generated into ignored `.local` files, never logged or committed. The dedicated Browser HMAC key is shared only with Core and Browser API; no Core JWT signing key enters Browser containers. Browser API exposes only loopback 48035 for signed one-time assertions. The broker gate accepts the exact UI origin `http://127.0.0.1:3018`. Integration mode disables the old `/sessions*` DEV/guest entry points.

Run sequentially from the frontend directory:

```powershell
./scripts/browser-activity/start.ps1
node scripts/browser-activity/e2e.cjs
node scripts/browser-activity/e2e.cjs --faults
./scripts/browser-activity/stop.ps1
```

The E2E registers unique real users through the actual Core HTTP API, creates friendship over authenticated STOMP, opens their DM and accepts a real call. Test microphones are Chrome's synthetic capture devices; actual audio RTP transport is measured. Hardware audibility is not certified. UI browser video comes from the real sandboxed server Chromium and separate Browser LiveKit room. No credentials are written into result JSON. Existing failed attempts remain in their own evidence directories.

Обычная frontend-сборка включает вход при `VITE_BROWSER_ACTIVITY=true`; Core требует `browser.activity.enabled=true` и отдельный `browser.activity.key` (43+ символа). По умолчанию функция выключена. В исходниках Core разрешены точные endpoints `http://127.0.0.1:48035/integration` и `http://browser-api:3000/integration`; container loopback не означает Windows host. Рабочий VPS media profile пока заблокирован локальной signaling/ICE topology. Обычный Zvonok3000 этим сценарием не обновляется. Подробности и gate обновления: `deployment/BROWSER-ACTIVITY.md`, `artifacts/stages/ZVONOK-BROWSER-PRODUCT-INTEGRATION-REPORT.md`.

`e2e.cjs --audio --soak` запрашивает600000ms. `media-acceptance.cjs` отдельно оценивает длительность, FPS14.5 каждого viewer, непрерывность counters и разрешение; короткий functional PASS не означает sustained PASS. Самопроверка анализатора: `node scripts/browser-activity/media-acceptance.cjs`. Новые campaigns пока FAIL; физическое прослушивание и Electron не подтверждены.

`regression.cjs` runs presentation suites in sequence against Vite3019 with fresh outputs. `--settings` expects the existing Settings fixture config on3020. These are synthetic presentation tests, separate from real Core acceptance.

`C:/project/zvonok-browser/session/slice4-regression.ps1` runs prior Browser suites sequentially. It temporarily returns the idle Browser session stack to its original local DEV mode, starts/stops the older standalone PoCs and restores the integration overlay in `finally`. Never run it while a Core Browser Activity or another Browser E2E campaign is active. It does not delete volumes or modify Core Docker.

Before production: durable session allocation/registry; process and UID separation for Chromium versus Worker/control IPC; independently protected membership enforcement and bounded revocation SLA; authenticated encrypted non-loopback transport/key rotation; per-principal Core request limits and operational auditing; multi-replica failover acceptance; remote ICE and sustained resource/load acceptance. This implementation intentionally certifies only the local two-person vertical slice.
