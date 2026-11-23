#!/usr/bin/env bash
# restore.sh --target-db (restore drill) end to end against the local cluster: the dump is read by
# the service user, objects are created by the app role over TCP, the port comes from DATABASE_URL.
source "$(dirname "$0")/lib.sh"
if ! is_root || ! id house >/dev/null 2>&1 || ! pg_available || ! runuser -u postgres -- psql -X -p "$TEST_PG_PORT" -Atc 'select 1' >/dev/null 2>&1; then
  skip "restore.sh drill" "needs root, the 'house' user, PostgreSQL and peer access for 'postgres'"
  t_finish
  exit $?
fi
load_common
SRC="hdt_rs_$$" DRILL="hdt_rs_$$_drill"
t_on_exit "tpsql -d postgres -c 'DROP DATABASE IF EXISTS \"$SRC\"' -c 'DROP DATABASE IF EXISTS \"$DRILL\"' >/dev/null 2>&1"
t_on_exit "tpsql -d postgres -Atc \"select datname from pg_database where datname like '${SRC}_restore_%'\" | while read -r d; do tpsql -d postgres -c \"DROP DATABASE \\\"\$d\\\"\"; done >/dev/null 2>&1"
tpsql -d postgres -c "CREATE DATABASE \"$SRC\"" >/dev/null
tpsql -d "$SRC" >/dev/null <<'SQL'
SET client_min_messages = warning;
CREATE EXTENSION IF NOT EXISTS postgis; CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE TABLE complex(id serial primary key, name text, geo geography(Point,4326));
INSERT INTO complex(name, geo) VALUES ('연향 아파트', 'SRID=4326;POINT(127.51 34.94)');
SQL

B="$T_TMP/backups" L="$T_TMP/log"
mkdir -p "$B"/{db,pre-restore} "$L"
chown -R house:house "$B" "$L"
chown root:house "$SHARED_DIR" && chmod 0750 "$SHARED_DIR"
: >"$SHARED_DIR/.deploy.lock" && chown root:house "$SHARED_DIR/.deploy.lock" && chmod 0660 "$SHARED_DIR/.deploy.lock"
printf 'BACKUP_DIR=%s\nLOG_DIR=%s\nDB_NAME=%s\nDB_USER=%s\n' "$B" "$L" "$SRC" "$TEST_PG_USER" >"$DEPLOY_CONF"
printf 'DATABASE_URL=postgresql://%s:%s@127.0.0.1:%s/%s?schema=public\n' "$TEST_PG_USER" "$TEST_PG_PASSWORD" "$TEST_PG_PORT" "$SRC" >"$ENV_FILE"
chown root:house "$ENV_FILE" "$DEPLOY_CONF" && chmod 0640 "$ENV_FILE" "$DEPLOY_CONF"
DUMP="$B/db/$SRC.dump"
PGPASSWORD="$TEST_PG_PASSWORD" runuser -u house -- pg_dump -Fc --no-owner -h 127.0.0.1 -p "$TEST_PG_PORT" -U "$TEST_PG_USER" -d "$SRC" -f "$DUMP"

out="$(HOUSE_ROOT="$HOUSE_ROOT" bash "$KIT_DIR/restore.sh" --db "$DUMP" --target-db "$DRILL" -y 2>&1)"
assert_eq "drill restore exits 0" "$?" "0"
assert_eq "drill DB has the data" "$(tpsql -d "$DRILL" -Atc 'select name from complex')" "연향 아파트"
assert_contains "restore log written as the service user" "$(cat "$L/restore.log" 2>/dev/null)" "복원 훈련 DB 준비"
assert_eq "restore.log owned by the service user" "$(stat -c %U "$L/restore.log")" "house"

mkdir -p "$T_TMP/rootonly" && chmod 0700 "$T_TMP/rootonly" && cp "$DUMP" "$T_TMP/rootonly/x.dump"
if out="$(HOUSE_ROOT="$HOUSE_ROOT" bash "$KIT_DIR/restore.sh" --db "$T_TMP/rootonly/x.dump" --target-db "${DRILL}2" -y 2>&1)"; then
  fail "root-only dump accepted" "$out"
else
  assert_contains "a dump the service user cannot read is refused (root never opens it)" "$out" "읽을 수 없는 파일"
fi

echo garbage >"$B/db/bad.dump" && chown house:house "$B/db/bad.dump"
check_fails "a non pg_dump file is rejected" env HOUSE_ROOT="$HOUSE_ROOT" bash "$KIT_DIR/restore.sh" --db "$B/db/bad.dump" --target-db "${DRILL}3" -y
t_finish
