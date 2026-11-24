#!/usr/bin/env bash
# install.sh without systemd: the fallback Redis start waits for the old instance to exit (an
# instance that is shutting down still answers PING, and a new one cannot bind its port).
source "$(dirname "$0")/lib.sh"
load_common

# Stubs: no real processes, no real sleeping. PGREP_ALIVE = pgrep calls that still find the old one.
sleep() { :; }
EVENTS="$T_TMP/events"
pkill() { echo "pkill $*" >>"$EVENTS"; }
pgrep() {
  local n
  n="$(cat "$T_TMP/alive")"
  echo "pgrep" >>"$EVENTS"
  ((n > 0)) || return 1
  echo $((n - 1)) >"$T_TMP/alive"
}
install() { :; }
runuser() {
  echo "start alive=$(cat "$T_TMP/alive") $*" >>"$EVENTS"
}

reset() { : >"$EVENTS"; echo "$1" >"$T_TMP/alive"; }

# retry
count() { echo x >>"$T_TMP/count"; (($(wc -l <"$T_TMP/count") >= $1)); }
: >"$T_TMP/count"
check "retry succeeds on the third try" retry 5 count 3
assert_eq "retry stopped after the success" "$(wc -l <"$T_TMP/count")" 3
: >"$T_TMP/count"
check_fails "retry gives up after the given tries" retry 2 count 3
assert_eq "retry ran exactly twice" "$(wc -l <"$T_TMP/count")" 2

# Old instance needs 3 more checks to exit: the new one starts only after it is gone.
reset 3
check "fallback start succeeds once the old instance exits" redis_start_unmanaged 6380
out="$(cat "$EVENTS")"
assert_contains "old instance on that port is stopped" "$out" "pkill -u redis -f redis-server .*:6380"
assert_contains "new instance starts with the packaged config" "$out" "redis-server /etc/redis/redis.conf --daemonize yes"
assert_contains "new instance starts only when no old one is left" "$out" "start alive=0"
assert_eq "waited for the old instance (pgrep calls)" "$(grep -c '^pgrep' "$EVENTS")" 4

# Nothing running: starts at once.
reset 0
check "fallback start with no old instance" redis_start_unmanaged 6380
assert_eq "no waiting when nothing runs" "$(grep -c '^pgrep' "$EVENTS")" 1

# Old instance never exits: do not start a second one that cannot bind.
reset 99
check_fails "fallback start gives up when the old instance stays" redis_start_unmanaged 6380
assert_not_contains "no new instance while the old one holds the port" "$(cat "$EVENTS")" "start alive"

grep -q 'if ! retry 5 redis_up; then' "$KIT_DIR/install.sh" &&
  grep -q 'redis_start_unmanaged "$REDIS_PORT"' "$KIT_DIR/install.sh" &&
  pass "install.sh waits for the init script, then uses the safe fallback" ||
  fail "install.sh Redis start does not use retry + redis_start_unmanaged"
t_finish
