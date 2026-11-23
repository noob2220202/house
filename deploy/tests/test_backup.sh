#!/usr/bin/env bash
# backup.sh end to end (as the service user, real PostgreSQL): a good night dumps + snapshots and
# prunes; a failed night (wrong DB password) keeps every old backup. No password in argv.
source "$(dirname "$0")/lib.sh"
if ! is_root || ! id house >/dev/null 2>&1 || ! pg_available || ! have_cmd pg_dump; then
  skip "backup.sh end to end" "needs root, the 'house' user and PostgreSQL"
  t_finish
  exit $?
fi
load_common
DB="hdt_bk_$$"
t_on_exit "tpsql -d postgres -c 'DROP DATABASE IF EXISTS \"$DB\"' >/dev/null 2>&1"
tpsql -d postgres -c "CREATE DATABASE \"$DB\"" >/dev/null
tpsql -d "$DB" -c "CREATE TABLE t(x int); INSERT INTO t VALUES (1)" >/dev/null

B="$T_TMP/backups" U="$T_TMP/uploads" L="$T_TMP/log"
mkdir -p "$B"/{db,uploads,config} "$U"/{public,private} "$L" "$HOUSE_ROOT/bin"
echo img >"$U/public/a.webp"
chown -R house:house "$B" "$U" "$L"
chown root:house "$SHARED_DIR" && chmod 0750 "$SHARED_DIR"
for f in .backup.lock .deploy.lock; do : >"$SHARED_DIR/$f"; chown root:house "$SHARED_DIR/$f"; chmod 0660 "$SHARED_DIR/$f"; done
printf 'BACKUP_DIR=%s\nUPLOAD_ROOT=%s\nLOG_DIR=%s\nDB_NAME=%s\nBACKUP_RETENTION_DAYS=14\nBACKUP_KEEP_MIN=3\n' "$B" "$U" "$L" "$DB" >"$DEPLOY_CONF"
envf() { printf 'DATABASE_URL=postgresql://%s:%s@%s:%s/%s?schema=public\n' "$TEST_PG_USER" "$1" "$TEST_PG_HOST" "$TEST_PG_PORT" "$DB" >"$ENV_FILE"; }
envf "$TEST_PG_PASSWORD"
chown root:house "$ENV_FILE" "$DEPLOY_CONF" && chmod 0640 "$ENV_FILE" "$DEPLOY_CONF"

# Old backups, all past the retention window.
for i in 1 2 3 4 5; do
  f="$B/db/$DB-2026010$i-033000.dump"
  runuser -u house -- sh -c ": >'$f'"
  touch -d "$((30 - i)) days ago" "$f"
done

# Watch every process's argv while the backup runs.
( for _ in $(seq 1 100); do cat /proc/[0-9]*/cmdline 2>/dev/null | tr '\0' ' '; sleep 0.05; done ) >"$T_TMP/argv" &
watcher=$!
out="$(HOUSE_ROOT="$HOUSE_ROOT" bash "$KIT_DIR/backup.sh" 2>&1)"
rc=$?
kill "$watcher" 2>/dev/null; wait "$watcher" 2>/dev/null
assert_eq "good night: exit 0" "$rc" "0"
new="$(find "$B/db" -name "$DB-*.dump" -newer "$DEPLOY_CONF" | head -1)"
[[ -n "$new" ]] && pg_restore --list "$new" >/dev/null && pass "a valid new dump was written" || fail "no new dump" "$out"
assert_eq "dump owned by the service user" "$(stat -c %U "$new" 2>/dev/null)" "house"
assert_eq "retention kept the newest 3 (new + 2 old)" "$(find "$B/db" -name '*.dump' | wc -l)" "3"
assert_eq "uploads snapshotted on a normal (non --uploads) run" "$(find "$B/uploads" -mindepth 1 -maxdepth 1 -type d -name '20*' | wc -l)" "1"
grep -q "$TEST_PG_PASSWORD@" "$T_TMP/argv" && fail "DB password visible in a process argv" || pass "DB password never in any argv"

# Failed night: wrong password. Make every existing dump old enough to be pruned.
envf "wrong-password-$$"
find "$B/db" -name '*.dump' -exec touch -d '40 days ago' {} +
before="$(find "$B/db" -name '*.dump' | wc -l)"
out="$(HOUSE_ROOT="$HOUSE_ROOT" bash "$KIT_DIR/backup.sh" --db-only 2>&1)"
rc=$?
[[ $rc -ne 0 ]] && pass "failed night: non-zero exit" || fail "failed backup exited 0"
assert_contains "failed night says retention was skipped" "$out" "보관 기간 정리를 건너뜁니다"
assert_eq "failed night deleted nothing" "$(find "$B/db" -name '*.dump' | wc -l)" "$before"
t_finish
