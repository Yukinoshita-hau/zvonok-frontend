# Stage 8 performance fixtures

All data is synthetic. No production DB, real account or media device is needed.

- `node benchmarks/history.mjs`: isolated pre-Map versus Map observer-registration algorithm. Not React timing.
- `npx vitest run --config vitest.performance.config.ts`: real Redux reducer retention/order/edit/switch checks at 1k/5k/10k. No millisecond assertions.
- `node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 3188`: then open `http://127.0.0.1:3188/benchmarks/history.html`. Read JSON in `#results` after completion. It uses the real DmItemsList in a bounded 600 px container, React Profiler, synthetic users/messages, and a dedicated Redux store.
- `?acceptance=1`: strict geometry (<2 px) checks for prepend, expanding text, asynchronous Blob-backed image, reply navigation, follow-tail and editor retention outside the viewport. Observers and Blob URLs are instrumented and counted after unmount. The synthetic attachment downloader and readers API are stubbed inside this fixture only. No production API writes.
- `?acceptance=1&threshold=1`: the same acceptance at the normal-to-windowed transition (480 messages, prepend 30).

`react-baseline.json` and `react-final.json` are single observed dev-browser timing runs with identical text fixtures and viewport. They are not p95 or production latency. `react-acceptance.json` stores only functional/resource observations; its timing/commit counts are intentionally not mixed with the timing comparison.

`DmItemsList.stage8-baseline.txt` preserves the exact component after Map optimization but before windowing. To reproduce that intermediate browser baseline, first save the current component outside the source tree, temporarily copy this text into `src/components/DmItemsList/DmItemsList.tsx`, run the text-only browser fixture, and restore the saved component in a finally block. Do not use git reset/checkout to restore: the working tree includes earlier stabilization changes. The initial quadratic lookup is reproduced separately by history.mjs. No script automatically overwrites application sources.

Backend reproduction lives in `C:\project\zvonok-backend\src\test\java\com\zvonok\integrationtest\CorePerformanceIT.java`:

```powershell
mvn -o '-Dtest=CorePerformanceIT' '-Dstage8.optimized=true' test
```

It always creates disposable PostgreSQL Testcontainers and never reads application datasource credentials. Use the optimized property to enforce query upper bounds. Historical before/after output is retained in the stage8 backend logs listed in CORE-STABILIZATION-STAGE8.md. Current code runs the optimized implementation; reconstructing old backend behavior requires the pre-Stage-8 source, not disabling assertions. Times and PostgreSQL plans vary with warmup/statistics; query counts and functional checks are the regression contract.
