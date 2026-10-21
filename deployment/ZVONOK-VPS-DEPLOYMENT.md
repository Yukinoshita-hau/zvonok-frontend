# Подготовка VPS Zvonok

Документ относится к первой веб-версии Core на Ubuntu Server 26.04 x86-64, 4 vCPU, 8 GiB RAM и 60 GB NVMe. Browser Activity, Electron и Windows-пакеты не запускаются. Эта инструкция подготавливает и запускает стек, но локальная проверка не является подтверждением работы публичного сервиса.

## Состав и размещение checkout

Нужны два отдельных Git checkout рядом:

```text
/opt/zvonok/zvonok-frontend
/opt/zvonok/zvonok-backend
```

Frontend содержит Compose, Caddy, CLI и оба production Dockerfile. Backend содержит Spring Boot source и `storage/application-policy.json`, который нужен RustFS bootstrap. Репозиторий LiveKit не требуется: production использует закреплённый образ и создаваемый `init` файл `/etc/zvonok/livekit.yaml`. `deployment.properties` — локальный конфиг и не должен попадать в Git или Docker build context.

В backend checkout в commit обязательно включить `src/main/resources/application-prod.yml`: он содержит production `/api` context path и schema setting. Файл был исключён старым `.gitignore`; текущий `.gitignore` разрешает его tracked.

CLI требует уже установленный Docker Engine/Compose, `python3`, `openssl`, `gnupg`, `curl`, `tar`, `iproute2` (`ss`), `getent` и `findmnt`. При отсутствии `gpg` команда `doctor` укажет `sudo apt install gnupg`; пакет есть в официальном Ubuntu 26.04 (resolute) package index ([gnupg](https://packages.ubuntu.com/resolute/gnupg)). Скрипт не устанавливает пакеты и не запускает upgrade.

## Минимальные inputs и секреты

`deployment/vps/.env.example` содержит только безопасные operator inputs. Скопируйте его в `/etc/zvonok/operator.env`, заполните `ACME_EMAIL` и при наличии независимого mount укажите `BACKUP_DESTINATION`. Для этого VPS домен и IPv4 уже указаны: `zvonok.info`, `201.58.179.55`. До `install` оператор добавляет A-записи четырёх имён на этот IP и удаляет AAAA, если IPv6 отдельно не настроен. `init` создаёт `/etc/zvonok/deployment.env` и `/etc/zvonok/livekit.yaml` с правами `0600`; родитель `/etc/zvonok` имеет `0700`. Повторный `init` для той же пары домен/IP сохраняет существующие файлы и секреты.

Случайные значения создаются через `openssl rand`: PostgreSQL, HS512 JWT, RustFS root, ограниченная S3 identity, LiveKit API key/secret. Redis закрыт приватной Docker-сетью, доступ к host port не опубликован, пароль при текущей топологии не используется. Секреты не печатаются. Нельзя переносить эти файлы в checkout или Git.

## Сервисы, память и диск

PostgreSQL 16.10, Redis 7.4.6, RustFS 1.0.3, LiveKit 1.13.10, Spring Boot и React/Vite работают в одной изолированной Docker-сети. Caddy единственный HTTP ingress. PostgreSQL, Redis, RustFS API, backend и LiveKit signaling не имеют host port. Порты ICE LiveKit публикуются явно.

Compose memory ceilings: PostgreSQL 768 MiB, Redis 256 MiB, RustFS 1024 MiB, LiveKit 1536 MiB, backend 2560 MiB, frontend 384 MiB, Caddy 256 MiB; суммарно 6784 MiB. Backend heap ограничен `MaxRAMPercentage=70` (до ~1792 MiB heap в контейнере); это верхняя граница, не измеренный фактический RSS. Остаётся около 1.4 GiB хосту при полном достижении лимитов. Тестовых нагрузочных измерений на 4 vCPU не было.

На старте требуется не менее 15 GiB свободного места под последовательные сборки и образы. PostgreSQL, Redis, RustFS objects, Caddy certificates/config хранятся в named volumes. 60 GB ограничивает суммарный рост объектов, журналов и слоёв; следите за `df -h`/`docker system df`, задайте лимиты хранения в продукте до массовой загрузки файлов. Docker JSON logs ограничены 10 MiB × 3 файла на сервис.

## Frontend, API, S3 media и LiveKit

- `https://zvonok.info` — Vite production build, API `https://api.zvonok.info/api`, WebSocket `wss://api.zvonok.info/api/ws-raw`.
- `https://api.zvonok.info` — Spring Boot с профилем `prod`, TLS proxy, forwarded headers, secure refresh cookie, CORS только для основного web origin. STOMP/WebSocket upgrade проходит через Caddy.
- `https://media.zvonok.info/zvonok-data/*` — RustFS path-style S3 hostname для presigned SigV4 URLs. Caddy сохраняет Host/path, пропускает GET/HEAD/OPTIONS; backend credentials не передаются браузеру, bucket private. Поддержка Range делегируется RustFS; реальный внешний тест обязателен до публичного использования.
- `wss://livekit.zvonok.info` — signaling/WebSocket за Caddy. UDP media `50200–50300`, ICE/TCP `7881`; LiveKit получает публичный `--node-ip` и использует Redis `redis:6379`. Signaling proxy не проксирует медиапотоки.

TURN/TLS не настроен и не заявляется как готовый. Звонки через direct UDP/ICE-TCP — beta до двухклиентского внешнего теста. Для сетей, блокирующих эти пути, сначала выполнить LiveKit network acceptance, затем отдельно спроектировать/настроить TURN/TLS, сертификат и правила firewall; обычный Caddy HTTP proxy этого не заменяет.

## DNS и firewall

Создайте A для `zvonok.info`, `api.zvonok.info`, `media.zvonok.info`, `livekit.zvonok.info` -> `201.58.179.55`. CLI проверяет resolver A и отсутствие AAAA. При ошибке он печатает нужное имя/IP и требует исправить DNS в панели провайдера; автоматического DNS изменения нет.

| Направление | Порт | Источник/назначение |
|---|---|---|
| Ingress | TCP 22 | SSH только с доверенных адресов; сохранить доступ перед изменением правил |
| Ingress | TCP 80, 443 | Публичные HTTPS/ACME через Caddy |
| Ingress | TCP 7881 | LiveKit ICE/TCP |
| Ingress | UDP 50200–50300 | LiveKit ICE media |
| Внутренние | 5432, 6379, 7880, 9000, 3000, 8080 | Не открывать на host/provider firewall |

Примените матрицу и в firewall VPS провайдера. CLI не меняет UFW и не ставит firewall пакеты. UDP mux не включён: сохраняется pinned ICE диапазон `50200–50300`.

## Образы и запуск

Registry workflow в репозиториях не найден, поэтому первый запуск собирает frontend/backend на VPS из двух checkout. Сборка строго последовательная, BuildKit включён, `doctor` проверяет Ubuntu 26.04, Docker/Compose, DNS, свободное место и RAM. Docker Engine не переустанавливается и не понижается. Каждый app image тегируется полным HEAD SHA своего репозитория. `update` требует указать ровно соответствующую пару SHA и checkout этих revisions; git pull/checkout скрипт не выполняет. Для последующих релизов рекомендуется CI build/publish immutable OCI images по commit SHA и отдельный pull-only режим.

`install` без `--apply` завершается отказом. Перед созданием контейнеров валидируется Compose и владение уже существующими контейнерами/volumes. Не принадлежащие deployment volumes не меняются. Compose health checks подтверждают PostgreSQL, Redis, RustFS bootstrap, LiveKit, backend, frontend и Caddy; CLI затем проверяет публичные HTTPS frontend и `/api/health`. При непрохождении readiness команда завершается ошибкой, причину нужно смотреть в `status`/`logs`.

## PostgreSQL и ограничения rollback

Production контейнер задаёт `SPRING_PROFILES_ACTIVE=prod`, инъецирует все runtime credentials через environment и не копирует локальный `deployment.properties`. Для новой пустой БД применяется существующий `spring.jpa.hibernate.ddl-auto=update`: миграций Flyway/Liquibase нет. Это позволяет Hibernate создать текущую схему при первом старте, но не является доказанным migration/rollback процессом. Откат image не откатывает схему; до критичных обновлений обязателен проверенный backup и тест restore. Не меняйте `ddl-auto` на `create`/`create-drop`.

## Backup и restore

`backup` требует существующий смонтированный каталог `BACKUP_DESTINATION` в `/etc/zvonok/deployment.env`, passphrase от 16 символов вводится интерактивно и не сохраняется на VPS. Backend кратковременно останавливается; PostgreSQL custom dump, RustFS data, env и LiveKit config собираются в архив и шифруются GnuPG symmetric AES256 с целостностью MDC. Команда сразу проверяет расшифрование созданного файла, затем предупреждает, если каталог находится на root filesystem. Пароль архивов нужно хранить отдельно. Локальный backup не защищает от потери VPS: сначала подключите независимый зашифрованный диск/экспортируйте зашифрованный архив в другое место и проверьте восстановление на disposable данных.

`restore` требует путь к шифрованному архиву, `--confirm-service-stop`, `--confirm-overwrite zvonok-prod` и повторный ввод фразы `RESTORE-ZVONOK-PROD`; затем запрашивает passphrase архива. Операция останавливает app/edge/media и перезаписывает активные PostgreSQL и RustFS данные. **До первого production restore этот путь должен быть проверен на disposable volumes**; выполнять на активной БД без копии не следует.

## Команды эксплуатации

Из корня frontend checkout на VPS:

```bash
sudo install -d -m 700 /etc/zvonok
sudo cp deployment/vps/.env.example /etc/zvonok/operator.env
sudoedit /etc/zvonok/operator.env
sudo bash deployment/vps/zvonok-vps.sh init --config /etc/zvonok/operator.env
sudo bash deployment/vps/zvonok-vps.sh doctor
sudo bash deployment/vps/zvonok-vps.sh install --apply
sudo bash deployment/vps/zvonok-vps.sh status
sudo bash deployment/vps/zvonok-vps.sh logs
  sudo bash deployment/vps/zvonok-vps.sh acceptance
sudo bash deployment/vps/zvonok-vps.sh backup
```

`acceptance` read-only проверяет DNS, container health, HTTPS/API/media/LiveKit proxy и внутренние host port bindings. Он не создаёт test account/upload и не доказывает ICE через внешнюю сеть.

Для обновления сначала оператор вручную checkout-ит согласованные commit SHA в обоих чистых клонах, затем `update --tag f<полный-frontend-SHA>-b<полный-backend-SHA> --apply`. Restore имеет разрушительный эффект и требует отдельного runbook/backup.

## Приёмка, которую нужно выполнить на VPS

После deploy отдельно проверьте регистрацию/вход, refresh cookie, сообщения и STOMP reconnect, upload/download/HEAD/Range для private objects, RustFS restart/persistence, HTTPS certificate renewal, два внешних клиента, ICE candidates с публичным IP и поток UDP/TCP через firewall. Проверить сети с заблокированным UDP можно только после TURN/TLS реализации. До успешного backup restore, внешнего API/storage и звонка двух клиентов сервис не считать production-ready для широкой публики.
