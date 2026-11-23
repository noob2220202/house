# shellcheck shell=bash
# Variables defined here are consumed by the scripts that source this file.
# shellcheck disable=SC2034
# Shared helpers for the house deploy kit (sourced by install/deploy/rollback/backup/restore/status).
# Server layout (all overridable through /srv/house/shared/deploy.conf written by install.sh):
#   /srv/house/repo.git          bare mirror of the Git repository
#   /srv/house/releases/<ts>-<sha>  one directory per build
#   /srv/house/current           symlink → active release (atomic switch)
#   /srv/house/shared/.env       API environment (secrets, 0600)
#   /srv/house/shared/deploy.conf  deploy settings (ports, instances, repo, domain)
#   /srv/house/bin               installed copy of deploy/ (scripts run from here)
#   /var/lib/house/uploads/{public,private}, /var/backups/house, /var/log/house

HOUSE_USER="${HOUSE_USER:-house}"
HOUSE_ROOT="${HOUSE_ROOT:-/srv/house}"
SHARED_DIR="$HOUSE_ROOT/shared"
RELEASES_DIR="$HOUSE_ROOT/releases"
CURRENT_LINK="$HOUSE_ROOT/current"
MIRROR_DIR="$HOUSE_ROOT/repo.git"
BIN_DIR="$HOUSE_ROOT/bin"
ENV_FILE="$SHARED_DIR/.env"
DEPLOY_CONF="$SHARED_DIR/deploy.conf"

# Defaults; deploy.conf overrides them.
REPO_URL=""
BRANCH="main"
DOMAIN=""
ADMIN_DOMAIN=""
API_PORT=4000
WEB_PORT=3000
ADMIN_PORT=3001
WORKER_PORT=4100
API_INSTANCES=2
WEB_INSTANCES=2
ADMIN_INSTANCES=1
KEEP_RELEASES=5
UPLOAD_ROOT=/var/lib/house/uploads
BACKUP_DIR=/var/backups/house
LOG_DIR=/var/log/house
BACKUP_RETENTION_DAYS=14
RCLONE_REMOTE=""
BACKUP_NOTIFY_URL=""
DB_NAME=house
DB_USER=house
TLS_ENABLED=true

# Deterministic toolchain: system Node (NodeSource) and its corepack/pnpm/pm2 shims.
export PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
export COREPACK_ENABLE_DOWNLOAD_PROMPT=0
export TURBO_TELEMETRY_DISABLED=1
export NEXT_TELEMETRY_DISABLED=1

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

# Load deploy.conf (KEY=value lines written by install.sh; values are validated there).
load_conf() {
  if [[ -r "$DEPLOY_CONF" ]]; then
    # shellcheck source=/dev/null
    source "$DEPLOY_CONF"
  fi
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

# libpq rejects Prisma's ?schema=public query parameter; pg_dump/psql get the bare URL.
libpq_url() {
  local url
  url="$(env_get DATABASE_URL)"
  [[ -n "$url" ]] || die "DATABASE_URL이 $ENV_FILE 에 없습니다."
  printf '%s' "${url%%\?*}"
}

# Re-exec the calling script as the service user when started as root.
ensure_house_user() {
  if [[ "$(id -un)" == "$HOUSE_USER" ]]; then return 0; fi
  if [[ $EUID -eq 0 ]]; then
    id "$HOUSE_USER" >/dev/null 2>&1 || die "사용자 '$HOUSE_USER'가 없습니다. 먼저 install.sh를 실행하세요."
    local self
    self="$(readlink -f "$0")"
    # Clean environment: nothing from root's shell (npm/pnpm config, tokens) reaches the build.
    local -a keep=() v
    for v in LANG LC_ALL TERM http_proxy https_proxy no_proxy HTTP_PROXY HTTPS_PROXY NO_PROXY; do
      [[ -n "${!v:-}" ]] && keep+=("$v=${!v}")
    done
    exec runuser -u "$HOUSE_USER" -- env -i HOME="/home/$HOUSE_USER" USER="$HOUSE_USER" \
      LOGNAME="$HOUSE_USER" SHELL=/bin/bash PATH="$PATH" "${keep[@]}" bash "$self" "$@"
  fi
  die "이 스크립트는 '$HOUSE_USER' 사용자(또는 root)로 실행해야 합니다."
}

# Exclusive lock shared by deploy/rollback/restore so they never run concurrently.
# A re-exec'd child inherits the fd (HOUSE_LOCK_FD) and must not reopen it.
acquire_lock() {
  local lockfile="$SHARED_DIR/.deploy.lock"
  if [[ -n "${HOUSE_LOCK_FD:-}" ]]; then return 0; fi
  exec 9>>"$lockfile" || die "잠금 파일을 열 수 없습니다: $lockfile"
  if ! flock -n 9; then
    die "다른 배포/롤백/복원 작업이 진행 중입니다. (잠금: $lockfile)"
  fi
  export HOUSE_LOCK_FD=9
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

current_release() {
  if [[ -L "$CURRENT_LINK" ]]; then readlink -f "$CURRENT_LINK"; fi
}

# Releases sorted oldest → newest (names start with a sortable timestamp).
list_releases() {
  [[ -d "$RELEASES_DIR" ]] || return 0
  find "$RELEASES_DIR" -mindepth 1 -maxdepth 1 -type d -printf '%f\n' | sort
}

# Atomic symlink switch: create a temp link then rename over the old one (rename(2) is atomic).
switch_current() {
  local target="$1" tmp="$HOUSE_ROOT/.current.tmp.$$"
  [[ -d "$target" ]] || die "릴리스 디렉터리가 없습니다: $target"
  ln -sfn "$target" "$tmp"
  mv -Tf "$tmp" "$CURRENT_LINK"
}

worker_uses_http() {
  # Until apps/api ships a dedicated dist/worker.js, the worker runs main.js on WORKER_PORT.
  [[ ! -f "$1/apps/api/dist/worker.js" ]]
}

http_ok() {
  local url="$1"
  curl -fs -o /dev/null --max-time 5 "$url"
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

pm2_apply() {
  local release="$1"
  pm2_cmd startOrReload "$release/ecosystem.config.cjs" --update-env
  pm2_cmd save --force >/dev/null
}
