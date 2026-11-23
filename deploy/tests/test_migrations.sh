#!/usr/bin/env bash
# Migration helpers against a real PostgreSQL and the repo's Prisma CLI:
#   - migrate_db_url gives `prisma migrate deploy` a lock_timeout (DDL never stalls the API behind
#     a pg_dump or a long query)                                                          (OPS-05)
#   - a failed migration (Prisma P3009) is detected and explained                          (OPS-07)
#   - migrations_unknown_to lists applied migrations a rollback target does not ship       (OPS-04)
source "$(dirname "$0")/lib.sh"
load_common

# ─── migrate_db_url (no DB needed) ───
MIGRATE_LOCK_TIMEOUT=5s MIGRATE_STATEMENT_TIMEOUT=15min
opts='options=-c%20lock_timeout%3D5s%20-c%20statement_timeout%3D15min'
assert_eq "plain URL gets ?options" "$(migrate_db_url postgresql://u:p@h:5432/d)" "postgresql://u:p@h:5432/d?$opts"
assert_eq "URL with ?schema gets &options" "$(migrate_db_url 'postgresql://u:p@h:5432/d?schema=public')" "postgresql://u:p@h:5432/d?schema=public&$opts"
assert_eq "operator-set options are kept" "$(migrate_db_url 'postgresql://u@h/d?options=-c%20x%3D1')" 'postgresql://u@h/d?options=-c%20x%3D1'

PRISMA="$REPO_DIR/apps/api/node_modules/.bin/prisma"
if ! pg_available || [[ ! -x "$PRISMA" ]]; then
  skip "migration DB tests" "needs PostgreSQL and apps/api's prisma CLI (pnpm install)"
  t_finish
  exit $?
fi
DB="hdt_mig_$$"
t_on_exit "tpsql -d postgres -c 'DROP DATABASE IF EXISTS \"$DB\"' >/dev/null 2>&1"
tpsql -d postgres -c "CREATE DATABASE \"$DB\"" >/dev/null
URL="postgresql://$TEST_PG_USER:$TEST_PG_PASSWORD@$TEST_PG_HOST:$TEST_PG_PORT/$DB?schema=public"
printf 'DATABASE_URL=%s\n' "$URL" >"$ENV_FILE"

# A release tree the way deploy.sh lays it out.
REL="$T_TMP/release"
MIGS="$REL/apps/api/prisma/schema/migrations"
mkdir -p "$MIGS"
printf 'datasource db {\n  provider = "postgresql"\n  url      = env("DATABASE_URL")\n}\n' >"$REL/apps/api/prisma/schema/schema.prisma"
echo 'provider = "postgresql"' >"$MIGS/migration_lock.toml"
add_migration() { mkdir -p "$MIGS/$1" && printf '%s\n' "$2" >"$MIGS/$1/migration.sql"; }
migrate() { (cd "$REL/apps/api" && DATABASE_URL="$1" "$PRISMA" migrate deploy --schema prisma/schema 2>&1); }

assert_eq "no _prisma_migrations yet → no failed migrations" "$(db_failed_migrations)" ""
assert_eq "no _prisma_migrations yet → nothing applied" "$(db_applied_migrations)" ""
assert_eq "no _prisma_migrations yet → nothing unknown to a release" "$(migrations_unknown_to "$REL")" ""

# The timeout URL really reaches the migration session (Prisma ignores PGOPTIONS).
add_migration 20260101000000_a "CREATE TABLE t(id int);
DO \$\$ BEGIN
  IF current_setting('lock_timeout') <> '5s' THEN RAISE EXCEPTION 'lock_timeout=%', current_setting('lock_timeout'); END IF;
  IF current_setting('statement_timeout') <> '15min' THEN RAISE EXCEPTION 'statement_timeout=%', current_setting('statement_timeout'); END IF;
END \$\$;"
check "migrate deploy runs with lock_timeout=5s and statement_timeout=15min" migrate "$(migrate_db_url "$URL")"
assert_eq "applied migrations listed" "$(db_applied_migrations)" "20260101000000_a"

# OPS-05: an ALTER waiting behind a dump-like ACCESS SHARE lock gives up after lock_timeout
# instead of queueing every query on the table behind it for the length of the dump.
add_migration 20260102000000_b "ALTER TABLE t ADD COLUMN n int NOT NULL DEFAULT 0;"
(PGPASSWORD="$TEST_PG_PASSWORD" psql -X -q -h "$TEST_PG_HOST" -p "$TEST_PG_PORT" -U "$TEST_PG_USER" -d "$DB" \
  -c "BEGIN; LOCK TABLE t IN ACCESS SHARE MODE; SELECT pg_sleep(25); COMMIT;") >/dev/null 2>&1 &
holder=$!
for _ in $(seq 50); do
  [[ "$(tpsql -d "$DB" -Atc "select count(*) from pg_locks l join pg_class c on c.oid = l.relation where c.relname = 't' and l.mode = 'AccessShareLock' and l.granted and l.pid <> pg_backend_pid()")" -ge 1 ]] && break
  sleep 0.1
done
t0=$(date +%s)
out="$(migrate "$(migrate_db_url "$URL")")" && rc=0 || rc=$?
elapsed=$(($(date +%s) - t0))
kill "$holder" 2>/dev/null
tpsql -d postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$DB' AND query LIKE '%pg_sleep%'" >/dev/null
wait "$holder" 2>/dev/null
((rc != 0)) && pass "blocked ALTER fails instead of waiting for the dump" || fail "blocked ALTER succeeded?" "$out"
((elapsed < 20)) && pass "gave up after lock_timeout (${elapsed}s, holder held 25s)" || fail "waited ${elapsed}s for the lock"
assert_contains "failure is a lock timeout" "$out" "lock timeout"

# OPS-07: that failure left a P3009 row; it is detected, and the hint names the fix.
assert_eq "failed migration detected" "$(db_failed_migrations)" "20260102000000_b"
out="$(migrate "$URL")" || true
assert_contains "plain retry is blocked by P3009 (why deploy.sh checks first)" "$out" "P3009"
hint="$(migrate_resolve_hint 20260102000000_b 2>&1)"
assert_contains "hint names the resolve command" "$hint" "prisma migrate resolve --rolled-back 20260102000000_b"
assert_contains "hint runs from the live release" "$hint" "cd $CURRENT_LINK/apps/api"
(cd "$REL/apps/api" && DATABASE_URL="$URL" "$PRISMA" migrate resolve --rolled-back 20260102000000_b --schema prisma/schema >/dev/null 2>&1)
assert_eq "after resolve --rolled-back nothing is failed" "$(db_failed_migrations)" ""
check "after resolve the migration applies" migrate "$(migrate_db_url "$URL")"

# OPS-04: an older release that does not ship the newest migrations is flagged.
OLD="$T_TMP/old-release"
mkdir -p "$OLD/apps/api/prisma/schema/migrations/20260101000000_a"
assert_eq "migrations the old release lacks" "$(migrations_unknown_to "$OLD")" "20260102000000_b"
assert_eq "the release that applied them lacks none" "$(migrations_unknown_to "$REL")" ""
printf 'DATABASE_URL=postgresql://%s:wrong@%s:%s/%s\n' "$TEST_PG_USER" "$TEST_PG_HOST" "$TEST_PG_PORT" "$DB" >"$ENV_FILE"
check_fails "an unreadable DB is an error, not 'nothing unknown'" migrations_unknown_to "$OLD"
check_fails "an unreadable DB is an error, not 'nothing failed'" db_failed_migrations
t_finish
