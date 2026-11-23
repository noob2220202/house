#!/usr/bin/env bash
# Zero-downtime deploy: fetch → new release dir → pnpm install → build → (backup + migrate)
# → atomic `current` switch → pm2 startOrReload → health checks → auto-rollback on failure.
#
#   sudo /srv/house/deploy.sh                 # deploy the configured branch (deploy.conf BRANCH)
#   sudo /srv/house/deploy.sh --branch hotfix
#   sudo /srv/house/deploy.sh --skip-migrate  # code-only deploy (no DB migration, no seed)
#   sudo /srv/house/deploy.sh --skip-build-cache  # full rebuild (ignore turbo/Next caches)
#
# Runs as the 'house' user (root re-execs itself as house). See docs/DEPLOY.md.
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
  --skip-build-cache    빌드 캐시(turbo, Next.js) 없이 처음부터 빌드
  --skip-seed           마이그레이션 후 기본 시드(멱등)를 건너뜀
  --force               이미 배포된 커밋이어도 새로 빌드
  --no-self-update      배포 스크립트 자동 갱신 안 함
  -h, --help            도움말
EOF
}

ORIG_ARGS=("$@")
OPT_BRANCH="" OPT_REF="" SKIP_MIGRATE=false SKIP_BUILD_CACHE=false SKIP_SEED=false FORCE=false
SELF_UPDATE=true
while [[ $# -gt 0 ]]; do
  case "$1" in
    --branch) [[ -n "${2:-}" ]] || die "--branch 에 값이 필요합니다."; OPT_BRANCH="$2"; shift 2 ;;
    --ref) [[ -n "${2:-}" ]] || die "--ref 에 값이 필요합니다."; OPT_REF="$2"; shift 2 ;;
    --skip-migrate) SKIP_MIGRATE=true; shift ;;
    --skip-build-cache) SKIP_BUILD_CACHE=true; shift ;;
    --skip-seed) SKIP_SEED=true; shift ;;
    --force) FORCE=true; shift ;;
    --no-self-update) SELF_UPDATE=false; shift ;;
    -h | --help) usage; exit 0 ;;
    *) usage >&2; die "알 수 없는 옵션: $1" ;;
  esac
done

ensure_house_user "${ORIG_ARGS[@]}"
load_conf
[[ -n "$OPT_BRANCH" ]] && BRANCH="$OPT_BRANCH"
[[ "$BRANCH" =~ ^[A-Za-z0-9._/-]+$ ]] || die "브랜치 이름이 올바르지 않습니다: $BRANCH"
[[ -z "$OPT_REF" || "$OPT_REF" =~ ^[0-9a-f]{7,40}$ ]] || die "--ref 는 커밋 해시여야 합니다."
[[ -f "$ENV_FILE" ]] || die "$ENV_FILE 이 없습니다. 먼저 install.sh 를 실행하세요."
[[ -n "$REPO_URL" ]] || die "저장소 주소(REPO_URL)가 $DEPLOY_CONF 에 없습니다. install.sh --repo 로 지정하세요."
umask 022

acquire_lock
mkdir -p "$LOG_DIR"
if [[ -z "${HOUSE_DEPLOY_LOGGING:-}" ]]; then
  export HOUSE_DEPLOY_LOGGING=1
  exec > >(tee -a "$LOG_DIR/deploy.log") 2>&1
fi

START_TS=$(date +%s)
step "배포 시작 — $(date '+%Y-%m-%d %H:%M:%S') (branch: $BRANCH)"

# ─── 1. fetch ───────────────────────────────────────────────────────────────────────────────
step "저장소 가져오기"
export GIT_SSH_COMMAND="ssh -o BatchMode=yes"
if [[ ! -d "$MIRROR_DIR" ]]; then
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
SUBJECT="$(git -C "$MIRROR_DIR" log -1 --format='%s (%an, %cr)' "$SHA")"
ok "$SHORT — $SUBJECT"

# ─── 2. self-update of the deploy kit ───────────────────────────────────────────────────────
# /srv/house/bin always runs the deploy kit of the commit being deployed (re-exec once).
if $SELF_UPDATE && [[ -z "${HOUSE_DEPLOY_UPDATED:-}" ]] &&
  git -C "$MIRROR_DIR" cat-file -e "${SHA}:deploy/deploy.sh" 2>/dev/null; then
  NEW_KIT="$(mktemp -d "$HOUSE_ROOT/.bin.new.XXXXXX")"
  git -C "$MIRROR_DIR" archive "$SHA" deploy | tar -x -C "$NEW_KIT"
  if ! diff -qr "$NEW_KIT/deploy" "$BIN_DIR" >/dev/null 2>&1; then
    log "배포 스크립트가 바뀌었습니다 → 새 버전으로 다시 실행"
    rm -rf "$HOUSE_ROOT/.bin.old"
    mv -T "$BIN_DIR" "$HOUSE_ROOT/.bin.old"
    mv -T "$NEW_KIT/deploy" "$BIN_DIR"
    chmod 0755 "$BIN_DIR"/*.sh
    rm -rf "$NEW_KIT" "$HOUSE_ROOT/.bin.old"
    export HOUSE_DEPLOY_UPDATED=1
    exec bash "$BIN_DIR/deploy.sh" "${ORIG_ARGS[@]}" --ref "$SHA"
  fi
  rm -rf "$NEW_KIT"
fi

PREV_RELEASE="$(current_release)"
if [[ -n "$PREV_RELEASE" && -f "$PREV_RELEASE/REVISION" && "$(cat "$PREV_RELEASE/REVISION")" == "$SHA" ]] && ! $FORCE; then
  step "이미 배포된 커밋입니다 ($SHORT) — 새 빌드 없이 설정만 다시 적용(reload)합니다"
  log "(.env 변경 반영용. 새로 빌드하려면 --force)"
  pm2_apply "$CURRENT_LINK"
  health_check "$PREV_RELEASE" || die "헬스체크 실패 — ./status.sh 와 로그를 확인하세요."
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
on_error() {
  local code=$?
  warn "배포 실패 (단계: ${FAILED_STAGE:-알 수 없음}, 종료 코드 $code)"
  if [[ -n "${SWITCHED:-}" ]]; then
    rollback_now
  else
    warn "현재 서비스는 바뀌지 않았습니다 (current → ${PREV_RELEASE:-없음})."
  fi
  [[ -d "$RELEASE" ]] && touch "$RELEASE/.failed"
  exit "$code"
}
trap on_error ERR

rollback_now() {
  trap - ERR
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
  if [[ -n "${MIGRATED:-}" ]]; then
    warn "DB 마이그레이션은 되돌리지 않았습니다 (추가형 변경 원칙). 필요 시 백업: ${PRE_DUMP:-없음}"
  fi
}

cd "$RELEASE"

# ─── 4. install ─────────────────────────────────────────────────────────────────────────────
FAILED_STAGE="pnpm install"
step "의존성 설치 (pnpm install --frozen-lockfile)"
CI=true pnpm install --frozen-lockfile --prefer-offline \
  --store-dir "$SHARED_DIR/pnpm-store" --reporter=append-only
ok "pnpm $(pnpm --version)"

# ─── 5. build ───────────────────────────────────────────────────────────────────────────────
FAILED_STAGE="build"
step "빌드 (turbo)"
TURBO_ARGS=(--cache-dir="$SHARED_DIR/turbo-cache" --output-logs=errors-only)
if $SKIP_BUILD_CACHE; then
  TURBO_ARGS+=(--force)
elif [[ -n "$PREV_RELEASE" ]]; then
  # Reuse Next.js incremental caches from the previous release.
  for app in web admin; do
    if [[ -d "$PREV_RELEASE/apps/$app/.next/cache" ]]; then
      mkdir -p "apps/$app/.next"
      cp -a "$PREV_RELEASE/apps/$app/.next/cache" "apps/$app/.next/cache"
    fi
  done
fi
# Only public build-time variables reach the frontends' build (Next inlines NEXT_PUBLIC_*).
BUILD_ENV=(NODE_ENV=production)
while IFS= read -r key; do
  BUILD_ENV+=("$key=$(env_get "$key")")
done < <(grep -oE '^NEXT_PUBLIC_[A-Z0-9_]+' "$ENV_FILE" || true)
env "${BUILD_ENV[@]}" pnpm exec turbo run build "${TURBO_ARGS[@]}"
for f in apps/api/dist/main.js apps/web/.next/BUILD_ID apps/admin/.next/BUILD_ID; do
  [[ -f "$f" ]] || { warn "빌드 결과물이 없습니다: $f"; false; }
done
ok "빌드 완료 (api, web, admin)"

# ─── 6. migrate ─────────────────────────────────────────────────────────────────────────────
PRE_DUMP=""
MIGRATED=""
if $SKIP_MIGRATE; then
  step "DB 마이그레이션 생략 (--skip-migrate)"
else
  FAILED_STAGE="migrate"
  step "DB 마이그레이션 (prisma migrate deploy)"
  DB_URL="$(libpq_url)"
  APPLIED="$(psql -X -q -At "$DB_URL" -c \
    "select migration_name from _prisma_migrations where finished_at is not null and rolled_back_at is null" \
    2>/dev/null || true)"
  PENDING=()
  while IFS= read -r m; do
    grep -qxF "$m" <<<"$APPLIED" || PENDING+=("$m")
  done < <(find apps/api/prisma/schema/migrations -mindepth 1 -maxdepth 1 -type d -printf '%f\n' 2>/dev/null | sort)
  if ((${#PENDING[@]} == 0)); then
    ok "적용할 마이그레이션 없음"
  else
    log "적용 예정 ${#PENDING[@]}개: ${PENDING[*]}"
    if [[ -n "$APPLIED" ]]; then
      mkdir -p "$BACKUP_DIR/pre-migrate"
      PRE_DUMP="$BACKUP_DIR/pre-migrate/${DB_NAME}-${RELEASE_NAME}.dump"
      (umask 077 && pg_dump -Fc --no-owner "$DB_URL" -f "$PRE_DUMP")
      ok "마이그레이션 전 백업: $PRE_DUMP ($(du -h "$PRE_DUMP" | cut -f1))"
      # keep the 10 most recent pre-migration dumps
      find "$BACKUP_DIR/pre-migrate" -maxdepth 1 -name '*.dump' -printf '%T@ %p\n' | sort -rn |
        tail -n +11 | cut -d' ' -f2- | xargs -r rm -f
    fi
    (cd apps/api && pnpm exec prisma migrate deploy)
    MIGRATED=1
    ok "마이그레이션 적용 완료"
  fi
  if ! $SKIP_SEED; then
    FAILED_STAGE="seed"
    # Base data (regions, banner slots, site settings) — idempotent; never overwrites edits.
    (cd apps/api && env SEED_ADMIN_EMAIL= SEED_ADMIN_PASSWORD= pnpm exec prisma db seed >/dev/null)
    ok "기본 데이터 시드 (멱등)"
  fi
fi

# ─── 7. switch + reload ─────────────────────────────────────────────────────────────────────
FAILED_STAGE="switch/reload"
step "릴리스 전환 및 무중단 reload"
switch_current "$RELEASE"
SWITCHED=1
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
trap - ERR

# ─── 8. prune ───────────────────────────────────────────────────────────────────────────────
step "이전 릴리스 정리 (최근 ${KEEP_RELEASES}개 보관)"
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
