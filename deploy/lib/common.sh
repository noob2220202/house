# shellcheck shell=bash
# Variables defined here are consumed by the scripts that source this file.
# shellcheck disable=SC2034
# Shared helpers for the house deploy kit (sourced by install/deploy/rollback/backup/restore/status).
#
# Server layout and ownership. Root runs these scripts, so nothing root executes or parses as
# config may be writable by the service user 'house' (it runs the internet-facing Node apps and
# every npm build script):
#   /srv/house                     root:root  0755
#   /srv/house/bin                 root:root  0755  installed deploy kit (install.sh only)
#   /srv/house/*.sh                root-owned symlinks into bin/
#   /srv/house/current             root-owned symlink → releases/.active
#   /srv/house/releases/           house      0755  builds; .active → the live release (switched by deploy)
#   /srv/house/repo.git            house      0755  bare mirror (deploy.sh fetches as house)
#   /srv/house/shared/             root:house 0750
#   /srv/house/shared/.env         root:house 0640  API environment (house reads, never writes)
#   /srv/house/shared/deploy.conf  root:house 0640  parsed (never sourced) by load_conf
#   /srv/house/shared/{pnpm-store,turbo-cache}  house (build caches)
#   /var/lib/house/uploads/{public,private}, /var/backups/house, /var/log/house  house

HOUSE_USER="${HOUSE_USER:-house}"
HOUSE_ROOT="${HOUSE_ROOT:-/srv/house}"
SHARED_DIR="$HOUSE_ROOT/shared"
RELEASES_DIR="$HOUSE_ROOT/releases"
CURRENT_LINK="$HOUSE_ROOT/current"
ACTIVE_LINK="$RELEASES_DIR/.active"
MIRROR_DIR="$HOUSE_ROOT/repo.git"
BIN_DIR="$HOUSE_ROOT/bin"
ENV_FILE="$SHARED_DIR/.env"
DEPLOY_CONF="$SHARED_DIR/deploy.conf"
KNOWN_HOSTS_FILE="$SHARED_DIR/ssh_known_hosts"
# Present in every release whose web app serves the office sites <slug>.DOMAIN (sites.sh,
# rollback.sh; test_sites.sh checks the repository still has it).
SITES_WEB_ROUTE=apps/web/src/app/office-site

# Defaults; deploy.conf overrides them (only the keys in CONF_KEYS).
REPO_URL=""
BRANCH="main"
DOMAIN=""
ADMIN_DOMAIN=""
API_PORT=4000
WEB_PORT=3000
ADMIN_PORT=3001
WORKER_PORT=4100
MEDIA_PORT=8088 # loopback-only nginx /media origin for the Next image optimizer (MEDIA_ORIGIN)
PREFLIGHT_OFFSET=90 # deploy.sh smoke-tests a new release on API/WEB/ADMIN_PORT + this
API_INSTANCES=2
WEB_INSTANCES=2
ADMIN_INSTANCES=1
KEEP_RELEASES=5
UPLOAD_ROOT=/var/lib/house/uploads
BACKUP_DIR=/var/backups/house
LOG_DIR=/var/log/house
BACKUP_RETENTION_DAYS=14
BACKUP_KEEP_MIN=7 # newest DB dumps / upload snapshots kept whatever their age
RCLONE_REMOTE=""
BACKUP_NOTIFY_URL=""
DB_NAME=house
DB_USER=house
TLS_ENABLED=true

CONF_KEYS=(REPO_URL BRANCH DOMAIN ADMIN_DOMAIN TLS_ENABLED API_PORT WEB_PORT ADMIN_PORT WORKER_PORT
  MEDIA_PORT PREFLIGHT_OFFSET API_INSTANCES WEB_INSTANCES ADMIN_INSTANCES KEEP_RELEASES UPLOAD_ROOT BACKUP_DIR
  LOG_DIR BACKUP_RETENTION_DAYS BACKUP_KEEP_MIN RCLONE_REMOTE BACKUP_NOTIFY_URL DB_NAME DB_USER)

DOMAIN_RE='^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$'
REPO_URL_RE='^(https://|ssh://|git@|file://|/)[A-Za-z0-9@:/._~+-]+$'
BRANCH_RE='^[A-Za-z0-9._/-]+$'
ABS_PATH_RE='^/[A-Za-z0-9._/-]+$'
RCLONE_RE='^(/|[A-Za-z0-9_][A-Za-z0-9_. -]*:)[A-Za-z0-9@:/._~+=, -]*$'
NOTIFY_URL_RE='^https://[A-Za-z0-9.-]+(:[0-9]{1,5})?(/[A-Za-z0-9@:/._~+=?&%,-]*)?$'
PG_IDENT_RE='^[a-z_][a-z0-9_]{0,62}$'

# Deterministic toolchain: system Node (NodeSource) and its corepack/pnpm/pm2 shims.
export PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
export COREPACK_ENABLE_DOWNLOAD_PROMPT=0
export TURBO_TELEMETRY_DISABLED=1
export NEXT_TELEMETRY_DISABLED=1
# UTF-8 for Korean output; C.UTF-8 ships with every Ubuntu (sorting stays byte-order).
export LC_ALL=C.UTF-8

if [[ -t 1 ]]; then
  C_RED=$'\e[31m' C_GRN=$'\e[32m' C_YLW=$'\e[33m' C_BLU=$'\e[34m' C_DIM=$'\e[2m' C_RST=$'\e[0m'
else
  C_RED="" C_GRN="" C_YLW="" C_BLU="" C_DIM="" C_RST=""
fi

ts() { date '+%Y-%m-%d %H:%M:%S'; }
log() { printf '%s[%s]%s %s\n' "$C_DIM" "$(ts)" "$C_RST" "$*"; }
step() { printf '\n%s==> %s%s\n' "$C_BLU" "$*" "$C_RST"; }
ok() { printf '%s  ✔ %s%s\n' "$C_GRN" "$*" "$C_RST"; }
warn() { printf '%s  ⚠ %s%s\n' "$C_YLW" "$*" "$C_RST" >&2; }
die() {
  printf '%s  ✖ %s%s\n' "$C_RED" "$*" "$C_RST" >&2
  exit 1
}

have() { command -v "$1" >/dev/null 2>&1; }
has_systemd() { [[ -d /run/systemd/system ]]; }
# retry <tries> <command...>: runs the command once a second until it succeeds, at most <tries> times.
retry() {
  local tries="$1" i
  shift
  for ((i = 1; i <= tries; i++)); do
    "$@" && return 0
    ((i < tries)) && sleep 1
  done
  return 1
}

# Starts Redis on <port> without an init system that manages it (containers). A Redis that was
# told to stop keeps answering PING until its shutdown finishes, and a new one started meanwhile
# cannot bind the port and exits; the old one then exits too, leaving no Redis. So wait for the
# old instance to be gone before starting the new one.
redis_gone() { ! pgrep -u redis -f "redis-server .*:$1" >/dev/null 2>&1; }
redis_start_unmanaged() {
  local port="$1"
  pkill -u redis -f "redis-server .*:${port}" 2>/dev/null || true
  retry 15 redis_gone "$port" || return 1
  install -d -m 0755 -o redis -g redis /run/redis /var/log/redis
  runuser -u redis -- redis-server /etc/redis/redis.conf --daemonize yes --supervised no
}

# ─── deploy.conf ────────────────────────────────────────────────────────────────────────────
is_port() { [[ "$1" =~ ^[0-9]{1,5}$ ]] && (($1 >= 1 && $1 <= 65535)); }

conf_known() {
  local k
  for k in "${CONF_KEYS[@]}"; do [[ "$k" == "$1" ]] && return 0; done
  return 1
}

# conf_valid KEY VALUE: every deploy.conf value is checked against a strict per-key pattern.
conf_valid() {
  local k="$1" v="$2"
  case "$k" in
    REPO_URL) [[ -z "$v" || "$v" =~ $REPO_URL_RE ]] ;;
    BRANCH) [[ "$v" =~ $BRANCH_RE && "$v" != *..* ]] ;;
    DOMAIN | ADMIN_DOMAIN) [[ -z "$v" || "$v" =~ $DOMAIN_RE ]] ;;
    TLS_ENABLED) [[ "$v" == true || "$v" == false ]] ;;
    API_PORT | WEB_PORT | ADMIN_PORT | WORKER_PORT | MEDIA_PORT) is_port "$v" ;;
    PREFLIGHT_OFFSET) [[ "$v" =~ ^[0-9]{1,4}$ ]] ;;
    API_INSTANCES | WEB_INSTANCES | ADMIN_INSTANCES | KEEP_RELEASES) [[ "$v" =~ ^[1-9][0-9]?$ ]] ;;
    UPLOAD_ROOT | BACKUP_DIR | LOG_DIR) [[ "$v" =~ $ABS_PATH_RE && "$v" != *..* ]] ;;
    BACKUP_RETENTION_DAYS) [[ "$v" =~ ^[0-9]{1,4}$ ]] ;;
    BACKUP_KEEP_MIN) [[ "$v" =~ ^[0-9]{1,3}$ ]] ;;
    RCLONE_REMOTE) [[ -z "$v" || "$v" =~ $RCLONE_RE ]] ;;
    BACKUP_NOTIFY_URL) [[ -z "$v" || "$v" =~ $NOTIFY_URL_RE ]] ;;
    DB_NAME | DB_USER) [[ "$v" =~ $PG_IDENT_RE ]] ;;
    *) return 1 ;;
  esac
}

# Value part of a KEY=value line: surrounding whitespace and one pair of quotes are removed,
# an unquoted " # comment" is dropped. No escapes, no expansion.
conf_unquote() {
  local v="$1"
  v="${v#"${v%%[![:space:]]*}"}"
  if [[ "$v" =~ ^\"([^\"]*)\"[[:space:]]*(#.*)?$ || "$v" =~ ^\'([^\']*)\'[[:space:]]*(#.*)?$ ]]; then
    v="${BASH_REMATCH[1]}"
  else
    [[ "$v" == '#'* ]] && v=""
    v="${v%%[[:space:]]#*}"
    v="${v%"${v##*[![:space:]]}"}"
  fi
  printf '%s' "$v"
}

# deploy.conf is parsed, never sourced: only known keys, each validated, are assigned.
load_conf() {
  local file="$DEPLOY_CONF" line key val n=0
  [[ -e "$file" ]] || return 0
  [[ -r "$file" ]] || die "설정 파일을 읽을 수 없습니다: $file"
  while IFS= read -r line || [[ -n "$line" ]]; do
    n=$((n + 1))
    line="${line%$'\r'}"
    [[ "$line" =~ ^[[:space:]]*(#.*)?$ ]] && continue
    [[ "$line" =~ ^[[:space:]]*([A-Z][A-Z0-9_]*)=(.*)$ ]] ||
      die "$file ${n}번째 줄 형식 오류 (KEY=값 형식이어야 합니다): ${line@Q}"
    key="${BASH_REMATCH[1]}"
    val="$(conf_unquote "${BASH_REMATCH[2]}")"
    conf_known "$key" || die "$file ${n}번째 줄: 알 수 없는 설정 키 '$key'"
    conf_valid "$key" "$val" || die "$file ${n}번째 줄: $key 값이 올바르지 않습니다: ${val@Q}"
    printf -v "$key" '%s' "$val"
  done <"$file"
}

# Prints deploy.conf for the current values; refuses any value load_conf would reject.
conf_render() {
  local k
  printf '%s\n' "# Managed by deploy/install.sh (re-run it to change domain/repo). Parsed — never" \
    "# sourced — by the deploy scripts and ecosystem.config.cjs: KEY=value, one per line," \
    "# known keys only, values checked against strict patterns (see deploy/lib/common.sh)."
  for k in "${CONF_KEYS[@]}"; do
    conf_valid "$k" "${!k}" || die "설정값이 올바르지 않습니다: $k=${!k@Q}"
    printf '%s=%s\n' "$k" "${!k}"
  done
}

# Read one key from a dotenv file without sourcing it (values may contain shell metacharacters).
# Strips surrounding quotes and unquoted inline " # comments", like dotenv does.
env_get() {
  local key="$1" file="${2:-$ENV_FILE}"
  [[ -r "$file" ]] || return 0
  awk -v k="$key" '
    BEGIN { FS = "=" }
    /^[[:space:]]*#/ { next }
    {
      line = $0
      sub(/^[[:space:]]*(export[[:space:]]+)?/, "", line)
      eq = index(line, "=")
      if (eq == 0) next
      name = substr(line, 1, eq - 1)
      gsub(/[[:space:]]+$/, "", name)
      if (name != k) next
      v = substr(line, eq + 1)
      sub(/^[[:space:]]+/, "", v)
      if (v ~ /^".*"/) { sub(/^"/, "", v); sub(/".*$/, "", v) }
      else if (v ~ /^'\''.*'\''/) { sub(/^'\''/, "", v); sub(/'\''.*$/, "", v) }
      else { sub(/[[:space:]]+#.*$/, "", v); sub(/^#.*$/, "", v); gsub(/[[:space:]]+$/, "", v) }
      val = v
      found = 1
    }
    END { if (found) print val }
  ' "$file"
}

# env_has_key KEY [file]: the dotenv file assigns KEY (commented-out lines do not count).
env_has_key() {
  local key="$1" file="${2:-$ENV_FILE}"
  [[ -r "$file" ]] || return 1
  awk -v k="$key" '
    /^[[:space:]]*#/ { next }
    {
      line = $0
      sub(/^[[:space:]]*(export[[:space:]]+)?/, "", line)
      eq = index(line, "=")
      if (eq == 0) next
      name = substr(line, 1, eq - 1)
      gsub(/[[:space:]]+$/, "", name)
      if (name == k) { found = 1; exit }
    }
    END { exit found ? 0 : 1 }
  ' "$file"
}

# env_add_missing <file> <group> KEY=value...: appends the keys the file does not assign yet and
# leaves every existing line (and value) alone; the file is replaced atomically as root:<group>
# 0640. Prints the names of the keys it added. Only for root-owned directories (shared/).
env_add_missing() {
  local file="$1" group="$2" kv tmp
  shift 2
  local -a add=()
  for kv in "$@"; do
    [[ "$kv" =~ ^[A-Z][A-Z0-9_]*= ]] || die "env_add_missing: KEY=value 형식이 아닙니다: $kv"
    env_has_key "${kv%%=*}" "$file" || add+=("$kv")
  done
  ((${#add[@]})) || return 0
  tmp="$(mktemp "$(dirname "$file")/.env.XXXXXX")"
  [[ -f "$file" ]] && cat "$file" >"$tmp"
  # Keep the last existing line intact when it has no trailing newline.
  [[ -s "$tmp" && -n "$(tail -c1 "$tmp")" ]] && printf '\n' >>"$tmp"
  {
    printf '\n# Added by deploy/install.sh on %s — web/admin build settings. NEXT_PUBLIC_* values are\n' "$(date '+%Y-%m-%d')"
    printf '# inlined into the browser code at build time: after editing them run sudo %s/deploy.sh\n' "$HOUSE_ROOT"
    printf '# (it rebuilds automatically when they changed).\n'
    printf '%s\n' "${add[@]}"
  } >>"$tmp"
  chown "root:$group" "$tmp"
  chmod 0640 "$tmp"
  mv -f "$tmp" "$file"
  printf '%s\n' "${add[@]%%=*}"
}

media_origin_default() { printf 'http://127.0.0.1:%s' "$MEDIA_PORT"; }

# frontend_env_defaults <scheme>: KEY=value lines the web/admin builds need in shared/.env.
# install.sh adds the missing ones (existing values always win).
frontend_env_defaults() {
  local scheme="$1"
  printf '%s\n' \
    "NEXT_PUBLIC_SITE_URL=${scheme}://${DOMAIN}" \
    "MEDIA_ORIGIN=$(media_origin_default)" \
    "NEXT_PUBLIC_KAKAO_MAP_KEY=" \
    "NEXT_PUBLIC_NAVER_SITE_VERIFICATION=" \
    "NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION="
}

# build_env_lines: the environment of the web/admin production build, one KEY=value per line.
# Next inlines NEXT_PUBLIC_* into the bundles and writes the /media rewrite (MEDIA_ORIGIN) into
# routes-manifest.json, so these are fixed at build time (turbo.json lists the non-NEXT_PUBLIC
# ones in the build task's env, or strict env mode would drop them). Secrets never go in here.
build_env_lines() {
  local key scheme=https site media
  [[ "$TLS_ENABLED" == true ]] || scheme=http
  printf 'NODE_ENV=production\n'
  while IFS= read -r key; do
    case "$key" in NEXT_PUBLIC_SITE_URL | NEXT_PUBLIC_API_MOCK) continue ;; esac
    printf '%s=%s\n' "$key" "$(env_get "$key")"
  done < <(grep -oE '^[[:space:]]*(export[[:space:]]+)?NEXT_PUBLIC_[A-Z0-9_]+[[:space:]]*=' "$ENV_FILE" 2>/dev/null |
    sed -E 's/^[[:space:]]*(export[[:space:]]+)?//; s/[[:space:]]*=$//' | sort -u)
  site="$(env_get NEXT_PUBLIC_SITE_URL)"
  if [[ -z "$site" ]]; then
    site="${scheme}://${DOMAIN}"
    warn "NEXT_PUBLIC_SITE_URL 이 $ENV_FILE 에 없어 ${site} 로 빌드합니다 (sudo $BIN_DIR/install.sh 를 다시 실행하면 추가됩니다)."
  fi
  media="$(env_get MEDIA_ORIGIN)"
  [[ -n "$media" ]] || media="$(media_origin_default)"
  # Mock mode is a development switch: a production build always talks to the real API.
  printf '%s\n' "NEXT_PUBLIC_SITE_URL=${site%/}" "NEXT_PUBLIC_API_MOCK=" "MEDIA_ORIGIN=${media%/}" \
    "INTERNAL_API_URL=http://127.0.0.1:${API_PORT}"
}

# build_env_fingerprint < lines: order-independent hash of build_env_lines' output (stored per
# release as BUILD_ENV.sha256, so a changed NEXT_PUBLIC_* value forces a rebuild).
build_env_fingerprint() { LC_ALL=C sort | sha256sum | cut -d' ' -f1; }

# ─── PostgreSQL connection without secrets in argv ──────────────────────────────────────────
# /proc/<pid>/cmdline is world-readable, so pg_dump/psql never get a URL with the password.
# pg_parse_url fills PGURL_* from DATABASE_URL; pg_export_env exports libpq's PG* variables
# (a process environment is readable only by the same uid and root). Export only in subshells.
url_decode() {
  local s="$1" out="" c
  while [[ -n "$s" ]]; do
    if [[ "$s" =~ ^%([0-9A-Fa-f]{2}) ]]; then
      printf -v c '%b' "\\x${BASH_REMATCH[1]}"
      out+="$c"
      s="${s:3}"
    else
      out+="${s:0:1}"
      s="${s:1}"
    fi
  done
  printf '%s' "$out"
}

pg_parse_url() {
  local url rest authority auth="" hostport path=""
  url="$(env_get DATABASE_URL)"
  [[ -n "$url" ]] || die "DATABASE_URL이 $ENV_FILE 에 없습니다."
  [[ "$url" =~ ^postgres(ql)?://(.*)$ ]] || die "DATABASE_URL 형식이 올바르지 않습니다 (postgresql://...)."
  rest="${BASH_REMATCH[2]}"
  rest="${rest%%\?*}" # libpq rejects Prisma's ?schema=public
  authority="${rest%%/*}"
  [[ "$rest" == */* ]] && path="${rest#*/}"
  if [[ "$authority" == *@* ]]; then
    auth="${authority%@*}" hostport="${authority##*@}"
  else
    hostport="$authority"
  fi
  PGURL_USER="$(url_decode "${auth%%:*}")" PGURL_PASSWORD=""
  [[ "$auth" == *:* ]] && PGURL_PASSWORD="$(url_decode "${auth#*:}")"
  if [[ "$hostport" =~ ^\[([0-9A-Fa-f:.]+)\](:([0-9]+))?$ || "$hostport" =~ ^([^:]*)(:([0-9]+))?$ ]]; then
    PGURL_HOST="${BASH_REMATCH[1]:-127.0.0.1}" PGURL_PORT="${BASH_REMATCH[3]:-5432}"
  else
    die "DATABASE_URL의 호스트/포트를 읽을 수 없습니다."
  fi
  PGURL_DB="$(url_decode "$path")"
  [[ -n "$PGURL_USER" && -n "$PGURL_DB" ]] || die "DATABASE_URL에 사용자/DB 이름이 없습니다."
}

pg_export_env() {
  pg_parse_url
  export PGHOST="$PGURL_HOST" PGPORT="$PGURL_PORT" PGUSER="$PGURL_USER" PGDATABASE="$PGURL_DB"
  export PGPASSWORD="$PGURL_PASSWORD"
}

# pg_run <command...>: run a libpq client as the app role (connection from DATABASE_URL).
pg_run() (
  pg_export_env
  "$@"
)

# ─── migrations ─────────────────────────────────────────────────────────────────────────────
# `prisma migrate deploy` runs against the live DB while the old release serves. A DDL statement
# waiting for its ACCESS EXCLUSIVE lock (behind a long query or pg_dump) would queue every API
# query on that table behind it, so it gives up after MIGRATE_LOCK_TIMEOUT instead.
MIGRATE_LOCK_TIMEOUT=5s
MIGRATE_STATEMENT_TIMEOUT=15min
MIG_PSQL=(psql -X -q -At -v ON_ERROR_STOP=1)

# migrate_db_url <url>: the URL with lock/statement timeouts as libpq `options`. Prisma's schema
# engine ignores PGOPTIONS but honours this parameter. A URL that already sets options is kept.
migrate_db_url() {
  local url="$1"
  local opts="-c%20lock_timeout%3D${MIGRATE_LOCK_TIMEOUT}%20-c%20statement_timeout%3D${MIGRATE_STATEMENT_TIMEOUT}"
  if [[ "$url" =~ [?\&]options= ]]; then
    printf '%s' "$url"
  elif [[ "$url" == *\?* ]]; then
    printf '%s&options=%s' "$url" "$opts"
  else
    printf '%s?options=%s' "$url" "$opts"
  fi
}

# The queries below run as the app role (DATABASE_URL); a query error is returned, never hidden.
db_has_migrations_table() {
  local has
  has="$(pg_run "${MIG_PSQL[@]}" -c "select to_regclass('public._prisma_migrations') is not null")" || return 2
  [[ "$has" == t ]]
}
# Migrations that started but neither finished nor were marked rolled back (Prisma P3009 state).
db_failed_migrations() {
  local rc=0
  db_has_migrations_table || rc=$?
  ((rc == 1)) && return 0
  ((rc == 0)) || return "$rc"
  pg_run "${MIG_PSQL[@]}" -c \
    "select migration_name from _prisma_migrations where finished_at is null and rolled_back_at is null order by started_at"
}
db_applied_migrations() {
  local rc=0
  db_has_migrations_table || rc=$?
  ((rc == 1)) && return 0
  ((rc == 0)) || return "$rc"
  pg_run "${MIG_PSQL[@]}" -c \
    "select migration_name from _prisma_migrations where finished_at is not null and rolled_back_at is null order by migration_name"
}
release_migrations() {
  find "$1/apps/api/prisma/schema/migrations" -mindepth 1 -maxdepth 1 -type d -printf '%f\n' 2>/dev/null | sort
}
# migrations_unknown_to <release>: migrations applied to the DB that <release> does not ship.
# Older code can break on them (e.g. Prisma throws on an enum value its client does not know).
migrations_unknown_to() {
  local applied known
  applied="$(db_applied_migrations)" || return 1
  known="$(release_migrations "$1")"
  [[ -n "$applied" ]] || return 0
  comm -23 <(sort <<<"$applied") <(sed '/^$/d' <<<"$known")
}

# Recovery command for a failed (P3009) migration, run from the live release.
migrate_resolve_hint() {
  local name="$1"
  warn "실패한 마이그레이션: $name — 이 상태에서는 다음 배포의 마이그레이션도 모두 멈춥니다 (Prisma P3009)."
  warn "  1) 원인(SQL 오류, 잠금 대기 시간 초과 등)을 확인하고 고친 커밋을 준비합니다. 자세한 절차: docs/OPERATIONS.md 'P3009 복구'"
  warn "  2) 변경이 DB에 남지 않았다면(보통 그렇습니다 — 마이그레이션은 한 트랜잭션) 실패 기록을 정리:"
  warn "     sudo -u $HOUSE_USER -H bash -c 'cd $CURRENT_LINK/apps/api && pnpm exec prisma migrate resolve --rolled-back $name'"
  warn "  3) 그 다음 다시 배포: sudo $HOUSE_ROOT/deploy.sh"
}

# ─── users / environment ────────────────────────────────────────────────────────────────────
# Clean environment for anything that runs as the service user: nothing from root's shell
# (npm/pnpm config, tokens) reaches builds or the apps.
house_env() {
  local -a keep=()
  local v
  for v in LANG TERM http_proxy https_proxy no_proxy HTTP_PROXY HTTPS_PROXY NO_PROXY \
    PGHOST PGPORT PGUSER PGDATABASE PGPASSWORD; do
    [[ -n "${!v:-}" ]] && keep+=("$v=${!v}")
  done
  printf '%s\0' HOME="/home/$HOUSE_USER" USER="$HOUSE_USER" LOGNAME="$HOUSE_USER" SHELL=/bin/bash \
    PATH="$PATH" LC_ALL=C.UTF-8 COREPACK_ENABLE_DOWNLOAD_PROMPT=0 HOUSE_ROOT="$HOUSE_ROOT" "${keep[@]}"
}

# run_as_house <command...>: as the service user (directly when already that user).
run_as_house() {
  if [[ "$(id -un)" == "$HOUSE_USER" ]]; then
    "$@"
    return
  fi
  [[ $EUID -eq 0 ]] || die "'$HOUSE_USER' 사용자(또는 root)로 실행해야 합니다."
  local -a envv
  mapfile -d '' -t envv < <(house_env)
  runuser -u "$HOUSE_USER" -- env -i "${envv[@]}" "$@"
}

# Re-exec the calling script as the service user when started as root.
ensure_house_user() {
  if [[ "$(id -un)" == "$HOUSE_USER" ]]; then return 0; fi
  if [[ $EUID -eq 0 ]]; then
    id "$HOUSE_USER" >/dev/null 2>&1 || die "사용자 '$HOUSE_USER'가 없습니다. 먼저 install.sh를 실행하세요."
    local self
    self="$(readlink -f "$0")"
    local -a envv
    mapfile -d '' -t envv < <(house_env)
    exec runuser -u "$HOUSE_USER" -- env -i "${envv[@]}" bash "$self" "$@"
  fi
  die "이 스크립트는 '$HOUSE_USER' 사용자(또는 root)로 실행해야 합니다."
}

# Exclusive lock shared by deploy/rollback/restore so they never run concurrently. The lock file
# is created by install.sh (root:house 0660) in the root-owned shared/ directory.
acquire_lock() {
  local lockfile="$SHARED_DIR/.deploy.lock"
  if [[ -n "${HOUSE_LOCK_FD:-}" ]]; then return 0; fi
  [[ -f "$lockfile" && ! -L "$lockfile" ]] ||
    die "잠금 파일이 없습니다: $lockfile — sudo $BIN_DIR/install.sh 를 한 번 다시 실행하세요."
  exec 9>>"$lockfile" || die "잠금 파일을 열 수 없습니다: $lockfile"
  if ! flock -n 9; then
    die "다른 배포/롤백/복원 작업이 진행 중입니다. (잠금: $lockfile)"
  fi
  export HOUSE_LOCK_FD=9
}

# run_detached <logfile> <args...>: re-runs the calling script in its own session (setsid) with
# output going only to <logfile>, and follows the log in the foreground. A dropped SSH session
# or Ctrl-C stops the viewer, never the work (switch → reload → health check → rollback).
run_detached() {
  local logfile="$1" self size pid rc=0
  shift
  [[ -n "${HOUSE_DETACHED:-}" ]] && return 0
  self="$(readlink -f "$0")"
  touch "$logfile" || die "로그 파일을 만들 수 없습니다: $logfile"
  size="$(stat -c %s "$logfile")"
  HOUSE_DETACHED=1 setsid bash "$self" "$@" </dev/null >>"$logfile" 2>&1 &
  pid=$!
  log "작업을 별도 세션(PID $pid)에서 실행합니다. SSH가 끊기거나 Ctrl+C를 눌러도 작업은 끝까지 진행됩니다."
  log "로그: $logfile   (중단이 꼭 필요하면: kill $pid — 전환 이후라면 자동 롤백)"
  trap 'printf "\n"; warn "화면 보기만 멈췄습니다. 작업은 계속됩니다: tail -f $logfile"; exit 130' INT
  tail -c +"$((size + 1))" -f --pid="$pid" "$logfile" || true
  wait "$pid" || rc=$?
  exit "$rc"
}

# PM2 runs with a clean environment so nothing from the operator's shell leaks into the apps;
# ecosystem.config.cjs reads /srv/house/shared/.env and deploy.conf itself.
pm2_cmd() {
  local -a as_user=()
  # The PM2 daemon belongs to the service user; root talks to it through runuser.
  [[ $EUID -eq 0 ]] && as_user=(runuser -u "$HOUSE_USER" --)
  "${as_user[@]}" env -i HOME="/home/$HOUSE_USER" PATH="$PATH" PM2_HOME="/home/$HOUSE_USER/.pm2" \
    HOUSE_ROOT="$HOUSE_ROOT" pm2 "$@"
}

APP_NAMES=(house-api house-worker house-web house-admin)

# The live release directory ('current' → releases/.active → releases/<name>), or nothing.
current_release() {
  local r
  r="$(readlink -e "$CURRENT_LINK" 2>/dev/null)" || return 0
  [[ -d "$r" ]] && printf '%s\n' "$r"
  return 0
}

# Releases sorted oldest → newest (names start with a sortable timestamp; symlinks excluded).
list_releases() {
  [[ -d "$RELEASES_DIR" ]] || return 0
  find "$RELEASES_DIR" -mindepth 1 -maxdepth 1 -type d -name '[0-9]*' -printf '%f\n' | sort
}

# Atomic switch: create a temp link then rename over the old one (rename(2) is atomic).
# The service user switches releases/.active; the root-owned 'current' link points at it.
switch_current() {
  local target="$1" link="$ACTIVE_LINK" tmp
  [[ -d "$target" ]] || die "릴리스 디렉터리가 없습니다: $target"
  if [[ "$(readlink "$CURRENT_LINK" 2>/dev/null)" != "releases/.active" ]]; then
    # Layout from before install.sh separated root and service-user files.
    warn "$CURRENT_LINK 가 releases/.active 를 가리키지 않습니다 — sudo $BIN_DIR/install.sh 를 다시 실행하세요."
    link="$CURRENT_LINK"
  fi
  tmp="$(dirname "$link")/.active.tmp.$$"
  ln -sfn "$target" "$tmp"
  mv -Tf "$tmp" "$link"
}

worker_uses_http() {
  # Until apps/api ships a dedicated dist/worker.js, the worker runs main.js on WORKER_PORT.
  [[ ! -f "$1/apps/api/dist/worker.js" ]]
}

http_ok() {
  local url="$1"
  curl -fs --noproxy '*' -o /dev/null --max-time 5 "$url"
}

# carry_image_cache <previous release> <new release>: copies only each frontend's optimized-image
# cache (.next/cache/images) forward, so photos are not re-optimized after every deploy. Nothing
# else of .next/cache: turbo caches the build outputs, stale webpack/SWC caches only grow, and the
# runtime fetch cache holds old API data (it is rebuilt as pages render).
carry_image_cache() {
  local prev="$1" next="$2" app
  for app in web admin; do
    [[ -d "$prev/apps/$app/.next/cache/images" ]] || continue
    mkdir -p "$next/apps/$app/.next/cache/images"
    rsync -a "$prev/apps/$app/.next/cache/images/" "$next/apps/$app/.next/cache/images/"
  done
}

# media_sample_path [public upload dir]: one stored upload nginx serves under /media (same name
# rule as house-media.conf), relative to the dir; empty when nothing has been uploaded yet.
media_sample_path() {
  local root="${1:-$UPLOAD_ROOT/public}"
  [[ -d "$root" ]] || return 0
  find "$root" -type f -size +0 -printf '%P\n' 2>/dev/null |
    grep -m1 -E '^[a-z0-9][a-z0-9/_.-]*\.(webp|avif|jpe?g|png|gif)$' || true
}

# image_smoke <web port> [public upload dir] [tries] [delay]: GET /_next/image for one stored
# upload on the web server; passes on 200 + image/*. Proves the optimizer reaches the media
# origin baked into the build (MEDIA_ORIGIN → nginx's loopback media port). Skipped (passes)
# while no photo has been uploaded (fresh install, empty DB).
image_smoke() {
  local port="$1" root="${2:-$UPLOAD_ROOT/public}" tries="${3:-3}" delay="${4:-2}" rel url out="" i
  rel="$(media_sample_path "$root")"
  if [[ -z "$rel" ]]; then
    log "사진 최적화 점검 생략 (아직 올린 사진 없음)"
    return 0
  fi
  # The name rule above leaves only "/" to encode.
  url="http://127.0.0.1:${port}/_next/image?url=%2Fmedia%2F${rel//\//%2F}&w=64&q=75"
  for ((i = 1; i <= tries; i++)); do
    out="$(curl -s --noproxy '*' -o /dev/null --max-time 20 -w '%{http_code} %{content_type}' "$url" || true)"
    if [[ "$out" =~ ^200\ image/ ]]; then
      ok "사진 최적화 점검 통과 (/media/${rel} → ${out#200 })"
      return 0
    fi
    ((i < tries)) && sleep "$delay"
  done
  warn "사진 최적화 점검 실패: /_next/image?url=/media/${rel} → ${out:-응답 없음}"
  warn "  .env 의 MEDIA_ORIGIN(기본 http://127.0.0.1:${MEDIA_PORT:-8088})과 curl -sI http://127.0.0.1:${MEDIA_PORT:-8088}/media/${rel} 을 확인하세요."
  return 1
}

# Every app must be "online" in PM2 and every HTTP probe must pass, within the retry budget.
health_check() {
  local release="$1" tries="${2:-30}" delay="${3:-2}" i failing=""
  local -a probes=(
    "api|http://127.0.0.1:${API_PORT}/api/v1/health/ready"
    "web|http://127.0.0.1:${WEB_PORT}/healthz"
    "admin|http://127.0.0.1:${ADMIN_PORT}/healthz"
  )
  if worker_uses_http "$release"; then
    probes+=("worker|http://127.0.0.1:${WORKER_PORT}/api/v1/health/ready")
  fi
  for ((i = 1; i <= tries; i++)); do
    failing=""
    local p name url
    for p in "${probes[@]}"; do
      name="${p%%|*}" url="${p#*|}"
      http_ok "$url" || failing+=" $name"
    done
    local offline
    offline="$(pm2_offline_apps)"
    [[ -n "$offline" ]] && failing+=" pm2:${offline}"
    if [[ -z "$failing" ]]; then
      ok "헬스체크 통과 (api, worker, web, admin)"
      return 0
    fi
    log "헬스체크 대기 중 ($i/$tries): 실패 →${failing}"
    sleep "$delay"
  done
  warn "헬스체크 실패:${failing}"
  return 1
}

# Prints the names of house-* apps that are not "online" (empty when all are up).
pm2_offline_apps() {
  pm2_cmd jlist 2>/dev/null | node -e '
    let s = "";
    process.stdin.on("data", (d) => (s += d)).on("end", () => {
      let list = [];
      try { list = JSON.parse(s); } catch { console.log("pm2-unreadable"); return; }
      const want = process.argv.slice(1);
      const bad = want.filter((n) => {
        const procs = list.filter((p) => p.name === n);
        return procs.length === 0 || procs.some((p) => p.pm2_env.status !== "online");
      });
      console.log(bad.join(","));
    });
  ' "${APP_NAMES[@]}"
}

# Apps whose PM2 exec_mode differs from the ecosystem file (a reload cannot change it).
# The ecosystem file is release code, so it is evaluated as the service user, never as root.
pm2_exec_mode_mismatch() {
  local eco="$1"
  pm2_cmd jlist 2>/dev/null | run_as_house node -e '
    let s = "";
    process.stdin.on("data", (d) => (s += d)).on("end", () => {
      let list = [];
      try { list = JSON.parse(s); } catch { return; }
      const want = new Map(require(process.argv[1]).apps.map((a) => [a.name, a.exec_mode || "fork"]));
      const names = new Set();
      for (const p of list) {
        const mode = String(p.pm2_env.exec_mode || "").replace(/_mode$/, "");
        if (want.has(p.name) && mode && mode !== want.get(p.name)) names.add(p.name);
      }
      console.log([...names].join(" "));
    });
  ' "$eco"
}

pm2_apply() {
  local release="$1" eco="$1/ecosystem.config.cjs" stale
  stale="$(pm2_exec_mode_mismatch "$eco" || true)"
  if [[ -n "$stale" ]]; then
    warn "실행 방식(exec_mode)이 바뀐 앱을 다시 등록합니다 (해당 앱 수 초 중단): $stale"
    # shellcheck disable=SC2086 # space-separated app names
    pm2_cmd delete $stale >/dev/null
  fi
  pm2_cmd startOrReload "$eco" --update-env
  pm2_cmd save --force >/dev/null
}

# ─── TLS / backups / kit helpers ────────────────────────────────────────────────────────────
# write_if_changed <path> <mode> [owner] < content: root-run writes of config files (nginx,
# systemd, cron). Returns 0 when the file changed, 1 when it already had this content (owner and
# mode are re-applied either way). A symlink at <path> is replaced, never followed.
write_if_changed() {
  local dest="$1" mode="$2" owner="${3:-root:root}" tmp
  tmp="$(mktemp)"
  cat >"$tmp"
  [[ -L "$dest" ]] && rm -f "$dest"
  if [[ -f "$dest" ]] && cmp -s "$tmp" "$dest"; then
    rm -f "$tmp"
    chown "$owner" "$dest"
    chmod "$mode" "$dest"
    return 1
  fi
  install -m "$mode" -o "${owner%%:*}" -g "${owner##*:}" "$tmp" "$dest"
  rm -f "$tmp"
  return 0
}

# cert_covers <pem> <name...>: the certificate's subjectAltName lists every name exactly.
cert_covers() {
  local pem="$1" sans n
  shift
  sans="$(openssl x509 -noout -ext subjectAltName -in "$pem" 2>/dev/null)" || return 1
  sans="$(tr ',' '\n' <<<"${sans,,}" | sed -n 's/^[[:space:]]*dns:\([^[:space:]]*\)[[:space:]]*$/\1/p')"
  for n in "$@"; do
    grep -qxF "${n,,}" <<<"$sans" || return 1
  done
}

# prune_keep_newest <dir> <name-glob> <days> <keep> [f|d]: delete entries older than <days>,
# but never the newest <keep> (so a run of failed backups cannot empty the directory).
prune_keep_newest() {
  local dir="$1" glob="$2" days="$3" keep_n="$4" type="${5:-f}" i=0 line path
  [[ -d "$dir" ]] || return 0
  while IFS= read -r line; do
    path="${line#* }"
    i=$((i + 1))
    ((i <= keep_n)) && continue
    if [[ -n "$(find "$path" -maxdepth 0 -mtime +"$days" 2>/dev/null)" ]]; then
      rm -rf -- "$path"
      log "삭제: $path"
    fi
  done < <(find "$dir" -mindepth 1 -maxdepth 1 -type "$type" -name "$glob" -printf '%T@ %p\n' | sort -rn)
}

# kit_validate <dir>: a deploy kit about to be installed into bin/ (run by root later) must be
# complete, contain only regular files and directories, and parse.
kit_validate() {
  local dir="$1" f odd
  for f in deploy.sh install.sh rollback.sh status.sh backup.sh restore.sh create-admin.sh \
    db-shell.sh set-keys.sh sites.sh lib/common.sh lib/preflight.cjs nginx/house-site.conf.template; do
    [[ -f "$dir/$f" ]] || { warn "배포 스크립트 파일이 없습니다: $f"; return 1; }
  done
  odd="$(find "$dir" ! -type f ! -type d -printf '%P\n' | head -5)"
  [[ -z "$odd" ]] || { warn "일반 파일이 아닌 항목이 있습니다: $odd"; return 1; }
  while IFS= read -r -d '' f; do
    bash -n "$f" || { warn "문법 오류: ${f#"$dir"/}"; return 1; }
  done < <(find "$dir" -type f -name '*.sh' -print0)
  if have node; then node --check "$dir/lib/preflight.cjs" || return 1; fi
}

# kit_missing_from <srcdir> <bindir>: prints the files the installed kit has and <srcdir> lacks
# (space-separated) and succeeds when there are any. kit_install mirrors with --delete, so such a
# source is most likely an older checkout (e.g. the /root/house-setup of the first install): it
# would delete those files and revert every kit fix made since.
kit_missing_from() {
  local src="$1" dest="$2" f out=""
  [[ -d "$dest" ]] || return 1
  while IFS= read -r -d '' f; do
    [[ -e "$src/$f" ]] || out+="$f "
  done < <(find "$dest" -type f -printf '%P\0' | sort -z)
  [[ -n "$out" ]] || return 1
  printf '%s' "${out% }"
}

# kit_install <srcdir> <bindir>: copy a validated kit as root:root (dirs/scripts 0755, files 0644).
kit_install() {
  local src="$1" dest="$2" stage
  kit_validate "$src" || die "배포 스크립트 검증 실패 — 설치하지 않았습니다: $src"
  stage="$(mktemp -d "$(dirname "$dest")/.bin.stage.XXXXXX")"
  cp -R "$src/." "$stage/"
  chown -R root:root "$stage"
  find "$stage" -type d -exec chmod 0755 {} +
  find "$stage" -type f -exec chmod 0644 {} +
  find "$stage" -type f -name '*.sh' -exec chmod 0755 {} +
  chmod 0755 "$stage"
  install -d -m 0755 -o root -g root "$dest"
  chown root:root "$dest"
  chmod 0755 "$dest"
  # Per-file rename: a script that is running keeps reading its old inode.
  rsync -a --delete "$stage/" "$dest/"
  rm -rf "$stage"
}

# db_swap_sql <db> <work_db> <before_db>: SQL that replaces <db> with <work_db> and keeps the old
# one as <before_db>. Run it after `ALTER DATABASE <db> WITH ALLOW_CONNECTIONS false` in one psql
# session with ON_ERROR_STOP: remaining sessions are terminated (waiting for them to exit) and
# both renames commit together or not at all.
db_swap_sql() {
  local db="$1" work="$2" before="$3" n
  for n in "$db" "$work" "$before"; do
    # PostgreSQL silently truncates longer identifiers, which would rename the wrong database.
    [[ "$n" =~ $PG_IDENT_RE ]] || die "DB 이름이 올바르지 않거나 63자를 넘습니다: $n"
  done
  cat <<SQL
SELECT pg_terminate_backend(pid, 10000) FROM pg_stat_activity WHERE datname = '$db' AND pid <> pg_backend_pid();
BEGIN;
ALTER DATABASE "$db" RENAME TO "$before";
ALTER DATABASE "$work" RENAME TO "$db";
ALTER DATABASE "$before" WITH ALLOW_CONNECTIONS true;
COMMIT;
SQL
}

# restore_list_filter: drops the TOC entries of a `pg_restore --list` that need a superuser —
# extensions (restore.sh creates postgis/pg_trgm itself) and PostGIS's own spatial_ref_sys data —
# so the rest can be restored by the app role.
restore_list_filter() {
  grep -vE ' (EXTENSION|COMMENT) - EXTENSION | EXTENSION - |TABLE DATA public spatial_ref_sys '
}
