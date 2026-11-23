#!/usr/bin/env bash
# ecosystem.config.cjs (OPS-06): a key deleted from shared/.env must really be unset after
# `pm2 startOrReload --update-env`, which merges the new env into the old one.
source "$(dirname "$0")/lib.sh"
load_common
eco="$REPO_DIR/ecosystem.config.cjs"

printf 'DATABASE_URL=postgresql://x@h/d\nGOOGLE_CLIENT_ID=abc\n' >"$ENV_FILE"
api_env() { HOUSE_ROOT="$HOUSE_ROOT" node -e 'const e = require(process.argv[1]).apps.find((a) => a.name === process.argv[2]).env; console.log(JSON.stringify(e))' "$eco" "$1"; }
j="$(api_env house-api)"
key() { node -e 'const e = JSON.parse(process.argv[1]); const v = e[process.argv[2]]; console.log(v === undefined ? "<undefined>" : JSON.stringify(v))' "$j" "$1"; }
assert_eq "present key keeps its value" "$(key GOOGLE_CLIENT_ID)" '"abc"'
assert_eq "documented key missing from .env is passed as ''" "$(key ADMIN_IP_ALLOWLIST)" '""'
assert_eq "commented-out documented key (# COOKIE_DOMAIN=) also blanked" "$(key COOKIE_DOMAIN)" '""'
assert_eq "NODE_ENV still forced" "$(key NODE_ENV)" '"production"'
assert_eq "JOBS_ENABLED still forced for the API" "$(key JOBS_ENABLED)" '"false"'
j="$(api_env house-worker)"
assert_eq "worker gets the blanks too" "$(key GOOGLE_CLIENT_SECRET)" '""'
assert_eq "worker JOBS_ENABLED forced" "$(key JOBS_ENABLED)" '"true"'

# Every variable the API reads must be documented, or deleting it from .env would not unset it.
schema="$REPO_DIR/apps/api/src/config/env.schema.ts"
missing=""
while IFS= read -r k; do
  case "$k" in NODE_ENV | HOST | PORT | JOBS_ENABLED) continue ;; esac # set by the ecosystem itself
  grep -qE "^[[:space:]]*#?[[:space:]]*$k=" "$REPO_DIR/apps/api/.env.example" || missing+=" $k"
done < <(sed -n '/^export const envSchema = z/,/^  })/p' "$schema" | grep -oE '^    [A-Z][A-Z0-9_]+:' | tr -d ' :')
assert_eq "every envSchema key is in apps/api/.env.example" "${missing:-none}" "none"

# ─── real PM2 (isolated daemon) ───
if ! have_cmd pm2 || ! have_cmd curl; then
  skip "pm2 reload drops a deleted key" "pm2/curl not installed"
  t_finish
  exit $?
fi
REL="$RELEASES_DIR/20260101000000-aaaaaaa"
mkdir -p "$REL/apps/api/dist"
cp "$eco" "$REL/"
printf 'GOOGLE_CLIENT_ID=\n# COOKIE_DOMAIN=\n' >"$REL/apps/api/.env.example"
cat >"$REL/apps/api/dist/main.js" <<'JS'
const pick = (k) => (k in process.env ? process.env[k] : null);
require('node:http')
  .createServer((_, res) => res.end(JSON.stringify({ g: pick('GOOGLE_CLIENT_ID'), u: pick('UNDOCUMENTED_KEY') })))
  .listen(Number(process.env.PORT), '127.0.0.1');
JS
ln -s "$REL" "$CURRENT_LINK"
PORT_T=14610
printf 'API_PORT=%s\nAPI_INSTANCES=1\nLOG_DIR=%s\n' "$PORT_T" "$T_TMP/log" >"$DEPLOY_CONF"
export PM2_HOME="$T_TMP/pm2"
t_on_exit "PM2_HOME='$PM2_HOME' pm2 kill >/dev/null 2>&1"
p2() { HOUSE_ROOT="$HOUSE_ROOT" PM2_HOME="$PM2_HOME" pm2 "$@" >/dev/null 2>&1; }
probe() {
  local i out
  for i in $(seq 40); do
    out="$(curl -fs --noproxy '*' --max-time 2 "http://127.0.0.1:$PORT_T/")" && [[ "$out" == "$1" ]] && { echo "$out"; return; }
    sleep 0.25
  done
  echo "${out:-<no answer>}"
}
printf 'GOOGLE_CLIENT_ID=abc\nUNDOCUMENTED_KEY=x\n' >"$ENV_FILE"
p2 startOrReload "$CURRENT_LINK/ecosystem.config.cjs" --only house-api --update-env
assert_eq "pm2 serves the initial env" "$(probe '{"g":"abc","u":"x"}')" '{"g":"abc","u":"x"}'
: >"$ENV_FILE" # both lines deleted
p2 startOrReload "$CURRENT_LINK/ecosystem.config.cjs" --only house-api --update-env
got="$(probe '{"g":"","u":"x"}')"
assert_eq "deleted documented key is unset after reload (stale value gone)" "$(node -e 'console.log(JSON.parse(process.argv[1]).g)' "$got" 2>/dev/null)" ""
# Control: PM2 really merges envs (why the blanking is needed); undocumented keys stay stale.
assert_eq "control: undocumented deleted key is still stale" "$(node -e 'console.log(JSON.parse(process.argv[1]).u)' "$got" 2>/dev/null)" "x"
t_finish
