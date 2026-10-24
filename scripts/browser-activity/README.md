# Local Browser Activity acceptance

`e2e.cjs --quality` runs a focused real two-client regression: quality 720p30 → 720p60 → 720p15 → 720p30, both clients' selected profile and new decoded video track, live browser audio tracks, and advancing voice RTP. It creates two test accounts and a separate call, then ends only that call. Set `BROWSER_TEST_BASE`, `BROWSER_TEST_API`, and `BROWSER_TEST_OUT` for an explicitly authorized remote environment. This mode skips local Docker fault injection/log export. It proves reconnection behavior; it records receiver FPS without claiming target-FPS performance acceptance.

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

`e2e.cjs --audio --soak` запрашивает 600000 ms. `media-acceptance.cjs` проверяет длительность, непрерывность counters, точное разрешение и не менее 95% целевой частоты кадров каждого viewer для выбранного `BROWSER_MEDIA_PROFILE` (720p15 по умолчанию). Короткий functional PASS не означает sustained PASS. Самопроверка анализатора: `node scripts/browser-activity/media-acceptance.cjs`. Профили 720p30/60 и 1080p30/60 настроены, но их runtime acceptance требует доступного Docker Engine; физическое прослушивание также не подтверждено.

Для `e2e.cjs --audio` перед `start.ps1` задайте `$env:BROWSER_FIXTURE='1'`: audio campaign нажимает кнопку на локальной controlled fixture, а значение по умолчанию `0` открывает обычный `example.com` без тестового звука.

Idle TTL остаётся пять минут: heartbeat/status не продлевают его. Для измерения активной сессии `--audio --soak --active-input` раз в минуту делает реальное движение указателя через UI и проверяет обновление idle deadline при неизменном absolute TTL. Прогон без ввода остаётся отдельной проверкой idle expiration. Guest membership имеет десятиминутный lease: в integration режиме только свежая Core-authorized heartbeat с текущими epoch/generation продлевает ещё действующий lease в пределах absolute session TTL. Прямой guest token, истёкшие/отозванные права и stale generation продление не получают. Standalone DEV heartbeat не продлевает membership.

Для последовательного сравнения на одном candidate: `--benchmark` измеряет video-only, `--benchmark --audio` — video+audio, по120 секунд после UI create/join/decode. Перед первым вариантом только в disposable Browser Compose задаётся `BROWSER_AUDIO=0`, перед вторым возвращается `1`; flag отключает Browser audio capture/publication, не voice. Quotas, video profile, authentication и TTL одинаковы. `BROWSER_TEST_PROJECT` выбирает существующий disposable Compose project для harness diagnostics/faults. Измеренные samples не означают автоматический PASS; сравнение текущих A/C без старой сопоставимой B не является полным A/B/C.

`regression.cjs` runs presentation suites in sequence against Vite3019 with fresh outputs. `--settings` expects the existing Settings fixture config on3020. These are synthetic presentation tests, separate from real Core acceptance.

`C:/project/zvonok-browser/session/slice4-regression.ps1` runs prior Browser suites sequentially. It temporarily returns the idle Browser session stack to its original local DEV mode, starts/stops the older standalone PoCs and restores the integration overlay in `finally`. Never run it while a Core Browser Activity or another Browser E2E campaign is active. It does not delete volumes or modify Core Docker.

Before production: durable session allocation/registry; process and UID separation for Chromium versus Worker/control IPC; independently protected membership enforcement and bounded revocation SLA; authenticated encrypted non-loopback transport/key rotation; per-principal Core request limits and operational auditing; multi-replica failover acceptance; remote ICE and sustained resource/load acceptance. This implementation intentionally certifies only the local two-person vertical slice.

### Identified A/V event diagnostic

The audio campaign transmits each shared 16-bit event ID in both a CRC-8 protected 4-FSK audio code and a CRC-8 protected 12×6 visual code with three repetitions per bit. Each receiver decodes IDs from received PCM and decoded video independently; matching, missing IDs, duplicates, invalid codes, ambiguity, signed offsets, detector timestamps, confidence, uncertainty, coverage, and drift are written to `av.json` under `identifiedEventDiagnostic`. p95 is `INCONCLUSIVE` below 20 unique matched IDs. This diagnostic is separate from the legacy nearest-edge p95 and unchanged 150 ms gate. Neither is a calibrated physical speaker/display sync measurement.

The visual event grid uses its own 240×120 canvas at source coordinates 1024,560. A magenta presence pilot distinguishes active events from the inactive black grid and source event ID 0; do not gate decoded IDs on average grid brightness because valid low-density IDs can have a dark average. The fixture and worker capture remain 1280×720; the reader crops intrinsic video pixels, independent of display `devicePixelRatio`.

After `start.ps1` has brought up the isolated acceptance services, run this short runtime check (35 seconds, not the 600-second soak) from `C:/project/zvonok-frontend`:

```powershell
$env:BROWSER_TEST_OUT = 'artifacts/stages/browser-avsync-diagnostics-20261022/identified-events'
node scripts/browser-activity/e2e.cjs --audio --av-only
```

Evidence is stored in `av.json`; it contains both methods separately for each receiver. Stop the isolated stack with `./scripts/browser-activity/stop.ps1` after the run.
