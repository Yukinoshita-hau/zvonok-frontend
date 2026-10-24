# Локальный Zvonok с Browser Activity

## Состояние текущей среды

На 23.10.2026 конфигурация Compose и статические проверки двух Worker/Publisher-слотов проходят. **E2E BLOCKED**: `docker info` получает `Access is denied` при открытии `//./pipe/docker_engine`; CLI также не может прочитать metadata контекста `desktop-linux`. Минимальное действие владельца системы: запустить или разблокировать Docker Desktop и восстановить штатный доступ текущего пользователя к этому контексту и named pipe, затем проверить `docker --context desktop-linux info`. ACL вручную не менялись.

Нужны PowerShell 7, Docker Desktop с Linux containers (контекст `desktop-linux`) и соседние checkout `zvonok-frontend`, `zvonok-backend`, `zvonok-browser`. Предварительно собирать PoC-образы не требуется.

Из `C:\project\zvonok-frontend`:

```powershell
.\deployment\start.ps1
```

Откройте `http://localhost:13000`. Скрипт сам проверяет Compose config, собирает образы, создаёт сети, ждёт readiness и запускает Core с Browser Activity. Вручную переключать флаги или перезапускать Java не нужно. Production build flag остаётся выключенным по умолчанию.

Остановка с сохранением данных:

```powershell
.\deployment\start.ps1 -Action stop
```

Состояние:

```powershell
.\deployment\start.ps1 -Action status
```

Первый запуск генерирует отдельные пароли БД/storage, JWT secret, voice/media credentials и выделенный HMAC ключ Core↔Browser API. Они сохраняются в `%LOCALAPPDATA%\Zvonok\local-browser-activity` с ACL текущего пользователя, вне Git, без вывода значений. Повторный запуск использует те же секреты. Сохраните эту папку вместе с данными volumes; удаление секретов нарушит доступ к существующей БД.

## Контейнеры, сети и volumes

Один скрипт управляет двумя выделенными Compose projects, чтобы сохранить независимые voice и Browser media сервисы. Существующие проекты и acceptance Core для этого запуска не используются.

| Project | Контейнеры | Named volumes (с префиксом project) |
|---|---|---|
| `zvonok-local-browser` | frontend, backend, postgres, redis, rustfs, voice livekit, одноразовый bootstrap, caddy | postgres, redis, objects, caddy_data, caddy_config |
| `zvonok-local-browser-session` | guard, proxy, worker ×2, api, media livekit, broker ×2, publisher supervisor ×2, rtc-relay | guard-state, общий control с разными именами сокетов, отдельные binding/frames/auth для каждого слота |

Каждый Worker slot использует отдельные Xvfb display (`:91` и `:92`), Chromium profile и PulseAudio в собственном `/tmp`, control/binding/token sockets и media volumes. API раздаёт Activity свободному Worker через `BROWSER_WORKER_SOCKETS`; новый слот не получает IPC или media mount активного слота.

Остановка вызывает `down` без удаления volumes. Повторный start использует стабильные project names и данные. При ошибке запуска можно исправить причину и повторить ту же команду.

Все host-порты привязаны к loopback: UI/API `13000`, S3 `19020`, voice signaling `17880`, voice ICE TCP `17881`, voice ICE UDP `50200–50300`, Browser signaling gates `48033` и `48039`, Browser RTC TCP relay `48034`. БД, Redis, Browser API, Worker и Publisher host-портов не имеют. Отдельный standalone Browser debug client исключён из обычного запуска.

Core обращается к `http://browser-api:3000/integration` через внутреннюю сеть. Только API имеет выделенный HMAC key; Worker его не получает. Worker сохраняет namespace Guard, seccomp, Chromium sandbox, read-only filesystem и private IPC. Proxy — единственный egress Worker. Локальный firewall использует отдельный диапазон `172.30.88.0/24`, чтобы не пересекаться с прежним Browser PoC `172.30.87.0/24`. При занятом диапазоне или host-порте запуск завершается ошибкой; чужие сети и контейнеры не удаляются.

Readiness проверяет Core HTTP, API→Worker `/ready`, Guard firewall, Publisher supervisor/SDK/auth socket и Browser RTC/LiveKit listeners. Когда Activity закрыта, короткоживущий Publisher child завершён — готовность idle-сервиса определяется supervisor. Получение кадров отдельно проверено E2E.

## Проверка и ручной тест

Статус кода: **СОБРАНО, НУЖНА RUNTIME-ПРОВЕРКА**. Реальный запуск двух параллельных слотов в этой среде заблокирован Docker Engine. Человеческое прослушивание и проверка физических микрофонов не выполнены; автоматизация использует тестовые микрофоны.

В таблице ниже строки с `исторический PASS` относятся к прежнему прогону локального стека и не подтверждают новую двухслотовую конфигурацию или профили качества. Текущая проверка каждого profile и реальная параллельная работа ждут Docker E2E.

| Проверка в этой среде | Результат |
|---|---|
| Browser/Core Compose model validation и статические assertions слотов | PASS (текущая конфигурация, без запуска контейнеров) |
| Core, API, Worker, Publisher, RTC readiness | исторический PASS |
| Два аккаунта, UI login, обычный приватный звонок и двусторонний voice RTP | исторический PASS |
| BrowserSession, два декодирующих клиента, передача/отзыв управления | исторический PASS |
| Закрытие Activity, отзыв media-доступа и продолжающийся voice RTP | исторический PASS |
| Stop/start: те же 10 volumes, прежние секреты, login существующего аккаунта и старый JWT | исторический PASS |
| Guard firewall, Worker isolation, отсутствие public API ports, loopback bindings | исторический PASS |
| Повторный start с посторонними shell secrets и debug profile | исторический PASS |
| Два раздельных Worker/Publisher-слота, Compose-порты, volumes и IPC sockets | PASS (статически, 23.10.2026) |
| Контейнерный запуск и реальная параллельная Browser E2E в текущей среде | E2E BLOCKED: Docker named pipe `Access is denied` |
| 720p30, 720p60, 1080p30 и 1080p60 runtime/FPS gate | НЕ ИЗМЕРЕНЫ |

Сохранённый прежний functional E2E после stop/start не объявляет прохождение FPS-gate. В прежнем измерении 720p15 FPS был около 15, но это не подтверждает стабильное качество. Новые profiles принимаются только при декодируемом разрешении и минимум 95% целевой частоты кадров на обоих клиентах; десятиминутный soak остаётся отдельным gate. Все результаты старых прогонов хранятся в своих evidence-папках.

По умолчанию используется прежний профиль 720p15. Для runtime-прогона можно задать `BROWSER_MEDIA_PROFILE=720p30`, `720p60`, `1080p30` или `1080p60` в локальном `compose.env`; профиль влияет на Xvfb, capture, Browser Publisher и UI-диагностику. Это описание конфигурации, а не заявление о производительности.

Для ручного теста: два аккаунта → обычный приватный звонок → Активности → Совместный браузер → второй участник подключается → видео у обоих → передача управления → закрытие Activity с продолжающимся голосом → stop/start с сохранностью аккаунтов и данных.

Подробный отчёт этой среды: `artifacts/stages/local-browser-activity/REPORT.md`; функциональный результат — `e2e-functional-post-restart/results.json`, сохранность — `restart-results.json`, изоляция — `security-results.json` в той же stage-папке. Production readiness и длительный media acceptance этим запуском не подтверждаются.

## Друг на другом компьютере

Этот профиль рассчитан на клиентов на одном компьютере. Browser LiveKit выдаёт loopback signaling/ICE, а broker допускает loopback HTTP origin. Удалённый доступ не готов.

Для Core Voice ICE на Windows скрипт использует IPv4 приватного `vEthernet (WSL)`, если этот интерфейс доступен; HTTP и signaling остаются на localhost. Это позволяет Windows Chromium с уже выданным доступом к микрофону соединяться с Docker SFU без loopback ICE. Порты ICE привязываются только к выбранному виртуальному адресу; системные firewall и ACL не меняются.

Для друга нужны доступный клиентам TLS/WSS signaling origin через membership-aware gate, корректный routable advertised ICE IP, настроенные TCP/UDP порты или TURN и проверка из внешней сети. Потребуются изменения текущего loopback broker/media profile. Внутренние Browser API, Worker, Publisher и IPC нельзя публиковать в интернет для обхода этих ограничений.
