#!/usr/bin/env bash
# set-keys.sh: answers fed on stdin. Updates or creates keys in place, keeps every other line,
# leaves shared/.env root:house 0640, rejects quotes/spaces/backslashes, asks for the Kakao map
# JavaScript 키 (NEXT_PUBLIC_KAKAO_MAP_KEY) in the kakao group and leaves retired Naver map lines alone.
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
NEXT_PUBLIC_NAVER_MAP_KEY_ID=old123
COOKIE_SECRET="a b#c" # quoted, with an inline comment
  export LOG_LEVEL=info
EOF
chown "root:$HOUSE_USER" "$ENV_FILE"
chmod 0640 "$ENV_FILE"
before_others="$(others 'NEXT_PUBLIC_KAKAO_MAP_KEY')"

JS_KEY=fedcba9876543210fedcba9876543210
out="$(keys kakao '' '' "$JS_KEY")"
assert_eq "kakao: map JavaScript 키 created" "$(env_get NEXT_PUBLIC_KAKAO_MAP_KEY)" "$JS_KEY"
assert_contains "kakao: the map key prompt says where to find it" "$out" "JavaScript 키"
assert_eq "kakao: Enter keeps the (empty) REST key and secret" "$(grep -cE '^KAKAO_CLIENT_(ID|SECRET)=' "$ENV_FILE")" "0"
assert_eq "every other line kept byte for byte (retired Naver lines too)" "$(others 'NEXT_PUBLIC_KAKAO_MAP_KEY')" "$before_others"
assert_contains "retired Naver map keys are pointed out, not removed" "$out" "NAVER_MAP_CLIENT_ID NEXT_PUBLIC_NAVER_MAP_KEY_ID 는 더 이상 쓰지 않습니다"
assert_eq "no Naver browser map key is (re)written" "$(env_get NEXT_PUBLIC_NAVER_MAP_KEY_ID)" "old123"
before_line="$(grep -n '^NEXT_PUBLIC_KAKAO_MAP_KEY=' "$ENV_FILE" | cut -d: -f1)"
out="$(keys kakao '' '' 0123456789abcdef0123456789abcdef)"
assert_eq "kakao: map key updated in place (same line)" "$(grep -n '^NEXT_PUBLIC_KAKAO_MAP_KEY=' "$ENV_FILE" | cut -d: -f1)" "$before_line"
assert_eq "only one map key line" "$(grep -c '^NEXT_PUBLIC_KAKAO_MAP_KEY=' "$ENV_FILE")" "1"
assert_contains "a NEXT_PUBLIC_* change asks for a rebuild via deploy.sh" "$out" "웹/관리자를 자동으로 다시 빌드"
assert_eq "quoted value with inline comment still reads back" "$(env_get COOKIE_SECRET)" "a b#c"
assert_eq ".env stays root:$HOUSE_USER 0640" "$(perms)" "root:$HOUSE_USER 640"
assert_contains "asks to deploy afterwards" "$out" "deploy.sh"
assert_eq "no temp files left in shared/" "$(find "$SHARED_DIR" -name '.env.*' | wc -l)" "0"

snap="$(cat "$ENV_FILE")"
out="$(keys data '"abcDEF999"' 'abc DEF999' 'abc\DEF999' '')"
assert_eq "quotes, spaces and backslashes rejected (value unchanged)" "$(cat "$ENV_FILE")" "$snap"
assert_eq "each bad paste is explained" "$(grep -c '공백·따옴표·역슬래시' <<<"$out")" "3"
assert_contains "nothing changed is reported" "$out" "바뀐 값이 없습니다"

out="$(keys kakao 0123456789abcdef0123456789abcdef SecretValue1234567890)"
assert_eq "kakao: id created" "$(env_get KAKAO_CLIENT_ID)" "0123456789abcdef0123456789abcdef"
assert_eq "kakao: secret created" "$(env_get KAKAO_CLIENT_SECRET)" "SecretValue1234567890"
assert_eq "kakao: written double-quoted" "$(grep '^KAKAO_CLIENT_SECRET=' "$ENV_FILE")" 'KAKAO_CLIENT_SECRET="SecretValue1234567890"'
assert_not_contains "secret is never printed" "$out" "SecretValue1234567890"
assert_eq "other keys untouched" "$(env_get NEXT_PUBLIC_KAKAO_MAP_KEY)" "0123456789abcdef0123456789abcdef"

out="$(keys kakao short n '' '')"
assert_eq "format mismatch + 'n' is not saved" "$(env_get KAKAO_CLIENT_ID)" "0123456789abcdef0123456789abcdef"
out="$(keys kakao short y '')"
assert_eq "format mismatch + 'y' is saved" "$(env_get KAKAO_CLIENT_ID)" "short"

out="$(keys vworld '')"
assert_eq "perms kept after every run" "$(perms)" "root:$HOUSE_USER 640"

out="$(HOUSE_ROOT="$HOUSE_ROOT" bash "$sk" </dev/null 2>&1)" && pass "end of input = keep everything (exit 0)" ||
  fail "set-keys.sh fails on end of input" "${out:0:300}"
check_fails "unknown service rejected" bash -c "HOUSE_ROOT='$HOUSE_ROOT' bash '$sk' sms </dev/null"
out="$(HOUSE_ROOT="$HOUSE_ROOT" bash "$sk" map </dev/null 2>&1)" && fail "retired 'map' service accepted" ||
  assert_contains "retired 'map' service points to kakao" "$out" "set-keys.sh kakao"
t_finish
