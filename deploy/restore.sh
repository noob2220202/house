#!/usr/bin/env bash
# Restore the database or the uploads from backups made by backup.sh / deploy.sh.
# Every destructive step asks for confirmation and first takes a safety copy.
#
#   sudo /srv/house/restore.sh --list
#   sudo /srv/house/restore.sh --db /var/backups/house/db/house-20261123-033000.dump
#   sudo /srv/house/restore.sh --db <dump> --target-db house_drill   # 복원 훈련: 운영 DB는 그대로
#   sudo /srv/house/restore.sh --uploads /var/backups/house/uploads/20261122-033000
#
# DB restore = restore into a NEW database as the app role, verify it, then swap names while
# the API/worker are stopped (about 10 seconds), then apply pending migrations of the current
# release. The replaced database is kept as <db>_before_<timestamp>.
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")" && pwd)"
# shellcheck source=lib/common.sh
source "$SCRIPT_DIR/lib/common.sh"

usage() {
  sed -n '2,13p' "$0" | sed 's/^# \{0,1\}//'
}

DUMP="" SNAP="" TARGET_DB="" LIST=false YES=false
while [[ $# -gt 0 ]]; do
  case "$1" in
    --db) [[ -n "${2:-}" ]] || die "--db 에 덤프 파일이 필요합니다."; DUMP="$2"; shift 2 ;;
    --uploads) [[ -n "${2:-}" ]] || die "--uploads 에 스냅샷 디렉터리가 필요합니다."; SNAP="$2"; shift 2 ;;
    --target-db) [[ -n "${2:-}" ]] || die "--target-db 에 이름이 필요합니다."; TARGET_DB="$2"; shift 2 ;;
    --list) LIST=true; shift ;;
    -y | --yes) YES=true; shift ;;
    -h | --help) usage; exit 0 ;;
    *) usage >&2; die "알 수 없는 옵션: $1" ;;
  esac
done

[[ $EUID -eq 0 ]] || die "root 권한이 필요합니다: sudo $0"
load_conf
TARGET_DB="${TARGET_DB:-$DB_NAME}"
[[ "$TARGET_DB" =~ $PG_IDENT_RE ]] || die "DB 이름 형식이 올바르지 않습니다: $TARGET_DB"

if $LIST; then
  echo "■ DB 덤프 ($BACKUP_DIR/db, $BACKUP_DIR/pre-migrate, $BACKUP_DIR/pre-restore)"
  find "$BACKUP_DIR/db" "$BACKUP_DIR/pre-migrate" "$BACKUP_DIR/pre-restore" -maxdepth 1 -name '*.dump' \
    -printf '%TY-%Tm-%Td %TH:%TM  %8s B  %p\n' 2>/dev/null | sort
  echo
  echo "■ 업로드 스냅샷 ($BACKUP_DIR/uploads)"
  find "$BACKUP_DIR/uploads" -mindepth 1 -maxdepth 1 -type d -name '20*' -printf '%p\n' 2>/dev/null | sort
  exit 0
fi
[[ -n "$DUMP" || -n "$SNAP" ]] || { usage >&2; die "--db 또는 --uploads 를 지정하세요."; }

confirm() {
  # confirm <word> <message>: the operator must type the word exactly.
  $YES && return 0
  local answer
  printf '%s\n' "$2"
  read -r -p "계속하려면 '$1' 을(를) 입력하세요: " answer
  [[ "$answer" == "$1" ]] || die "취소했습니다."
}

# Backups, logs and uploads belong to the service user: everything that reads or writes them
# runs as that user (run_as_house), so a planted symlink can never redirect a root write.
pg_parse_url
pg_super() { runuser -u postgres -- psql -X -q -v ON_ERROR_STOP=1 -p "$PGURL_PORT" "$@"; }
STAMP="$(date +%Y%m%d%H%M%S)"
run_as_house install -d -m 0700 "$BACKUP_DIR/pre-restore"

acquire_lock
exec > >(trap '' HUP INT; exec runuser -u "$HOUSE_USER" -- tee -a "$LOG_DIR/restore.log") 2>&1

TMPD="" APPS_STOPPED="" CONN_BLOCKED="" BEFORE_DB=""
cleanup() {
  local rc=$?
  trap '' INT TERM HUP
  if [[ -n "$CONN_BLOCKED" ]]; then
    pg_super -d postgres -c "ALTER DATABASE \"$DB_NAME\" WITH ALLOW_CONNECTIONS true;" ||
      warn "DB '$DB_NAME' 접속 허용을 되돌리지 못했습니다: sudo -u postgres psql -c 'ALTER DATABASE \"$DB_NAME\" WITH ALLOW_CONNECTIONS true'"
  fi
  if [[ -n "$APPS_STOPPED" ]]; then
    warn "복원이 끝나지 않았습니다 — API/worker를 다시 시작합니다 (운영 DB: $DB_NAME)."
    pm2_apply "$CURRENT_LINK" || warn "앱 재시작 실패 — sudo -u $HOUSE_USER pm2 start all"
  fi
  [[ -n "$TMPD" ]] && rm -rf "$TMPD"
  exit "$rc"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
trap 'exit 129' HUP

# ─── database ───────────────────────────────────────────────────────────────────────────────
if [[ -n "$DUMP" ]]; then
  [[ -f "$DUMP" ]] || die "덤프 파일이 없습니다: $DUMP"
  # The dump is read by the app role's tools only; root never opens it.
  run_as_house test -r "$DUMP" ||
    die "'$HOUSE_USER' 사용자가 읽을 수 없는 파일입니다. 먼저 복사하세요: sudo install -o $HOUSE_USER -g $HOUSE_USER -m 0600 $DUMP $BACKUP_DIR/db/"
  run_as_house pg_restore --list "$DUMP" >/dev/null || die "올바른 pg_dump -Fc 파일이 아닙니다: $DUMP"
  SWAP=false
  [[ "$TARGET_DB" == "$DB_NAME" ]] && SWAP=true
  if $SWAP; then
    confirm "$DB_NAME" "운영 DB '$DB_NAME' 을(를) $(basename "$DUMP") 내용으로 교체합니다. 그 이후의 데이터는 사라집니다.
(현재 DB는 ${DB_NAME}_before_${STAMP} 이름으로 보관되고, 덤프도 먼저 만듭니다. API는 약 10초간 중단됩니다.)"
  else
    [[ "$(pg_super -d postgres -Atc "select 1 from pg_database where datname = '$TARGET_DB'")" != 1 ]] ||
      die "DB '$TARGET_DB' 가 이미 있습니다. 다른 이름을 쓰거나 먼저 삭제하세요: sudo -u postgres dropdb $TARGET_DB"
    confirm "yes" "덤프를 새 DB '$TARGET_DB' 에 복원합니다 (운영 DB는 건드리지 않음)."
  fi

  if $SWAP; then
    step "안전 백업: 현재 DB 덤프"
    SAFETY="$BACKUP_DIR/pre-restore/${DB_NAME}-${STAMP}.dump"
    # shellcheck disable=SC2016 # $1 expands in the child shell
    pg_run run_as_house bash -c 'umask 077; exec pg_dump -Fc --no-owner -f "$1"' _ "$SAFETY"
    ok "$SAFETY"
  fi

  WORK_DB="${DB_NAME}_restore_${STAMP}"
  step "새 DB에 복원: $WORK_DB"
  # Superuser only for what needs it: the database and the (untrusted) extensions.
  pg_super -d postgres -c "CREATE DATABASE \"$WORK_DB\" OWNER \"$DB_USER\" ENCODING 'UTF8' TEMPLATE template0;"
  pg_super -d "$WORK_DB" -c "SET client_min_messages = warning; CREATE EXTENSION IF NOT EXISTS postgis; CREATE EXTENSION IF NOT EXISTS pg_trgm;"
  pg_super -d "$WORK_DB" -c "REVOKE ALL ON DATABASE \"$WORK_DB\" FROM PUBLIC; GRANT CONNECT, TEMP ON DATABASE \"$WORK_DB\" TO \"$DB_USER\";"
  TMPD="$(mktemp -d)"
  chmod 0711 "$TMPD"
  # Extension entries (created above) and PostGIS's own table data are skipped.
  run_as_house pg_restore --list "$DUMP" | restore_list_filter >"$TMPD/list"
  chmod 0644 "$TMPD/list"
  # Every object is created by the app role over TCP — never as a superuser — so a tampered
  # dump can do no more than the app role already can.
  if ! pg_run run_as_house pg_restore --no-owner --no-acl --exit-on-error \
    -L "$TMPD/list" -d "$WORK_DB" "$DUMP"; then
    pg_super -d postgres -c "DROP DATABASE IF EXISTS \"$WORK_DB\";"
    die "복원 실패 — 운영 DB는 변경되지 않았습니다."
  fi
  TABLES="$(pg_super -d "$WORK_DB" -Atc "select count(*) from information_schema.tables where table_schema = 'public'")"
  MIGS="$(pg_super -d "$WORK_DB" -Atc "select count(*) from _prisma_migrations where finished_at is not null" 2>/dev/null || echo 0)"
  ok "복원 검증: public 테이블 ${TABLES}개, 적용된 마이그레이션 ${MIGS}개"
  ((TABLES > 0)) || { pg_super -d postgres -c "DROP DATABASE \"$WORK_DB\";"; die "복원된 DB가 비어 있습니다."; }

  if ! $SWAP; then
    pg_super -d postgres -c "ALTER DATABASE \"$WORK_DB\" RENAME TO \"$TARGET_DB\";"
    ok "복원 훈련 DB 준비: $TARGET_DB  (확인 후 삭제: sudo -u postgres dropdb $TARGET_DB)"
  else
    step "운영 DB 교체 (API/worker 일시 중지)"
    BEFORE_DB="${DB_NAME}_before_${STAMP}"
    APPS_STOPPED=1 # set first: from here on, any exit restarts the apps (cleanup)
    pm2_cmd stop house-api house-worker >/dev/null || die "API/worker를 멈추지 못했습니다 — 운영 DB는 그대로입니다."
    # New connections (cron backup, a stray worker, psql) are refused from here on; the
    # rename happens in one transaction, so the database is either fully swapped or untouched.
    CONN_BLOCKED=1
    pg_super -d postgres -c "ALTER DATABASE \"$DB_NAME\" WITH ALLOW_CONNECTIONS false;"
    db_swap_sql "$DB_NAME" "$WORK_DB" "$BEFORE_DB" | pg_super -d postgres >/dev/null
    CONN_BLOCKED=""
    ok "교체 완료 (이전 DB: $BEFORE_DB)"

    CUR="$(current_release)"
    if [[ -n "$CUR" ]]; then
      step "현재 릴리스의 마이그레이션 적용 (덤프가 더 오래된 경우)"
      # shellcheck disable=SC2016 # $1 expands in the child shell
      if run_as_house bash -c 'cd "$1" && pnpm exec prisma migrate deploy' _ "$CUR/apps/api"; then
        ok "마이그레이션 상태 최신"
      else
        warn "prisma migrate deploy 실패 — 앱은 다시 시작하지만 확인이 필요합니다 (pm2 logs)."
      fi
      pm2_apply "$CURRENT_LINK"
      APPS_STOPPED=""
      health_check "$CUR" 30 2 || warn "헬스체크 실패 — ./status.sh, pm2 logs 확인"
    else
      APPS_STOPPED=""
    fi
    echo "  확인이 끝나면 이전 DB 삭제: sudo -u postgres dropdb $BEFORE_DB"
  fi
fi

# ─── uploads ────────────────────────────────────────────────────────────────────────────────
if [[ -n "$SNAP" ]]; then
  SNAP="${SNAP%/}"
  run_as_house test -d "$SNAP/public" || run_as_house test -d "$SNAP/private" ||
    die "업로드 스냅샷 디렉터리가 아닙니다: $SNAP"
  confirm "uploads" "업로드 파일($UPLOAD_ROOT)을 스냅샷 $(basename "$SNAP") 상태로 되돌립니다. 이후 올라온 파일은 삭제됩니다.
(현재 상태는 $BACKUP_DIR/pre-restore/uploads-${STAMP} 에 먼저 보관합니다.)"
  step "안전 스냅샷"
  run_as_house rsync -a "$UPLOAD_ROOT/" "$BACKUP_DIR/pre-restore/uploads-${STAMP}/"
  ok "$BACKUP_DIR/pre-restore/uploads-${STAMP}"
  step "업로드 복원"
  # Both trees belong to the service user; copying as that user keeps ownership without chown.
  run_as_house rsync -a --delete "$SNAP/" "$UPLOAD_ROOT/"
  run_as_house chmod 0755 "$UPLOAD_ROOT" "$UPLOAD_ROOT/public"
  run_as_house chmod 0700 "$UPLOAD_ROOT/private"
  ok "업로드 복원 완료"
fi
