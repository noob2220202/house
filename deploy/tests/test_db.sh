#!/usr/bin/env bash
# restore.sh database steps against a real PostgreSQL: the atomic swap with live connections,
# and an app-role (non-superuser) restore of a PostGIS + pg_trgm dump.
source "$(dirname "$0")/lib.sh"
load_common

if ! pg_available; then
  skip "database tests" "PostgreSQL not reachable at $TEST_PG_HOST:$TEST_PG_PORT"
  t_finish
  exit $?
fi
S="t$$"
A="hdt_${S}" W="hdt_${S}_restore_1" B="hdt_${S}_before_1" SRC="hdt_${S}_src" WK="hdt_${S}_work" ROLE="hdt_${S}_app"
t_on_exit "tpsql -d postgres -c 'DROP DATABASE IF EXISTS \"$A\"' -c 'DROP DATABASE IF EXISTS \"$W\"' -c 'DROP DATABASE IF EXISTS \"$B\"' -c 'DROP DATABASE IF EXISTS \"$SRC\"' -c 'DROP DATABASE IF EXISTS \"$WK\"' -c 'DROP ROLE IF EXISTS \"$ROLE\"' >/dev/null 2>&1"

# ─── swap ───
tpsql -d postgres -c "CREATE DATABASE \"$A\"" -c "CREATE DATABASE \"$W\"" >/dev/null
tpsql -d "$A" -c "CREATE TABLE marker(v text); INSERT INTO marker VALUES ('old')" >/dev/null
tpsql -d "$W" -c "CREATE TABLE marker(v text); INSERT INTO marker VALUES ('new')" >/dev/null
# An idle client (think: a worker that did not stop, or an operator's psql) holds the database.
(sleep 30 | PGPASSWORD="$TEST_PG_PASSWORD" psql -X -q -h "$TEST_PG_HOST" -p "$TEST_PG_PORT" -U "$TEST_PG_USER" -d "$A") >/dev/null 2>&1 &
holder=$!
sleep 1
tpsql -d postgres -c "ALTER DATABASE \"$A\" WITH ALLOW_CONNECTIONS false" >/dev/null
check_fails "new connections are refused while the swap runs" tpsql -d "$A" -c 'select 1'
check "swap succeeds despite the open connection" bash -c "$(declare -f db_swap_sql die); PG_IDENT_RE='$PG_IDENT_RE'; db_swap_sql '$A' '$W' '$B' |
  PGPASSWORD='$TEST_PG_PASSWORD' psql -X -q -v ON_ERROR_STOP=1 -h '$TEST_PG_HOST' -p '$TEST_PG_PORT' -U '$TEST_PG_USER' -d postgres"
assert_eq "restored data is live under the original name" "$(tpsql -d "$A" -Atc 'select v from marker')" "new"
assert_eq "previous database kept and reachable" "$(tpsql -d "$B" -Atc 'select v from marker')" "old"
assert_eq "both databases accept connections" "$(tpsql -d postgres -Atc "select string_agg(datallowconn::text, ',' order by datname) from pg_database where datname in ('$A','$B')")" "true,true"
kill "$holder" 2>/dev/null; wait "$holder" 2>/dev/null

# Failure (work DB missing): nothing renamed; the caller re-allows connections.
tpsql -d postgres -c "ALTER DATABASE \"$A\" WITH ALLOW_CONNECTIONS false" >/dev/null
check_fails "swap with a missing work DB fails" bash -c "$(declare -f db_swap_sql die); PG_IDENT_RE='$PG_IDENT_RE'; db_swap_sql '$A' 'hdt_${S}_nope' 'hdt_${S}_b2' |
  PGPASSWORD='$TEST_PG_PASSWORD' psql -X -q -v ON_ERROR_STOP=1 -h '$TEST_PG_HOST' -p '$TEST_PG_PORT' -U '$TEST_PG_USER' -d postgres"
assert_eq "failed swap left the database in place (transaction)" "$(tpsql -d postgres -Atc "select count(*) from pg_database where datname = '$A'")" "1"
tpsql -d postgres -c "ALTER DATABASE \"$A\" WITH ALLOW_CONNECTIONS true" >/dev/null
assert_eq "database usable again after cleanup" "$(tpsql -d "$A" -Atc 'select v from marker')" "new"
check_fails "names over 63 characters are refused" bash -c "$(declare -f db_swap_sql die); PG_IDENT_RE='$PG_IDENT_RE'; db_swap_sql a b '$(printf 'x%.0s' {1..70})'"

r="$KIT_DIR/restore.sh"
grep -q 'ALLOW_CONNECTIONS false' "$r" && grep -q 'db_swap_sql "\$DB_NAME" "\$WORK_DB" "\$BEFORE_DB" | pg_super' "$r" &&
  pass "restore.sh blocks connections and swaps in one session" || fail "restore.sh swap not atomic"
grep -q 'trap cleanup EXIT' "$r" && grep -q 'APPS_STOPPED=1' "$r" && ! grep -q 'stop house-api house-worker >/dev/null || true' "$r" &&
  pass "restore.sh restarts the apps on any exit after stopping them" || fail "restore.sh can leave the apps stopped"
grep -q -- '-p "\$PGURL_PORT"' "$r" && pass "restore.sh passes the cluster port from DATABASE_URL" || fail "restore.sh ignores the DB port"
grep -q 'prisma migrate deploy' "$r" && pass "restore.sh applies pending migrations after the swap" || fail "no migrate after restore"

# ─── app-role restore of a PostGIS dump ───
tpsql -d postgres -c "CREATE DATABASE \"$SRC\"" >/dev/null
tpsql -d "$SRC" >/dev/null <<SQL
SET client_min_messages = warning;
CREATE EXTENSION IF NOT EXISTS postgis; CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE TABLE listing(id serial primary key, title text not null, geo geography(Point,4326));
CREATE INDEX listing_title_trgm ON listing USING gin (title gin_trgm_ops);
CREATE INDEX listing_geo ON listing USING gist (geo);
INSERT INTO listing(title, geo) VALUES ('순천 아파트', 'SRID=4326;POINT(127.48 34.95)'::geography), ('원룸', NULL);
SQL
PGPASSWORD="$TEST_PG_PASSWORD" pg_dump -Fc --no-owner -h "$TEST_PG_HOST" -p "$TEST_PG_PORT" -U "$TEST_PG_USER" -d "$SRC" -f "$T_TMP/src.dump"
tpsql -d postgres -c "CREATE ROLE \"$ROLE\" LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE PASSWORD 'pw_$S'" \
  -c "CREATE DATABASE \"$WK\" OWNER \"$ROLE\" TEMPLATE template0" >/dev/null
tpsql -d "$WK" -c "SET client_min_messages = warning; CREATE EXTENSION IF NOT EXISTS postgis; CREATE EXTENSION IF NOT EXISTS pg_trgm;" >/dev/null
pg_restore --list "$T_TMP/src.dump" | restore_list_filter >"$T_TMP/list"
if PGPASSWORD="pw_$S" pg_restore --no-owner --no-acl --exit-on-error -h "$TEST_PG_HOST" -p "$TEST_PG_PORT" -U "$ROLE" \
  -L "$T_TMP/list" -d "$WK" "$T_TMP/src.dump" >"$T_TMP/restore.out" 2>&1; then
  pass "non-superuser app role restores the filtered dump"
else
  fail "app-role restore failed" "$(head -5 "$T_TMP/restore.out")"
fi
assert_eq "rows restored" "$(tpsql -d "$WK" -Atc 'select count(*) from listing')" "2"
assert_eq "objects owned by the app role" "$(tpsql -d "$WK" -Atc "select tableowner from pg_tables where tablename = 'listing'")" "$ROLE"
assert_eq "trigram search works" "$(tpsql -d "$WK" -Atc "select title from listing where title % '순천 아파'")" "순천 아파트"
! grep -q 'runuser -u postgres -- pg_restore' "$r" && grep -q 'pg_run run_as_house pg_restore --no-owner --no-acl' "$r" &&
  pass "restore.sh never runs pg_restore as a superuser" || fail "restore.sh still restores as postgres"
t_finish
