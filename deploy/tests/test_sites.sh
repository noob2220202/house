#!/usr/bin/env bash
# deploy/sites.sh (사무소 홈페이지 HTTPS, run by root every 5 minutes):
#   - the slug rules are those of packages/shared/src/agencies/site.ts (reserved list and limits
#     read from the source; validation compared with the built @house/shared when available)
#   - every slug read from the database is re-validated before it reaches nginx, certbot or SQL
#   - the per-office server file (certificate paths, shared snippets, IPv6 rule)
#   - the assigned-site SQL against PostgreSQL (ACTIVE / SUSPENDED kept, servable rule +
#     subscription gate marks the live ones; column names checked against the real schema when a
#     migrated database is reachable)
#   - a whole run with stub certbot / nginx / DB: issuance, pacing, the weekly budget, retry
#     backoff, a busy certbot (no backoff), nginx -t rollback (a restored file still serves),
#     kept (suspended / gated) slugs, stale files, https_ready_at set and clear, a release without
#     office sites, --staging, and the TLS_ENABLED=false / HTTP-mode no-ops
#   - install.sh wiring (kit, timer, cron fallback, nginx snippets)
source "$(dirname "$0")/lib.sh"
# common.sh pins PATH to the server's directories; keep the developer's node/psql reachable too.
DEV_PATH="$PATH"
load_common
# shellcheck source=../sites.sh
source "$KIT_DIR/sites.sh"
PATH="$PATH:$DEV_PATH"
# Git Bash on Windows would rewrite openssl's "/CN=..." argument as a path.
export MSYS2_ARG_CONV_EXCL="${MSYS2_ARG_CONV_EXCL:+$MSYS2_ARG_CONV_EXCL;}/CN=;/O="
DOMAIN=example.com ADMIN_DOMAIN=admin.example.com

# ─── slug rules = packages/shared ───
TS="$REPO_DIR/packages/shared/src/agencies/site.ts"
ts_words="$(awk '/RESERVED_SITE_SLUGS: ReadonlySet<string> = new Set\(\[/ { f = 1; next } f && /^\]\);/ { f = 0 } f' "$TS" |
  tr -d "\r\t ',\"" | sed '/^$/d' | paste -sd' ' -)"
# shellcheck disable=SC2086 # word list
sh_words="$(printf '%s\n' $SITE_RESERVED_SLUGS | paste -sd' ' -)"
[[ -n "$ts_words" ]] && pass "read RESERVED_SITE_SLUGS from site.ts ($(wc -w <<<"$ts_words") words)" || fail "could not read RESERVED_SITE_SLUGS from $TS"
assert_eq "sites.sh reserved list = RESERVED_SITE_SLUGS (same words, same order)" "$sh_words" "$ts_words"
assert_eq "minimum length = SITE_SLUG_MIN_LENGTH" "$(sed -n 's/^export const SITE_SLUG_MIN_LENGTH = \([0-9]*\);.*/\1/p' "$TS" | tr -d '\r')" "$SITE_SLUG_MIN"
assert_eq "maximum length = SITE_SLUG_MAX_LENGTH" "$(sed -n 's/^export const SITE_SLUG_MAX_LENGTH = \([0-9]*\);.*/\1/p' "$TS" | tr -d '\r')" "$SITE_SLUG_MAX"
grep -qF 'export const SITE_SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;' "$TS" && grep -qF "slug.includes('--')" "$TS" &&
  pass "site.ts still uses the pattern + no-'--' rule sites.sh implements" || fail "site.ts slug pattern changed: update site_slug_problem in deploy/sites.sh"

problem() { site_slug_problem "$1" || true; }
a30="$(printf 'a%.0s' {1..30})"
for s in abc a1b abc-def 0office my-office-2 "$a30" ABC " abc " $'abc\n' Office-1; do
  assert_eq "valid: ${s@Q}" "$(problem "$s")" ""
done
for s in "" ab a "${a30}a" -abc abc- a--b xn--abc ab_c a.b "a b" 한글사무소 "abc;rm" '$(id)' 'abc|t' a/b '*' 'é-abc'; do
  assert_eq "invalid: ${s@Q}" "$(problem "$s")" "INVALID"
done
for s in www admin WWW " admin" api suncheonmap house null undefined; do
  assert_eq "reserved: ${s@Q}" "$(problem "$s")" "RESERVED"
done

# The same cases through the real siteSlugProblem (packages/shared, built to dist).
SHARED_SITE_JS="$REPO_DIR/packages/shared/dist/agencies/site.js"
cases=(abc a1b abc-def 0office my-office-2 "$a30" "${a30}a" ABC " abc " $'abc\n' $'\tabc' Office-1 "" ab a -abc abc- a--b
  xn--abc ab_c a.b "a b" 한글사무소 "abc;rm" '$(id)' 'abc|t' a/b '*' www admin WWW " admin" api suncheonmap house null
  undefined 'abc-' '1-2-3' '9' '999' 'a-b-c-d-e-f-g-h-i-j-k-l-m-n-o' 'www1' 'www3')
if have_cmd node && [[ -f "$SHARED_SITE_JS" ]]; then
  want="$(printf '%s\0' "${cases[@]}" | node -e '
    const { siteSlugProblem } = require(process.argv[1]);
    let b = "";
    process.stdin.on("data", (d) => (b += d)).on("end", () => {
      const xs = b.split("\0");
      xs.pop();
      console.log(xs.map((x) => siteSlugProblem(x) ?? "OK").join("\n"));
    });
  ' "$SHARED_SITE_JS" | tr -d '\r')"
  got="$(for s in "${cases[@]}"; do p="$(problem "$s")"; printf '%s\n' "${p:-OK}"; done)"
  assert_eq "site_slug_problem = @house/shared siteSlugProblem on ${#cases[@]} cases" "$got" "$want"
else
  skip "comparison with @house/shared" "needs node and packages/shared/dist (pnpm --filter @house/shared build)"
fi

# Database values must already be canonical; nothing else reaches nginx/certbot/SQL.
check "servable: canonical slug" site_slug_servable my-office-2
for s in ABC " abc" "abc " $'abc\n' Office; do check_fails "servable refuses non-canonical ${s@Q}" site_slug_servable "$s"; done
for s in www admin 'abc;rm' '$(id)' "abc'--" 'abc|t' a/b ../etc '*' abc.def xn--80ak6aa92e ""; do
  check_fails "servable refuses ${s@Q}" site_slug_servable "$s"
done
assert_eq "refusal reason is printed" "$(site_slug_servable ABC || true)" "NOT_CANONICAL"
ADMIN_DOMAIN=backoffice.example.com
assert_eq "the admin host's own label is refused" "$(site_slug_servable backoffice || true)" "ADMIN_HOST"
ADMIN_DOMAIN=admin.example.com

# ─── server file ───
SITES_TEMPLATE="$KIT_DIR/nginx/house-site.conf.template"
conf6="$(site_server_conf my-office true)"
conf4="$(site_server_conf my-office false)"
assert_contains "server_name is the office host" "$conf6" "server_name my-office.example.com;"
assert_contains "own certificate" "$conf6" "ssl_certificate /etc/letsencrypt/live/house-site-my-office/fullchain.pem;"
assert_contains "own key" "$conf6" "ssl_certificate_key /etc/letsencrypt/live/house-site-my-office/privkey.pem;"
for inc in house-tls-params.conf house-server-common.conf house-web-locations.conf; do
  assert_contains "includes $inc" "$conf6" "include /etc/nginx/snippets/$inc;"
done
assert_not_contains "never the main certificate's snippet" "$conf6" "house-tls.conf"
assert_contains "IPv6 listen with IPv6" "$conf6" "listen [::]:443 ssl http2;"
assert_not_contains "no [::] listen without IPv6" "$conf4" "listen [::]"
assert_contains "IPv4 listen without IPv6" "$conf4" "listen 443 ssl http2;"
assert_not_contains "no placeholder left" "$conf6" "{{"
check_fails "missing template is an error" bash -c "$(declare -f site_server_conf warn); SITES_TEMPLATE=/nonexistent; site_server_conf x true"

# ─── SQL helpers ───
assert_eq "SQL list of validated slugs" "$(sites_sql_list a-b c1)" "'a-b','c1'"
assert_contains "set-ready SQL" "$(sites_set_ready_sql a b)" "SET https_ready_at = now() WHERE https_ready_at IS NULL AND status IN ('ACTIVE', 'SUSPENDED') AND slug IN ('a','b')"
assert_contains "clear-ready SQL" "$(sites_clear_ready_sql a)" "SET https_ready_at = NULL WHERE https_ready_at IS NOT NULL AND slug IN ('a')"
[[ -d "$REPO_DIR/$SITES_WEB_ROUTE" ]] && pass "the web app's office-site route is where sites_release_ok looks ($SITES_WEB_ROUTE)" ||
  fail "$SITES_WEB_ROUTE moved: update SITES_WEB_ROUTE in deploy/sites.sh (otherwise every office server is taken down)"

if pg_available; then
  # A throw-away schema (cheaper than a database: no checkpoint on DROP), found through
  # search_path; sites_db reaches it through DATABASE_URL + libpq's PGOPTIONS.
  DB=postgres SCHEMA="hdt_sites_$$"
  t_on_exit "PGOPTIONS= tpsql -d postgres -c 'DROP SCHEMA IF EXISTS $SCHEMA CASCADE' >/dev/null 2>&1"
  export PGOPTIONS="-c search_path=$SCHEMA"
  tpsql -d "$DB" -c "CREATE SCHEMA $SCHEMA" >/dev/null
  printf 'DATABASE_URL=postgresql://%s:%s@%s:%s/%s?schema=public\n' "$TEST_PG_USER" "$TEST_PG_PASSWORD" \
    "$TEST_PG_HOST" "$TEST_PG_PORT" "$DB" >"$ENV_FILE"
  # The columns sites.sh reads, as in the Prisma schema (agencies.prisma, admin.prisma).
  tpsql -d "$DB" >/dev/null <<'SQL'
CREATE TYPE agency_status AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED');
CREATE TYPE agency_site_status AS ENUM ('REQUESTED', 'ACTIVE', 'REJECTED', 'SUSPENDED');
CREATE TYPE subscription_product AS ENUM ('SITE', 'PLATFORM');
CREATE TABLE agencies (id int PRIMARY KEY, status agency_status NOT NULL, deleted_at timestamptz);
CREATE TABLE agency_sites (id serial PRIMARY KEY, agency_id int NOT NULL REFERENCES agencies,
  status agency_site_status NOT NULL, slug varchar(30), https_ready_at timestamptz, decided_at timestamptz);
CREATE TABLE agency_subscriptions (id serial PRIMARY KEY, agency_id int NOT NULL, product subscription_product NOT NULL,
  starts_on date NOT NULL, ends_on date, canceled_at timestamptz);
CREATE TABLE site_settings (key varchar(50) PRIMARY KEY, value jsonb NOT NULL);
INSERT INTO agencies (id, status, deleted_at) VALUES
  (1, 'APPROVED', NULL), (2, 'APPROVED', NULL), (3, 'SUSPENDED', NULL), (4, 'APPROVED', now()), (5, 'APPROVED', NULL),
  (6, 'APPROVED', NULL), (7, 'APPROVED', NULL), (8, 'APPROVED', NULL), (9, 'APPROVED', NULL), (10, 'APPROVED', NULL),
  (11, 'APPROVED', NULL), (12, 'APPROVED', NULL), (13, 'PENDING', NULL), (14, 'APPROVED', NULL);
INSERT INTO agency_sites (agency_id, status, slug, https_ready_at, decided_at) VALUES
  (1, 'ACTIVE', 'alpha', now(), '2026-01-02'), (2, 'SUSPENDED', 'beta', NULL, '2026-01-01'),
  (3, 'ACTIVE', 'gamma', NULL, '2026-01-01'), (4, 'ACTIVE', 'delta', NULL, '2026-01-01'),
  (5, 'ACTIVE', NULL, NULL, '2026-01-01'), (6, 'REQUESTED', NULL, NULL, NULL),
  (7, 'ACTIVE', 'zeta', NULL, '2026-01-01'), (8, 'ACTIVE', 'eta', NULL, '2026-01-03'),
  (9, 'ACTIVE', 'theta', NULL, '2026-01-04'), (10, 'ACTIVE', 'iota', NULL, '2026-01-05'),
  (11, 'ACTIVE', 'kappa', NULL, '2026-01-06'), (12, 'ACTIVE', 'lambda', NULL, '2026-01-07'),
  (13, 'ACTIVE', 'mu', NULL, '2026-01-08'), (14, 'REJECTED', 'nu', now(), '2026-01-01');
-- KST days, like the API (packages/shared subscriptionState).
INSERT INTO agency_subscriptions (agency_id, product, starts_on, ends_on, canceled_at) VALUES
  (8, 'SITE', (now() AT TIME ZONE 'Asia/Seoul')::date, NULL, NULL),
  (9, 'SITE', (now() AT TIME ZONE 'Asia/Seoul')::date - 30, (now() AT TIME ZONE 'Asia/Seoul')::date - 1, NULL),
  (10, 'SITE', (now() AT TIME ZONE 'Asia/Seoul')::date - 1, NULL, now()),
  (11, 'PLATFORM', (now() AT TIME ZONE 'Asia/Seoul')::date - 1, NULL, NULL),
  (12, 'SITE', (now() AT TIME ZONE 'Asia/Seoul')::date + 1, NULL, NULL);
SQL
  assigned() { sites_db -c "$(sites_assigned_sql)" | tr -d '\r' | paste -sd' ' -; }
  # Kept, not live: beta (SUSPENDED), gamma (agency SUSPENDED), mu (agency PENDING). Never listed:
  # delta (agency deleted), the rows without a slug, nu (REJECTED).
  gate_off="zeta|f|l alpha|t|l eta|f|l theta|f|l iota|f|l kappa|f|l lambda|f|l beta|f|k gamma|f|k mu|f|k"
  assert_eq "gate off (no FEATURES row): live = ACTIVE + APPROVED + not deleted first, then the kept; oldest approval first" \
    "$(assigned)" "$gate_off"
  tpsql -d "$DB" -c "INSERT INTO site_settings VALUES ('FEATURES', '{\"dealRequests\": true, \"siteSubscriptionRequired\": false}')" >/dev/null
  assert_eq "gate off (siteSubscriptionRequired false)" "$(assigned)" "$gate_off"
  tpsql -d "$DB" -c "UPDATE site_settings SET value = '{\"siteSubscriptionRequired\": \"true\"}'" >/dev/null
  assert_eq "gate needs JSON true (the API checks === true)" "$(assigned)" "$gate_off"
  tpsql -d "$DB" -c "UPDATE site_settings SET value = '{\"siteSubscriptionRequired\": true}'" >/dev/null
  assert_eq "gate on: live only with a current, not canceled SITE subscription (KST days); the gated ones are kept" \
    "$(assigned)" "eta|f|l beta|f|k gamma|f|k zeta|f|k alpha|t|k theta|f|k iota|f|k kappa|f|k lambda|f|k mu|f|k"
  assert_eq "set-ready marks ACTIVE / SUSPENDED rows without https_ready_at (never REJECTED)" \
    "$(sites_db -c "$(sites_set_ready_sql zeta alpha mu beta nu)" | tr -d '\r' | paste -sd' ' -)" "beta zeta mu"
  assert_eq "clear-ready clears only rows that had it" "$(sites_db -c "$(sites_clear_ready_sql alpha eta)" | tr -d '\r' | paste -sd' ' -)" "alpha"
  assert_eq "clear-all clears every row that had it" "$(sites_db -c "$(sites_clear_all_ready_sql)" | tr -d '\r' | sort | paste -sd' ' -)" "beta mu nu zeta"
  unset PGOPTIONS
  SCHEMA_DB="${TEST_PG_SCHEMA_DB:-house_dev}"
  if [[ "$(tpsql -d "$SCHEMA_DB" -Atc "select to_regclass('public.agency_sites') is not null" 2>/dev/null)" == t ]]; then
    # EXPLAIN only: plans the statements against the migrated schema, runs nothing.
    check "assigned-site SQL fits the migrated schema ($SCHEMA_DB)" tpsql -d "$SCHEMA_DB" -c "EXPLAIN $(sites_assigned_sql)"
    check "set-ready SQL fits the migrated schema" tpsql -d "$SCHEMA_DB" -c "EXPLAIN $(sites_set_ready_sql abc)"
    check "clear-ready SQL fits the migrated schema" tpsql -d "$SCHEMA_DB" -c "EXPLAIN $(sites_clear_ready_sql abc)"
    check "clear-all SQL fits the migrated schema" tpsql -d "$SCHEMA_DB" -c "EXPLAIN $(sites_clear_all_ready_sql)"
  else
    skip "SQL against the migrated schema" "no agency_sites table in $SCHEMA_DB (TEST_PG_SCHEMA_DB)"
  fi
else
  skip "assigned-site SQL" "PostgreSQL not reachable at $TEST_PG_HOST:$TEST_PG_PORT"
fi

# ─── a whole run with stub certbot / nginx / DB ───
if ! have_cmd openssl; then
  skip "sites_main runs" "openssl not installed"
  t_finish
  exit $?
fi
F="$T_TMP/flow"
mkdir -p "$F"
SITES_DIR="$F/sites" SITES_STATE_DIR="$F/state" LE_LIVE_DIR="$F/live" ACME_WEBROOT="$F/www"
NGINX_SITE_CONF="$F/house.conf" TLS_PARAMS_SNIPPET="$F/tls-params.conf"
ROWS="$F/rows" CALLS="$F/calls"
printf '%s\n' "$SITES_INCLUDE_LINE" >"$NGINX_SITE_CONF"
: >"$TLS_PARAMS_SNIPPET"
printf 'DOMAIN=example.com\nADMIN_DOMAIN=admin.example.com\nTLS_ENABLED=true\n' >"$DEPLOY_CONF"
: >"$F/certbot-fail"
: >"$F/certbot-busy"
: >"$F/nginx-bad"

sites_require_root() { :; }
flock() { :; }
has_systemd() { return 1; }
site_dns_ok() { [[ "$1" != nodns.* ]]; }
if ! is_root; then
  # Same contract without chown/owner (the real one installs root-owned files).
  write_if_changed() {
    local dest="$1" mode="$2" tmp
    tmp="$(mktemp)"
    cat >"$tmp"
    if [[ -f "$dest" ]] && cmp -s "$tmp" "$dest"; then
      rm -f "$tmp"
      return 1
    fi
    install -m "$mode" "$tmp" "$dest"
    rm -f "$tmp"
  }
fi
# mkcert <dir> <host> [subject]: a self-signed certificate for <host> where certbot puts one.
mkcert() {
  mkdir -p "$1"
  openssl req -x509 -newkey ec -pkeyopt ec_paramgen_curve:prime256v1 -nodes -days 90 -subj "${3:-/CN=$2}" \
    -keyout "$1/privkey.pem" -out "$1/fullchain.pem" -addext "subjectAltName=DNS:$2" >/dev/null 2>&1
}
certbot() {
  local a prev="" name="" host=""
  for a in "$@"; do
    [[ "$prev" == --cert-name ]] && name="$a"
    [[ "$prev" == -d ]] && host="$a"
    prev="$a"
  done
  printf 'certbot %s %s%s%s\n' "$name" "$host" "$([[ " $* " == *" --staging "* ]] && echo ' staging')" \
    "$([[ " $* " == *" --force-renewal "* ]] && echo ' force')" >>"$CALLS"
  grep -qxF "$host" "$F/certbot-fail" && return 1
  if grep -qxF "$host" "$F/certbot-busy"; then
    echo 'Another instance of Certbot is already running.' >&2
    return 1
  fi
  mkcert "$LE_LIVE_DIR/$name" "$host"
}
nginx() {
  local s
  case "$*" in
    -t)
      while IFS= read -r s; do
        if [[ -n "$s" && -f "$SITES_DIR/$s.conf" ]]; then
          echo "nginx: [emerg] broken $s" >&2
          return 1
        fi
      done <"$F/nginx-bad"
      # A broken template: every file rendered from it fails.
      if grep -qsF '# house-test-broken' "$SITES_DIR"/*.conf; then
        echo "nginx: [emerg] broken template" >&2
        return 1
      fi
      ;;
    "-s reload") echo reload >>"$CALLS" ;;
    *) return 1 ;;
  esac
}
# DB stub: the rows file is the table ("slug|t/f|l/k"); the UPDATEs flip the flags like the real
# SQL (without a slug list: every row).
sites_db() {
  local sql="${*: -1}" s out="" list
  case "$sql" in
    *to_regclass*) echo t ;;
    *"SELECT s.slug"*) cat "$ROWS" ;;
    *"SET https_ready_at = now()"* | *"SET https_ready_at = NULL"*)
      local from=f to=t verb=set
      [[ "$sql" == *"= NULL"* ]] && from=t to=f verb=clear
      if [[ "$sql" == *" IN ("* ]]; then
        list="$(sed -n "s/.* slug IN (\(.*\)) RETURNING.*/\1/p" <<<"$sql" | tr -d "'" | tr ',' ' ')"
      else
        verb="clear-all"
        list="$(cut -d'|' -f1 "$ROWS")"
      fi
      for s in $list; do
        if grep -q "^$s|$from|" "$ROWS"; then
          sed -i "s/^$s|$from|/$s|$to|/" "$ROWS"
          out+="$s"$'\n'
        fi
      done
      printf 'db %s %s\n' "$verb" "$(paste -sd' ' - <<<"${out%$'\n'}")" >>"$CALLS"
      printf '%s' "$out"
      ;;
  esac
}
# shellcheck disable=SC2120,SC2119 # options arrive through check (run --staging)
run() {
  : >"$CALLS"
  local rc=0
  (sites_main "$@") >"$F/out" 2>&1 || rc=$?
  return "$rc"
}
calls() { grep "^$1" "$CALLS" | sort | paste -sd';' -; }
files() { (cd "$SITES_DIR" 2>/dev/null && ls -1 -- *.conf 2>/dev/null) | paste -sd' ' -; }
row() { grep "^$1|" "$ROWS" | cut -d'|' -f1,2; }
ipv6=false
[[ -f /proc/net/if_inet6 ]] && ipv6=true

printf '%s\n' 'hanbit|f|l' 'dasom|f|l' 'ABC|f|l' 'www|f|l' 'evil|t|f' 'evil2|t' 'nodns|f|l' 'gamma|t|l' >"$ROWS"
echo gamma.example.com >"$F/certbot-fail"
check_fails "run 1 reports the failed issuance (exit 1)" run
assert_eq "run 1: certbot only for valid, resolvable slugs" "$(calls certbot)" \
  "certbot house-site-dasom dasom.example.com;certbot house-site-gamma gamma.example.com;certbot house-site-hanbit hanbit.example.com"
assert_eq "run 1: a server file per certified slug" "$(files)" "dasom.conf hanbit.conf"
assert_eq "run 1: server file = site_server_conf" "$(cat "$SITES_DIR/hanbit.conf")" "$(site_server_conf hanbit "$ipv6")"
assert_eq "run 1: one reload" "$(calls reload)" "reload"
assert_eq "run 1: https_ready_at set for the new HTTPS sites" "$(calls 'db set')" "db set hanbit dasom"
assert_eq "run 1: https_ready_at cleared for a live slug without HTTPS" "$(calls 'db clear')" "db clear gamma"
assert_eq "run 1: rows now" "$(row hanbit) $(row dasom) $(row gamma)" "hanbit|t dasom|t gamma|f"
out="$(cat "$F/out")"
assert_contains "run 1: non-canonical slug refused" "$out" "NOT_CANONICAL"
assert_contains "run 1: reserved slug refused" "$out" "RESERVED"
assert_contains "run 1: malformed row refused" "$out" "형식이 맞지 않는 행"
assert_contains "run 1: missing DNS is reported" "$out" "nodns.example.com 를 DNS 에서 찾을 수 없습니다"
[[ ! -e "$SITES_DIR/ABC.conf" && ! -e "$SITES_DIR/www.conf" && ! -e "$SITES_DIR/evil.conf" ]] &&
  pass "run 1: nothing written for refused slugs" || fail "a refused slug got a server file"
[[ -f "$SITES_STATE_DIR/failed/gamma" ]] && pass "run 1: failure marker for gamma" || fail "no failure marker"
assert_eq "run 1: issuance log counts the two new certificates" "$(sites_issued_this_week)" "2"

check "run 2 (nothing new) succeeds" run
assert_eq "run 2: no certbot (certificates valid, gamma in backoff, nodns unresolved)" "$(calls certbot)" ""
assert_eq "run 2: no reload when nothing changed" "$(calls reload)" ""
assert_eq "run 2: no DB writes" "$(calls db)" ""
assert_contains "run 2: backoff is logged" "$(cat "$F/out")" "gamma.example.com: 최근 발급 실패"

touch -d '2 hours ago' "$SITES_STATE_DIR/failed/gamma"
: >"$F/certbot-fail"
check "run 3 (gamma retried after the backoff) succeeds" run
assert_eq "run 3: gamma issued" "$(calls certbot)" "certbot house-site-gamma gamma.example.com"
assert_eq "run 3: gamma served" "$(files)" "dasom.conf gamma.conf hanbit.conf"
assert_eq "run 3: gamma marked ready" "$(row gamma)" "gamma|t"
[[ ! -e "$SITES_STATE_DIR/failed/gamma" ]] && pass "run 3: failure marker removed" || fail "failure marker kept"

# Suspended / gated (kept): the server stays, so resuming needs no new run; nothing new is issued
# for a kept slug, and one whose certificate is gone loses https_ready_at.
sed -i 's/^dasom|t|l$/dasom|t|k/' "$ROWS"
printf '%s\n' 'kept1|f|k' 'kept2|t|k' >>"$ROWS"
check "run 4 (dasom suspended, two kept slugs without certificates) succeeds" run
assert_eq "run 4: dasom's server file kept" "$(files)" "dasom.conf gamma.conf hanbit.conf"
assert_eq "run 4: no certbot for kept slugs" "$(calls certbot)" ""
assert_eq "run 4: no reload" "$(calls reload)" ""
assert_eq "run 4: dasom keeps https_ready_at; a kept slug without a server loses it" "$(calls db)" "db clear kept2"
assert_eq "run 4: rows now" "$(row dasom) $(row kept1) $(row kept2)" "dasom|t kept1|f kept2|f"
sed -i 's/^dasom|t|k$/dasom|t|l/' "$ROWS"
check "run 4b (dasom resumed) succeeds" run
assert_eq "run 4b: nothing to do on resume" "$(cat "$CALLS")" ""
sed -i '/^dasom|/d;/^kept[12]|/d' "$ROWS"
check "run 4c (dasom's slug no longer assigned) succeeds" run
assert_eq "run 4c: dasom's server file removed" "$(files)" "gamma.conf hanbit.conf"
assert_eq "run 4c: reloaded" "$(calls reload)" "reload"
[[ -s "$LE_LIVE_DIR/house-site-dasom/fullchain.pem" ]] && pass "run 4c: dasom's certificate is kept" || fail "certificate removed"
echo 'stray' >"$SITES_DIR/stray.conf"
run >/dev/null
assert_eq "a file for no assigned slug is removed" "$(files)" "gamma.conf hanbit.conf"

printf '%s\n' 'dong1|f|l' 'dong2|f|l' >>"$ROWS"
SITES_MAX_NEW_CERTS=1
check "run 5 (pacing: 1 per run) succeeds" run
assert_eq "run 5: one new certificate" "$(calls certbot)" "certbot house-site-dong1 dong1.example.com"
assert_contains "run 5: the rest waits for the next run" "$(cat "$F/out")" "인증서 1건은 발급 한도"
SITES_MAX_NEW_CERTS=10
now="$(date +%s)"
for _ in $(seq 40); do echo "$now x" >>"$(sites_issued_log)"; done
echo "$((now - 9 * 86400)) old" >>"$(sites_issued_log)"
check "run 6 (weekly budget used up) succeeds" run
assert_eq "run 6: no certificate over the weekly budget" "$(calls certbot)" ""
assert_contains "run 6: budget reason logged" "$(cat "$F/out")" "주 ${SITES_WEEKLY_CERTS}건"
assert_eq "entries older than 8 days are pruned" "$(grep -c ' old$' "$(sites_issued_log)")" "0"
: >"$(sites_issued_log)"

echo dong2 >"$F/nginx-bad"
printf '%s\n' 'dong3|f|l' >>"$ROWS"
check "run 7 (nginx -t fails for one file) succeeds" run
assert_eq "run 7: the failing file is reverted, the other kept" "$(files)" "dong1.conf dong3.conf gamma.conf hanbit.conf"
assert_contains "run 7: failure logged" "$(cat "$F/out")" "nginx 설정 검사 실패"
assert_eq "run 7: dong2 not marked ready" "$(row dong2)" "dong2|f"
assert_eq "run 7: dong3 marked ready" "$(row dong3)" "dong3|t"
: >"$F/nginx-bad"

# A template change that nginx refuses: each file is put back and keeps serving, so no link goes.
before="$(cat "$SITES_DIR/hanbit.conf")"
good_template="$SITES_TEMPLATE"
{ cat "$good_template"; echo '# house-test-broken'; } >"$F/broken.template"
SITES_TEMPLATE="$F/broken.template"
check "run 7b (template refused by nginx -t) succeeds" run
SITES_TEMPLATE="$good_template"
assert_eq "run 7b: the previous file is restored" "$(cat "$SITES_DIR/hanbit.conf")" "$before"
assert_eq "run 7b: files unchanged" "$(files)" "dong1.conf dong3.conf gamma.conf hanbit.conf"
assert_eq "run 7b: https_ready_at not cleared for restored servers" "$(calls db)" ""
assert_eq "run 7b: rows keep https_ready_at" "$(row hanbit) $(row gamma) $(row dong1)" "hanbit|t gamma|t dong1|t"
assert_contains "run 7b: failure logged" "$(cat "$F/out")" "nginx 설정 검사 실패"

# certbot.timer holding certbot's lock: not a failed validation (no backoff, exit 0), the rest waits.
: >"$(sites_issued_log)"
printf '%s\n' 'busy1|f|l' 'busy2|f|l' >>"$ROWS"
echo busy1.example.com >"$F/certbot-busy"
check "run 7c (another certbot running) succeeds" run
assert_eq "run 7c: one attempt, the next slug waits" "$(calls certbot)" "certbot house-site-busy1 busy1.example.com"
assert_contains "run 7c: explained" "$(cat "$F/out")" "다른 certbot(자동 갱신 certbot.timer)이 실행 중입니다"
[[ ! -e "$SITES_STATE_DIR/failed/busy1" ]] && pass "run 7c: no failure marker (no backoff)" || fail "busy certbot left a failure marker"
assert_eq "run 7c: nothing counted as issued" "$(sites_issued_this_week)" "0"
: >"$F/certbot-busy"
check "run 7d (certbot free again) succeeds" run
assert_eq "run 7d: both issued" "$(calls certbot)" "certbot house-site-busy1 busy1.example.com;certbot house-site-busy2 busy2.example.com"
assert_eq "run 7d: both ready" "$(row busy1) $(row busy2)" "busy1|t busy2|t"
: >"$(sites_issued_log)"

printf '%s\n' 'stg1|f|l' >>"$ROWS"
check "run 8 (--staging) succeeds" run --staging
assert_contains "run 8: certbot uses the staging CA" "$(calls certbot)" "certbot house-site-stg1 stg1.example.com staging"
assert_eq "run 8: no DB writes with --staging" "$(calls db)" ""
assert_eq "run 8: stg1 stays not ready" "$(row stg1)" "stg1|f"

printf '%s\n' 'upg1|f|l' >>"$ROWS"
mkcert "$LE_LIVE_DIR/house-site-upg1" upg1.example.com "/O=(STAGING) Let's Encrypt/CN=upg1.example.com"
check "run 9 (staging certificate, real CA) succeeds" run
assert_contains "run 9: staging certificates are replaced (forced)" "$(calls certbot)" "certbot house-site-upg1 upg1.example.com force"
assert_eq "run 9: upg1 ready once replaced" "$(row upg1)" "upg1|t"

mkcert "$LE_LIVE_DIR/house-site-wrong1" other.example.com
printf '%s\n' 'wrong1|f|l' >>"$ROWS"
echo wrong1.example.com >"$F/certbot-fail"
run >/dev/null
[[ ! -e "$SITES_DIR/wrong1.conf" ]] && pass "a certificate for other names gets no server file" || fail "server file with a wrong certificate"
: >"$F/certbot-fail"
sed -i '/^wrong1|/d' "$ROWS"

# A forced rollback to a release without office sites: no office server, every link hidden.
served_before="$(files)"
mkdir -p "$CURRENT_LINK/apps/web/src/app"
check "run 10 (release without office sites) succeeds" run
assert_eq "run 10: every office server removed" "$(files)" ""
assert_eq "run 10: no certificate requested" "$(calls certbot)" ""
assert_eq "run 10: reloaded" "$(calls reload)" "reload"
assert_contains "run 10: every https_ready_at cleared" "$(calls 'db clear-all')" "db clear-all hanbit"
assert_eq "run 10: no row keeps https_ready_at" "$(grep -c '^[^|]*|t|' "$ROWS")" "0"
assert_contains "run 10: explained" "$(cat "$F/out")" "사무소 홈페이지가 없습니다"
mkdir -p "$CURRENT_LINK/$SITES_WEB_ROUTE"
check "run 11 (office sites deployed again) succeeds" run
assert_eq "run 11: servers back from the kept certificates" "$(files)" "$served_before"
assert_eq "run 11: no new certificate needed" "$(calls certbot)" ""
assert_eq "run 11: links back" "$(row hanbit) $(row dong3)" "hanbit|t dong3|t"
rm -rf "$CURRENT_LINK"

printf 'DOMAIN=example.com\nADMIN_DOMAIN=admin.example.com\nTLS_ENABLED=false\n' >"$DEPLOY_CONF"
check "TLS_ENABLED=false: no-op success" run
assert_eq "TLS_ENABLED=false: nothing called" "$(cat "$CALLS")" ""
printf 'DOMAIN=example.com\nADMIN_DOMAIN=admin.example.com\nTLS_ENABLED=true\n' >"$DEPLOY_CONF"
echo '# http template' >"$NGINX_SITE_CONF"
check "HTTP-mode nginx (no sites include): no-op success" run
assert_eq "HTTP mode: nothing called" "$(cat "$CALLS")" ""
assert_contains "HTTP mode: explained" "$(cat "$F/out")" "install.sh --nginx-only"
check "--help prints usage" bash -c "source '$KIT_DIR/sites.sh'; sites_main --help | grep -q 'sites.sh --staging'"
check_fails "unknown option is refused" bash -c "source '$KIT_DIR/sites.sh'; sites_main --bogus"

# ─── install.sh wiring ───
i="$KIT_DIR/install.sh"
grep -q 'for s in deploy rollback status backup restore create-admin db-shell set-keys sites; do' "$i" &&
  pass "install.sh links sites.sh into /srv/house" || fail "sites.sh not linked"
grep -q 'house-server-common.conf house-tls-params.conf; do' "$i" && grep -q '/etc/nginx/house/sites /var/www/letsencrypt' "$i" &&
  pass "configure_nginx installs house-tls-params.conf and the sites directory" || fail "tls params / sites dir not installed"
grep -q '^OnCalendar=\*:0/5$' "$i" && grep -q '^ExecStart=${BIN_DIR}/sites.sh${SITES_FLAGS}$' "$i" &&
  grep -q 'systemctl enable --now house-sites.timer' "$i" && pass "house-sites.timer every 5 minutes" || fail "timer not installed"
grep -q 'SITES_CRON="\*/5 \* \* \* \* root ${BIN_DIR}/sites.sh${SITES_FLAGS} >> /var/log/house-sites.log 2>&1"' "$i" &&
  pass "cron fallback without systemd (root, log outside the service user's directory)" || fail "cron fallback missing"
grep -q 'systemctl disable --now house-sites.timer' "$i" && pass "TLS_ENABLED=false disables the timer" || fail "timer kept with TLS off"
grep -q '\$STAGING && SITES_FLAGS=" --staging"' "$i" && pass "install.sh --staging reaches sites.sh" || fail "--staging not passed on"
t_finish
