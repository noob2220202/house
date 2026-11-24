#!/usr/bin/env bash
# Renders the real nginx templates into a sandbox (high ports, temp paths) and checks:
# case-insensitive blocking of the admin API on the apex, the strict auth zone covering only
# login flows, frequent auth reads staying in the API zone, that both templates pass nginx -t,
# /_next/static served from the active release (immutable, gzip, fallback to Next), the page
# and image rate limits, the client IP headers sent to the Next upstreams, /media caching and
# the loopback media origin of the image optimizer.
source "$(dirname "$0")/lib.sh"

if ! have_cmd nginx || ! have_cmd curl || ! have_cmd node; then
  skip "nginx sandbox" "nginx/curl/node not installed"
  t_finish
  exit $?
fi
N="$T_TMP/nginx"
mkdir -p "$N"/{snippets,house,log,www,cert,uploads/public,tmp}
P=$((20000 + RANDOM % 20000)) PS=$((P + 1)) UP=$((P + 2)) MP=$((P + 3))
TPL="$KIT_DIR/nginx"
render() {
  sed -e "s|{{DOMAIN}}|web.test|g" -e "s|{{ADMIN_DOMAIN}}|admin.web.test|g" \
    -e "s|{{API_PORT}}|$UP|g" -e "s|{{WEB_PORT}}|$UP|g" -e "s|{{ADMIN_PORT}}|$UP|g" \
    -e "s|{{MEDIA_PORT}}|$MP|g" -e "s|{{CURRENT}}|$N/current|g" \
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
# Active release with web/admin build assets, and one public upload.
mkdir -p "$N/current/apps/web/.next/static/chunks" "$N/current/apps/admin/.next/static/chunks" "$N/uploads/public/listings"
{ printf '/* web chunk */\n'; for _ in $(seq 200); do printf 'console.log("house web chunk");\n'; done; } \
  >"$N/current/apps/web/.next/static/chunks/app-abc123.js"
printf '/* admin chunk */\n' >"$N/current/apps/admin/.next/static/chunks/admin-def456.js"
printf 'RIFFxxxxWEBP' >"$N/uploads/public/listings/a.webp"
printf '<script>alert(1)</script>' >"$N/uploads/public/listings/x.html"
chmod -R a+rX "$N/current" "$N/uploads"
HTTP_EXTRA=""
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
  $HTTP_EXTRA
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

# Upstream that echoes what reached it (and the client IP headers nginx set).
node -e 'require("http").createServer((q, r) => {
  r.setHeader("x-up-real-ip", q.headers["x-real-ip"] || "-");
  r.setHeader("x-up-xff", q.headers["x-forwarded-for"] || "-");
  r.setHeader("x-up-ssr", q.headers["x-house-ssr"] || "-");
  r.end("upstream " + q.url);
}).listen(+process.argv[1], "127.0.0.1")' "$UP" &
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
# hdr <host> <path> <header> [curl args...]: one response header's value (lower-case name).
hdr() {
  local host="$1" path="$2" name="$3"
  shift 3
  curl -s --path-as-is -o "$N/body" -D "$N/headers" -H "Host: $host" "$@" "http://127.0.0.1:$P$path" >/dev/null
  tr -d '\r' <"$N/headers" | sed -n "s/^${name}: //Ip" | head -1
}
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

# ─── /_next/static from the active release ───
check "restart sandbox (fresh zones)" start
web_chunk=/_next/static/chunks/app-abc123.js
assert_eq "web /_next/static is served from the release on disk" "$(code web.test $web_chunk)" "200"
cmp -s "$N/body" "$N/current/apps/web/.next/static/chunks/app-abc123.js" && pass "static body is the release file (not Next)" ||
  fail "static body is not the release file" "$(head -c 200 "$N/body")"
assert_eq "static assets are immutable for a year" "$(hdr web.test $web_chunk cache-control)" "public, max-age=31536000, immutable"
assert_eq "static assets keep nosniff" "$(hdr web.test $web_chunk x-content-type-options)" "nosniff"
assert_eq "static assets are gzipped by nginx" "$(hdr web.test $web_chunk content-encoding -H 'Accept-Encoding: gzip')" "gzip"
assert_eq "admin host serves the admin build's static files" "$(code admin.web.test /_next/static/chunks/admin-def456.js; head -1 "$N/body")" "200/* admin chunk */"
assert_eq "apex never serves the admin build" "$(code web.test /_next/static/chunks/admin-def456.js; cat "$N/body")" "200upstream /_next/static/chunks/admin-def456.js"
assert_eq "a chunk missing from the release falls back to Next" "$(code web.test /_next/static/chunks/old-999.js; cat "$N/body")" "200upstream /_next/static/chunks/old-999.js"
assert_eq "admin fallback goes to the admin upstream" "$(code admin.web.test /_next/static/chunks/old-1.js; cat "$N/body")" "200upstream /_next/static/chunks/old-1.js"
assert_eq "300 rapid static requests from one IP: no 429" "$(count429 web.test $web_chunk 300)" "0"

# ─── page / image rate limits ───
start >/dev/null
assert_eq "60 rapid page loads from one IP: no 429 (normal browsing + prefetch)" "$(count429 web.test /listing/abc 60)" "0"
start >/dev/null
n="$(count429 web.test '/listing/x?n=1' 250)"
((n > 0)) && pass "a scraper hammering pages gets 429 ($n of 250)" || fail "pages are not rate limited"
start >/dev/null
n="$(count429 admin.web.test /members 250)"
((n > 0)) && pass "admin pages are rate limited too ($n of 250)" || fail "admin pages are not rate limited"
start >/dev/null
assert_eq "150 rapid /_next/image requests: no 429" "$(count429 web.test '/_next/image?url=%2Fmedia%2Flistings%2Fa.webp&w=640&q=75' 150)" "0"

# ─── client IP headers for the Next upstreams ───
start >/dev/null
for path in /listing/abc '/_next/image?url=%2Fmedia%2Fa.webp&w=64&q=75' /_next/static/chunks/gone.js; do
  assert_eq "web upstream gets X-Real-IP ($path)" "$(hdr web.test "$path" x-up-real-ip -H 'X-Real-IP: 6.6.6.6')" "127.0.0.1"
  assert_eq "web upstream gets X-Forwarded-For = client only ($path)" "$(hdr web.test "$path" x-up-xff -H 'X-Forwarded-For: 6.6.6.6')" "127.0.0.1"
done
assert_eq "admin upstream gets X-Real-IP" "$(hdr admin.web.test /members x-up-real-ip)" "127.0.0.1"
assert_eq "admin upstream gets X-Forwarded-For" "$(hdr admin.web.test /members x-up-xff -H 'X-Forwarded-For: 6.6.6.6')" "127.0.0.1"
# X-House-SSR marks the Next servers' own loopback API calls; a client must never get it through.
for path in /listing/abc /api/v1/listings; do
  assert_eq "client X-House-SSR is stripped ($path)" "$(hdr web.test "$path" x-up-ssr -H 'X-House-SSR: 1')" "-"
done
assert_eq "client X-House-SSR is stripped (admin)" "$(hdr admin.web.test /members x-up-ssr -H 'X-House-SSR: 1')" "-"
# The pages' CSP comes from the apps (web: csp.mjs, admin: per-request nonce); nginx adds none.
for host in web.test admin.web.test; do
  hdr "$host" /listing/abc content-security-policy >/dev/null
  if grep -qi '^content-security-policy' "$N/headers"; then
    fail "nginx adds a CSP header on $host pages"
  else
    pass "nginx adds no CSP header on $host pages"
  fi
done

# ─── /media ───
assert_eq "public /media image served" "$(code web.test /media/listings/a.webp)" "200"
assert_eq "/media stays immutable" "$(hdr web.test /media/listings/a.webp cache-control)" "public, max-age=31536000, immutable"
assert_eq "/media non-image is 404" "$(code web.test /media/listings/x.html)" "404"
mcode() { curl -s -o "$N/body" -w '%{http_code}' "http://127.0.0.1:$MP$1"; }
assert_eq "loopback media origin (MEDIA_ORIGIN) serves /media images" "$(mcode /media/listings/a.webp)" "200"
cmp -s "$N/body" "$N/uploads/public/listings/a.webp" && pass "loopback media origin returns the upload" || fail "loopback media body differs"
assert_eq "loopback media origin: non-image 404" "$(mcode /media/listings/x.html)" "404"
assert_eq "loopback media origin serves nothing else" "$(mcode /api/v1/listings)" "404"
grep -q "listen 127.0.0.1:{{MEDIA_PORT}};" "$TPL/house-upstreams.conf.template" && ! grep -q 'listen {{MEDIA_PORT}}\|listen \[::\]:{{MEDIA_PORT}}' "$TPL/house-upstreams.conf.template" &&
  pass "media origin listens on loopback only" || fail "media origin is not loopback-only"

# ─── regexes still hold with merge_slashes off (no reliance on nginx normalizing //) ───
HTTP_EXTRA="merge_slashes off;"
render "$TPL/house-http.conf.template" >"$N/site.conf" && main
check "merge_slashes off: nginx -t" ngx -t -q
check "merge_slashes off: sandbox starts" start
for p in //api/v1/admin/auth/me /api//v1//ADMIN/members ///API/v1/admin; do
  c="$(code web.test "$p")"
  if [[ "$c" == 404 ]] && ! grep -q upstream "$N/body"; then pass "merge_slashes off: apex blocks $p"; else fail "merge_slashes off: apex blocks $p" "got $c $(cat "$N/body")"; fi
done
n="$(count429 admin.web.test //api//v1//admin//auth//login 35)"
((n > 0)) && pass "merge_slashes off: admin login with // stays in the strict zone ($n×429)" || fail "admin login with // escapes the strict zone"
HTTP_EXTRA=""

! grep -q 'nginx-limit-req' "$KIT_DIR/install.sh" || grep -q '^# No nginx-limit-req jail' "$KIT_DIR/install.sh" &&
  ! grep -q '^\[nginx-limit-req\]' "$KIT_DIR/install.sh" && pass "no fail2ban jail bans on nginx 429s" ||
  fail "fail2ban nginx-limit-req jail still installed"
t_finish
