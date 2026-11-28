#!/usr/bin/env bash
# The deploy kit root runs is root-owned, validated, and never rewritten by the service user.
source "$(dirname "$0")/lib.sh"
load_common

check "the repository's deploy/ kit validates" kit_validate "$KIT_DIR"
cp -R "$KIT_DIR" "$T_TMP/kit-bad" && echo 'if then' >>"$T_TMP/kit-bad/lib/common.sh"
check_fails "kit with a syntax error is rejected" kit_validate "$T_TMP/kit-bad"
cp -R "$KIT_DIR" "$T_TMP/kit-link" && ln -s /etc/passwd "$T_TMP/kit-link/evil.sh"
check_fails "kit containing a symlink is rejected" kit_validate "$T_TMP/kit-link"
cp -R "$KIT_DIR" "$T_TMP/kit-miss" && rm "$T_TMP/kit-miss/restore.sh"
check_fails "incomplete kit is rejected" kit_validate "$T_TMP/kit-miss"
cp -R "$KIT_DIR" "$T_TMP/kit-nokeys" && rm "$T_TMP/kit-nokeys/set-keys.sh"
check_fails "kit without set-keys.sh is rejected" kit_validate "$T_TMP/kit-nokeys"
cp -R "$KIT_DIR" "$T_TMP/kit-nosites" && rm "$T_TMP/kit-nosites/nginx/house-site.conf.template"
check_fails "kit without the office-site server template is rejected" kit_validate "$T_TMP/kit-nosites"
grep -q 'for s in deploy rollback status backup restore create-admin db-shell set-keys sites; do' "$KIT_DIR/install.sh" &&
  pass "install.sh links set-keys.sh into /srv/house" || fail "set-keys.sh not linked by install.sh"

# An older checkout (e.g. the first install's /root/house-setup) must not replace a newer bin/.
check_fails "kit_missing_from: same kit → nothing missing" kit_missing_from "$KIT_DIR" "$KIT_DIR"
check_fails "kit_missing_from: no bin/ yet → nothing missing" kit_missing_from "$KIT_DIR" "$T_TMP/no-bin"
assert_eq "kit_missing_from lists what only bin/ has (sites.sh and the site template)" \
  "$(kit_missing_from "$T_TMP/kit-nosites" "$KIT_DIR")" "nginx/house-site.conf.template"
cp -R "$T_TMP/kit-nosites" "$T_TMP/kit-old" && rm "$T_TMP/kit-old/sites.sh"
assert_eq "kit_missing_from lists several, sorted" "$(kit_missing_from "$T_TMP/kit-old" "$KIT_DIR")" \
  "nginx/house-site.conf.template sites.sh"
i="$KIT_DIR/install.sh"
guard_line="$(grep -n 'kit_missing_from "\$SCRIPT_DIR" "\$BIN_DIR"' "$i" | head -1 | cut -d: -f1)"
first_change="$(grep -nE '^if \$KIT_ONLY; then' "$i" | head -1 | cut -d: -f1)"
if [[ -n "$guard_line" && -n "$first_change" ]] && ((guard_line < first_change)); then
  pass "install.sh refuses an older checkout before --kit-only or anything else changes (line $guard_line)"
else
  fail "install.sh older-checkout guard missing or too late" "guard ${guard_line:-none}, --kit-only ${first_change:-none}"
fi
grep -q -- '--allow-older-kit) ALLOW_OLDER_KIT=true' "$i" && pass "--allow-older-kit overrides the guard" || fail "--allow-older-kit missing"

if is_root && id "$HOUSE_USER" >/dev/null 2>&1; then
  bin="$HOUSE_ROOT/bin"
  mkdir -p "$bin/lib"
  # Old layout: house-owned bin with a tampered file of identical size and mtime, plus extras.
  cp "$KIT_DIR/lib/common.sh" "$bin/lib/common.sh"
  sed -i '1s/^#/X/' "$bin/lib/common.sh"
  touch -r "$KIT_DIR/lib/common.sh" "$bin/lib/common.sh"
  echo 'planted' >"$bin/planted.sh"
  chown -R "$HOUSE_USER:$HOUSE_USER" "$bin"
  ( kit_install "$KIT_DIR" "$bin" ) >/dev/null
  cmp -s "$KIT_DIR/lib/common.sh" "$bin/lib/common.sh" && pass "tampered file with same size/mtime replaced" ||
    fail "tampered common.sh survived kit_install"
  [[ ! -e "$bin/planted.sh" ]] && pass "unknown files removed from bin" || fail "planted file kept"
  bad="$(find "$bin" \( ! -user root -o -perm /022 \) -printf '%u %m %P\n' | head -5)"
  assert_eq "every file and directory in bin is root-owned and not group/world-writable" "$bad" ""
  assert_eq "scripts are 0755" "$(stat -c %a "$bin/deploy.sh")" "755"
  assert_eq "non-script files are 0644" "$(stat -c %a "$bin/lib/preflight.cjs")" "644"
  check_fails "the service user cannot modify bin/lib/common.sh" runuser -u "$HOUSE_USER" -- sh -c "echo x >> '$bin/lib/common.sh'"
  check_fails "the service user cannot add files to bin" runuser -u "$HOUSE_USER" -- touch "$bin/new.sh"
  # Running an older checkout's install.sh: refused before anything changes, bin/ intact.
  before="$(find "$bin" -type f -printf '%P %s\n' | sort)"
  out="$(HOUSE_ROOT="$HOUSE_ROOT" bash "$T_TMP/kit-old/install.sh" --kit-only 2>&1)" && rc=0 || rc=$?
  assert_eq "an older checkout's install.sh --kit-only is refused" "$rc" "1"
  assert_contains "the refusal names the files only bin/ has" "$out" "sites.sh"
  assert_contains "the refusal points at the installed install.sh" "$out" "$bin/install.sh --kit-only"
  assert_eq "bin/ unchanged after the refusal" "$(find "$bin" -type f -printf '%P %s\n' | sort)" "$before"
  check "--allow-older-kit lets that checkout run (the kit still has to validate)" bash -c \
    "HOUSE_ROOT='$HOUSE_ROOT' bash '$T_TMP/kit-old/install.sh' --kit-only --allow-older-kit 2>&1 | grep -q '검증 실패'"
else
  skip "kit_install ownership" "needs root and the '$HOUSE_USER' user"
fi

d="$KIT_DIR/deploy.sh"
! grep -qE 'mv -T "\$NEW_KIT|HOUSE_DEPLOY_UPDATED' "$d" && pass "deploy.sh no longer rewrites bin/ (self-update removed)" ||
  fail "deploy.sh still self-updates bin/"
grep -q 'install.sh --kit-only --kit-ref' "$d" && pass "deploy.sh points at the root-run kit update" || fail "kit drift notice missing"
i="$KIT_DIR/install.sh"
grep -q 'root_dir 0755 root:root "\$HOUSE_ROOT"' "$i" && grep -q 'root_dir 0755 root:root "\$BIN_DIR"' "$i" &&
  grep -q 'root_dir 0750 "root:\$HOUSE_USER" "\$SHARED_DIR"' "$i" && pass "install.sh makes /srv/house, bin root and shared root:house" ||
  fail "install.sh ownership of /srv/house, bin, shared"
grep -q 'write_if_changed "\$DEPLOY_CONF" 0640 "root:\$HOUSE_USER"' "$i" && grep -q 'install -m 0640 -o root -g "\$HOUSE_USER" "\$TMP_ENV"' "$i" &&
  pass "deploy.conf and .env are root:house 0640" || fail "deploy.conf/.env ownership"
! grep -q 'chown -h "\$HOUSE_USER' "$i" && pass "symlinks in /srv/house stay root-owned" || fail "install.sh still hands symlinks to house"
t_finish
