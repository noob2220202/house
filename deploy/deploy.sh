#!/usr/bin/env bash
# shellcheck disable=SC2317 # on_error/rollback_now run from traps
# Zero-downtime deploy: fetch → new release dir → pnpm install → build → (backup + migrate)
# → preflight on spare ports → atomic `current` switch → pm2 startOrReload → health checks
# → auto-rollback on failure.
#
#   sudo /srv/house/deploy.sh                 # deploy the configured branch (deploy.conf BRANCH)
#   sudo /srv/house/deploy.sh --branch hotfix
#   sudo /srv/house/deploy.sh --skip-migrate  # code-only deploy (no DB migration, no seed)
#   sudo /srv/house/deploy.sh --skip-build-cache  # full rebuild (ignore the turbo cache)
#
# Runs as the 'house' user (root re-execs itself as house) in its own session, so a dropped SSH
# connection cannot interrupt it. The deploy kit itself (/srv/house/bin) is root-owned and is
# only updated by `sudo /srv/house/bin/install.sh --kit-only`. See docs/DEPLOY.md.
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")" && pwd)"
# shellcheck source=lib/common.sh
source "$SCRIPT_DIR/lib/common.sh"

usage() {
  cat <<'EOF'
사용법: ./deploy.sh [옵션]
  --branch <이름>       배포할 브랜치 (기본: deploy.conf 의 BRANCH)
  --ref <커밋>          특정 커밋을 배포 (브랜치 최신 대신)
  --skip-migrate        DB 마이그레이션/시드를 건너뜀
  --skip-build-cache    빌드 캐시(turbo) 없이 처음부터 빌드
  --skip-seed           마이그레이션 후 기본 시드(멱등)를 건너뜀
  --force               이미 배포된 커밋이어도 새로 빌드
  --foreground          별도 세션으로 분리하지 않고 현재 터미널에서 실행
  -h, --help            도움말
EOF
}

ORIG_ARGS=("$@")
OPT_BRANCH="" OPT_REF="" SKIP_MIGRATE=false SKIP_BUILD_CACHE=false SKIP_SEED=false FORCE=false
FOREGROUND=false
while [[ $# -gt 0 ]]; do
  case "$1" in
    --branch) [[ -n "${2:-}" ]] || die "--branch 에 값이 필요합니다."; OPT_BRANCH="$2"; shift 2 ;;
    --ref) [[ -n "${2:-}" ]] || die "--ref 에 값이 필요합니다."; OPT_REF="$2"; shift 2 ;;
    --skip-migrate) SKIP_MIGRATE=true; shift ;;
    --skip-build-cache) SKIP_BUILD_CACHE=true; shift ;;
    --skip-seed) SKIP_SEED=true; shift ;;
    --force) FORCE=true; shift ;;
    --foreground) FOREGROUND=true; shift ;;
    --no-self-update) shift ;; # accepted for old habits; the kit never updates itself now
    -h | --help) usage; exit 0 ;;
    *) usage >&2; die "알 수 없는 옵션: $1" ;;
  esac
done

ensure_house_user "${ORIG_ARGS[@]}"
load_conf
[[ -n "$OPT_BRANCH" ]] && BRANCH="$OPT_BRANCH"
[[ "$BRANCH" =~ $BRANCH_RE && "$BRANCH" != *..* ]] || die "브랜치 이름이 올바르지 않습니다: $BRANCH"
[[ -z "$OPT_REF" || "$OPT_REF" =~ ^[0-9a-f]{7,40}$ ]] || die "--ref 는 커밋 해시여야 합니다."
[[ -r "$ENV_FILE" ]] || die "$ENV_FILE 을 읽을 수 없습니다. 먼저 install.sh 를 실행하세요."
[[ -n "$REPO_URL" ]] || die "저장소 주소(REPO_URL)가 $DEPLOY_CONF 에 없습니다. install.sh --repo 로 지정하세요."
umask 022

mkdir -p "$LOG_DIR"
# Detach from the terminal before anything changes; the foreground only follows the log.
$FOREGROUND || run_detached "$LOG_DIR/deploy.log" "${ORIG_ARGS[@]}"
if [[ -z "${HOUSE_DETACHED:-}" ]]; then
  # --foreground: log through tee, which ignores HUP/INT so it outlives a dropped terminal.
  exec > >(trap '' HUP INT; exec tee -a "$LOG_DIR/deploy.log") 2>&1
fi
acquire_lock

LAST_GOOD_ENV="$BACKUP_DIR/config/env.last-good"
START_TS=$(date +%s)
step "배포 시작 — $(date '+%Y-%m-%d %H:%M:%S') (branch: $BRANCH)"

# Keeps a copy of the .env that just passed a health check (house-owned backup dir, 0600).
save_last_good_env() {
  (umask 077 && mkdir -p "$BACKUP_DIR/config" && cp "$ENV_FILE" "$LAST_GOOD_ENV.tmp" &&
    mv -f "$LAST_GOOD_ENV.tmp" "$LAST_GOOD_ENV") || warn "정상 설정 사본을 저장하지 못했습니다: $LAST_GOOD_ENV"
}
env_restore_hint() {
  if [[ -f "$LAST_GOOD_ENV" ]] && ! cmp -s "$LAST_GOOD_ENV" "$ENV_FILE"; then
    warn "직전 정상 .env 로 되돌리기: sudo install -m 0640 -o root -g $HOUSE_USER $LAST_GOOD_ENV $ENV_FILE && sudo $HOUSE_ROOT/deploy.sh"
    warn "바뀐 부분 확인: sudo diff $LAST_GOOD_ENV $ENV_FILE"
  fi
}

# ─── 1. fetch ───────────────────────────────────────────────────────────────────────────────
step "저장소 가져오기"
GIT_SSH_COMMAND="ssh -o BatchMode=yes"
[[ -r "$KNOWN_HOSTS_FILE" ]] &&
  GIT_SSH_COMMAND+=" -o UserKnownHostsFile=$KNOWN_HOSTS_FILE -o StrictHostKeyChecking=yes"
export GIT_SSH_COMMAND
if [[ ! -f "$MIRROR_DIR/HEAD" ]]; then
  # install.sh creates the (empty) mirror directory; /srv/house itself is root-owned.
  git clone -q --mirror "$REPO_URL" "$MIRROR_DIR" ||
    die "저장소를 복제할 수 없습니다: $REPO_URL (배포 키 등록 여부 확인: docs/DEPLOY.md)"
else
  git -C "$MIRROR_DIR" remote set-url origin "$REPO_URL"
  git -C "$MIRROR_DIR" fetch -q --prune origin || die "git fetch 실패: $REPO_URL"
fi
if [[ -n "$OPT_REF" ]]; then
  SHA="$(git -C "$MIRROR_DIR" rev-parse --verify -q "${OPT_REF}^{commit}")" || die "커밋을 찾을 수 없습니다: $OPT_REF"
else
  SHA="$(git -C "$MIRROR_DIR" rev-parse --verify -q "refs/heads/${BRANCH}^{commit}")" ||
    die "브랜치를 찾을 수 없습니다: $BRANCH"
fi
SHORT="${SHA:0:7}"
SUBJECT="$(git -C "$MIRROR_DIR" log -1 --date=format:'%Y-%m-%d %H:%M' --format='%s (%an, %cd)' "$SHA")"
ok "$SHORT — $SUBJECT"

# ─── 2. deploy kit drift ────────────────────────────────────────────────────────────────────
# bin/ is root-owned and root runs it, so it is never rewritten from here (the service user's
# mirror is not a trusted source). Changed kit files only produce a notice.
KIT_NOTICE=""
if git -C "$MIRROR_DIR" cat-file -e "${SHA}:deploy/deploy.sh" 2>/dev/null; then
  KIT_TMP="$(mktemp -d)"
  git -C "$MIRROR_DIR" archive "$SHA" deploy | tar -x -C "$KIT_TMP"
  if ! diff -qr "$KIT_TMP/deploy" "$BIN_DIR" >/dev/null 2>&1; then
    KIT_NOTICE="이 커밋의 배포 스크립트(deploy/)가 설치본과 다릅니다. 배포 후 갱신: sudo $BIN_DIR/install.sh --kit-only --kit-ref $SHA"
    warn "$KIT_NOTICE"
  fi
  rm -rf "$KIT_TMP"
fi

PREV_RELEASE="$(current_release)"
PREFLIGHT_PORTS=("$((API_PORT + PREFLIGHT_OFFSET))" "$((WEB_PORT + PREFLIGHT_OFFSET))" "$((ADMIN_PORT + PREFLIGHT_OFFSET))")
# Build-time settings of web/admin (NEXT_PUBLIC_*, MEDIA_ORIGIN, ...): Next bakes them into the
# build, so a release built with other values is rebuilt even when the commit is the same.
mapfile -t BUILD_ENV < <(build_env_lines)
BUILD_FP="$(printf '%s\n' "${BUILD_ENV[@]}" | build_env_fingerprint)"
SAME_COMMIT=false
if [[ -n "$PREV_RELEASE" && -f "$PREV_RELEASE/REVISION" && "$(cat "$PREV_RELEASE/REVISION")" == "$SHA" ]] && ! $FORCE; then
  SAME_COMMIT=true
  if [[ "$(cat "$PREV_RELEASE/BUILD_ENV.sha256" 2>/dev/null)" != "$BUILD_FP" ]]; then
    SAME_COMMIT=false
    step "같은 커밋이지만 빌드 설정(NEXT_PUBLIC_* 등)이 바뀌어 새로 빌드합니다 ($SHORT)"
  fi
fi
if $SAME_COMMIT; then
  step "이미 배포된 커밋입니다 ($SHORT) — 새 빌드 없이 설정만 다시 적용(reload)합니다"
  log "(.env 변경 반영용, 빌드 설정은 그대로. 새로 빌드하려면 --force)"
  # The new .env must boot the current build on spare ports before PM2 swaps any worker.
  step "사전 기동 점검 (현재 릴리스 + 새 .env, 임시 포트 +${PREFLIGHT_OFFSET})"
  if ! HOUSE_ROOT="$HOUSE_ROOT" node "$SCRIPT_DIR/lib/preflight.cjs" "$PREV_RELEASE" "${PREFLIGHT_PORTS[@]}" 90; then
    warn "새 설정(.env)으로는 앱이 기동하지 않습니다. 현재 서비스는 바뀌지 않았습니다 (reload 안 함)."
    env_restore_hint
    die "위 preflight 오류의 설정 키를 고친 뒤 다시 실행하세요."
  fi
  pm2_apply "$CURRENT_LINK"
  if ! health_check "$PREV_RELEASE"; then
    env_restore_hint
    die "헬스체크 실패 — ./status.sh 와 로그를 확인하세요."
  fi
  save_last_good_env
  ok "reload 완료"
  exit 0
fi

# ─── 3. release directory ───────────────────────────────────────────────────────────────────
RELEASE_NAME="$(date +%Y%m%d%H%M%S)-${SHORT}"
RELEASE="$RELEASES_DIR/$RELEASE_NAME"
step "릴리스 준비: $RELEASE"
mkdir -p "$RELEASE"
git -C "$MIRROR_DIR" archive "$SHA" | tar -x -C "$RELEASE"
printf '%s\n' "$SHA" >"$RELEASE/REVISION"
printf 'branch=%s\nsha=%s\nsubject=%s\ndeployed_at=%s\n' "$BRANCH" "$SHA" "$SUBJECT" "$(date -Is)" >"$RELEASE/RELEASE_INFO"
# Shared state: one .env (API + Prisma CLI read apps/api/.env) and the uploads tree.
ln -sfn "$ENV_FILE" "$RELEASE/apps/api/.env"
ln -sfn "$UPLOAD_ROOT" "$RELEASE/uploads"
ok "소스 추출 및 공유 파일 연결"

FAILED_STAGE=""
PRE_DUMP=""
MIGRATED=""
SWITCHED=""
migration_warning() {
  if [[ -n "$MIGRATED" ]]; then
    warn "DB 마이그레이션은 이미 적용되었고 되돌리지 않았습니다 (추가형 변경 원칙). 마이그레이션 전 백업: ${PRE_DUMP:-없음}"
  fi
}
on_error() {
  local code="${1:-$?}"
  # No second signal may interrupt the rollback itself.
  trap '' INT TERM HUP
  trap - ERR
  warn "배포 실패 (단계: ${FAILED_STAGE:-알 수 없음}, 종료 코드 $code)"
  if [[ -n "$SWITCHED" ]]; then
    rollback_now
  else
    warn "현재 서비스는 바뀌지 않았습니다 (current → ${PREV_RELEASE:-없음})."
  fi
  migration_warning
  if [[ "$FAILED_STAGE" == migrate ]]; then
    [[ -n "$PRE_DUMP" ]] && warn "마이그레이션 전 백업: $PRE_DUMP"
    local m failed_migrations
    failed_migrations="$(db_failed_migrations 2>/dev/null)" || failed_migrations=""
    while IFS= read -r m; do [[ -n "$m" ]] && migrate_resolve_hint "$m"; done <<<"$failed_migrations"
  fi
  [[ -d "$RELEASE" ]] && touch "$RELEASE/.failed"
  exit "$code"
}
trap on_error ERR
trap 'on_error 130' INT
trap 'on_error 143' TERM
trap 'on_error 129' HUP

rollback_now() {
  if [[ -z "$PREV_RELEASE" || ! -d "$PREV_RELEASE" ]]; then
    warn "되돌릴 이전 릴리스가 없습니다 (첫 배포). 로그 확인: pm2 logs / $LOG_DIR/pm2"
    return 0
  fi
  step "자동 롤백 → $(basename "$PREV_RELEASE")"
  switch_current "$PREV_RELEASE"
  if pm2_apply "$CURRENT_LINK" && health_check "$PREV_RELEASE" 20 2; then
    ok "이전 릴리스로 복구되었습니다."
  else
    warn "롤백 후에도 헬스체크 실패 — 즉시 확인 필요: ./status.sh, pm2 logs"
  fi
}

cd "$RELEASE"

# ─── 4. install ─────────────────────────────────────────────────────────────────────────────
FAILED_STAGE="pnpm install"
step "의존성 설치 (pnpm install --frozen-lockfile)"
# A broken network must fail the deploy within minutes, not hang it: short per-request timeouts
# and few retries for registry fetches, plus a hard cap on the whole install (corepack included).
PNPM_INSTALL_TIMEOUT="${PNPM_INSTALL_TIMEOUT:-900}"
[[ "$PNPM_INSTALL_TIMEOUT" =~ ^[1-9][0-9]*$ ]] || PNPM_INSTALL_TIMEOUT=900
if ! CI=true npm_config_fetch_retries=2 npm_config_fetch_timeout=30000 \
  npm_config_fetch_retry_mintimeout=2000 npm_config_fetch_retry_maxtimeout=15000 \
  timeout --kill-after=30 "$PNPM_INSTALL_TIMEOUT" pnpm install --frozen-lockfile --prefer-offline \
  --store-dir "$SHARED_DIR/pnpm-store" --reporter=append-only; then
  warn "pnpm install 실패 또는 ${PNPM_INSTALL_TIMEOUT}초 초과 — 서버의 인터넷 연결(registry.npmjs.org)을 확인하세요."
  false
fi
ok "pnpm $(pnpm --version)"

# ─── 5. build ───────────────────────────────────────────────────────────────────────────────
FAILED_STAGE="build"
step "빌드 (turbo)"
TURBO_ARGS=(--cache-dir="$SHARED_DIR/turbo-cache" --output-logs=errors-only)
$SKIP_BUILD_CACHE && TURBO_ARGS+=(--force)
# Only the optimized images (.next/cache/images) of the previous release are carried over, so
# photos are not re-optimized after every deploy (carry_image_cache, lib/common.sh).
[[ -n "$PREV_RELEASE" ]] && carry_image_cache "$PREV_RELEASE" "$RELEASE"
# Only public build-time settings reach the frontends' build (build_env_lines, computed above).
log "빌드 설정: $(printf '%s ' "${BUILD_ENV[@]%%=*}")"
env "${BUILD_ENV[@]}" pnpm exec turbo run build "${TURBO_ARGS[@]}"
for f in apps/api/dist/main.js apps/web/.next/BUILD_ID apps/admin/.next/BUILD_ID; do
  [[ -f "$f" ]] || { warn "빌드 결과물이 없습니다: $f"; false; }
done
printf '%s\n' "$BUILD_FP" >"$RELEASE/BUILD_ENV.sha256"
ok "빌드 완료 (api, web, admin)"

# ─── 6. migrate ─────────────────────────────────────────────────────────────────────────────
PSQL=(psql -X -q -At -v ON_ERROR_STOP=1)
if $SKIP_MIGRATE; then
  step "DB 마이그레이션 생략 (--skip-migrate)"
else
  FAILED_STAGE="migrate"
  step "DB 마이그레이션 (prisma migrate deploy)"
  # Never overlap the nightly pg_dump: its ACCESS SHARE locks would make every ALTER TABLE wait
  # (and every API query on that table queue behind the ALTER). backup.sh takes the same lock.
  BACKUP_LOCK="$SHARED_DIR/.backup.lock"
  if [[ ! -f "$BACKUP_LOCK" || -L "$BACKUP_LOCK" ]]; then
    warn "잠금 파일이 없습니다: $BACKUP_LOCK — sudo $BIN_DIR/install.sh 를 한 번 다시 실행하세요."
    false
  fi
  exec 8>>"$BACKUP_LOCK"
  if ! flock -n 8; then
    log "백업이 진행 중입니다 — 끝날 때까지 기다립니다 (최대 10분)"
    flock -w 600 8 || { warn "백업이 10분 안에 끝나지 않았습니다. 백업이 끝난 뒤 다시 배포하세요."; false; }
  fi
  # Any query error aborts the deploy: an unreadable DB must never look like an empty one.
  PUBLIC_TABLES="$(pg_run "${PSQL[@]}" -c "select count(*) from information_schema.tables where table_schema = 'public'")"
  # A failed migration (Prisma P3009) blocks every later `migrate deploy` until it is resolved.
  FAILED_MIGRATIONS="$(db_failed_migrations)"
  if [[ -n "$FAILED_MIGRATIONS" ]]; then
    warn "이전 배포에서 실패한 마이그레이션이 DB에 기록되어 있어 진행할 수 없습니다: ${FAILED_MIGRATIONS//$'\n'/ }"
    false # on_error prints the recovery steps
  fi
  APPLIED="$(db_applied_migrations)"
  PENDING=()
  while IFS= read -r m; do
    grep -qxF "$m" <<<"$APPLIED" || PENDING+=("$m")
  done < <(release_migrations .)
  if ((${#PENDING[@]} == 0)); then
    ok "적용할 마이그레이션 없음"
  else
    log "적용 예정 ${#PENDING[@]}개: ${PENDING[*]}"
    if ((PUBLIC_TABLES > 0)); then
      mkdir -p "$BACKUP_DIR/pre-migrate"
      PRE_DUMP="$BACKUP_DIR/pre-migrate/${DB_NAME}-${RELEASE_NAME}.dump"
      (umask 077 && pg_run pg_dump -Fc --no-owner -f "$PRE_DUMP")
      ok "마이그레이션 전 백업: $PRE_DUMP ($(du -h "$PRE_DUMP" | cut -f1))"
      # keep the 10 most recent pre-migration dumps
      find "$BACKUP_DIR/pre-migrate" -maxdepth 1 -name '*.dump' -printf '%T@ %p\n' | sort -rn |
        tail -n +11 | cut -d' ' -f2- | xargs -r rm -f
    fi
    # lock_timeout: a DDL statement that cannot get its lock fails fast instead of stalling the API.
    MIGRATE_URL="$(migrate_db_url "$(env_get DATABASE_URL)")"
    (cd apps/api && DATABASE_URL="$MIGRATE_URL" pnpm exec prisma migrate deploy)
    MIGRATED=1
    ok "마이그레이션 적용 완료"
  fi
  if ! $SKIP_SEED; then
    FAILED_STAGE="seed"
    # Base data (regions, banner slots, site settings) — idempotent; never overwrites edits.
    (cd apps/api && env ADMIN_BOOTSTRAP_EMAIL= ADMIN_BOOTSTRAP_PASSWORD= SEED_ADMIN_EMAIL= SEED_ADMIN_PASSWORD= SEED_DEMO= pnpm exec prisma db seed >/dev/null)
    ok "기본 데이터 시드 (멱등)"
  fi
  exec 8>&- # release the backup lock
fi

# ─── 7. preflight ───────────────────────────────────────────────────────────────────────────
# Boot the new build on spare ports first: a release that cannot start is never switched to.
FAILED_STAGE="preflight"
step "사전 기동 점검 (임시 포트 +${PREFLIGHT_OFFSET})"
HOUSE_ROOT="$HOUSE_ROOT" node "$SCRIPT_DIR/lib/preflight.cjs" "$RELEASE" "${PREFLIGHT_PORTS[@]}" 90
ok "새 릴리스 기동 확인 (api, web, admin)"

# ─── 8. switch + reload ─────────────────────────────────────────────────────────────────────
FAILED_STAGE="switch/reload"
step "릴리스 전환 및 무중단 reload"
SWITCHED=1 # set first: a signal right after the rename must still roll back
switch_current "$RELEASE"
ok "current → $RELEASE_NAME"
pm2_apply "$CURRENT_LINK"

FAILED_STAGE="health-check"
step "헬스체크"
if ! health_check "$RELEASE" 45 2; then
  pm2_cmd status || true
  for app in api worker web admin; do
    if [[ -f "$LOG_DIR/pm2/$app.err.log" ]]; then
      log "--- $app 오류 로그 (마지막 15줄)"
      tail -n 15 "$LOG_DIR/pm2/$app.err.log" || true
    fi
  done
  false
fi
trap - ERR INT TERM HUP
save_last_good_env

# Post-deploy smoke (not a rollback reason: the release is healthy, but photos would be broken).
IMAGE_SMOKE_NOTE=""
image_smoke "$WEB_PORT" || IMAGE_SMOKE_NOTE="사진 최적화(/_next/image) 점검 실패 — 위 안내를 확인하세요 (docs/DEPLOY.md 15단계 '사진이 안 보임')."

# ─── 9. prune ───────────────────────────────────────────────────────────────────────────────
step "이전 릴리스 정리 (최근 ${KEEP_RELEASES}개 보관)"
# Failed builds go first; then only the newest KEEP_RELEASES remain.
for name in $(list_releases); do
  dir="$RELEASES_DIR/$name"
  if [[ -f "$dir/.failed" && "$dir" != "$RELEASE" && "$dir" != "$PREV_RELEASE" ]]; then
    rm -rf "$dir"
    log "삭제(실패한 빌드): $name"
  fi
done
mapfile -t ALL < <(list_releases)
KEEP_FROM=$((${#ALL[@]} - KEEP_RELEASES))
for ((i = 0; i < KEEP_FROM; i++)); do
  dir="$RELEASES_DIR/${ALL[$i]}"
  [[ "$dir" == "$RELEASE" || "$dir" == "$PREV_RELEASE" ]] && continue
  rm -rf "$dir"
  log "삭제: ${ALL[$i]}"
done

ELAPSED=$(($(date +%s) - START_TS))
if [[ -n "$MIGRATED" ]]; then
  MIGRATION_NOTE="${#PENDING[@]}개 적용${PRE_DUMP:+ (사전 백업: $PRE_DUMP)}"
elif $SKIP_MIGRATE; then
  MIGRATION_NOTE="생략 (--skip-migrate)"
else
  MIGRATION_NOTE="변경 없음"
fi
cat <<EOF

${C_GRN}✔ 배포 성공${C_RST}  ${RELEASE_NAME}  (${ELAPSED}초)
  커밋     ${SHORT} ${SUBJECT}
  이전     ${PREV_RELEASE:+$(basename "$PREV_RELEASE")}
  마이그레이션 ${MIGRATION_NOTE}
  되돌리기  sudo $HOUSE_ROOT/rollback.sh
EOF
[[ -n "$KIT_NOTICE" ]] && warn "$KIT_NOTICE"
[[ -n "$IMAGE_SMOKE_NOTE" ]] && warn "$IMAGE_SMOKE_NOTE"
exit 0
