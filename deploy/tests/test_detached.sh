#!/usr/bin/env bash
# run_detached: a dropped terminal (SIGHUP) or Ctrl-C stops the viewer, never the work.
source "$(dirname "$0")/lib.sh"
load_common

job="$T_TMP/job.sh"
cat >"$job" <<JOB
#!/usr/bin/env bash
set -euo pipefail
source '$KIT_DIR/lib/common.sh'
run_detached '$T_TMP/job.log' "\$@"
echo "started \$1"
sleep 2
echo "finished \$1" >'$T_TMP/done'
echo "finished \$1"
JOB
chmod +x "$job"

# Foreground wrapper killed with SIGHUP (SSH drop) while the job runs.
setsid bash "$job" A >"$T_TMP/viewer.out" 2>&1 &
viewer=$!
sleep 0.7
kill -HUP "$viewer" 2>/dev/null
wait "$viewer" 2>/dev/null
for _ in $(seq 1 40); do [[ -e "$T_TMP/done" ]] && break; sleep 0.2; done
assert_eq "job finished after the viewer got SIGHUP" "$(cat "$T_TMP/done" 2>/dev/null)" "finished A"
assert_contains "job output went to the log" "$(cat "$T_TMP/job.log")" "started A"

# Normal run: the viewer shows the output and returns the job's exit status.
rm -f "$T_TMP/done"
out="$(bash "$job" B 2>&1)"
rc=$?
assert_eq "viewer exit status is the job's" "$rc" "0"
assert_contains "viewer streamed the job's output" "$out" "finished B"

d="$KIT_DIR/deploy.sh"
grep -q "trap 'on_error 130' INT" "$d" && grep -q "trap 'on_error 143' TERM" "$d" && grep -q "trap 'on_error 129' HUP" "$d" &&
  pass "deploy.sh rolls back on INT/TERM/HUP after the switch" || fail "deploy.sh signal traps missing"
grep -q 'run_detached "\$LOG_DIR/deploy.log"' "$d" && pass "deploy.sh detaches before changing anything" || fail "deploy.sh does not detach"
grep -q 'run_detached "\$LOG_DIR/deploy.log"' "$KIT_DIR/rollback.sh" && pass "rollback.sh detaches after confirmation" ||
  fail "rollback.sh does not detach"
t_finish
