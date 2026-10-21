#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

usage() {
  cat <<'EOF'
Использование: sudo bash deployment/vps/zvonok-vps.sh COMMAND [options]
  init --domain DOMAIN --email EMAIL --public-ip IPv4
       --config /etc/zvonok/operator.env
  doctor
  install --apply
  status
  logs [SERVICE]
  acceptance
  backup
  restore --file FILE --confirm-service-stop --confirm-overwrite zvonok-prod
  update --tag FRONTEND_SHA-BACKEND_SHA --apply

Конфигурация и LiveKit secrets: /etc/zvonok/deployment.env, /etc/zvonok/livekit.yaml.
EOF
}
die() { printf 'ОШИБКА: %s\n' "$*" >&2; exit 1; }
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
DEPLOY_DIR="$(cd -- "$SCRIPT_DIR/.." && pwd -P)"
FRONTEND_ROOT="$(cd -- "$DEPLOY_DIR/.." && pwd -P)"
BACKEND_ROOT="$(cd -- "$FRONTEND_ROOT/../zvonok-backend" 2>/dev/null && pwd -P || true)"
ENV_FILE="${ZVONOK_ENV_FILE:-/etc/zvonok/deployment.env}"
CONFIG_FILE=""
APPLY=false
DOMAIN="" EMAIL="" PUBLIC_IP="" RELEASE_TAG="" SERVICE="" BACKUP_FILE=""
CONFIRM_STOP=false CONFIRM_OVERWRITE=""
ACTION="${1:-help}"; shift || true
while (($#)); do
  case "$1" in
    --domain|--email|--public-ip|--tag|--file|--confirm-overwrite|--env-file|--config)
      (($# >= 2)) || die "$1 требует значение"
      case "$1" in
        --domain) DOMAIN=$2 ;; --email) EMAIL=$2 ;; --public-ip) PUBLIC_IP=$2 ;;
        --tag) RELEASE_TAG=$2 ;; --file) BACKUP_FILE=$2 ;;
        --confirm-overwrite) CONFIRM_OVERWRITE=$2 ;; --env-file) ENV_FILE=$2 ;; --config) CONFIG_FILE=$2 ;;
      esac
      shift 2 ;;
    --confirm-service-stop) CONFIRM_STOP=true; shift ;;
    --apply) APPLY=true; shift ;;
    *)
      if [[ "$ACTION" == logs && -z "$SERVICE" && "$1" != -* ]]; then SERVICE=$1; shift
      else die "Неизвестный параметр или аргумент: $1"; fi ;;
  esac
done

compose() {
  docker compose --project-directory "$DEPLOY_DIR" --env-file "$ENV_FILE" \
    -f "$DEPLOY_DIR/compose.yaml" -f "$DEPLOY_DIR/prod.yaml" \
    -f "$SCRIPT_DIR/production.yaml" "$@"
}
load_env() {
  [[ -f "$ENV_FILE" ]] || die "Нет $ENV_FILE; сначала выполните init"
  chmod 600 "$ENV_FILE"
  while IFS='=' read -r key value; do
    [[ "$key" =~ ^[A-Z][A-Z0-9_]*$ ]] || continue
    printf -v "$key" '%s' "$value"
    export "$key"
  done < "$ENV_FILE"
}
check_dns() {
  local host got
  for host in "$DOMAIN" "api.$DOMAIN" "media.$DOMAIN" "livekit.$DOMAIN"; do
    got=$(getent ahostsv4 "$host" | awk '{print $1}' | sort -u || true)
    [[ "$got" == "$LIVEKIT_NODE_IP" ]] || die "DNS A для $host должен быть $LIVEKIT_NODE_IP; найдено: ${got:-записи нет}. Исправьте A в панели DNS. Удалите AAAA, пока IPv6 отдельно не настроен."
    if getent ahostsv6 "$host" | grep -q .; then die "Для $host опубликована AAAA, IPv6 не настроен. Удалите AAAA в панели DNS либо завершите отдельную IPv6 настройку."; fi
  done
}
check_ports() {
  local port
  for port in 80 443; do
    if ss -H -lnt "sport = :$port" | grep -q .; then
      ss -H -lntp "sport = :$port" >&2 || true
      die "TCP $port уже занят; процесс не остановлен"
    fi
  done
  ss -H -lnu 'sport = :443' | grep -q . && die 'UDP 443 уже занят; Caddy HTTP/3 в этой конфигурации не используется'
}
check_os() {
  [[ -r /etc/os-release ]] || die 'Не найден /etc/os-release'
  # shellcheck disable=SC1091
  . /etc/os-release
  [[ "${ID:-}" == ubuntu && "${VERSION_ID:-}" == 26.04 ]] || die "Требуется Ubuntu 26.04; обнаружено ${PRETTY_NAME:-неизвестно}. Docker не переустанавливается."
}
check_requirements() {
  local bin
  for bin in docker python3 openssl gpg getent ss curl tar findmnt; do command -v "$bin" >/dev/null || die "Не найдена команда $bin; при отсутствии установите: sudo apt install gnupg"
  done
  docker info >/dev/null 2>&1 || die 'Docker Engine недоступен текущему пользователю; проверьте sudo docker info'
  docker compose version >/dev/null || die 'Не найден Docker Compose plugin'
  [[ -n "$BACKEND_ROOT" && -f "$BACKEND_ROOT/pom.xml" ]] || die "Backend checkout не найден. Разместите оба клона рядом: $FRONTEND_ROOT и $(dirname "$FRONTEND_ROOT")/zvonok-backend"
}
init() {
  check_os
  if [[ -n "$CONFIG_FILE" ]]; then
    [[ -f "$CONFIG_FILE" ]] || die "Не найден operator config: $CONFIG_FILE"
    local key value
    while IFS='=' read -r key value; do
      [[ "$key" =~ ^(DOMAIN|ACME_EMAIL|PUBLIC_IPV4|BACKUP_DESTINATION)$ ]] || continue
      case "$key" in
        DOMAIN) [[ -n "$DOMAIN" ]] || DOMAIN=$value ;;
        ACME_EMAIL) [[ -n "$EMAIL" ]] || EMAIL=$value ;;
        PUBLIC_IPV4) [[ -n "$PUBLIC_IP" ]] || PUBLIC_IP=$value ;;
      esac
      [[ "$key" != BACKUP_DESTINATION ]] || BACKUP_DESTINATION=$value
    done < "$CONFIG_FILE"
  fi
  [[ "$DOMAIN" =~ ^[A-Za-z0-9.-]+\.[A-Za-z]{2,}$ && "$DOMAIN" != *..* ]] || die 'Некорректный --domain'
  [[ "$EMAIL" == *@*.* && "$EMAIL" != *[[:space:]]* ]] || die 'Некорректный --email'
  python3 - "$PUBLIC_IP" <<'PY' || die 'Некорректный или непубличный --public-ip'
import ipaddress,sys
ip=ipaddress.ip_address(sys.argv[1])
if not ip.is_global or ip.version != 4: raise SystemExit(1)
PY
  [[ "$ENV_FILE" != "$FRONTEND_ROOT"/* && "$ENV_FILE" != "$BACKEND_ROOT"/* ]] || die 'Секреты должны храниться вне Git checkout'
  install -d -m 700 "$(dirname "$ENV_FILE")"
  local livekit_file="$(dirname "$ENV_FILE")/livekit.yaml"
  if [[ -e "$ENV_FILE" ]]; then
    chmod 600 "$ENV_FILE"
    grep -Fxq "DOMAIN=$DOMAIN" "$ENV_FILE" && grep -Fxq "LIVEKIT_NODE_IP=$PUBLIC_IP" "$ENV_FILE" || die 'Существующая конфигурация относится к другому домену/IP; файл сохранён без изменений'
    [[ -s "$livekit_file" ]] || die "Конфигурация $livekit_file отсутствует; восстановите её из резервной копии, секреты не пересозданы"
    printf 'Существующие секреты и конфигурация сохранены: %s\n' "$ENV_FILE"
    return
  fi
  local pg jwt root_key root_secret app_key app_secret lk_key lk_secret tmp
  pg=$(openssl rand -hex 32); jwt=$(openssl rand -base64 64 | tr -d '\n')
  root_key=$(openssl rand -hex 10 | tr '[:lower:]' '[:upper:]'); root_secret=$(openssl rand -hex 32)
  app_key=$(openssl rand -hex 10 | tr '[:lower:]' '[:upper:]'); app_secret=$(openssl rand -hex 32)
  lk_key=$(openssl rand -hex 10 | tr '[:lower:]' '[:upper:]'); lk_secret=$(openssl rand -hex 32)
  tmp=$(mktemp "$(dirname "$ENV_FILE")/.deployment.XXXXXX")
  cat > "$tmp" <<EOF
COMPOSE_PROJECT_NAME=zvonok-prod
FRONTEND_TAG=unbuilt
BACKEND_TAG=unbuilt
DOMAIN=$DOMAIN
POSTGRES_PASSWORD=$pg
JWT_SECRET=$jwt
RUSTFS_ACCESS_KEY=$root_key
RUSTFS_SECRET_KEY=$root_secret
S3_ACCESS_KEY=$app_key
S3_SECRET_ACCESS_KEY=$app_secret
LIVEKIT_API_KEY=$lk_key
LIVEKIT_API_SECRET=$lk_secret
APP_URL=https://$DOMAIN
API_SITE=https://api.$DOMAIN
API_URL=https://api.$DOMAIN/api
WS_PUBLIC_URL=wss://api.$DOMAIN/api/ws-raw
S3_PUBLIC_URL=https://media.$DOMAIN
LIVEKIT_HTTP_URL=https://livekit.$DOMAIN
LIVEKIT_PUBLIC_URL=wss://livekit.$DOMAIN
LIVEKIT_NODE_IP=$PUBLIC_IP
ICE_BIND_IP=0.0.0.0
ICE_TCP_PORT=7881
ICE_UDP_START=50200
ICE_UDP_END=50300
COOKIE_SECURE=true
ALLOW_LOOPBACK_HTTP=false
DISK_WARNING_FREE_GIB=15
CADDY_CONFIG_FILE=$SCRIPT_DIR/Caddyfile
LIVEKIT_CONFIG_FILE=$livekit_file
ACME_EMAIL=$EMAIL
BACKUP_DESTINATION=${BACKUP_DESTINATION:-}
EOF
  chmod 600 "$tmp"
  (set -o noclobber; cat "$tmp" > "$ENV_FILE") || { rm -f "$tmp"; die 'Не удалось атомарно создать конфигурацию'; }
  rm -f "$tmp"
  cat > "$livekit_file" <<'EOF'
port: 7880
log_level: info
rtc:
  tcp_port: 7881
  port_range_start: 50200
  port_range_end: 50300
  use_external_ip: false
redis:
  address: redis:6379
keys: {}
EOF
  chmod 600 "$livekit_file"
  printf 'Конфигурация создана с режимом 600: %s. Секреты не выводились.\n' "$ENV_FILE"
  printf 'Создайте A-записи %s, api.%s, media.%s, livekit.%s -> %s; удалите неиспользуемые AAAA.\n' "$DOMAIN" "$DOMAIN" "$DOMAIN" "$DOMAIN" "$PUBLIC_IP"
}
doctor() {
  check_os
  check_requirements
  load_env
  check_dns
  check_ports
  local free_gib ram_mib
  free_gib=$(df -Pm "$FRONTEND_ROOT" | awk 'NR==2 {print int($4/1024)}')
  ram_mib=$(awk '/MemTotal/ {print int($2/1024)}' /proc/meminfo)
  (( free_gib >= 15 )) || die "Свободно ${free_gib} GiB; нужно не менее 15 GiB для сборки и runtime"
  (( ram_mib >= 7000 )) || die "Обнаружено ${ram_mib} MiB RAM; target 8 GiB недостаточно"
  compose config --quiet || die 'docker compose config завершился ошибкой; значения секретов не выводятся'
  if [[ -z "$BACKUP_DESTINATION" ]]; then
    printf 'ПРЕДУПРЕЖДЕНИЕ: независимый backup destination не настроен; данные пока защищены только диском VPS.\n' >&2
  fi
  printf 'PASS: Ubuntu %s, Docker/Compose, DNS, порты, диск (%s GiB), RAM (%s MiB), Compose.\n' "$VERSION_ID" "$free_gib" "$ram_mib"
}
release_tag() {
  local front back
  [[ -z "$(git -c safe.directory="$FRONTEND_ROOT" -C "$FRONTEND_ROOT" status --porcelain)" ]] || die "Frontend checkout содержит незакоммиченные файлы: $FRONTEND_ROOT; сначала review/commit"
  [[ -z "$(git -c safe.directory="$BACKEND_ROOT" -C "$BACKEND_ROOT" status --porcelain)" ]] || die "Backend checkout содержит незакоммиченные файлы: $BACKEND_ROOT; сначала review/commit"
  front=$(git -c safe.directory="$FRONTEND_ROOT" -C "$FRONTEND_ROOT" rev-parse --verify HEAD)
  back=$(git -c safe.directory="$BACKEND_ROOT" -C "$BACKEND_ROOT" rev-parse --verify HEAD)
  printf 'f%s-b%s' "$front" "$back"
}
set_release_tag() {
  local tag=$1 tmp front back
  front="${tag#f}"; front="${front%%-b*}"; back="${tag#*-b}"
  tmp=$(mktemp "$(dirname "$ENV_FILE")/.deployment.XXXXXX")
  awk -v front="$front" -v back="$back" 'BEGIN{f=0;b=0} /^FRONTEND_TAG=/ {print "FRONTEND_TAG=" front; f=1; next} /^BACKEND_TAG=/ {print "BACKEND_TAG=" back; b=1; next} {print} END{if(!f) print "FRONTEND_TAG=" front; if(!b) print "BACKEND_TAG=" back}' "$ENV_FILE" > "$tmp"
  chmod 600 "$tmp" && mv -f "$tmp" "$ENV_FILE"
  export FRONTEND_TAG="$front" BACKEND_TAG="$back"
}
install_services() {
  check_os; check_requirements; load_env; check_dns; check_ports
  [[ -n "$BACKUP_DESTINATION" ]] || printf 'ПРЕДУПРЕЖДЕНИЕ: независимое место backup не настроено; отказ VPS приведёт к потере данных.\n' >&2
  compose config --quiet || die 'Compose-конфигурация некорректна'
  verify_ownership
  local tag
  tag=$(release_tag)
  (( $(df -Pm "$FRONTEND_ROOT" | awk 'NR==2 {print $4}') >= 15360 )) || die 'Перед сборкой требуется не менее 15 GiB свободного места'
  if [[ "$ACTION" == update ]]; then compose stop backend frontend; fi
  set_release_tag "$tag"
  printf 'Сборка backend, затем frontend; версия %s.\n' "$tag"
  DOCKER_BUILDKIT=1 COMPOSE_DOCKER_CLI_BUILD=1 compose build backend
  DOCKER_BUILDKIT=1 COMPOSE_DOCKER_CLI_BUILD=1 compose build frontend
  compose up -d --wait --wait-timeout 300 || die 'Не все контейнеры стали healthy; проверьте status и logs, автоматического удаления volumes нет'
  curl --fail --silent --show-error --max-time 15 "$APP_URL/" >/dev/null || die 'Frontend HTTPS readiness failed'
  curl --fail --silent --show-error --max-time 15 "$API_SITE/api/health" >/dev/null || die 'Backend HTTPS health check failed'
  printf 'PASS: frontend/API HTTPS готовы. Direct ICE UDP/TCP и звонок двух клиентов здесь не проверены. URL: %s %s %s %s\n' "$APP_URL" "$API_SITE" "$S3_PUBLIC_URL" "$LIVEKIT_PUBLIC_URL"
}
verify_ownership() {
  local id owner
  while IFS= read -r id; do
    [[ -n "$id" ]] || continue
    owner=$(docker inspect --format '{{index .Config.Labels "io.zvonok.deployment"}}' "$id")
    [[ "$owner" == stage5e ]] || die "Контейнер проекта $COMPOSE_PROJECT_NAME не принадлежит этому deployment; остановка отменена"
  done < <(docker ps -aq --filter "label=com.docker.compose.project=$COMPOSE_PROJECT_NAME")
  local volume
  for volume in postgres redis objects caddy_data caddy_config; do
    local name="${COMPOSE_PROJECT_NAME}_${volume}"
    if docker volume inspect "$name" >/dev/null 2>&1; then
      owner=$(docker volume inspect --format '{{index .Labels "io.zvonok.deployment"}}' "$name")
      [[ "$owner" == stage5e ]] || die "Volume $name не принадлежит этому deployment; он не изменён"
    fi
  done
}
backup() {
  load_env
  [[ -n "$BACKUP_DESTINATION" && -d "$BACKUP_DESTINATION" ]] || die 'Укажите BACKUP_DESTINATION как смонтированный каталог назначения в deployment.env'
  local stamp tmp pass volume
  stamp=$(date -u +%Y%m%dT%H%M%SZ); tmp=$(mktemp -d)
  volume="${COMPOSE_PROJECT_NAME}_objects"
  read -r -s -p 'Введите backup encryption passphrase: ' pass </dev/tty; printf '\n'
  [[ ${#pass} -ge 16 ]] || { rm -rf "$tmp"; unset pass; die 'Passphrase должна содержать не менее 16 символов'; }
  printf '%s\n' "$pass" > "$tmp/.pass"; chmod 600 "$tmp/.pass"
  ( set -Eeuo pipefail
    compose stop backend >/dev/null
    compose exec -T postgres pg_dump -U zvonok -d zvonok -Fc > "$tmp/postgres.dump"
    docker run --rm -v "$volume:/data:ro" -v "$tmp:/backup" alpine:3.21 tar -cf /backup/objects.tar -C /data .
    cp "$ENV_FILE" "$tmp/deployment.env"; cp "$LIVEKIT_CONFIG_FILE" "$tmp/livekit.yaml"
    tar -C "$tmp" -czf - postgres.dump objects.tar deployment.env livekit.yaml |
      gpg --batch --pinentry-mode loopback --passphrase-fd 3 --symmetric --cipher-algo AES256 --output "$BACKUP_DESTINATION/zvonok-$stamp.tar.gz.gpg" 3< "$tmp/.pass"
    gpg --batch --pinentry-mode loopback --passphrase-fd 3 --decrypt --output /dev/null "$BACKUP_DESTINATION/zvonok-$stamp.tar.gz.gpg" 3< "$tmp/.pass"
    compose start backend >/dev/null
  ) || { compose start backend >/dev/null 2>&1 || true; rm -rf "$tmp"; unset pass; die 'Backup завершился ошибкой; backend перезапущен по возможности, проверьте status/logs'; }
  rm -rf "$tmp"; unset pass
  printf 'Зашифрованный backup создан с integrity check: %s/zvonok-%s.tar.gz.gpg\n' "$BACKUP_DESTINATION" "$stamp"
  if [[ "$(findmnt -T "$BACKUP_DESTINATION" -n -o TARGET)" == / ]]; then
    printf 'ПРЕДУПРЕЖДЕНИЕ: независимость destination не подтверждена; скопируйте файл на отдельную систему.\n' >&2
  fi
}
restore() {
  load_env
  [[ "$CONFIRM_STOP" == true && "$CONFIRM_OVERWRITE" == "$COMPOSE_PROJECT_NAME" ]] || die 'Требуются оба подтверждения: --confirm-service-stop и --confirm-overwrite zvonok-prod'
  [[ -f "$BACKUP_FILE" ]] || die 'Зашифрованный backup file не найден'
  printf 'ВНИМАНИЕ: восстановление перезапишет production DB и RustFS volume.\n'
  read -r -p 'Для продолжения введите RESTORE-ZVONOK-PROD: ' answer </dev/tty
  [[ "$answer" == RESTORE-ZVONOK-PROD ]] || die 'Подтверждение не совпало; активные данные сохранены'
  local tmp pass volume
  tmp=$(mktemp -d); volume="${COMPOSE_PROJECT_NAME}_objects"
  read -r -s -p 'Введите backup encryption passphrase: ' pass </dev/tty; printf '\n'
  printf '%s\n' "$pass" > "$tmp/.pass"; chmod 600 "$tmp/.pass"
  gpg --batch --pinentry-mode loopback --passphrase-fd 3 --decrypt "$BACKUP_FILE" 3< "$tmp/.pass" | tar -xz -C "$tmp" || { rm -rf "$tmp"; unset pass; die 'Расшифровка/архив повреждены; runtime не остановлен'; }
  unset pass
  for f in postgres.dump objects.tar deployment.env livekit.yaml; do [[ -s "$tmp/$f" ]] || { rm -rf "$tmp"; die "В backup отсутствует $f; runtime не изменён"; }; done
  compose stop backend frontend caddy livekit rustfs
  compose exec -T postgres pg_restore --clean --if-exists --no-owner -U zvonok -d zvonok < "$tmp/postgres.dump"
  docker run --rm -v "$volume:/data" -v "$tmp:/backup:ro" alpine:3.21 sh -c 'find /data -mindepth 1 -maxdepth 1 -exec rm -rf -- {} + && tar -xf /backup/objects.tar -C /data'
  rm -rf "$tmp"
  compose up -d --wait --wait-timeout 300 || die 'Restore выполнен, но readiness не пройдена; проверьте status/logs'
  printf 'PASS: данные восстановлены и Compose services готовы. Проверьте HTTPS и контрольные файлы вручную.\n'
}

case "$ACTION" in
  init) init ;;
  doctor) doctor ;;
  install) [[ "$APPLY" == true ]] || die 'Запуск меняет состояние; добавьте --apply'; install_services ;;
  status) load_env; compose ps ;;
  logs) load_env; if [[ -n "$SERVICE" ]]; then compose logs --tail=200 "$SERVICE"; else compose logs --tail=200; fi ;;
  acceptance) load_env; bash "$SCRIPT_DIR/acceptance.sh" ;;
  backup) backup ;;
  restore) restore ;;
  update)
    [[ "$APPLY" == true ]] || die 'Запуск меняет состояние; добавьте --apply'
    check_requirements; load_env
    expected=$(release_tag)
    [[ "$RELEASE_TAG" == "$expected" ]] || die "--tag должен точно совпасть с checkout SHA пары: $expected; выполните checkout нужных SHA вручную"
    install_services
    ;;
  help|-h|--help) usage ;;
  *) usage >&2; exit 2 ;;
esac
