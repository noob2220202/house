#!/usr/bin/env bash
# Regression tests for the deploy kit (no network; PostgreSQL/nginx tests skip when unavailable).
#   bash deploy/tests/run.sh            # all
#   bash deploy/tests/run.sh conf nginx # only test_conf.sh and test_nginx.sh
# Some tests need root (ownership, runuser, nginx) and are skipped otherwise.
set -uo pipefail
cd "$(dirname "$0")" || exit 1
export LC_ALL=C.UTF-8
files=()
if (($#)); then
  for n in "$@"; do files+=("test_$n.sh"); done
else
  files=(test_*.sh)
fi
failed=()
for f in "${files[@]}"; do
  printf '■ %s\n' "$f"
  if ! bash "$f"; then failed+=("$f"); fi
done
echo
if ((${#failed[@]})); then
  printf 'FAILED: %s\n' "${failed[*]}"
  exit 1
fi
printf 'deploy kit tests: all %d files passed\n' "${#files[@]}"
