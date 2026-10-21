#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
DEPLOY_DIR="$(cd -- "$SCRIPT_DIR/.." && pwd -P)"
ENV_FILE="${ZVONOK_ENV_FILE:-/etc/zvonok/deployment.env}"
[[ -f "$ENV_FILE" ]] || { printf 'ОШИБКА: нет %s; сначала init\n' "$ENV_FILE" >&2; exit 1; }
while IFS='=' read -r key value; do
  [[ "$key" =~ ^[A-Z][A-Z0-9_]*$ ]] || continue
  printf -v "$key" '%s' "$value"; export "$key"
done < "$ENV_FILE"
compose() {
  docker compose --project-directory "$DEPLOY_DIR" --env-file "$ENV_FILE" \
    -f "$DEPLOY_DIR/compose.yaml" -f "$DEPLOY_DIR/prod.yaml" \
    -f "$SCRIPT_DIR/production.yaml" "$@"
}
fail() { printf 'FAIL: %s\n' "$*" >&2; exit 1; }
pass() { printf 'PASS: %s\n' "$*"; }

for host in "$DOMAIN" "api.$DOMAIN" "media.$DOMAIN" "livekit.$DOMAIN"; do
  ips=$(getent ahostsv4 "$host" | awk '{print $1}' | sort -u || true)
  [[ "$ips" == "$LIVEKIT_NODE_IP" ]] || fail "DNS A $host -> ${ips:-отсутствует}; ожидался $LIVEKIT_NODE_IP"
  if getent ahostsv6 "$host" | grep -q .; then fail "Обнаружена неподготовленная AAAA для $host"; fi
done
pass 'DNS A/AAAA'

for service in postgres redis rustfs livekit backend frontend caddy; do
  id=$(compose ps -q "$service")
  [[ -n "$id" ]] || fail "container отсутствует: $service"
  state=$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$id")
  [[ "$state" == healthy ]] || fail "$service state=$state; проверьте logs"
done
pass 'health checks PostgreSQL/Redis/RustFS/LiveKit/backend/frontend/Caddy'

curl --fail --silent --show-error --max-time 15 "$APP_URL/" >/dev/null || fail 'Frontend HTTPS/TLS'
curl --fail --silent --show-error --max-time 15 "$API_SITE/api/health" >/dev/null || fail 'Backend HTTPS/API health'
pass 'Frontend HTTPS и backend API health'

media_status=$(curl --silent --show-error --max-time 15 -o /dev/null -w '%{http_code}' \
  "$S3_PUBLIC_URL/zvonok-data/vps-acceptance-nonexistent-object") || fail 'Media HTTPS/TLS'
[[ "$media_status" == 403 || "$media_status" == 404 ]] || fail "Анонимный media read вернул HTTP $media_status; ожидался deny"
pass 'Media TLS и анонимный доступ закрыт'

livekit_status=$(curl --silent --show-error --max-time 15 -o /dev/null -w '%{http_code}' "$LIVEKIT_HTTP_URL/") || fail 'LiveKit HTTPS/TLS'
[[ "$livekit_status" != 000 && "$livekit_status" != 502 && "$livekit_status" != 503 ]] || fail "LiveKit proxy HTTP $livekit_status"
pass "LiveKit signaling proxy HTTP $livekit_status"

for mapping in 'postgres:5432/tcp' 'redis:6379/tcp' 'rustfs:9000/tcp' 'backend:8080/tcp' 'livekit:7880/tcp'; do
  service=${mapping%%:*}; port=${mapping#*:}; id=$(compose ps -q "$service")
  bindings=$(docker inspect --format "{{json (index .NetworkSettings.Ports \"$port\")}}" "$id")
  [[ "$bindings" == null || "$bindings" == '[]' ]] || fail "$service internal port $port опубликован на host: $bindings"
done
pass 'DB/Redis/RustFS/backend/LiveKit signaling ports не опубликованы на host'
printf 'ВНЕШНИЕ ПРОВЕРКИ НЕ ВЫПОЛНЕНЫ: login/refresh, сообщения, upload/download/Range, ICE candidates и звонок двух клиентов.\n'
