#!/usr/bin/env bash
# set-keys.sh: answers fed on stdin. Updates or creates keys in place, keeps every other line,
# leaves shared/.env root:house 0640, rejects quotes/spaces/backslashes, mirrors
# NAVER_MAP_CLIENT_ID into NEXT_PUBLIC_NAVER_MAP_KEY_ID (the browser map key).
source "$(dirname "$0")/lib.sh"
load_common
sk="$KIT_DIR/set-keys.sh"

if ! is_root || ! id "$HOUSE_USER" >/dev/null 2>&1; then
  skip "set-keys.sh" "needs root and the '$HOUSE_USER' user"
  t_finish
  exit $?
fi
chown "root:$HOUSE_USER" "$SHARED_DIR"
chmod 0750 "$SHARED_DIR"
# keys <service> <answer>...: runs set-keys.sh with one answer per line on stdin.
keys() {
  local only="$1"
  shift
  printf '%s\n' "$@" | HOUSE_ROOT="$HOUSE_ROOT" bash "$sk" ${only:+"$only"} 2>&1
}
perms() { stat -c '%U:%G %a' "$ENV_FILE"; }
others() { grep -vE "^(${1})=" "$ENV_FILE"; }

cat >"$ENV_FILE" <<'EOF'
# PRODUCTION environment
DATABASE_URL=postgresql://house:pw@127.0.0.1:5432/house?schema=public
NAVER_MAP_CLIENT_ID=old123
COOKIE_SECRET="a b#c" # quoted, with an inline comment
  export LOG_LEVEL=info
EOF
chown "root:$HOUSE_USER" "$ENV_FILE"
chmod 0640 "$ENV_FILE"
before_others="$(others 'NAVER_MAP_CLIENT_ID|NEXT_PUBLIC_NAVER_MAP_KEY_ID')"
before_line="$(grep -n '^NAVER_MAP_CLIENT_ID=' "$ENV_FILE" | cut -d: -f1)"

out="$(keys map abcDEF123456 '')"
assert_eq "map: client id updated" "$(env_get NAVER_MAP_CLIENT_ID)" "abcDEF123456"
assert_eq "map: updated in place (same line)" "$(grep -n '^NAVER_MAP_CLIENT_ID=' "$ENV_FILE" | cut -d: -f1)" "$before_line"
assert_eq "map: browser key created and mirrored" "$(env_get NEXT_PUBLIC_NAVER_MAP_KEY_ID)" "abcDEF123456"
assert_eq "map: Enter keeps the (empty) secret" "$(grep -c '^NAVER_MAP_CLIENT_SECRET=' "$ENV_FILE")" "0"
assert_eq "every other line kept byte for byte" "$(others 'NAVER_MAP_CLIENT_ID|NEXT_PUBLIC_NAVER_MAP_KEY_ID')" "$before_others"
assert_eq "quoted value with inline comment still reads back" "$(env_get COOKIE_SECRET)" "a b#c"
assert_eq ".env stays root:$HOUSE_USER 0640" "$(perms)" "root:$HOUSE_USER 640"
assert_contains "asks to deploy afterwards" "$out" "deploy.sh"
assert_eq "no temp files left in shared/" "$(find "$SHARED_DIR" -name '.env.*' | wc -l)" "0"

snap="$(cat "$ENV_FILE")"
out="$(keys map '"abcDEF999"' 'abc DEF999' 'abc\DEF999' '' '')"
assert_eq "quotes, spaces and backslashes rejected (value unchanged)" "$(cat "$ENV_FILE")" "$snap"
assert_eq "each bad paste is explained" "$(grep -c '공백·따옴표·역슬래시' <<<"$out")" "3"
assert_contains "nothing changed is reported" "$out" "바뀐 값이 없습니다"

out="$(keys kakao 0123456789abcdef0123456789abcdef SecretValue1234567890)"
assert_eq "kakao: id created" "$(env_get KAKAO_CLIENT_ID)" "0123456789abcdef0123456789abcdef"
assert_eq "kakao: secret created" "$(env_get KAKAO_CLIENT_SECRET)" "SecretValue1234567890"
assert_eq "kakao: written double-quoted" "$(grep '^KAKAO_CLIENT_SECRET=' "$ENV_FILE")" 'KAKAO_CLIENT_SECRET="SecretValue1234567890"'
assert_not_contains "secret is never printed" "$out" "SecretValue1234567890"
assert_eq "other services untouched" "$(env_get NAVER_MAP_CLIENT_ID)" "abcDEF123456"

out="$(keys kakao short n '' '')"
assert_eq "format mismatch + 'n' is not saved" "$(env_get KAKAO_CLIENT_ID)" "0123456789abcdef0123456789abcdef"
out="$(keys kakao short y '')"
assert_eq "format mismatch + 'y' is saved" "$(env_get KAKAO_CLIENT_ID)" "short"

# A browser key that drifted from the client id (edited by hand) is repaired on any run.
sed -i 's/^NEXT_PUBLIC_NAVER_MAP_KEY_ID=.*/NEXT_PUBLIC_NAVER_MAP_KEY_ID=stale/' "$ENV_FILE"
out="$(keys vworld '')"
assert_eq "drifted browser map key re-mirrored" "$(env_get NEXT_PUBLIC_NAVER_MAP_KEY_ID)" "abcDEF123456"
assert_eq "only one browser map key line" "$(grep -c '^NEXT_PUBLIC_NAVER_MAP_KEY_ID=' "$ENV_FILE")" "1"
assert_eq "perms kept after every run" "$(perms)" "root:$HOUSE_USER 640"

out="$(HOUSE_ROOT="$HOUSE_ROOT" bash "$sk" </dev/null 2>&1)" && pass "end of input = keep everything (exit 0)" ||
  fail "set-keys.sh fails on end of input" "${out:0:300}"
check_fails "unknown service rejected" bash -c "HOUSE_ROOT='$HOUSE_ROOT' bash '$sk' sms </dev/null"
t_finish
