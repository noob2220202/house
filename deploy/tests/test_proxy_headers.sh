#!/usr/bin/env bash
# Static check of the nginx templates (no nginx needed): every proxied location sends the API /
# Next upstreams X-Forwarded-For = $remote_addr and an empty X-House-SSR (house-proxy.conf), and
# nothing overrides either header. The API's throttle exemption for cached SSR reads and its
# "SSR reads never count listing views" rule (docs/CONVENTIONS.md §3) rely on both: only a process
# on the server itself may reach the API from loopback with X-House-SSR and no X-Forwarded-For.
source "$(dirname "$0")/lib.sh"

TPL="$KIT_DIR/nginx"
PROXY="$TPL/snippets/house-proxy.conf"
grep -Eq '^proxy_set_header X-Forwarded-For \$remote_addr;$' "$PROXY" &&
  pass "house-proxy.conf overwrites X-Forwarded-For with \$remote_addr" ||
  fail "house-proxy.conf does not set X-Forwarded-For \$remote_addr"
grep -Eq '^proxy_set_header X-House-SSR "";$' "$PROXY" &&
  pass "house-proxy.conf clears X-House-SSR" || fail "house-proxy.conf does not clear X-House-SSR"

# No other file sets either header (a later proxy_set_header in a location would override it,
# and one at server level would be dropped wherever a location sets its own headers).
others="$(grep -rEil 'proxy_set_header[[:space:]]+(X-Forwarded-For|X-House-SSR)' "$TPL" | grep -v "/house-proxy.conf$" || true)"
assert_eq "no other nginx file sets X-Forwarded-For / X-House-SSR" "$others" ""

# Each location block with proxy_pass must include house-proxy.conf directly (proxy_set_header is
# inherited only when a level defines none of its own, so the include must sit in that block).
unproxied() {
  awk '
    function flush() {
      if (inloc && haspass && !hasproxy) printf "%s:%d %s\n", FILENAME, start, head
      inloc = 0
    }
    {
      line = $0; sub(/#.*/, "", line)
      if (!inloc && line ~ /^[[:space:]]*location[[:space:]].*\{/) {
        inloc = 1; depth = 0; haspass = 0; hasproxy = 0; start = FNR; head = line
      }
      if (inloc) {
        if (line ~ /proxy_pass[[:space:]]/) haspass = 1
        if (line ~ /include[[:space:]]+[^;]*\/house-proxy\.conf;/) hasproxy = 1
        n = gsub(/\{/, "{", line); m = gsub(/\}/, "}", line)
        depth += n - m
        if (depth <= 0) flush()
      }
    }
  ' "$@"
}
bad="$(unproxied "$TPL"/*.template "$TPL"/snippets/*.conf "$TPL"/snippets/*.template)"
assert_eq "every proxied location includes house-proxy.conf" "$bad" ""
n="$(grep -rEc 'proxy_pass[[:space:]]' "$TPL" | awk -F: '{s += $2} END {print s + 0}')"
((n >= 10)) && pass "found $n proxy_pass directives to check" || fail "expected at least 10 proxy_pass directives, found $n"

# The checker itself: a proxied location without the include is reported, one with it is not.
cat >"$T_TMP/bad.template" <<'CONF'
location /api/ {
    if ($x) { return 404; }
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_pass http://house_api;
}
location / {
    include /etc/nginx/snippets/house-proxy.conf;
    proxy_pass http://house_web;
}
CONF
assert_eq "checker reports a proxied location without house-proxy.conf" \
  "$(unproxied "$T_TMP/bad.template" | sed "s|$T_TMP/||")" "bad.template:1 location /api/ {"
t_finish
