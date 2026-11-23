#!/usr/bin/env bash
# Renders the real nginx templates into a sandbox (high ports, temp paths) and checks:
# case-insensitive blocking of the admin API on the apex, the strict auth zone covering only
# login flows, frequent auth reads staying in the API zone, and that both templates pass nginx -t.
source "$(dirname "$0")/lib.sh"

if ! have_cmd nginx || ! have_cmd curl || ! have_cmd node; then
  skip "nginx sandbox" "nginx/curl/node not installed"
  t_finish
  exit $?
fi
N="$T_TMP/nginx"
mkdir -p "$N"/{snippets,house,log,www,cert,uploads/public,tmp}
P=$((20000 + RANDOM % 20000)) PS=$((P + 1)) UP=$((P + 2))
TPL="$KIT_DIR/nginx"
render() {
  sed -e "s|{{DOMAIN}}|web.test|g" -e "s|{{ADMIN_DOMAIN}}|admin.web.test|g" \
    -e "s|{{API_PORT}}|$UP|g" -e "s|{{WEB_PORT}}|$UP|g" -e "s|{{ADMIN_PORT}}|$UP|g" \
    -e "s|{{UPLOAD_PUBLIC}}|$N/uploads/public|g" -e "s|{{CERT_NAME}}|house|g" -e "s|{{HSTS_LINE}}||g" \
    -e "s|/etc/nginx/snippets/|$N/snippets/|g" -e "s|/etc/nginx/house/|$N/house/|g" \
    -e "s|/var/log/nginx/|$N/log/|g" -e "s|/etc/letsencrypt/live/house/|$N/cert/|g" \
    -e "s|/var/www/letsencrypt|$N/www|g" -e '/listen \[::\]/d' \
    -e "s|listen 80|listen 127.0.0.1:$P|" -e "s|listen 443|listen 127.0.0.1:$PS|" "$1"
}
for f in "$TPL"/snippets/*.conf; do render "$f" >"$N/snippets/$(basename "$f")"; done
for f in "$TPL"/snippets/*.conf.template; do b="$(basename "$f" .template)"; render "$f" >"$N/snippets/$b"; done
render "$TPL/admin-allowlist.conf.example" >"$N/house/admin-allowlist.conf"
render "$TPL/house-upstreams.conf.template" >"$N/upstreams.conf"
openssl req -x509 -newkey rsa:2048 -nodes -days 2 -subj /CN=web.test -keyout "$N/cert/privkey.pem" \
  -out "$N/cert/fullchain.pem" >/dev/null 2>&1
main() {
  cat >"$N/nginx.conf" <<CONF
worker_processes 1;
pid $N/nginx.pid;
error_log $N/log/error.log warn;
events { worker_connections 256; }
http {
  access_log off;
  client_body_temp_path $N/tmp/body; proxy_temp_path $N/tmp/proxy; fastcgi_temp_path $N/tmp/fcgi;
  uwsgi_temp_path $N/tmp/uwsgi; scgi_temp_path $N/tmp/scgi;
  include $N/upstreams.conf;
  include $N/site.conf;
}
CONF
}
ngx() { nginx -p "$N" -e "$N/log/error.log" -c "$N/nginx.conf" "$@"; }

render "$TPL/house.conf.template" >"$N/site.conf" && main
check "TLS template + snippets pass nginx -t" ngx -t -q
render "$TPL/house-http.conf.template" >"$N/site.conf" && main
check "HTTP template + snippets pass nginx -t" ngx -t -q

# Upstream that echoes what reached it.
node -e 'require("http").createServer((q, r) => r.end("upstream " + q.url)).listen(+process.argv[1], "127.0.0.1")' "$UP" &
up_pid=$!
t_on_exit "kill $up_pid"
t_on_exit "ngx -s stop"
start() {
  ngx -s stop 2>/dev/null
  for _ in $(seq 1 25); do [[ -e "$N/nginx.pid" ]] || break; sleep 0.2; done
  ngx || return 1
  for _ in $(seq 1 25); do curl -s -o /dev/null -H 'Host: web.test' "http://127.0.0.1:$P/" && return 0; sleep 0.2; done
  return 1
}
code() { curl -s --path-as-is -o "$N/body" -w '%{http_code}' -H "Host: $1" "http://127.0.0.1:$P$2"; }
count429() {
  local host="$1" path="$2" n="$3" i c=0
  for ((i = 0; i < n; i++)); do [[ "$(code "$host" "$path")" == 429 ]] && c=$((c + 1)); done
  echo "$c"
}
for _ in $(seq 1 25); do curl -s -o /dev/null "http://127.0.0.1:$UP/" && break; sleep 0.2; done
check "sandbox nginx starts" start

for p in /api/v1/admin/auth/me /api/v1/ADMIN/auth/me /api/v1/Admin/members /API/V1/ADMIN/auth/login \
  /api/v1//admin/auth/me /api/v1/%61dmin/auth/me /api/v1/admin; do
  c="$(code web.test "$p")"
  if [[ "$c" == 404 ]] && ! grep -q upstream "$N/body"; then pass "apex blocks $p"; else fail "apex blocks $p" "got $c $(cat "$N/body")"; fi
done
assert_eq "apex still proxies other API paths" "$(code web.test /api/v1/listings; cat "$N/body")" "200upstream /api/v1/listings"
assert_eq "apex: /api/v1/administrative-areas is not mistaken for admin" "$(code web.test /api/v1/administrative-areas)" "200"

# 50 requests: far over the strict zone (30/min, burst 30), well within the API zone (burst 100).
start >/dev/null
assert_eq "50 rapid GET /auth/me from one IP: no 429" "$(count429 web.test /api/v1/auth/me 50)" "0"
start >/dev/null
assert_eq "50 rapid GET /auth/csrf from one IP: no 429" "$(count429 web.test /api/v1/auth/csrf 50)" "0"
start >/dev/null
n="$(count429 web.test /api/v1/AUTH/oauth/kakao/start 45)"
((n > 0)) && pass "OAuth start is in the strict zone even with odd case ($n×429)" || fail "OAuth start not rate limited"

check "restart sandbox (fresh zones)" start
assert_eq "admin host: 50 rapid GET /admin/auth/me: no 429" "$(count429 admin.web.test /api/v1/admin/auth/me 50)" "0"
start >/dev/null
n="$(count429 admin.web.test /api/v1/ADMIN/AUTH/login 35)"
((n > 0)) && pass "admin login is in the strict zone even with odd case ($n×429)" || fail "admin login not rate limited"
assert_eq "admin host serves the admin API" "$(code admin.web.test /api/v1/admin/members; cat "$N/body")" "200upstream /api/v1/admin/members"

! grep -q 'nginx-limit-req' "$KIT_DIR/install.sh" || grep -q '^# No nginx-limit-req jail' "$KIT_DIR/install.sh" &&
  ! grep -q '^\[nginx-limit-req\]' "$KIT_DIR/install.sh" && pass "no fail2ban jail bans on nginx 429s" ||
  fail "fail2ban nginx-limit-req jail still installed"
t_finish
