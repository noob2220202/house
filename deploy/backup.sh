#!/usr/bin/env bash
# Backups: PostgreSQL (pg_dump -Fc, daily) and uploads (rsync hard-link snapshot, weekly),
# kept for BACKUP_RETENTION_DAYS (14). Optional off-site copy with rclone (RCLONE_REMOTE).
#
#   sudo /srv/house/backup.sh            # DB now (+ uploads if the last snapshot is ≥ 6 days old)
#   sudo /srv/house/backup.sh --uploads  # DB + uploads snapshot now
#   sudo /srv/house/backup.sh --db-only
#   (cron) /srv/house/bin/backup.sh --cron   — installed in /etc/cron.d/house, 03:30 daily
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")" && pwd)"
# shellcheck source=lib/common.sh
source "$SCRIPT_DIR/lib/common.sh"

ORIG_ARGS=("$@")
MODE=auto CRON=false
while [[ $# -gt 0 ]]; do
  case "$1" in
    --uploads) MODE=uploads; shift ;;
    --db-only) MODE=db; shift ;;
    --cron) CRON=true; shift ;;
    -h | --help)
      sed -n '2,9p' "$0" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    *) die "알 수 없는 옵션: $1" ;;
  esac
done

ensure_house_user "${ORIG_ARGS[@]}"
load_conf
umask 077

exec 8>>"$SHARED_DIR/.backup.lock"
flock -n 8 || die "다른 백업이 진행 중입니다."

DB_DIR="$BACKUP_DIR/db"
UP_DIR="$BACKUP_DIR/uploads"
mkdir -p "$DB_DIR" "$UP_DIR" "$BACKUP_DIR/config"
STAMP="$(date +%Y%m%d-%H%M%S)"
FAILED=false

notify() {
  [[ -n "$BACKUP_NOTIFY_URL" ]] || return 0
  local suffix=""
  [[ "$1" == fail ]] && suffix="/fail"
  curl -fsS -m 10 --retry 3 -o /dev/null "${BACKUP_NOTIFY_URL%/}${suffix}" || warn "알림 URL 호출 실패"
}

# ─── database ───────────────────────────────────────────────────────────────────────────────
step "DB 백업 ($DB_NAME)"
DUMP="$DB_DIR/${DB_NAME}-${STAMP}.dump"
if pg_dump -Fc --no-owner "$(libpq_url)" -f "$DUMP.partial" && pg_restore --list "$DUMP.partial" >/dev/null; then
  mv "$DUMP.partial" "$DUMP"
  ok "$DUMP ($(du -h "$DUMP" | cut -f1))"
else
  rm -f "$DUMP.partial"
  warn "DB 백업 실패"
  FAILED=true
fi
# Secrets are needed to restore a server; kept locally only (never sent to rclone).
cp "$ENV_FILE" "$BACKUP_DIR/config/env.$(date +%Y%m%d)"

# ─── uploads ────────────────────────────────────────────────────────────────────────────────
LATEST_SNAP="$(find "$UP_DIR" -mindepth 1 -maxdepth 1 -type d -name '20*' -printf '%f\n' 2>/dev/null | sort | tail -1)"
DO_UPLOADS=false
case "$MODE" in
  uploads) DO_UPLOADS=true ;;
  db) ;;
  auto)
    if [[ -z "$LATEST_SNAP" ]] ||
      [[ -n "$(find "$UP_DIR/$LATEST_SNAP" -maxdepth 0 -mtime +5 2>/dev/null)" ]]; then
      DO_UPLOADS=true
    fi
    ;;
esac
if $DO_UPLOADS; then
  step "업로드 스냅샷 ($UPLOAD_ROOT)"
  SNAP="$UP_DIR/$STAMP"
  LINK_DEST=()
  [[ -n "$LATEST_SNAP" ]] && LINK_DEST=(--link-dest="$UP_DIR/$LATEST_SNAP")
  # Unchanged files are hard links to the previous snapshot, so each snapshot is cheap.
  if rsync -a --delete "${LINK_DEST[@]}" "$UPLOAD_ROOT/" "$SNAP.partial/"; then
    mv "$SNAP.partial" "$SNAP"
    touch "$SNAP"
    ok "$SNAP ($(du -sh "$SNAP" | cut -f1), 이전 스냅샷과 하드링크 공유)"
  else
    rm -rf "$SNAP.partial"
    warn "업로드 스냅샷 실패"
    FAILED=true
  fi
fi

# ─── retention ──────────────────────────────────────────────────────────────────────────────
step "보관 기간 정리 (${BACKUP_RETENTION_DAYS}일)"
find "$DB_DIR" -maxdepth 1 -name '*.dump' -mtime +"$BACKUP_RETENTION_DAYS" -print -delete
find "$BACKUP_DIR/config" -maxdepth 1 -name 'env.*' -mtime +"$BACKUP_RETENTION_DAYS" -print -delete
# Always keep the newest uploads snapshot, even if it is older than the retention window.
mapfile -t SNAPS < <(find "$UP_DIR" -mindepth 1 -maxdepth 1 -type d -name '20*' -printf '%f\n' | sort)
for ((i = 0; i < ${#SNAPS[@]} - 1; i++)); do
  s="$UP_DIR/${SNAPS[$i]}"
  if [[ -n "$(find "$s" -maxdepth 0 -mtime +"$BACKUP_RETENTION_DAYS")" ]]; then
    rm -rf "$s"
    log "삭제: $s"
  fi
done
find "$UP_DIR" -mindepth 1 -maxdepth 1 -name '*.partial' -mtime +1 -exec rm -rf {} +

# ─── off-site (optional) ────────────────────────────────────────────────────────────────────
if [[ -n "$RCLONE_REMOTE" ]]; then
  step "원격 백업 (rclone → $RCLONE_REMOTE)"
  if ! have rclone; then
    warn "rclone 이 설치되어 있지 않습니다 (sudo apt install rclone, 설정: rclone config)."
    FAILED=true
  else
    if [[ -f "$DUMP" ]] && rclone copy "$DUMP" "${RCLONE_REMOTE%/}/db/"; then
      ok "DB 덤프 업로드"
    else
      warn "DB 덤프 원격 업로드 실패"
      FAILED=true
    fi
    if $DO_UPLOADS; then
      if rclone sync "$UPLOAD_ROOT/" "${RCLONE_REMOTE%/}/uploads/"; then
        ok "업로드 동기화"
      else
        warn "업로드 원격 동기화 실패"
        FAILED=true
      fi
    fi
    rclone delete --min-age "${BACKUP_RETENTION_DAYS}d" "${RCLONE_REMOTE%/}/db/" || true
  fi
fi

if $FAILED; then
  notify fail
  die "백업 중 오류가 있었습니다 ($(date '+%F %T'))."
fi
notify ok
$CRON && log "백업 완료"
ok "백업 완료 — 사용량: $(du -sh "$BACKUP_DIR" 2>/dev/null | cut -f1) ($BACKUP_DIR)"
