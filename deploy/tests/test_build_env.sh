#!/usr/bin/env bash
# Web/admin build settings: install.sh adds the missing frontend keys to shared/.env without
# touching existing values; deploy.sh builds with exactly build_env_lines (NEXT_PUBLIC_*,
# MEDIA_ORIGIN, INTERNAL_API_URL, mock mode forced off, no secrets) and rebuilds a same-commit
# release when its fingerprint changed; turbo passes those variables to the build.
source "$(dirname "$0")/lib.sh"
load_common
i="$KIT_DIR/install.sh"
d="$KIT_DIR/deploy.sh"
group="$(id -gn)"
is_root && id "$HOUSE_USER" >/dev/null 2>&1 && group="$HOUSE_USER"

# ─── env_add_missing ───
DOMAIN=suncheonmap.kr
printf '%s\n' '# existing' 'NEXT_PUBLIC_SITE_URL=https://custom.example' '# MEDIA_ORIGIN=http://old' 'NAVER_MAP_CLIENT_ID="mapid42"' >"$ENV_FILE"
printf 'LAST_LINE=no-newline' >>"$ENV_FILE"
orig="$(cat "$ENV_FILE")"
mapfile -t defaults < <(frontend_env_defaults https)
assert_eq "defaults: site URL from the domain" "${defaults[0]}" "NEXT_PUBLIC_SITE_URL=https://suncheonmap.kr"
assert_eq "defaults: MEDIA_ORIGIN is nginx's loopback media origin" "${defaults[1]}" "MEDIA_ORIGIN=http://127.0.0.1:8088"
assert_eq "defaults: browser map key mirrors NAVER_MAP_CLIENT_ID" "${defaults[2]}" "NEXT_PUBLIC_NAVER_MAP_KEY_ID=mapid42"
added="$(env_add_missing "$ENV_FILE" "$group" "${defaults[@]}")"
assert_eq "only missing keys are added (commented-out ones count as missing)" "${added//$'\n'/ }" \
  "MEDIA_ORIGIN NEXT_PUBLIC_NAVER_MAP_KEY_ID NEXT_PUBLIC_NAVER_SITE_VERIFICATION NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION"
assert_eq "existing NEXT_PUBLIC_SITE_URL is not clobbered" "$(env_get NEXT_PUBLIC_SITE_URL)" "https://custom.example"
assert_eq "MEDIA_ORIGIN added" "$(env_get MEDIA_ORIGIN)" "http://127.0.0.1:8088"
assert_eq "original lines kept (last line without newline intact)" "$(head -n 5 "$ENV_FILE")" "$orig"
assert_eq "LAST_LINE still parses" "$(env_get LAST_LINE)" "no-newline"
assert_contains "added block explains the NEXT_PUBLIC_* rebuild" "$(cat "$ENV_FILE")" "inlined into the browser code at build time"
snap="$(cat "$ENV_FILE")"
assert_eq "second run adds nothing" "$(env_add_missing "$ENV_FILE" "$group" "${defaults[@]}")" ""
assert_eq "second run leaves the file identical" "$(cat "$ENV_FILE")" "$snap"
if is_root; then
  assert_eq ".env is root:$group 0640 after adding keys" "$(stat -c '%U:%G %a' "$ENV_FILE")" "root:$group 640"
else
  skip ".env ownership" "needs root"
fi
check_fails "env_add_missing refuses a non KEY=value argument" bash -c "source '$KIT_DIR/lib/common.sh'; env_add_missing '$ENV_FILE' '$group' 'bad line'"

# Fresh install (no .env yet) gets the whole block.
rm -f "$ENV_FILE"
env_add_missing "$ENV_FILE" "$group" "${defaults[@]}" >/dev/null
assert_eq "new file: NEXT_PUBLIC_SITE_URL from the domain" "$(env_get NEXT_PUBLIC_SITE_URL)" "https://suncheonmap.kr"

# install.sh runs it for new AND existing .env files, after the create branch.
ln_create="$(grep -n 'ok ".env 생성' "$i" | head -1 | cut -d: -f1)"
ln_add="$(grep -n 'env_add_missing "\$ENV_FILE" "\$HOUSE_USER"' "$i" | head -1 | cut -d: -f1)"
ln_fi="$(awk -v s="$ln_create" 'NR > s && /^fi$/ { print NR; exit }' "$i")"
[[ -n "$ln_add" && -n "$ln_fi" ]] && ((ln_add > ln_fi)) && pass "install.sh adds frontend keys outside the new/existing .env branches" ||
  fail "install.sh frontend keys only in one branch"
assert_contains "install.sh uses frontend_env_defaults" "$(cat "$i")" 'frontend_env_defaults "$SCHEME"'

# upgrade_env_to_https (install.sh) also switches NEXT_PUBLIC_SITE_URL.
eval "$(awk '/^upgrade_env_to_https\(\) \{/,/^\}/' "$i")"
ADMIN_DOMAIN=admin.suncheonmap.kr
printf '%s\n' PUBLIC_BASE_URL=http://suncheonmap.kr NEXT_PUBLIC_SITE_URL=http://suncheonmap.kr \
  MEDIA_ORIGIN=http://127.0.0.1:8088 >"$ENV_FILE"
upgrade_env_to_https >/dev/null
assert_eq "upgrade to https: NEXT_PUBLIC_SITE_URL" "$(env_get NEXT_PUBLIC_SITE_URL)" "https://suncheonmap.kr"
assert_eq "upgrade to https: loopback MEDIA_ORIGIN untouched" "$(env_get MEDIA_ORIGIN)" "http://127.0.0.1:8088"

# ─── build_env_lines ───
API_PORT=4300 MEDIA_PORT=8099 TLS_ENABLED=true
cat >"$ENV_FILE" <<'EOF'
COOKIE_SECRET=s3cret-value
DATABASE_URL=postgresql://u:pw@127.0.0.1/db
NEXT_PUBLIC_SITE_URL=https://suncheonmap.kr/
NEXT_PUBLIC_NAVER_MAP_KEY_ID="abc123"
NEXT_PUBLIC_API_MOCK=1
export NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION=g-token # inline comment
NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION=g-token
EOF
out="$(build_env_lines 2>/dev/null)"
assert_contains "NODE_ENV=production" "$out" "NODE_ENV=production"
assert_contains "NEXT_PUBLIC_* from .env (quotes stripped)" "$out" "NEXT_PUBLIC_NAVER_MAP_KEY_ID=abc123"
assert_contains "export-prefixed key with comment" "$out" "NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION=g-token"
assert_eq "duplicate keys passed once" "$(grep -c '^NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION=' <<<"$out")" "1"
assert_contains "site URL without trailing slash" "$out" "NEXT_PUBLIC_SITE_URL=https://suncheonmap.kr"$'\n'
assert_contains "mock mode forced off in production builds" "$out" "NEXT_PUBLIC_API_MOCK="$'\n'
assert_not_contains "mock mode from .env ignored" "$out" "NEXT_PUBLIC_API_MOCK=1"
assert_contains "MEDIA_ORIGIN defaults to the loopback media origin" "$out" "MEDIA_ORIGIN=http://127.0.0.1:8099"
assert_contains "INTERNAL_API_URL uses API_PORT" "$out" "INTERNAL_API_URL=http://127.0.0.1:4300"
assert_not_contains "no secrets in the build env" "$out" "s3cret"
assert_not_contains "no DATABASE_URL in the build env" "$out" "DATABASE_URL"
fp1="$(build_env_lines 2>/dev/null | build_env_fingerprint)"
fp_rev="$(build_env_lines 2>/dev/null | tac | build_env_fingerprint)"
assert_eq "fingerprint ignores line order" "$fp_rev" "$fp1"
sed -i 's/^COOKIE_SECRET=.*/COOKIE_SECRET=rotated/' "$ENV_FILE"
assert_eq "fingerprint unchanged by runtime-only keys" "$(build_env_lines 2>/dev/null | build_env_fingerprint)" "$fp1"
sed -i 's/^NEXT_PUBLIC_NAVER_MAP_KEY_ID=.*/NEXT_PUBLIC_NAVER_MAP_KEY_ID=new456/' "$ENV_FILE"
fp2="$(build_env_lines 2>/dev/null | build_env_fingerprint)"
[[ "$fp2" != "$fp1" ]] && pass "fingerprint changes with a NEXT_PUBLIC_* value" || fail "fingerprint ignores NEXT_PUBLIC_* changes"
printf 'MEDIA_ORIGIN=http://media.internal:9000/\n' >>"$ENV_FILE"
assert_contains "MEDIA_ORIGIN from .env wins" "$(build_env_lines 2>/dev/null)" "MEDIA_ORIGIN=http://media.internal:9000"$'\n'

printf 'COOKIE_SECRET=x\n' >"$ENV_FILE"
DOMAIN=suncheonmap.kr TLS_ENABLED=false
warn_out="$(build_env_lines 2>&1 >/dev/null)"
assert_contains "missing NEXT_PUBLIC_SITE_URL falls back to the domain" "$(build_env_lines 2>/dev/null)" "NEXT_PUBLIC_SITE_URL=http://suncheonmap.kr"
assert_contains "and says how to fix it" "$warn_out" "install.sh"

# ─── deploy.sh wiring ───
assert_contains "deploy.sh builds with build_env_lines" "$(cat "$d")" 'mapfile -t BUILD_ENV < <(build_env_lines)'
assert_contains "deploy.sh passes BUILD_ENV to turbo" "$(cat "$d")" 'env "${BUILD_ENV[@]}" pnpm exec turbo run build'
branch_cond="$(awk '/^SAME_COMMIT=false$/,/^if \$SAME_COMMIT; then$/' "$d")"
assert_contains "same commit + changed build settings → rebuild" "$branch_cond" 'BUILD_ENV.sha256" 2>/dev/null)" != "$BUILD_FP"'
fp_set="$(grep -n '^BUILD_FP=' "$d" | cut -d: -f1)"
same="$(grep -n '^if \$SAME_COMMIT; then$' "$d" | cut -d: -f1)"
((fp_set < same)) && pass "fingerprint computed before the same-commit decision" || fail "fingerprint computed too late"
w="$(grep -n 'printf .%s\\n. "\$BUILD_FP" >"\$RELEASE/BUILD_ENV.sha256"' "$d" | cut -d: -f1)"
b="$(grep -n 'pnpm exec turbo run build' "$d" | tail -1 | cut -d: -f1)"
[[ -n "$w" && -n "$b" ]] && ((w > b)) && pass "fingerprint stored only after a successful build" || fail "BUILD_ENV.sha256 not written after the build"

# turbo strict env mode drops undeclared variables: the build task must declare them.
turbo_env="$(node -e 'console.log((require(process.argv[1]).tasks.build.env || []).join(" "))' "$REPO_DIR/turbo.json")"
for k in MEDIA_ORIGIN INTERNAL_API_URL 'NEXT_PUBLIC_*'; do
  [[ " $turbo_env " == *" $k "* ]] && pass "turbo build env declares $k" || fail "turbo.json build env lacks $k" "$turbo_env"
done
t_finish
