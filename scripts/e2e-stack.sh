#!/usr/bin/env bash
# Real-API browser e2e stack (stage 3): apps/api + worker + apps/web + apps/admin in REAL API mode
# (NEXT_PUBLIC_API_MOCK unset) on a freshly migrated, base + demo seeded database of its own.
#
#   scripts/e2e-stack.sh up [--skip-build] [--keep-data]   reset DB/Redis, build, start, wait for health
#   scripts/e2e-stack.sh down [--keep-builds]              stop everything (+ remove .next-e2e builds)
#   scripts/e2e-stack.sh status                             pids + health of each service
#   scripts/e2e-stack.sh logs [api|worker|web|admin|media|build-web|build-admin|setup]
#   scripts/e2e-stack.sh reset-limits                       clear rate-limit / daily-cap counters
#   scripts/e2e-stack.sh env                                print the env the tests read
#
# Isolation: database house_e2e, Redis DB index 14 (prefix house-e2e:), ports 4100 (api),
# 4101 (/media static, stands in for nginx), 3200 (web), 3201 (admin), Next dist dir .next-e2e,
# API build in apps/api/.tmp/e2e-dist. Logs + state in .tmp/e2e/. See docs/E2E.md.
#
# The API runs with NODE_ENV=test + E2E_FAKE_OAUTH=1, which registers the TEST-ONLY login
# POST /api/v1/e2e/login (apps/api/src/modules/e2e-auth). Never use these settings anywhere else.
set -Eeuo pipefail

ROOT="$(cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")/.." && pwd)"
API_DIR="$ROOT/apps/api"
WEB_DIR="$ROOT/apps/web"
ADMIN_DIR="$ROOT/apps/admin"
STATE_DIR="$ROOT/.tmp/e2e"
PID_DIR="$STATE_DIR/pids"
LOG_DIR="$STATE_DIR/logs"

E2E_DB_NAME="${E2E_DB_NAME:-house_e2e}"
E2E_PG_URL="${E2E_PG_URL:-postgresql://house:house@localhost:5432}"
E2E_REDIS_HOST_URL="${E2E_REDIS_HOST_URL:-redis://localhost:6379}"
E2E_REDIS_DB="${E2E_REDIS_DB:-14}"
E2E_API_PORT="${E2E_API_PORT:-4100}"
E2E_MEDIA_PORT="${E2E_MEDIA_PORT:-4101}"
E2E_WEB_PORT="${E2E_WEB_PORT:-3200}"
E2E_ADMIN_PORT="${E2E_ADMIN_PORT:-3201}"
E2E_DIST_DIR=".next-e2e"
E2E_API_DIST=".tmp/e2e-dist"
E2E_ADMIN_EMAIL="${E2E_ADMIN_EMAIL:-e2e-admin@e2e.example.invalid}"
E2E_ADMIN_PASSWORD="${E2E_ADMIN_PASSWORD:-e2e-Admin-Passw0rd-only}"
HEALTH_TIMEOUT="${E2E_HEALTH_TIMEOUT:-180}"

API_ORIGIN="http://127.0.0.1:$E2E_API_PORT"
MEDIA_ORIGIN="http://127.0.0.1:$E2E_MEDIA_PORT"
WEB_URL="http://localhost:$E2E_WEB_PORT"
ADMIN_URL="http://localhost:$E2E_ADMIN_PORT"
SERVICES=(media api worker web admin)

log() { printf '\033[1;34m[e2e]\033[0m %s\n' "$*"; }
die() {
  printf '\033[1;31m[e2e] %s\033[0m\n' "$*" >&2
  exit 1
}

# --------------------------------------------------------------------------- safety checks

check_isolation() {
  [[ "$E2E_DB_NAME" =~ ^house_e2e[a-z0-9_]*$ ]] || die "E2E_DB_NAME must start with house_e2e (got $E2E_DB_NAME)"
  if ! [[ "$E2E_REDIS_DB" =~ ^[0-9]+$ ]] || ((E2E_REDIS_DB < 1 || E2E_REDIS_DB > 15)); then
    die "E2E_REDIS_DB must be 1..15 (0 is the dev DB)"
  fi
  local f
  for f in "$API_DIR"/test/env/*.env; do
    if grep -qE "^REDIS_DB=${E2E_REDIS_DB}\s*$" "$f"; then
      die "Redis DB $E2E_REDIS_DB is used by $(basename "$f") — pick another E2E_REDIS_DB"
    fi
  done
  for f in "$WEB_DIR" "$ADMIN_DIR"; do
    if grep -sqE '^\s*NEXT_PUBLIC_API_MOCK\s*=\s*1' "$f"/.env "$f"/.env.local "$f"/.env.production \
      "$f"/.env.production.local; then
      die "$f has NEXT_PUBLIC_API_MOCK=1 in an .env file — the e2e build must run in real API mode"
    fi
  done
}

port_busy() { ss -ltnH "sport = :$1" 2>/dev/null | grep -q .; }

# --------------------------------------------------------------------------- env

api_env() {
  # NODE_ENV=test: ConfigModule ignores apps/api/.env, so everything is given here.
  cat <<EOF
NODE_ENV=test
HOST=127.0.0.1
PORT=$E2E_API_PORT
TRUST_PROXY=loopback
LOG_LEVEL=${E2E_API_LOG_LEVEL:-info}
LOG_PRETTY=false
SWAGGER_ENABLED=false
PUBLIC_BASE_URL=$WEB_URL
ADMIN_BASE_URL=$ADMIN_URL
# Same origin as the site, as in production (deploy/install.sh: API_BASE_URL = site URL):
# banner click URLs and OAuth callbacks go through the web rewrite.
API_BASE_URL=$WEB_URL
# Per surface (common/auth/origin-policy.ts): user routes ← site aliases, /api/v1/admin/** ← admin aliases.
CORS_ORIGINS=http://127.0.0.1:$E2E_WEB_PORT
ADMIN_CORS_ORIGINS=http://127.0.0.1:$E2E_ADMIN_PORT
DATABASE_URL=$E2E_PG_URL/$E2E_DB_NAME?schema=public
REDIS_URL=$E2E_REDIS_HOST_URL/$E2E_REDIS_DB
REDIS_KEY_PREFIX=house-e2e:
COOKIE_SECRET=e2e-only-cookie-secret-0123456789abcdefghijkl
COOKIE_SECURE=false
ADMIN_SESSION_IDLE_TTL_SECONDS=7200
TOTP_ENCRYPTION_KEY=ZTJlLW9ubHktdG90cC1rZXktMzItYnl0ZXMtbG9uZyE=
UPLOAD_DIR=$STATE_DIR/uploads
PRIVATE_UPLOAD_DIR=$STATE_DIR/private-uploads
MEDIA_BASE_URL=/media
REGION_SGG_CODE=12150
THROTTLE_LIMIT=100000
E2E_FAKE_OAUTH=1
EOF
}

next_env() {
  # $1 = public site URL. Rewrites (/api/v1, /media) are baked in at build time, so build and
  # start get the same values.
  cat <<EOF
NEXT_DIST_DIR=$E2E_DIST_DIR
INTERNAL_API_URL=$API_ORIGIN
MEDIA_ORIGIN=$MEDIA_ORIGIN
NEXT_PUBLIC_SITE_URL=$1
NEXT_TELEMETRY_DISABLED=1
EOF
}

# Runs "$@" with the given KEY=VALUE lines exported (and NEXT_PUBLIC_API_MOCK unset).
with_env() {
  local envtext="$1"
  shift
  (
    unset NEXT_PUBLIC_API_MOCK
    set -a
    # shellcheck disable=SC1090
    source <(printf '%s\n' "$envtext")
    set +a
    "$@"
  )
}

# --------------------------------------------------------------------------- process control

start_bg() {
  # start_bg <name> <cwd> <envtext> <cmd...>: own session (kill the whole group on down).
  local name="$1" cwd="$2" envtext="$3"
  shift 3
  : >"$LOG_DIR/$name.log"
  (
    cd "$cwd"
    unset NEXT_PUBLIC_API_MOCK
    set -a
    # shellcheck disable=SC1090
    source <(printf '%s\n' "$envtext")
    set +a
    exec setsid "$@" >>"$LOG_DIR/$name.log" 2>&1 </dev/null
  ) &
  echo $! >"$PID_DIR/$name.pid"
}

pid_of() { [[ -f "$PID_DIR/$1.pid" ]] && cat "$PID_DIR/$1.pid"; }
alive() {
  local pid
  pid="$(pid_of "$1")" || return 1
  [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null
}

stop_one() {
  local name="$1" pid i
  pid="$(pid_of "$name")" || return 0
  if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
    kill -TERM -- "-$pid" 2>/dev/null || kill -TERM "$pid" 2>/dev/null || true
    for ((i = 0; i < 100; i++)); do
      kill -0 "$pid" 2>/dev/null || break
      sleep 0.2
    done
    kill -KILL -- "-$pid" 2>/dev/null || true
    log "stopped $name"
  fi
  rm -f "$PID_DIR/$name.pid"
}

wait_for() {
  # wait_for <label> <service-name> <check command...>: polls until the check passes, the
  # process dies, or HEALTH_TIMEOUT elapses.
  local label="$1" name="$2"
  shift 2
  local deadline=$((SECONDS + HEALTH_TIMEOUT))
  until "$@" >/dev/null 2>&1; do
    if ! alive "$name"; then
      tail -n 40 "$LOG_DIR/$name.log" >&2 || true
      die "$label exited during startup (log: $LOG_DIR/$name.log)"
    fi
    ((SECONDS < deadline)) || {
      tail -n 40 "$LOG_DIR/$name.log" >&2 || true
      die "$label not healthy after ${HEALTH_TIMEOUT}s (log: $LOG_DIR/$name.log)"
    }
    sleep 1
  done
  log "$label ready"
}

http_ok() { [[ "$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "$1")" == "200" ]]; }
worker_ready() { grep -q 'worker started' "$LOG_DIR/worker.log"; }

# --------------------------------------------------------------------------- steps

reset_data() {
  log "resetting database $E2E_DB_NAME and Redis DB $E2E_REDIS_DB"
  psql "$E2E_PG_URL/postgres" -v ON_ERROR_STOP=1 -qAt \
    -c "DROP DATABASE IF EXISTS \"$E2E_DB_NAME\" WITH (FORCE)" \
    -c "CREATE DATABASE \"$E2E_DB_NAME\"" >/dev/null
  redis-cli -u "$E2E_REDIS_HOST_URL/$E2E_REDIS_DB" FLUSHDB >/dev/null
  rm -rf "$STATE_DIR/uploads" "$STATE_DIR/private-uploads" "$STATE_DIR/admin.json" "$STATE_DIR/auth"
  mkdir -p "$STATE_DIR/uploads" "$STATE_DIR/private-uploads"

  local env
  env="$(api_env)"
  log "prisma migrate deploy"
  (cd "$API_DIR" && with_env "$env" flock /tmp/house-prisma.lock ./node_modules/.bin/prisma migrate deploy) \
    >"$LOG_DIR/setup.log" 2>&1 || {
    tail -n 30 "$LOG_DIR/setup.log" >&2
    die "migrate failed"
  }
  log "seed: base + demo + e2e admin"
  # `prisma db seed` runs "tsx prisma/seed.ts": apps/api's bin dir must be on PATH (pnpm does that).
  (cd "$API_DIR" && PATH="$API_DIR/node_modules/.bin:$PATH" with_env "$env
SEED_DEMO=true
ADMIN_BOOTSTRAP_EMAIL=$E2E_ADMIN_EMAIL
ADMIN_BOOTSTRAP_PASSWORD=$E2E_ADMIN_PASSWORD" ./node_modules/.bin/prisma db seed) \
    >>"$LOG_DIR/setup.log" 2>&1 || {
    tail -n 30 "$LOG_DIR/setup.log" >&2
    die "seed failed"
  }
}

build_all() {
  local shared_dist="$ROOT/packages/shared/dist/index.js"
  if [[ ! -f "$shared_dist" ]] || [[ -n "$(find "$ROOT/packages/shared/src" -newer "$shared_dist" -print -quit)" ]]; then
    log "building @house/shared"
    (cd "$ROOT/packages/shared" && ./node_modules/.bin/tsc -p tsconfig.build.json) >"$LOG_DIR/build-shared.log" 2>&1 || {
      tail -n 30 "$LOG_DIR/build-shared.log" >&2
      die "@house/shared build failed"
    }
  fi
  log "building api → apps/api/$E2E_API_DIST"
  (cd "$API_DIR" && rm -rf "$E2E_API_DIST" && ./node_modules/.bin/tsc -p tsconfig.build.json \
    --outDir "$E2E_API_DIST" --tsBuildInfoFile "$E2E_API_DIST/.tsbuildinfo") >"$LOG_DIR/build-api.log" 2>&1 || {
    tail -n 30 "$LOG_DIR/build-api.log" >&2
    die "api build failed"
  }
  log "building web + admin (next build, $E2E_DIST_DIR, real API mode) — a few minutes"
  local wenv aenv
  wenv="$(next_env "$WEB_URL")"
  aenv="$(next_env "$WEB_URL")"
  (cd "$WEB_DIR" && with_env "$wenv" ./node_modules/.bin/next build) >"$LOG_DIR/build-web.log" 2>&1 &
  local wpid=$!
  (cd "$ADMIN_DIR" && with_env "$aenv" ./node_modules/.bin/next build) >"$LOG_DIR/build-admin.log" 2>&1 &
  local apid=$!
  local failed=0
  wait "$wpid" || {
    tail -n 40 "$LOG_DIR/build-web.log" >&2
    failed=1
  }
  wait "$apid" || {
    tail -n 40 "$LOG_DIR/build-admin.log" >&2
    failed=1
  }
  ((failed == 0)) || die "next build failed (logs: $LOG_DIR/build-web.log, build-admin.log)"
}

cmd_up() {
  local skip_build=0 keep_data=0 a
  for a in "$@"; do
    case "$a" in
      --skip-build) skip_build=1 ;;
      --keep-data) keep_data=1 ;;
      *) die "unknown option $a" ;;
    esac
  done
  check_isolation
  mkdir -p "$PID_DIR" "$LOG_DIR"
  cmd_down --keep-builds >/dev/null
  local p
  for p in "$E2E_API_PORT" "$E2E_MEDIA_PORT" "$E2E_WEB_PORT" "$E2E_ADMIN_PORT"; do
    port_busy "$p" && die "port $p is already in use"
  done
  pg_isready -d "$E2E_PG_URL/postgres" -q || die "PostgreSQL is not reachable at $E2E_PG_URL"
  redis-cli -u "$E2E_REDIS_HOST_URL" ping >/dev/null || die "Redis is not reachable at $E2E_REDIS_HOST_URL"

  if ((skip_build)); then
    [[ -f "$API_DIR/$E2E_API_DIST/main.js" && -d "$WEB_DIR/$E2E_DIST_DIR" && -d "$ADMIN_DIR/$E2E_DIST_DIR" ]] ||
      die "--skip-build: no previous e2e build found"
  else
    build_all
  fi
  if ((keep_data)); then
    [[ -f "$STATE_DIR/admin.json" ]] || die "--keep-data: no previous e2e state (.tmp/e2e/admin.json)"
  else
    reset_data
  fi

  local env
  env="$(api_env)"
  start_bg media "$ROOT" "E2E_MEDIA_ROOT=$STATE_DIR/uploads
E2E_MEDIA_PORT=$E2E_MEDIA_PORT" node scripts/e2e/media-server.mjs
  start_bg api "$API_DIR" "$env" node --enable-source-maps "$E2E_API_DIST/main.js"
  start_bg worker "$API_DIR" "$env" node --enable-source-maps "$E2E_API_DIST/worker.js"
  wait_for "media server" media http_ok "$MEDIA_ORIGIN/healthz"
  wait_for "api" api http_ok "$API_ORIGIN/api/v1/health/ready"
  wait_for "worker" worker worker_ready

  if ((!keep_data)); then
    log "enrolling e2e admin TOTP"
    E2E_API_ORIGIN="$API_ORIGIN" E2E_ADMIN_EMAIL="$E2E_ADMIN_EMAIL" E2E_ADMIN_PASSWORD="$E2E_ADMIN_PASSWORD" \
      E2E_STATE_DIR="$STATE_DIR" node "$ROOT/scripts/e2e/enroll-admin.mjs" >>"$LOG_DIR/setup.log" 2>&1 || {
      tail -n 20 "$LOG_DIR/setup.log" >&2
      die "admin enrollment failed"
    }
  fi

  start_bg web "$WEB_DIR" "$(next_env "$WEB_URL")
PORT=$E2E_WEB_PORT" ./node_modules/.bin/next start --port "$E2E_WEB_PORT"
  start_bg admin "$ADMIN_DIR" "$(next_env "$WEB_URL")
PORT=$E2E_ADMIN_PORT" ./node_modules/.bin/next start --port "$E2E_ADMIN_PORT"
  wait_for "web" web http_ok "$WEB_URL/"
  wait_for "admin" admin http_ok "$ADMIN_URL/login"

  cmd_env >"$STATE_DIR/stack.env"
  log "stack is up — web $WEB_URL · admin $ADMIN_URL · api $API_ORIGIN (logs: .tmp/e2e/logs)"
  log "run tests: pnpm exec playwright test -c e2e/playwright.config.ts"
}

cmd_down() {
  local keep_builds=0 a
  for a in "$@"; do
    case "$a" in
      --keep-builds) keep_builds=1 ;;
      *) die "unknown option $a" ;;
    esac
  done
  mkdir -p "$PID_DIR"
  local s
  for ((i = ${#SERVICES[@]} - 1; i >= 0; i--)); do
    s="${SERVICES[$i]}"
    stop_one "$s"
  done
  if ((!keep_builds)); then
    rm -rf "${WEB_DIR:?}/${E2E_DIST_DIR:?}" "${ADMIN_DIR:?}/${E2E_DIST_DIR:?}" "${API_DIR:?}/${E2E_API_DIST:?}" \
      "$WEB_DIR/tsconfig.next-e2e.json" "$ADMIN_DIR/tsconfig.next-e2e.json"
    log "removed e2e builds ($E2E_DIST_DIR, apps/api/$E2E_API_DIST)"
  fi
  rm -f "$STATE_DIR/stack.env"
  log "stack is down"
}

cmd_status() {
  local s
  for s in "${SERVICES[@]}"; do
    if alive "$s"; then printf '%-7s running (pid %s)\n' "$s" "$(pid_of "$s")"; else printf '%-7s stopped\n' "$s"; fi
  done
  printf 'api health   %s\n' "$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 "$API_ORIGIN/api/v1/health/ready" || true)"
  printf 'web /        %s\n' "$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "$WEB_URL/" || true)"
  printf 'admin /login %s\n' "$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "$ADMIN_URL/login" || true)"
}

cmd_logs() {
  local name="${1:-api}"
  [[ -f "$LOG_DIR/$name.log" ]] || die "no log $LOG_DIR/$name.log"
  tail -n 200 -f "$LOG_DIR/$name.log"
}

cmd_reset_limits() {
  local n=0 key
  while read -r key; do
    [[ -n "$key" ]] || continue
    redis-cli -u "$E2E_REDIS_HOST_URL/$E2E_REDIS_DB" DEL "$key" >/dev/null
    n=$((n + 1))
  done < <(redis-cli -u "$E2E_REDIS_HOST_URL/$E2E_REDIS_DB" --scan --pattern 'house-e2e:throttle:*'
    redis-cli -u "$E2E_REDIS_HOST_URL/$E2E_REDIS_DB" --scan --pattern 'house-e2e:cap:*')
  log "cleared $n rate-limit / daily-cap keys"
}

cmd_env() {
  cat <<EOF
E2E_WEB_URL=$WEB_URL
E2E_ADMIN_URL=$ADMIN_URL
E2E_API_ORIGIN=$API_ORIGIN
E2E_STATE_DIR=$STATE_DIR
E2E_ADMIN_EMAIL=$E2E_ADMIN_EMAIL
EOF
}

case "${1:-}" in
  up) shift && cmd_up "$@" ;;
  down) shift && cmd_down "$@" ;;
  status) cmd_status ;;
  logs) shift && cmd_logs "$@" ;;
  reset-limits) cmd_reset_limits ;;
  env) cmd_env ;;
  *)
    sed -n '2,12p' "$0" | sed 's/^# \{0,1\}//'
    exit 2
    ;;
esac
