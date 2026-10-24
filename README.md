# zvonok-frontend

## Browser через Docker Compose

Для обычного локального Zvonok теперь используются штатные Compose-файлы трёх репозиториев. В frontend `.env` включите `VITE_BROWSER_ACTIVITY=true`, в backend `.env` — `BROWSER_ACTIVITY_ENABLED=true` и общий с Browser `BROWSER_INTEGRATION_KEY`. Browser имеет свой `.env.example` и запускается из `zvonok-browser` командой `docker compose up -d --build --wait --wait-timeout 180`; затем пересоберите backend и frontend через их `docker compose up -d --build`.

Полная инструкция с секретами, сетью, портами и диагностикой: [zvonok-browser/docs/DOCKER-COMPOSE.md](../zvonok-browser/docs/DOCKER-COMPOSE.md). PowerShell-скрипт для этого запуска не нужен. Текущий Browser media transport рассчитан на клиентов на компьютере с Docker.

## Прежний отдельный локальный стенд на 13000

PowerShell 7, Docker Desktop (Linux containers), соседние checkout `zvonok-backend` и `zvonok-browser`:

```powershell
.\deployment\start.ps1
```

Откройте [http://localhost:13000](http://localhost:13000). Секреты, сборки, Browser Activity flags и порядок запуска настраиваются автоматически.

Остановка с сохранением данных:

```powershell
.\deployment\start.ps1 -Action stop
```

[Инструкция, контейнеры, volumes и статус проверок](deployment/LOCAL-BROWSER-ACTIVITY.md). Профиль рассчитан на один компьютер; удалённый ICE ещё не готов.
