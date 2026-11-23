#!/usr/bin/env bash
# Switch /srv/house/current back to the previous release (or a given one) and reload PM2.
#
#   sudo /srv/house/rollback.sh              # previous successful release
#   sudo /srv/house/rollback.sh --list       # show releases
#   sudo /srv/house/rollback.sh 20261123101500-abc1234
#
# After the confirmation it runs in its own session (like deploy.sh): a dropped SSH connection
# cannot leave `current` switched without the reload and health check.
#
# Before switching, the target is booted on spare ports with the current .env and DB (preflight):
# a release that cannot start is never switched to. If the switched release fails its health
# check, `current` goes back to the release that was live before.
#
# Database migrations are NOT reverted. Additive migrations do not always keep older code working:
# an older Prisma client throws on enum values it does not know, as soon as a row holds one. So a
# target that does not ship every migration applied to the DB needs --force and a typed
# confirmation. To also restore data, use restore.sh with a pre-migrate dump.
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")" && pwd)"
# shellcheck source=lib/common.sh
source "$SCRIPT_DIR/lib/common.sh"

usage() {
  cat <<'EOF'
사용법: ./rollback.sh [릴리스이름] [--list] [-y]
  (인자 없음)   현재 바로 이전의 정상 릴리스로 되돌립니다
  릴리스이름    지정한 릴리스로 전환 (./rollback.sh --list 로 확인)
  --list        릴리스 목록
  -y            확인 질문 없이 진행
  --force       대상 릴리스가 모르는 DB 마이그레이션이 적용되어 있어도 진행 (이름 입력 확인 필요)
  --no-preflight  전환 전 임시 포트 기동 점검을 건너뜀 (권장하지 않음)
  --foreground  별도 세션으로 분리하지 않고 현재 터미널에서 실행
EOF
}

ORIG_ARGS=("$@")
TARGET_NAME="" LIST=false YES=false FOREGROUND=false FORCE=false PREFLIGHT=true
while [[ $# -gt 0 ]]; do
  case "$1" in
    --list) LIST=true; shift ;;
    --force) FORCE=true; shift ;;
    --no-preflight) PREFLIGHT=false; shift ;;
    --foreground) FOREGROUND=true; shift ;;
    -y | --yes) YES=true; shift ;;
    -h | --help) usage; exit 0 ;;
    -*) usage >&2; die "알 수 없는 옵션: $1" ;;
    *) TARGET_NAME="$1"; shift ;;
  esac
done

ensure_house_user "${ORIG_ARGS[@]}"
load_conf
CURRENT="$(current_release)"
mapfile -t RELEASES < <(list_releases)

if $LIST; then
  printf '%-24s %-7s %s\n' "RELEASE" "STATE" "COMMIT"
  for r in "${RELEASES[@]}"; do
    dir="$RELEASES_DIR/$r" state=""
    [[ "$dir" == "$CURRENT" ]] && state="current"
    [[ -f "$dir/.failed" ]] && state="${state:+$state,}failed"
    sub="$(sed -n 's/^subject=//p' "$dir/RELEASE_INFO" 2>/dev/null || true)"
    printf '%-24s %-7s %s\n' "$r" "${state:--}" "${sub:0:70}"
  done
  exit 0
fi

if [[ -n "$TARGET_NAME" ]]; then
  [[ "$TARGET_NAME" =~ ^[0-9]{14}-[0-9a-f]{7}$ ]] || die "릴리스 이름 형식이 아닙니다: $TARGET_NAME"
  TARGET="$RELEASES_DIR/$TARGET_NAME"
  [[ -d "$TARGET" ]] || die "릴리스가 없습니다: $TARGET_NAME (./rollback.sh --list)"
else
  TARGET=""
  # newest release older than current that built successfully
  for ((i = ${#RELEASES[@]} - 1; i >= 0; i--)); do
    dir="$RELEASES_DIR/${RELEASES[$i]}"
    [[ "$dir" < "$CURRENT" || "$dir" == "$CURRENT" ]] || continue
    [[ "$dir" == "$CURRENT" || -f "$dir/.failed" ]] && continue
    [[ -f "$dir/apps/api/dist/main.js" ]] || continue
    TARGET="$dir"
    break
  done
  [[ -n "$TARGET" ]] || die "되돌릴 이전 릴리스가 없습니다."
fi
[[ "$TARGET" != "$CURRENT" ]] || die "이미 현재 릴리스입니다: $(basename "$TARGET")"
[[ -f "$TARGET/apps/api/dist/main.js" ]] || die "빌드되지 않은 릴리스입니다: $(basename "$TARGET")"

echo "현재:   ${CURRENT:+$(basename "$CURRENT")}"
echo "전환:   $(basename "$TARGET")  $(sed -n 's/^subject=//p' "$TARGET/RELEASE_INFO" 2>/dev/null || true)"

# Migrations applied to the DB that the target does not ship: its Prisma client may throw on
# rows they allow (e.g. a new enum value), so those reads would fail after the switch.
UNKNOWN_MIGRATIONS="" MIGRATION_CHECK_OK=true
UNKNOWN_MIGRATIONS="$(migrations_unknown_to "$TARGET")" || MIGRATION_CHECK_OK=false
if ! $MIGRATION_CHECK_OK; then
  warn "DB의 마이그레이션 목록을 읽지 못했습니다 (DB 접속 확인). 대상 릴리스와의 호환 여부를 알 수 없습니다."
  $FORCE || die "확인 없이 진행하려면 --force 를 붙이세요."
elif [[ -n "$UNKNOWN_MIGRATIONS" ]]; then
  warn "대상 릴리스가 모르는 DB 마이그레이션이 적용되어 있습니다 (되돌려지지 않음):"
  while IFS= read -r m; do warn "  - $m"; done <<<"$UNKNOWN_MIGRATIONS"
  warn "이 마이그레이션이 추가한 enum 값 등을 새 코드가 이미 저장했다면, 이전 코드는 그 데이터를 읽을 때 오류(500)를 냅니다."
  warn "데이터까지 되돌리려면 restore.sh 로 마이그레이션 전 백업(/var/backups/house/pre-migrate)을 복원하세요."
  $FORCE || die "그래도 코드만 되돌리려면 --force 를 붙여 다시 실행하세요."
  if [[ -z "${HOUSE_DETACHED:-}" ]]; then
    [[ -t 0 ]] || die "--force 확인은 터미널에서 릴리스 이름을 직접 입력해야 합니다."
    read -r -p "계속하려면 대상 릴리스 이름을 그대로 입력하세요 ($(basename "$TARGET")): " typed
    [[ "$typed" == "$(basename "$TARGET")" ]] || die "이름이 일치하지 않아 취소했습니다."
  fi
else
  ok "DB 마이그레이션 호환: 대상 릴리스가 적용된 마이그레이션을 모두 포함합니다."
fi

if ! $YES; then
  read -r -p "진행할까요? [y/N] " answer
  [[ "$answer" =~ ^[yY] ]] || die "취소했습니다."
fi

mkdir -p "$LOG_DIR"
DETACHED_ARGS=("$(basename "$TARGET")" -y)
$FORCE && DETACHED_ARGS+=(--force)
$PREFLIGHT || DETACHED_ARGS+=(--no-preflight)
$FOREGROUND || run_detached "$LOG_DIR/deploy.log" "${DETACHED_ARGS[@]}"
if [[ -z "${HOUSE_DETACHED:-}" ]]; then
  exec > >(trap '' HUP INT; exec tee -a "$LOG_DIR/deploy.log") 2>&1
fi
acquire_lock
step "롤백 $(date '+%Y-%m-%d %H:%M:%S'): $(basename "${CURRENT:-none}") → $(basename "$TARGET")"

# The target runs against today's .env and DB, not the ones it last ran with: boot it on spare
# ports first. PM2 stops old cluster workers once listen_timeout expires even when the new ones
# never listen, so switching to a release that cannot boot would take the whole site down.
if $PREFLIGHT; then
  step "사전 기동 점검 (대상 릴리스 + 현재 .env/DB, 임시 포트 +${PREFLIGHT_OFFSET})"
  HOUSE_ROOT="$HOUSE_ROOT" node "$SCRIPT_DIR/lib/preflight.cjs" "$TARGET" \
    "$((API_PORT + PREFLIGHT_OFFSET))" "$((WEB_PORT + PREFLIGHT_OFFSET))" "$((ADMIN_PORT + PREFLIGHT_OFFSET))" 90 ||
    die "대상 릴리스가 현재 .env/DB로 기동하지 않습니다 — 전환하지 않았습니다 (현재 서비스 그대로)."
  ok "대상 릴리스 기동 확인 (api, web, admin)"
else
  warn "사전 기동 점검 생략 (--no-preflight)"
fi

# Back to the release that was live before (same as deploy.sh's automatic rollback).
restore_previous() {
  trap '' INT TERM HUP
  if [[ -z "$CURRENT" || ! -d "$CURRENT" ]]; then
    warn "되돌아갈 원래 릴리스가 없습니다. 즉시 확인: ./status.sh, pm2 logs"
    return 0
  fi
  step "원래 릴리스로 복귀 → $(basename "$CURRENT")"
  switch_current "$CURRENT"
  if pm2_apply "$CURRENT_LINK" && health_check "$CURRENT" 20 2; then
    ok "원래 릴리스로 복구되었습니다: $(basename "$CURRENT")"
  else
    warn "복귀 후에도 헬스체크 실패 — 즉시 확인 필요: ./status.sh, pm2 logs"
  fi
}
trap 'restore_previous; exit 130' INT
trap 'restore_previous; exit 143' TERM
trap 'restore_previous; exit 129' HUP

switch_current "$TARGET"
if pm2_apply "$CURRENT_LINK" && health_check "$TARGET" 45 2; then
  trap - INT TERM HUP
  ok "롤백 완료: current → $(basename "$TARGET")"
  echo "  ※ DB 마이그레이션은 되돌리지 않았습니다. 데이터 복구가 필요하면 restore.sh 를 사용하세요."
else
  warn "롤백 후 헬스체크 실패: $(basename "$TARGET")"
  restore_previous
  die "롤백하지 못했습니다 — ./status.sh 와 pm2 logs 를 확인하세요."
fi
