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
# Database migrations are NOT reverted (migrations are additive by convention, so older code
# keeps working). To also restore data, use restore.sh with a pre-migrate dump.
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
  --foreground  별도 세션으로 분리하지 않고 현재 터미널에서 실행
EOF
}

ORIG_ARGS=("$@")
TARGET_NAME="" LIST=false YES=false FOREGROUND=false
while [[ $# -gt 0 ]]; do
  case "$1" in
    --list) LIST=true; shift ;;
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
if ! $YES; then
  read -r -p "진행할까요? [y/N] " answer
  [[ "$answer" =~ ^[yY] ]] || die "취소했습니다."
fi

mkdir -p "$LOG_DIR"
$FOREGROUND || run_detached "$LOG_DIR/deploy.log" "$(basename "$TARGET")" -y
if [[ -z "${HOUSE_DETACHED:-}" ]]; then
  exec > >(trap '' HUP INT; exec tee -a "$LOG_DIR/deploy.log") 2>&1
fi
acquire_lock
step "롤백 $(date '+%Y-%m-%d %H:%M:%S'): $(basename "${CURRENT:-none}") → $(basename "$TARGET")"
switch_current "$TARGET"
pm2_apply "$CURRENT_LINK"
if health_check "$TARGET" 45 2; then
  ok "롤백 완료: current → $(basename "$TARGET")"
  echo "  ※ DB 마이그레이션은 되돌리지 않았습니다. 데이터 복구가 필요하면 restore.sh 를 사용하세요."
else
  die "롤백 후 헬스체크 실패 — ./status.sh 와 pm2 logs 를 확인하세요."
fi
