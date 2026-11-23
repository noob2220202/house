# shellcheck shell=bash
# Minimal test helpers for the deploy kit tests (sourced by deploy/tests/test_*.sh).
# Each test file runs in its own bash process; failures are counted, not fatal.
set -uo pipefail

TESTS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
KIT_DIR="$(cd "$TESTS_DIR/.." && pwd)"
REPO_DIR="$(cd "$KIT_DIR/.." && pwd)"
T_FAILS=0
T_PASSES=0

T_TMP="$(mktemp -d "${TMPDIR:-/tmp}/house-deploy-test.XXXXXX")"
chmod 0755 "$T_TMP"
t_cleanup_hooks=()
t_on_exit() { t_cleanup_hooks+=("$1"); }
t_finish() {
  local h
  for h in "${t_cleanup_hooks[@]}"; do eval "$h" || true; done
  rm -rf "$T_TMP"
  printf '  %d passed, %d failed\n' "$T_PASSES" "$T_FAILS"
  ((T_FAILS == 0))
}

pass() { T_PASSES=$((T_PASSES + 1)); printf '    ok   %s\n' "$1"; }
fail() { T_FAILS=$((T_FAILS + 1)); printf '    FAIL %s\n' "$1"; [[ -n "${2:-}" ]] && printf '         %s\n' "$2"; }

# check <name> <command...>: passes when the command succeeds.
check() {
  local name="$1"
  shift
  local out
  if out="$("$@" 2>&1)"; then pass "$name"; else fail "$name" "${out:0:400}"; fi
}
# check_fails <name> <command...>: passes when the command fails.
check_fails() {
  local name="$1"
  shift
  local out
  if out="$("$@" 2>&1)"; then fail "$name" "expected failure, got: ${out:0:300}"; else pass "$name"; fi
}
assert_eq() {
  if [[ "$2" == "$3" ]]; then pass "$1"; else fail "$1" "expected [$3], got [$2]"; fi
}
assert_contains() {
  if [[ "$2" == *"$3"* ]]; then pass "$1"; else fail "$1" "[$3] not found in: ${2:0:400}"; fi
}
assert_not_contains() {
  if [[ "$2" != *"$3"* ]]; then pass "$1"; else fail "$1" "unexpected [$3] in: ${2:0:400}"; fi
}

is_root() { [[ $EUID -eq 0 ]]; }
skip() { printf '    skip %s (%s)\n' "$1" "$2"; }

# Loads the kit's common.sh against a throw-away HOUSE_ROOT.
load_common() {
  export HOUSE_ROOT="$T_TMP/srv"
  mkdir -p "$HOUSE_ROOT/shared" "$HOUSE_ROOT/releases"
  # shellcheck source=../lib/common.sh
  source "$KIT_DIR/lib/common.sh"
}

# Local PostgreSQL superuser (test container defaults; override with TEST_PG_*).
TEST_PG_HOST="${TEST_PG_HOST:-localhost}"
TEST_PG_PORT="${TEST_PG_PORT:-5432}"
TEST_PG_USER="${TEST_PG_USER:-house}"
TEST_PG_PASSWORD="${TEST_PG_PASSWORD:-house}"
pg_available() {
  have_cmd psql && PGPASSWORD="$TEST_PG_PASSWORD" psql -X -q -h "$TEST_PG_HOST" -p "$TEST_PG_PORT" \
    -U "$TEST_PG_USER" -d postgres -Atc 'select 1' >/dev/null 2>&1
}
tpsql() {
  PGPASSWORD="$TEST_PG_PASSWORD" psql -X -q -v ON_ERROR_STOP=1 -h "$TEST_PG_HOST" -p "$TEST_PG_PORT" \
    -U "$TEST_PG_USER" "$@"
}
have_cmd() { command -v "$1" >/dev/null 2>&1; }
