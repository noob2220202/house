#!/usr/bin/env bash
# install.sh --kit-only run from the installed bin/: root fetches deploy/ from REPO_URL itself
# (here a local repository) and installs it root-owned; a broken kit is refused.
source "$(dirname "$0")/lib.sh"
if ! is_root || ! have_cmd git; then
  skip "install.sh --kit-only" "needs root and git"
  t_finish
  exit $?
fi
load_common
chown root:root "$HOUSE_ROOT" && chmod 0755 "$HOUSE_ROOT"
( kit_install "$KIT_DIR" "$BIN_DIR" ) >/dev/null

repo="$T_TMP/repo"
mkdir -p "$repo"
git -C "$repo" init -q -b main
cp -R "$KIT_DIR" "$repo/deploy"
echo '# kit-marker-v2' >>"$repo/deploy/status.sh"
git -C "$repo" add -A && git -C "$repo" -c user.email=t@t -c user.name=t commit -qm v2
sha="$(git -C "$repo" rev-parse HEAD)"
printf 'REPO_URL=%s\nBRANCH=main\n' "$repo" >"$DEPLOY_CONF"

out="$(HOUSE_ROOT="$HOUSE_ROOT" bash "$BIN_DIR/install.sh" --kit-only 2>&1)"
rc=$?
assert_eq "--kit-only (branch) succeeds" "$rc" "0"
grep -q 'kit-marker-v2' "$BIN_DIR/status.sh" && pass "bin/ updated from the repository" || fail "bin/ not updated" "$out"
assert_eq "updated files are root-owned" "$(find "$BIN_DIR" ! -user root | wc -l)" "0"
assert_eq "/srv/house/deploy.sh symlink is root-owned" "$(stat -c %U "$HOUSE_ROOT/deploy.sh")" "root"
assert_eq "db-shell.sh link installed" "$(readlink "$HOUSE_ROOT/db-shell.sh")" "$BIN_DIR/db-shell.sh"

echo 'if then' >>"$repo/deploy/lib/common.sh"
git -C "$repo" -c user.email=t@t -c user.name=t commit -qam broken
if out="$(HOUSE_ROOT="$HOUSE_ROOT" bash "$BIN_DIR/install.sh" --kit-only 2>&1)"; then
  fail "broken kit installed" "$out"
else
  pass "a kit with a syntax error is refused"
fi
bash -n "$BIN_DIR/lib/common.sh" && pass "installed kit left intact" || fail "installed kit damaged"

out="$(HOUSE_ROOT="$HOUSE_ROOT" bash "$BIN_DIR/install.sh" --kit-only --kit-ref "$sha" 2>&1)"
assert_eq "--kit-ref <full sha> installs that commit" "$?" "0"
check_fails "--kit-ref with a short sha is refused" env HOUSE_ROOT="$HOUSE_ROOT" bash "$BIN_DIR/install.sh" --kit-only --kit-ref "${sha:0:7}"
t_finish
