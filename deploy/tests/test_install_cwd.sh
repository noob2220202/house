#!/usr/bin/env bash
# install.sh is often started from a root-only checkout (/root/house-setup, mode 0700). Commands it
# runs as the service user inherit that working directory, and corepack aborts with EACCES there,
# so install.sh must leave it (cd /) before the first command it runs as 'house'.
source "$(dirname "$0")/lib.sh"

inst="$KIT_DIR/install.sh"
cd_line="$(grep -nE '^cd /$' "$inst" | head -1 | cut -d: -f1)"
first_house="$(grep -nE '^[^#]*\bas_house\b' "$inst" | grep -v 'as_house()' | head -1 | cut -d: -f1)"
[[ -n "$cd_line" ]] && pass "install.sh changes to / at top level" || fail "install.sh has no top-level 'cd /'"
if [[ -n "$cd_line" && -n "$first_house" ]] && ((cd_line < first_house)); then
  pass "cd / runs before the first as_house call (line $cd_line < $first_house)"
else
  fail "cd / must come before the first as_house call" "cd at ${cd_line:-none}, as_house at ${first_house:-none}"
fi

if is_root && id "${HOUSE_USER:-house}" >/dev/null 2>&1 && have_cmd corepack; then
  # Reproduce the failure mode: a 0700 root directory as cwd breaks corepack for 'house'; '/' works.
  d="$(mktemp -d /root/house-cwd-test.XXXXXX)"
  chmod 0700 "$d"
  out="$(cd "$d" && runuser -u "${HOUSE_USER:-house}" -- env -i PATH=/usr/bin:/bin HOME="/home/${HOUSE_USER:-house}" corepack prepare pnpm@10 --activate 2>&1)" &&
    skip "corepack from a root-only cwd" "did not fail on this system" ||
    assert_contains "corepack fails from a root-only cwd (the bug)" "$out" "EACCES"
  out="$(cd / && runuser -u "${HOUSE_USER:-house}" -- env -i PATH=/usr/bin:/bin HOME="/home/${HOUSE_USER:-house}" corepack --version 2>&1)"
  check "corepack works for house from /" test -n "$out"
  rmdir "$d"
fi
t_finish
