#!/usr/bin/env bash
# deploy.conf is parsed (never sourced), validated per key, and written only with safe values.
source "$(dirname "$0")/lib.sh"
load_common

conf() { printf '%s\n' "$@" >"$DEPLOY_CONF"; }
load_and_print() ( load_conf && printf '%s|' "$@" && for k in "$@"; do printf '%s|' "${!k}"; done )
load_ok() ( load_conf )

conf 'BACKUP_NOTIFY_URL=https://hc-ping.com/abc-123?rid=1&x=2' 'RCLONE_REMOTE=b2:my backups' 'API_PORT=4100'
out="$( load_conf; printf '%s\n%s\n%s' "$BACKUP_NOTIFY_URL" "$RCLONE_REMOTE" "$API_PORT" )"
assert_eq "URL with ?&= and remote with a space survive parsing" "$out" $'https://hc-ping.com/abc-123?rid=1&x=2\nb2:my backups\n4100'

marker="$T_TMP/pwned"
conf "RCLONE_REMOTE=x; touch $marker" "BACKUP_NOTIFY_URL=\$(touch $marker)"
check_fails "shell metacharacters are rejected, not executed" load_ok
[[ ! -e "$marker" ]] && pass "no command ran while reading deploy.conf" || fail "command ran while reading deploy.conf"

conf 'API_PORT=4000' 'PATH=/tmp/evil'
check_fails "unknown keys are rejected" load_ok
conf 'API_PORT=40a0'
check_fails "non-numeric port rejected" load_ok
conf 'API_PORT=70000'
check_fails "out-of-range port rejected" load_ok
conf 'UPLOAD_ROOT=relative/path'
check_fails "relative path rejected" load_ok
conf 'UPLOAD_ROOT=/var/lib/a|b'
check_fails "path with | rejected (sed delimiter in nginx rendering)" load_ok
conf 'LOG_DIR=/var/log/../../etc'
check_fails "path with .. rejected" load_ok
conf 'BACKUP_NOTIFY_URL=http://insecure.example.com/x'
check_fails "non-https notify URL rejected" load_ok
conf 'TLS_ENABLED=yes'
check_fails "boolean must be true/false" load_ok
conf 'echo hi'
check_fails "non KEY=value line rejected" load_ok

conf '# comment' '' '  API_INSTANCES="3"  ' "WEB_INSTANCES='4' # inline" 'BRANCH=main # note'
out="$( load_conf; printf '%s %s %s' "$API_INSTANCES" "$WEB_INSTANCES" "$BRANCH" )"
assert_eq "comments, quotes and inline comments" "$out" "3 4 main"

# conf_render → load_conf round trip with every key.
out="$(
  REPO_URL=git@github.com:o/r.git BRANCH=release/1.2 DOMAIN=example.com ADMIN_DOMAIN=admin.example.com
  BACKUP_NOTIFY_URL='https://hc-ping.com/u?a=1&b=2' RCLONE_REMOTE='offsite-crypt:house backups'
  conf_render >"$DEPLOY_CONF"
  REPO_URL="" BACKUP_NOTIFY_URL="" RCLONE_REMOTE="" BRANCH=""
  load_conf
  printf '%s|%s|%s|%s' "$REPO_URL" "$BRANCH" "$BACKUP_NOTIFY_URL" "$RCLONE_REMOTE"
)"
assert_eq "conf_render output parses back to the same values" "$out" \
  "git@github.com:o/r.git|release/1.2|https://hc-ping.com/u?a=1&b=2|offsite-crypt:house backups"
check_fails "conf_render refuses an unsafe value" bash -c "source '$KIT_DIR/lib/common.sh'; RCLONE_REMOTE='a:\$(id)'; conf_render"

# ecosystem.config.cjs reads the same file (ports/instances/log dir).
conf 'API_PORT=4300' 'WEB_INSTANCES=1' 'ADMIN_INSTANCES=1' 'LOG_DIR=/var/log/house'
eco="$(HOUSE_ROOT="$HOUSE_ROOT" node -e '
  const e = require(process.argv[1]);
  const by = Object.fromEntries(e.apps.map((a) => [a.name, a]));
  console.log([by["house-api"].env.PORT, by["house-web"].exec_mode, by["house-web"].instances,
    by["house-admin"].exec_mode, by["house-admin"].instances].join(" "));
' "$REPO_DIR/ecosystem.config.cjs")"
assert_eq "ecosystem: web/admin stay in cluster mode with 1 instance" "$eco" "4300 cluster 1 cluster 1"

! grep -nE '(^|[^_])source[[:space:]]+"?\$DEPLOY_CONF|\.[[:space:]]+"?\$DEPLOY_CONF' "$KIT_DIR"/*.sh "$KIT_DIR"/lib/common.sh >/dev/null &&
  pass "no script sources deploy.conf" || fail "a script still sources deploy.conf"
t_finish
