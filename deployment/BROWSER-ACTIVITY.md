# Совместный браузер: подготовка развёртывания

Обновление 24.10.2026: обычная локальная интеграция запускается через `zvonok-browser/compose.yaml`, без PS1 и дополнительных overlays. [Актуальная инструкция](../../zvonok-browser/docs/DOCKER-COMPOSE.md). Корневой backend Compose теперь сопоставляет `BROWSER_INTEGRATION_KEY` с `BROWSER_ACTIVITY_KEY`, корневой frontend Compose передаёт build arg `VITE_BROWSER_ACTIVITY`. Ниже сохранены прежние пути запуска и ограничения VPS; `deployment/compose.yaml` по-прежнему относится к отдельному deployment-профилю.

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

При запуске Java вне корневого backend Compose `BROWSER_INTEGRATION_KEY` не подставляется в Core автоматически: используйте `BROWSER_ACTIVITY_KEY` или явное `${BROWSER_INTEGRATION_KEY}` в закрытом properties-файле. Core JWT secret запрещено передавать Browser Service.

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

## Ручной запуск с обычным локальным Zvonok

Этот opt-in путь подключает Browser API к существующей Docker-сети Core `zvonok-net`; он не запускает acceptance Core и не использует DEV_TOKEN. Сначала обычный Zvonok должен уже работать, а Docker network `zvonok-net` существовать. Функция рассчитана на локальную проверку на одном компьютере: signaling URL Browser LiveKit пока loopback-only, поэтому удалённые устройства не подключатся.

В PowerShell из `C:/project/zvonok-browser` создайте отдельный случайный ключ и сохраните в игнорируемый локальный env-файл:

```powershell
$key = [Convert]::ToHexString([Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
@("BROWSER_INTEGRATION_KEY=$key", 'BROWSER_UI_ORIGIN=http://localhost:3000', 'ZVONOK_CORE_NETWORK=zvonok-net') | Set-Content -Encoding ascii .env.main.local
```

Из `C:/project/zvonok-browser` запустите только Browser сервисы и подключите API к существующей сети:

```powershell
docker --context desktop-linux compose --env-file .env.main.local -f compose.session.yaml -f compose.integration.yaml -f compose.main-local.yaml up -d --build api worker publisher publisher-2 rtc-relay
```

Перед переключением Core дождитесь readiness API/Worker:

```powershell
$ready = $false
for ($i = 0; $i -lt 60; $i++) {
  try { if ((Invoke-RestMethod http://127.0.0.1:48035/ready -TimeoutSec 2).status -eq 'ready') { $ready = $true; break } } catch { }
  Start-Sleep -Seconds 2
}
if (-not $ready) { throw 'Browser API/Worker не готовы; Core не перезапускайте' }
```

Из `C:/project/zvonok-backend` перезапустите только Core backend с локальным opt-in overlay и тем же ключом:

```powershell
$env:BROWSER_INTEGRATION_KEY = ((Get-Content 'C:/project/zvonok-browser/.env.main.local' | Where-Object { $_ -like 'BROWSER_INTEGRATION_KEY=*' }) -split '=',2)[1]
docker --context desktop-linux compose --env-file 'C:/project/zvonok-browser/.env.main.local' -f docker-compose.yml -f docker-compose.browser-activity.local.yml up -d backend
```

Запустите текущий frontend на привычном порту с build-time флагом (остановите только ранее запущенный Vite перед этим; не останавливайте Core):

```powershell
cd C:/project/zvonok-frontend
$env:VITE_BROWSER_ACTIVITY = 'true'
npm run dev -- --host 127.0.0.1 --strictPort
```

Откройте `http://localhost:3000`, войдите двумя реальными аккаунтами, начните обычный приватный звонок и выберите **Активности → Совместный браузер**. Второй пользователь принимает приглашение в том же звонке. Оба пользователя должны открыть UI с этой машины; origin выбран под существующую локальную CORS настройку `http://localhost:3000`. Для возврата к обычному режиму: закройте Activity кнопкой «Завершить для всех», примените backend compose без локального overlay (`docker compose -f docker-compose.yml up -d backend`), остановите только Browser stack командой ниже и перезапустите Vite без `VITE_BROWSER_ACTIVITY`. Не используйте `down -v`; Browser volumes и данные Core сохраняются.

```powershell
cd C:/project/zvonok-browser
docker --context desktop-linux compose -f compose.session.yaml -f compose.integration.yaml -f compose.main-local.yaml down
```

Состояние production остается выключенным: production compose не включает этот overlay, а оба feature flag по умолчанию `false`. Integration режим не использует DEV_TOKEN; compose оставляет его пустым, а API принимает только короткие подписанные Core assertions. Ручной запуск подтверждает только локальную функциональность; p95 A/V выше 150 ms, полный 600-секундный acceptance не пройден, production readiness и удалённый ICE не подтверждены.
