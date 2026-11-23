#!/usr/bin/env bash
# Retention never empties the backup directory, and is skipped on a failed night.
source "$(dirname "$0")/lib.sh"
load_common

d="$T_TMP/db"
mkdir -p "$d"
for i in $(seq 1 10); do
  f="$d/house-$(printf '%02d' "$i").dump"
  : >"$f"
  touch -d "$((40 - i)) days ago" "$f" # all older than 14 days
done
prune_keep_newest "$d" '*.dump' 14 7 f >/dev/null
left="$(find "$d" -name '*.dump' -printf '%f\n' | sort | tr '\n' ' ')"
assert_eq "all dumps expired: newest 7 kept" "$left" "house-04.dump house-05.dump house-06.dump house-07.dump house-08.dump house-09.dump house-10.dump "

d2="$T_TMP/db2"
mkdir -p "$d2"
for i in 1 2 3; do : >"$d2/new-$i.dump"; done
for i in 1 2 3 4 5 6 7 8; do : >"$d2/old-$i.dump"; touch -d "$((20 + i)) days ago" "$d2/old-$i.dump"; done
prune_keep_newest "$d2" '*.dump' 14 7 f >/dev/null
assert_eq "beyond the newest 7, only expired entries go" "$(find "$d2" -name '*.dump' | wc -l)" "7"
[[ -e "$d2/old-1.dump" && -e "$d2/old-4.dump" && ! -e "$d2/old-5.dump" ]] && pass "oldest expired removed first" ||
  fail "wrong entries removed: $(ls "$d2" | tr '\n' ' ')"

s="$T_TMP/snaps"
mkdir -p "$s"
for i in 1 2 3 4 5 6 7 8 9; do mkdir "$s/2026010$i-033000"; touch -d "$((30 - i)) days ago" "$s/2026010$i-033000"; done
prune_keep_newest "$s" '20*' 14 7 d >/dev/null
assert_eq "upload snapshots: newest 7 directories kept" "$(find "$s" -mindepth 1 -maxdepth 1 -type d | wc -l)" "7"

b="$KIT_DIR/backup.sh"
grep -q 'if \$FAILED; then' "$b" && grep -q '보관 기간 정리를 건너뜁니다' "$b" && pass "backup.sh skips retention after a failure" ||
  fail "backup.sh retention not guarded by FAILED"
grep -q -- '--backup-dir' "$b" && pass "rclone uploads sync keeps deleted files (--backup-dir)" || fail "rclone sync without --backup-dir"
! grep -q -- '-mtime +5' "$b" && grep -q 'DO_UPLOADS=true' "$b" && pass "uploads are snapshotted daily" || fail "uploads still weekly"
grep -q '0 3 \* \* \*\|30 3 \* \* \*' "$KIT_DIR/install.sh" && pass "cron runs daily" || fail "cron line missing"
t_finish
