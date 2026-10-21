# Electron для обычного локального Docker

Из корня `zvonok-frontend`:

```powershell
npm run pack:desktop:local
```

Запускать `artifacts/stages/local-docker/package/win-unpacked/Zvonok.exe`.
Переносить следует весь каталог `win-unpacked`, а не один exe.
Это неподписанная локальная QA-сборка для работающего обычного Docker Zvonok.
Перед повторной упаковкой закройте запущенный LOCAL_DOCKER клиент: открытый
`app.asar` блокирует замену файлов. Обычный веб и Docker останавливать не требуется.

| Среда | Назначение | API / SFU |
| --- | --- | --- |
| LOCAL_DOCKER | Обычные локальные аккаунты, друзья, сообщения | `http://localhost:8080/api`, `ws://127.0.0.1:7880` |
| ISOLATED_E6 | Только изолированная приёмка | API `18086`, SFU `48886`; не использовать ежедневно |
| PRODUCTION | Публичное доверенное окружение | Только HTTPS/WSS; существующие `pack:desktop` / `dist:desktop` |

Источником LOCAL_DOCKER служит `config/desktop-local-docker.json`.
Профиль явно выбирает API `http://localhost:8080/api` и STOMP
`ws://localhost:8080/api/ws-raw`. SFU проверен по `LIVEKIT_SERVER_URL`
работающего backend и по ответу реального звонка: `ws://127.0.0.1:7880`.
Веб получает SFU из backend `CallTokenDto.serverUrl`; старое
`VITE_LIVEKIT_URL=ws://localhost:8080` в `.env` не определяет адрес звонка.
LOCAL_DOCKER переопределяет три адреса из `.env`; остальные настройки Vite
сохраняются. Конфликтующие переменные адресов в оболочке завершают сборку ошибкой.

Перед сборкой проверяются реальные JS-адреса работающего веба, CORS для
`http://localhost:3000` и доступность SFU. Renderer собирается заново в
`artifacts/stages/local-docker/renderer`; старый `dist` не используется.
Упаковщик использует установленный runtime `node_modules/electron/dist`.
После упаковки проверяется сам `resources/app.asar`: метаданные, JS,
отсутствие E6-адресов, точный список CSP connect-src и обработчик ресурсов.
Результат: `artifacts/stages/local-docker/bundle-verification.json`.

Метаданные находятся внутри пакета в `dist/desktop-environment.json`.
Профиль пользователя — `%APPDATA%/Zvonok-LOCAL_DOCKER`; это отдельные cookie,
localStorage и настройки, не существующий production/E6 профиль.
Маркер среды в userData проверяется при запуске; несовпадение останавливает запуск.
Первый вход требуется выполнить самостоятельно своим обычным аккаунтом.

## Origin, CORS и cookie

Только LOCAL_DOCKER обслуживает упакованные статические ресурсы через
session protocol handler под origin `http://localhost:3000` внутри Electron.
Сетевой сервер на 3000 остаётся нетронутым; дополнительный сервер не запускается.
Остальные HTTP-запросы передаются штатному сетевому стеку Electron.
Путь ресурсов ограничен каталогом `dist`, а методы — GET/HEAD.
React использует обычную browser-навигацию с fallback на упакованный index.html.

Таким образом backend видит уже разрешённый веб-origin; браузер сохраняет
свой существующий HttpOnly refresh-cookie для localhost. В проверенном Docker:
`SameSite=Lax`, `Secure=false`, `Path=/api/auth`, cookie постоянный.
Не добавляются `null` origins, отключение webSecurity/CSP, обход TLS,
экспорт JWT в preload или изменения серверной аутентификации.
Существующая production-ветка загрузки через file origin сохраняется.
Механизм обработчика описан в [официальной документации Electron](https://www.electronjs.org/docs/latest/api/protocol).

## Повторная приёмка

```powershell
npm run test:desktop:local
node scripts/electron-package-local.mjs --verify-only
```

Приёмка использует Playwright из имеющегося Codex runtime (или путь
`STAGE10_PLAYWRIGHT`) и требует возможности запуска Electron с записью в
свой userData. Она создаёт два выделенных QA-аккаунта через обычный веб,
дружбу, DM и звонки только между этими аккаунтами. Повторный запуск использует
те же QA-аккаунты; учётные данные хранятся в игнорируемом `accounts.local`.
JWT и значения cookies в отчёты не выводятся.
Сервисы Docker, credentials, volumes и production не изменяются.
В обычную базу добавляются только указанные тестовые данные.

Результаты, наблюдаемые адреса и скриншот находятся в
`artifacts/stages/local-docker/acceptance/`.
Для RTP используется синтетический аудиосигнал Chromium через настоящий
LiveKit/WebRTC; проверка физического микрофона и слышимости человеком отдельно
не выполняется. Итоговая таблица PASS/FAIL/NOT RUN — в `REPORT.md` рядом со сборкой.
