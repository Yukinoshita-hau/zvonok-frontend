# Совместный браузер: подготовка развёртывания

Статус на 21.10.2026: **VPS BLOCKED**, обычный Zvonok на порту 3000 не обновлён. Эта инструкция описывает gate активации; готового production browser profile пока нет. Базовый messenger работает без Browser Service.

## Флаги и сборка

| Настройка | Где действует | Значение по умолчанию |
|---|---|---|
| `VITE_BROWSER_ACTIVITY` | Frontend build-time; web и Electron renderer | `false` / отсутствует |
| `browser.activity.enabled` / `BROWSER_ACTIVITY_ENABLED` | Core runtime, включает controller/service beans | `false` / отсутствует |
| `browser.activity.key` / `BROWSER_ACTIVITY_KEY` | Core runtime, отдельный HMAC key, минимум 43 символа | отсутствует |
| `browser.activity.url` / `BROWSER_ACTIVITY_URL` | Core runtime, точный доверенный endpoint | `http://127.0.0.1:48035/integration` |
| `BROWSER_INTEGRATION_KEY` | Browser API runtime, тот же выделенный HMAC key | отсутствует |
| `BROWSER_INTEGRATION=1` | Worker runtime, Core lease/watchdog | выключен |
| `BROWSER_CORE_ORIGIN` | Broker runtime, точный Origin UI; текущий код принимает только loopback HTTP | отсутствует |
| `BROWSER_FIXTURE` | Worker runtime, acceptance fixture | `0` |

`BROWSER_INTEGRATION_KEY` не подставляется в Core автоматически: используйте `BROWSER_ACTIVITY_KEY` или явное `${BROWSER_INTEGRATION_KEY}` в закрытом properties-файле. Core JWT secret запрещено передавать Browser Service.

Оба frontend Dockerfile принимают `--build-arg VITE_BROWSER_ACTIVITY=true`, default `false`. В существующем `deployment/compose.yaml` этот arg не подключён: штатный `deploy.ps1 build` сохраняет браузер выключенным. После прохождения gates отдельный проверенный overlay должен передать arg в `frontend.build.args`; сборка должна получить новый `DEPLOY_TAG`. Для Electron переменная должна быть задана **до** `npm run build:desktop-renderer`. Переключение backend runtime flag или localStorage не меняет готовый renderer.

## Целевая сеть

Core → `http://browser-api:3000/integration` по отдельной внутренней trusted control network. Этот второй точный endpoint разрешён Core; произвольные URL, query, userinfo и другие hostname отклоняются. Подпись HMAC, nonce, срок assertion, PRIVATE membership, epoch и generation обязательны.

Только Browser API присоединяется к trusted Core network. У Browser API нет `ports`; privileged `/integration`, `/sessions*` и Worker IPC не публикуются в Caddy. Worker использует прежний network namespace guard, private Unix sockets, seccomp, sandbox, restricted proxy и не имеет Docker socket. Proxy — единственный выход Chromium в сеть, с существующей проверкой private/metadata IP и DNS rebinding.

Browser media Room остаётся независимой от voice Room. Viewer signaling разрешается публиковать только через membership-aware gate с TLS/WSS; прямой обход gate к LiveKit не допускается. Core voice signaling, токены и CallMediaOwner не меняются.

## Блокеры до создания рабочего VPS profile

1. `zvonok-browser/session/broker.mjs` возвращает `ws://127.0.0.1:48033`, принимает Core origin только вида loopback HTTP и читает локальные `spike` credentials из YAML. Нужны явные production origin/media URL и секреты, проверяемые fail-closed.
2. `session/livekit.local.yaml` рекламирует loopback ICE; `rtc-relay.mjs` является Docker Desktop TCP hop. Нужны реальный advertised IP, TCP/UDP/TURN, проверка с внешними клиентами и закрытый доступ publisher к LiveKit.
3. Текущий session Compose — single-session PoC с фиксированной subnet и локальными image prerequisites, не масштабируемый VPS allocator. Требуются lifecycle allocation/cleanup, durable registry/restart recovery и критерии beta для single-session limits.
4. Остаются ранее задокументированные риски изоляции Chromium/Worker/control IPC, operational audit/rate limits, bounded membership revocation и sustained media acceptance. Успех Core allowlist test не закрывает их.
5. Десятиминутная reliability, FPS ≥14.5, A/V offset с погрешностью, TTL cleanup, recovery и все незакрытые security/regression gates должны получить новые доказательства.

## Конкретный gate обновления основного приложения

До gate: закончить код и offline-проверки, создать проверяемый overlay с private API, отдельными ограниченными worker/broker/publisher, readiness и секретами вне Git; пройти изолированный E2E через реальный UI и внешний ICE. Сохранить список исходных изменений, release tag и план отката. Проверить backup без удаления/пересоздания текущих volumes.

На gate требуется **явное разрешение владельца обновить frontend/Core основного deployment на порту 3000** с указанием release tag, затрагиваемых сервисов и допустимого окна. До этого не выполнять `up`, `restart`, `stop`, migration или замену image текущего проекта. Существующий `deploy.ps1` охраняет только свой stage5e project и не является разрешением управлять основным deployment.

После разрешения и выполнения остальных gates: отдельно пересобрать renderer с флагом, обновить только разрешённые сервисы, проверить обычный URL/аккаунты и два клиента через DM → звонок → «Активности» → «Совместный браузер». Проверить видео, звук каждого viewer, передачу управления, закрытие Activity и непрерывность voice RTP. Только после этого статус normal deployment может стать YES.

Отключение после разрешения: запретить создание новых Activity, корректно закрыть активные сессии и проверить освобождение процессов/Room; выключить backend flag и вернуть renderer без entry при плановом rebuild. Не удалять БД/volumes и не менять voice credentials.

## Где доступно сейчас

Проверки на `http://127.0.0.1:3018` относятся только к отдельному acceptance frontend. Его запускает `scripts/browser-activity/start.ps1`, отдельный Core работает на `18080`, Browser API на loopback `48035`. Это не обычное приложение на `3000` и не способ активации для конечного пользователя. Реальная текущая работоспособность зависит от последней E2E кампании и отражается в product integration report.
