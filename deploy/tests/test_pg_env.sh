#!/usr/bin/env bash
# DB credentials reach libpq through the environment only — never argv (/proc/*/cmdline is public).
source "$(dirname "$0")/lib.sh"
load_common

printf 'DATABASE_URL="postgresql://app%%40x:p%%40ss%%2Fw0rd@127.0.0.1:6543/house_db?schema=public"\n' >"$ENV_FILE"
out="$( pg_parse_url; printf '%s|%s|%s|%s|%s' "$PGURL_HOST" "$PGURL_PORT" "$PGURL_USER" "$PGURL_PASSWORD" "$PGURL_DB" )"
assert_eq "URL parsed and percent-decoded, ?schema dropped" "$out" "127.0.0.1|6543|app@x|p@ss/w0rd|house_db"

printf 'DATABASE_URL=postgres://u:pw@[::1]/d\n' >"$ENV_FILE"
out="$( pg_parse_url; printf '%s|%s' "$PGURL_HOST" "$PGURL_PORT" )"
assert_eq "IPv6 host, default port" "$out" "::1|5432"

printf 'DATABASE_URL=mysql://u:p@h/d\n' >"$ENV_FILE"
check_fails "non-postgres URL rejected" bash -c "source '$KIT_DIR/lib/common.sh'; ENV_FILE='$ENV_FILE'; pg_parse_url"

printf 'DATABASE_URL=postgresql://house:S3cr3tPw@127.0.0.1:5432/house?schema=public\n' >"$ENV_FILE"
# shellcheck disable=SC2016 # expands in the child
argv="$(pg_run bash -c 'tr "\0" " " </proc/$$/cmdline')"
envpw="$(pg_run printenv PGPASSWORD)"
assert_not_contains "password is not in the child's argv" "$argv" "S3cr3tPw"
assert_eq "password is in the child's environment" "$envpw" "S3cr3tPw"
[[ -z "${PGPASSWORD:-}" ]] && pass "pg_run does not export into the caller" || fail "PGPASSWORD leaked into caller"

# No script builds a URL argument for libpq tools any more.
hits="$(grep -nE 'libpq_url|psql[^|]*"\$DB_URL"|pg_dump[^|]*"\$\(|pg_dump[^|]*"\$DB_URL"' "$KIT_DIR"/*.sh "$KIT_DIR"/lib/common.sh || true)"
assert_eq "no DATABASE_URL on a pg_dump/psql command line" "$hits" ""
docs="$(grep -nE 'psql "\$\(grep \^DATABASE_URL' "$REPO_DIR/docs/OPERATIONS.md" "$REPO_DIR/docs/DEPLOY.md" || true)"
assert_eq "docs no longer show psql with the URL in argv" "$docs" ""

if pg_available; then
  printf 'DATABASE_URL=postgresql://%s:%s@%s:%s/postgres?schema=public\n' "$TEST_PG_USER" "$TEST_PG_PASSWORD" "$TEST_PG_HOST" "$TEST_PG_PORT" >"$ENV_FILE"
  assert_eq "pg_run psql connects with the parsed settings" "$(pg_run psql -X -Atc 'select 41+1')" "42"
else
  skip "live psql connection" "PostgreSQL not reachable"
fi
t_finish
