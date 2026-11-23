#!/usr/bin/env bash
# Backups: PostgreSQL (pg_dump -Fc) and uploads (rsync hard-link snapshot), both daily, kept for
# BACKUP_RETENTION_DAYS (14) — the newest BACKUP_KEEP_MIN (7) of each are kept whatever their age,
# and nothing is pruned on a night whose DB dump failed. Optional off-site copy with rclone.
#
#   sudo /srv/house/backup.sh            # DB + uploads snapshot now
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
    --uploads) MODE=uploads; shift ;; # kept for compatibility: uploads are snapshotted daily
    --db-only) MODE=db; shift ;;
    --cron) CRON=true; shift ;;
    -h | --help)
      sed -n '2,8p' "$0" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    *) die "알 수 없는 옵션: $1" ;;
  esac
done

ensure_house_user "${ORIG_ARGS[@]}"
load_conf
umask 077

BACKUP_LOCK="$SHARED_DIR/.backup.lock"
[[ -f "$BACKUP_LOCK" && ! -L "$BACKUP_LOCK" ]] ||
  die "잠금 파일이 없습니다: $BACKUP_LOCK — sudo $BIN_DIR/install.sh 를 한 번 다시 실행하세요."
exec 8>>"$BACKUP_LOCK"
flock -n 8 || die "다른 백업이 진행 중입니다."

DB_DIR="$BACKUP_DIR/db"
UP_DIR="$BACKUP_DIR/uploads"
mkdir -p "$DB_DIR" "$UP_DIR" "$BACKUP_DIR/config"
STAMP="$(date +%Y%m%d-%H%M%S)"
FAILED=false

notify() {
  [[ -n "$BACKUP_NOTIFY_URL" ]] || return 0
  # healthchecks.io style: <url>/fail on failure; a query string stays at the end.
  local base="${BACKUP_NOTIFY_URL%%\?*}" query="" url
  [[ "$BACKUP_NOTIFY_URL" == *\?* ]] && query="?${BACKUP_NOTIFY_URL#*\?}"
  url="$base"
  [[ "$1" == fail ]] && url="${base%/}/fail"
  curl -fsS -m 10 --retry 3 -o /dev/null "${url}${query}" || warn "알림 URL 호출 실패"
}

# ─── database ───────────────────────────────────────────────────────────────────────────────
step "DB 백업 ($DB_NAME)"
DUMP="$DB_DIR/${DB_NAME}-${STAMP}.dump"
DB_OK=false
# Connection settings go through the environment (PG*), never argv: /proc/*/cmdline is public.
if pg_run pg_dump -Fc --no-owner -f "$DUMP.partial" && pg_restore --list "$DUMP.partial" >/dev/null; then
  mv "$DUMP.partial" "$DUMP"
  DB_OK=true
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
# Daily: unchanged files are hard links into the previous snapshot, so a snapshot costs little.
DO_UPLOADS=true
[[ "$MODE" == db ]] && DO_UPLOADS=false
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
if $FAILED; then
  # A failing backup (full disk, changed password, ...) must never also delete the good ones.
  warn "오늘 백업이 실패해 보관 기간 정리를 건너뜁니다 (기존 백업 유지)."
else
  step "보관 기간 정리 (${BACKUP_RETENTION_DAYS}일, 최근 ${BACKUP_KEEP_MIN}개는 항상 보관)"
  prune_keep_newest "$DB_DIR" '*.dump' "$BACKUP_RETENTION_DAYS" "$BACKUP_KEEP_MIN" f
  prune_keep_newest "$BACKUP_DIR/config" 'env.2*' "$BACKUP_RETENTION_DAYS" "$BACKUP_KEEP_MIN" f
  prune_keep_newest "$UP_DIR" '20*' "$BACKUP_RETENTION_DAYS" "$BACKUP_KEEP_MIN" d
fi
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
      # Files deleted or replaced locally are moved aside remotely, never dropped by the sync.
      if rclone sync --backup-dir "${RCLONE_REMOTE%/}/uploads-deleted/$STAMP" \
        "$UPLOAD_ROOT/" "${RCLONE_REMOTE%/}/uploads/"; then
        ok "업로드 동기화 (삭제·변경된 파일은 uploads-deleted/$STAMP 에 보관)"
      else
        warn "업로드 원격 동기화 실패"
        FAILED=true
      fi
    fi
    # Remote pruning only after a good night, like local retention.
    if $DB_OK && ! $FAILED; then
      rclone delete --min-age "${BACKUP_RETENTION_DAYS}d" "${RCLONE_REMOTE%/}/db/" || true
      rclone delete --min-age "${BACKUP_RETENTION_DAYS}d" "${RCLONE_REMOTE%/}/uploads-deleted/" || true
      rclone rmdirs --leave-root "${RCLONE_REMOTE%/}/uploads-deleted/" 2>/dev/null || true
    fi
  fi
fi

if $FAILED; then
  notify fail
  die "백업 중 오류가 있었습니다 ($(date '+%F %T'))."
fi
notify ok
$CRON && log "백업 완료"
ok "백업 완료 — 사용량: $(du -sh "$BACKUP_DIR" 2>/dev/null | cut -f1) ($BACKUP_DIR)"
