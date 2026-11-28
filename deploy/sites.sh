#!/usr/bin/env bash
# 사무소 홈페이지 HTTPS (https://<slug>.DOMAIN). DNS is at 가비아, which has no API, so there is no
# wildcard certificate: every office gets its own Let's Encrypt certificate (HTTP-01, webroot) and
# its own nginx server. Run as root by the house-sites timer every 5 minutes (install.sh):
#   1. reads the assigned slugs from PostgreSQL: agency_sites ACTIVE or SUSPENDED whose agency is
#      not deleted. "Live" ones (the API's servable rule: ACTIVE, agency APPROVED, plus an active
#      SITE subscription while FEATURES.siteSubscriptionRequired is on) come first.
#   2. re-checks every slug with the rules of packages/shared/src/agencies/site.ts (the internet-
#      facing app writes them, so root treats them as untrusted input)
#   3. issues missing certificates for live slugs (certbot --cert-name house-site-<slug>): at most
#      10 per run and within a weekly budget under Let's Encrypt's 50 new certificates per domain
#      per week. A certbot that is already running (certbot.timer's renew) defers the rest.
#   4. writes /etc/nginx/house/sites/<slug>.conf for every assigned slug whose certificate exists
#      (nginx -t per file): a suspended or gated office keeps its server (the app answers 404
#      meanwhile), so it opens at once when it is servable again. Removes the files of slugs no
#      longer assigned to such a site (certificates are kept), reloads once.
#   5. sets agency_sites.https_ready_at for assigned slugs whose HTTPS server works and clears it
#      for those that have none, so the apps link an office site only once it works (the API
#      keeps the value across suspend / resume / gate changes and resets it on a new slug)
#   A release whose web app does not know office sites (a forced rollback past the feature) gets
#   no office server at all and every https_ready_at is cleared, until such a release is current.
#
#   sudo /srv/house/sites.sh              # run now (the timer runs it every 5 minutes anyway)
#   sudo /srv/house/sites.sh --staging    # Let's Encrypt staging CA (tests: the certificates are
#                                         # not trusted, so https_ready_at is left alone)
#   journalctl -u house-sites -n 50       # the timer's log (no systemd: /var/log/house-sites.log)
#
# TLS_ENABLED=false (install.sh --no-tls) → nothing to do.

SCRIPT_DIR="$(cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")" && pwd)"
# shellcheck source=lib/common.sh
source "$SCRIPT_DIR/lib/common.sh"

# Fixed server paths (plain variables, not read from the environment; the tests reassign them).
SITES_DIR=/etc/nginx/house/sites
SITES_STATE_DIR=/var/lib/house-sites # root 0700: lock, issuance log, failure markers
SITES_TEMPLATE="$SCRIPT_DIR/nginx/house-site.conf.template"
NGINX_SITE_CONF=/etc/nginx/sites-enabled/house.conf
SITES_INCLUDE_LINE='include /etc/nginx/house/sites/*.conf;'
TLS_PARAMS_SNIPPET=/etc/nginx/snippets/house-tls-params.conf
LE_LIVE_DIR=/etc/letsencrypt/live
ACME_WEBROOT=/var/www/letsencrypt
SITE_CERT_PREFIX=house-site-

SITES_MAX_NEW_CERTS=10 # new certificates per run (SPEC §6)
# Let's Encrypt allows 50 new certificates per registered domain per 7 days (renewals are exempt);
# the rest is left for the main certificate and manual issuance.
SITES_WEEKLY_CERTS=40
# A failed issuance waits this long (Let's Encrypt: 5 failed validations per hostname per hour).
SITES_RETRY_MINUTES=60
SITES_MAX_ROWS=5000 # rows read per run
SITES_STAGING=false

# ─── slug rules (packages/shared/src/agencies/site.ts — keep in sync; test_sites.sh compares) ───
SITE_SLUG_MIN=3
SITE_SLUG_MAX=30
# RESERVED_SITE_SLUGS, same words and order.
SITE_RESERVED_SLUGS="www admin api app apps m mobile mail email smtp imap pop pop3 ftp sftp ns ns1 ns2
dns mx webmail autodiscover autoconfig static assets cdn img image images media upload uploads files
dev test testing staging stage beta alpha demo local localhost preview help support cs blog news
status docs doc wiki about login logout auth oauth sso signup register account accounts me my agent
agents agency agencies office offices site sites map maps search listing listings complex complexes
deal deals home root system server web www1 www2 billing pay payment shop store ads ad suncheon
suncheonmap house brand official notice notices event events kakao naver google apple null
undefined"

# normalizeSiteSlug: trimmed and lower-cased. (JS trim also strips non-ASCII spaces; such input is
# never canonical, and site_slug_servable refuses anything that is not.)
site_slug_normalize() {
  local s="$1"
  s="${s#"${s%%[![:space:]]*}"}"
  s="${s%"${s##*[![:space:]]}"}"
  printf '%s' "${s,,}"
}

# site_slug_problem <slug>: siteSlugProblem — prints INVALID or RESERVED and fails when the slug
# cannot be used; prints nothing and succeeds when it can. 3–30 characters, one DNS label of
# a-z 0-9 and inner hyphens, no "--" (punycode xn--), not reserved. Uniqueness is the API's job.
site_slug_problem() {
  local s
  s="$(site_slug_normalize "$1")"
  # Explicit character list, not a range: [a-z] depends on the locale.
  if ((${#s} < SITE_SLUG_MIN || ${#s} > SITE_SLUG_MAX)) ||
    [[ "$s" == *[!abcdefghijklmnopqrstuvwxyz0123456789-]* || "$s" == -* || "$s" == *- || "$s" == *--* ]]; then
    printf 'INVALID'
    return 1
  fi
  local w
  for w in $SITE_RESERVED_SLUGS; do
    if [[ "$w" == "$s" ]]; then
      printf 'RESERVED'
      return 1
    fi
  done
  return 0
}

# site_slug_servable <slug>: the stricter check for a slug read from the database, which becomes
# an nginx server_name, a certbot name and a file name: already canonical, valid, not reserved,
# and not the admin host. Prints the reason when it is refused.
site_slug_servable() {
  local s="$1" p
  if [[ "$s" != "$(site_slug_normalize "$s")" ]]; then
    printf 'NOT_CANONICAL'
    return 1
  fi
  p="$(site_slug_problem "$s")" || {
    printf '%s' "$p"
    return 1
  }
  if [[ "$s.$DOMAIN" == "$ADMIN_DOMAIN" ]]; then
    printf 'ADMIN_HOST'
    return 1
  fi
}

site_host() { printf '%s.%s' "$1" "$DOMAIN"; }
site_cert_dir() { printf '%s/%s%s' "$LE_LIVE_DIR" "$SITE_CERT_PREFIX" "$1"; }

# site_server_conf <slug> <ipv6 true|false>: the nginx server of one office site, on stdout. Same
# IPv6 rule as install.sh's render_template (no [::] listens on a host without IPv6).
site_server_conf() {
  local slug="$1" ipv6="$2" out
  [[ -r "$SITES_TEMPLATE" ]] || {
    warn "템플릿이 없습니다: $SITES_TEMPLATE"
    return 1
  }
  out="$(sed -e "s|{{SITE_SLUG}}|${slug}|g" -e "s|{{DOMAIN}}|${DOMAIN}|g" "$SITES_TEMPLATE")"
  [[ "$ipv6" == true ]] || out="$(grep -v 'listen \[::\]' <<<"$out")"
  if grep -q '{{[A-Z_]*}}' <<<"$out"; then
    warn "치환되지 않은 템플릿 변수: $SITES_TEMPLATE"
    return 1
  fi
  printf '%s\n' "$out"
}

# site_cert_state <slug>:
#   ok        certificate and key present, issued for <slug>.DOMAIN, valid for more than a day
#   expiring  present and for this name, but expires within a day (or has expired)
#   untrusted present and for this name, but from the staging CA while running against the real one
#   missing   anything else (nginx could not use it for this host)
site_cert_state() {
  local dir pem
  dir="$(site_cert_dir "$1")"
  pem="$dir/fullchain.pem"
  if [[ ! -s "$pem" || ! -s "$dir/privkey.pem" ]] || ! cert_covers "$pem" "$(site_host "$1")"; then
    printf 'missing'
  elif ! openssl x509 -checkend 86400 -noout -in "$pem" >/dev/null 2>&1; then
    printf 'expiring'
  elif [[ "$SITES_STAGING" != true ]] && openssl x509 -noout -issuer -in "$pem" 2>/dev/null | grep -qi 'staging'; then
    printf 'untrusted'
  else
    printf 'ok'
  fi
}

# Certificates issued in the last 7 days ("<epoch> <slug>" per line in the issuance log).
sites_issued_log() { printf '%s/issued' "$SITES_STATE_DIR"; }
sites_issued_this_week() {
  local log since
  log="$(sites_issued_log)"
  since=$(($(date +%s) - 7 * 86400))
  if [[ -f "$log" ]]; then awk -v s="$since" '$1 >= s' "$log" | wc -l | tr -d ' '; else printf '0'; fi
}
sites_prune_issued_log() {
  local log since tmp
  log="$(sites_issued_log)"
  [[ -f "$log" ]] || return 0
  since=$(($(date +%s) - 8 * 86400))
  tmp="$(mktemp "$SITES_STATE_DIR/.issued.XXXXXX")"
  awk -v s="$since" '$1 >= s' "$log" >"$tmp"
  mv -f "$tmp" "$log"
}
site_failed_marker() { printf '%s/failed/%s' "$SITES_STATE_DIR" "$1"; }
site_recently_failed() {
  local m
  m="$(site_failed_marker "$1")"
  [[ -f "$m" && -n "$(find "$m" -maxdepth 0 -mmin "-$SITES_RETRY_MINUTES" 2>/dev/null)" ]]
}

site_dns_ok() { getent ahosts "$1" >/dev/null 2>&1; }

# site_issue_cert <slug> <force true|false>: one certificate for <slug>.DOMAIN through the ACME
# webroot nginx serves on port 80 (*.DOMAIN server, house-acme.conf). certbot uses the account
# install.sh registered; certbot.timer renews it and the renewal hook reloads nginx.
# Returns 0 when issued, 3 when another certbot holds its lock (certbot.timer's twice-daily
# renew: not a failed validation, so no backoff), 1 otherwise. certbot's output goes to stderr.
SITES_CERTBOT_BUSY='Another instance of Certbot is already running'
site_issue_cert() {
  local slug="$1" force="$2" out rc=0
  local -a args=(certonly --webroot -w "$ACME_WEBROOT" --cert-name "${SITE_CERT_PREFIX}${slug}"
    -d "$(site_host "$slug")" --non-interactive --agree-tos --register-unsafely-without-email)
  if [[ "$force" == true ]]; then args+=(--force-renewal); else args+=(--keep-until-expiring); fi
  [[ "$SITES_STAGING" == true ]] && args+=(--staging)
  out="$(certbot "${args[@]}" 2>&1)" || rc=$?
  [[ -z "$out" ]] || printf '%s\n' "$out" | sed 's/^/    /' >&2
  ((rc == 0)) && return 0
  grep -qF "$SITES_CERTBOT_BUSY" <<<"$out" && return 3
  return 1
}

# site_install_conf <path> <content>: writes one server file and tests the whole nginx config.
# Returns 0 when it changed and passes, 1 when unchanged, 2 when nginx -t failed (the previous
# file, or none, is put back).
site_install_conf() {
  local conf="$1" content="$2" backup="" out
  if [[ -f "$conf" ]]; then
    backup="$(mktemp "$SITES_STATE_DIR/.conf.XXXXXX")"
    cp -p "$conf" "$backup"
  fi
  if ! printf '%s\n' "$content" | write_if_changed "$conf" 0644; then
    rm -f "$backup"
    return 1
  fi
  if out="$(nginx -t 2>&1)"; then
    rm -f "$backup"
    return 0
  fi
  warn "nginx 설정 검사 실패 — $conf 를 되돌립니다:"
  printf '%s\n' "$out" | sed 's/^/    /' >&2
  if [[ -n "$backup" ]]; then mv -f "$backup" "$conf"; else rm -f "$conf"; fi
  return 2
}

sites_nginx_reload() {
  if has_systemd && systemctl is-active --quiet nginx 2>/dev/null; then
    systemctl reload nginx
  else
    nginx -s reload
  fi
}

# ─── database (app role from DATABASE_URL; the password never reaches argv) ───
SITES_PSQL=(psql -X -q -At -v ON_ERROR_STOP=1)
sites_db() { pg_run "${SITES_PSQL[@]}" "$@"; }

# One "<slug>|<t|f>|<l|k>" line per assigned site: t = https_ready_at is set; l = live (the API's
# servable rule, GET /sites/:slug, minus httpsReady), k = kept only (SUSPENDED, agency not
# APPROVED, or no current SITE subscription under the gate). Live first, then oldest approval.
# A deleted agency never comes back, so its slug is not kept.
sites_assigned_sql() {
  cat <<SQL
SELECT s.slug || '|' || CASE WHEN s.https_ready_at IS NULL THEN 'f' ELSE 't' END
  || '|' || CASE WHEN g.live THEN 'l' ELSE 'k' END
FROM agency_sites s
JOIN agencies a ON a.id = s.agency_id
CROSS JOIN LATERAL (
  SELECT s.status = 'ACTIVE' AND a.status = 'APPROVED' AND (
    NOT COALESCE((SELECT (st.value -> 'siteSubscriptionRequired') = 'true'::jsonb
                  FROM site_settings st WHERE st.key = 'FEATURES'), false)
    OR EXISTS (
      SELECT 1 FROM agency_subscriptions sub
      WHERE sub.agency_id = s.agency_id AND sub.product = 'SITE' AND sub.canceled_at IS NULL
        AND sub.starts_on <= (now() AT TIME ZONE 'Asia/Seoul')::date
        AND (sub.ends_on IS NULL OR sub.ends_on >= (now() AT TIME ZONE 'Asia/Seoul')::date)
    )
  ) AS live
) g
WHERE s.status IN ('ACTIVE', 'SUSPENDED') AND s.slug IS NOT NULL AND a.deleted_at IS NULL
ORDER BY g.live DESC, s.decided_at NULLS LAST, s.slug
LIMIT ${SITES_MAX_ROWS}
SQL
}

# 'a','b',... — only for slugs that passed site_slug_servable ([a-z0-9-] only).
sites_sql_list() {
  local out="" s
  for s in "$@"; do out+="'${s}',"; done
  printf '%s' "${out%,}"
}
sites_set_ready_sql() {
  printf "UPDATE agency_sites SET https_ready_at = now() WHERE https_ready_at IS NULL AND status IN ('ACTIVE', 'SUSPENDED') AND slug IN (%s) RETURNING slug" \
    "$(sites_sql_list "$@")"
}
sites_clear_ready_sql() {
  printf "UPDATE agency_sites SET https_ready_at = NULL WHERE https_ready_at IS NOT NULL AND slug IN (%s) RETURNING slug" \
    "$(sites_sql_list "$@")"
}
# Every row (the active release serves no office host).
sites_clear_all_ready_sql() {
  printf '%s' "UPDATE agency_sites SET https_ready_at = NULL WHERE https_ready_at IS NOT NULL RETURNING slug"
}

# sites_release_ok: the active release's web app serves office hosts. No release yet: nothing to
# protect. A release without the route (a forced rollback past the feature) would render the
# whole main site under every office host.
sites_release_ok() {
  [[ ! -d "$CURRENT_LINK/apps/web" || -d "$CURRENT_LINK/$SITES_WEB_ROUTE" ]]
}

# ─── main ───
sites_require_root() { [[ $EUID -eq 0 ]] || die "root 권한이 필요합니다: sudo $0"; }
# The header comment (line 2 up to the first line that is not a comment).
sites_usage() { awk 'NR > 1 && !/^#/ { exit } NR > 1 { sub(/^# ?/, ""); print }' "${BASH_SOURCE[0]}"; }

sites_main() {
  while (($#)); do
    case "$1" in
      --staging) SITES_STAGING=true ;;
      -h | --help)
        sites_usage
        return 0
        ;;
      *) die "알 수 없는 옵션: $1" ;;
    esac
    shift
  done
  sites_require_root
  load_conf
  if [[ "$TLS_ENABLED" != true ]]; then
    log "TLS_ENABLED=false — 사무소 홈페이지 인증서를 만들지 않습니다 (할 일 없음)."
    return 0
  fi
  [[ -n "$DOMAIN" ]] || die "deploy.conf 에 DOMAIN 이 없습니다. 먼저 install.sh 를 실행하세요."
  [[ -L "$SITES_STATE_DIR" ]] && die "$SITES_STATE_DIR 가 심볼릭 링크입니다."
  (umask 077 && mkdir -p "$SITES_STATE_DIR/failed")
  chmod 0700 "$SITES_STATE_DIR" "$SITES_STATE_DIR/failed"

  # One run at a time (a slow certbot can outlast the 5-minute timer period).
  exec 7>>"$SITES_STATE_DIR/lock" || die "잠금 파일을 열 수 없습니다: $SITES_STATE_DIR/lock"
  if ! flock -n 7; then
    log "다른 sites.sh 가 실행 중입니다 — 이번 실행은 건너뜁니다."
    return 0
  fi

  # Before the main certificate exists nginx runs the HTTP template, where *.DOMAIN already serves
  # the office sites over plain HTTP and nothing includes the per-office servers.
  if ! grep -qsF "$SITES_INCLUDE_LINE" "$NGINX_SITE_CONF"; then
    log "nginx 가 TLS 설정이 아니거나 사무소 홈페이지 포함 줄이 없습니다 ($NGINX_SITE_CONF) — 할 일 없음."
    log "  (메인 인증서 발급 후 sudo $BIN_DIR/install.sh --nginx-only 를 실행하면 포함됩니다)"
    return 0
  fi
  [[ -f "$TLS_PARAMS_SNIPPET" ]] ||
    die "$TLS_PARAMS_SNIPPET 가 없습니다 — sudo $BIN_DIR/install.sh --nginx-only 로 nginx 설정을 다시 만드세요."
  have certbot || die "certbot 이 없습니다 — sudo $BIN_DIR/install.sh 를 다시 실행하세요."

  local has_table rows
  has_table="$(sites_db -c "select to_regclass('public.agency_sites') is not null")" ||
    die "DB 에 접속할 수 없습니다 (DATABASE_URL, PostgreSQL 상태 확인)."
  if [[ "$has_table" != t ]]; then
    log "agency_sites 테이블이 아직 없습니다 (첫 배포 전) — 할 일 없음."
    return 0
  fi
  local release_ok=true
  if ! sites_release_ok; then
    release_ok=false
    warn "현재 릴리스($(readlink -f "$CURRENT_LINK"))의 웹 앱에 사무소 홈페이지가 없습니다 (이전 버전으로 롤백?)"
    warn "  — 사무소 nginx 설정을 모두 내리고 링크를 숨깁니다. 사무소 홈페이지가 있는 버전을 배포하면 다음 실행에 돌아옵니다."
    rows=""
  else
    rows="$(sites_db -c "$(sites_assigned_sql)")" || die "사무소 홈페이지 목록을 읽지 못했습니다."
  fi

  # ── untrusted rows → validated slugs ──
  local -a assigned=() live=()
  local -A is_assigned=() is_live=() had_ready=()
  local line slug flag kind why row_re='^([^|]*)[|]([tf])[|]([lk])$'
  while IFS= read -r line; do
    [[ -n "$line" ]] || continue
    if [[ ! "$line" =~ $row_re ]]; then
      warn "형식이 맞지 않는 행을 건너뜁니다: ${line@Q}"
      continue
    fi
    slug="${BASH_REMATCH[1]}" flag="${BASH_REMATCH[2]}" kind="${BASH_REMATCH[3]}"
    if ! why="$(site_slug_servable "$slug")"; then
      warn "사용할 수 없는 홈페이지 주소라 건너뜁니다: ${slug@Q} ($why)"
      continue
    fi
    [[ -z "${is_assigned[$slug]:-}" ]] || continue
    is_assigned[$slug]=1
    had_ready[$slug]="$flag"
    assigned+=("$slug")
    if [[ "$kind" == l ]]; then
      is_live[$slug]=1
      live+=("$slug")
    fi
  done <<<"$rows"

  # ── certificates + server files ──
  local ipv6=false
  [[ -f /proc/net/if_inet6 ]] && ipv6=true
  mkdir -p "$SITES_DIR" "$ACME_WEBROOT"
  sites_prune_issued_log
  local week budget new=0 deferred=0 failed=0 busy=false changed=false state host conf content rc
  week="$(sites_issued_this_week)"
  budget=$((SITES_WEEKLY_CERTS - week))
  ((budget > SITES_MAX_NEW_CERTS)) && budget=$SITES_MAX_NEW_CERTS
  ((budget < 0)) && budget=0
  local -a served=()
  local -A keep=() is_served=()
  for slug in "${assigned[@]}"; do
    host="$(site_host "$slug")"
    state="$(site_cert_state "$slug")"
    # New certificates only for live slugs; a kept one keeps what it has (certbot.timer renews it).
    if [[ "$state" != ok && -n "${is_live[$slug]:-}" ]]; then
      if site_recently_failed "$slug"; then
        log "$host: 최근 발급 실패 — ${SITES_RETRY_MINUTES}분이 지나면 다시 시도합니다."
      elif $busy || ((new >= budget)); then
        deferred=$((deferred + 1))
      elif ! site_dns_ok "$host"; then
        warn "$host 를 DNS 에서 찾을 수 없습니다 (가비아 DNS의 * A 레코드 확인) — 다음 실행에 다시 확인합니다."
      else
        new=$((new + 1))
        log "인증서 발급: $host (--cert-name ${SITE_CERT_PREFIX}${slug}$([[ "$SITES_STAGING" == true ]] && echo ', staging'))"
        rc=0
        site_issue_cert "$slug" "$([[ "$state" == untrusted ]] && echo true || echo false)" || rc=$?
        case "$rc" in
          0)
            printf '%s %s\n' "$(date +%s)" "$slug" >>"$(sites_issued_log)"
            rm -f "$(site_failed_marker "$slug")"
            ;;
          3)
            # Nothing was asked of Let's Encrypt: no backoff, and the rest waits too.
            new=$((new - 1)) deferred=$((deferred + 1)) busy=true
            log "다른 certbot(자동 갱신 certbot.timer)이 실행 중입니다 — $host 와 남은 발급은 다음 실행에 합니다."
            ;;
          *)
            failed=$((failed + 1))
            touch "$(site_failed_marker "$slug")"
            warn "인증서 발급 실패: $host — ${SITES_RETRY_MINUTES}분 뒤 다시 시도합니다 (journalctl -u house-sites)."
            ;;
        esac
        state="$(site_cert_state "$slug")"
      fi
    fi
    # Without a certificate for this name nginx could not serve the host: no server file.
    [[ "$state" == missing ]] && continue
    conf="$SITES_DIR/$slug.conf"
    content="$(site_server_conf "$slug" "$ipv6")" || continue
    rc=0
    site_install_conf "$conf" "$content" || rc=$?
    case "$rc" in
      0)
        changed=true
        log "nginx 설정 추가/갱신: $host"
        ;;
      2)
        # Reverted: a previous file (which passed before and is what nginx serves) stays and
        # counts as served below; a new one is gone.
        [[ -f "$conf" ]] || continue
        ;;
    esac
    keep[$slug]=1
    if [[ "$state" == ok ]]; then
      served+=("$slug")
      is_served[$slug]=1
    fi
  done

  # ── files of slugs no longer assigned (slug changed, request rejected, office deleted) ──
  local f
  for f in "$SITES_DIR"/*.conf; do
    [[ -e "$f" || -L "$f" ]] || continue
    slug="$(basename "$f" .conf)"
    [[ -n "${keep[$slug]:-}" ]] && continue
    rm -f -- "$f"
    changed=true
    log "nginx 설정 제거: ${slug}.${DOMAIN} (배정된 사무소 홈페이지가 아님 — 인증서는 남겨 둡니다)"
  done

  if $changed; then
    local out
    out="$(nginx -t 2>&1)" || {
      printf '%s\n' "$out" | sed 's/^/    /' >&2
      die "nginx 설정 검사 실패 — 다시 읽지 않았습니다 (https_ready_at 도 바꾸지 않음)."
    }
    sites_nginx_reload || die "nginx 를 다시 읽지 못했습니다."
    ok "nginx 다시 읽음"
  fi

  # ── https_ready_at (the apps link an office site only once it is set) ──
  if [[ "$SITES_STAGING" == true ]]; then
    log "--staging: 신뢰되지 않는 인증서이므로 https_ready_at 은 바꾸지 않습니다."
  else
    local -a mark=() clear=()
    for slug in "${served[@]}"; do [[ "${had_ready[$slug]}" == f ]] && mark+=("$slug"); done
    for slug in "${assigned[@]}"; do
      [[ "${had_ready[$slug]}" == t && -z "${is_served[$slug]:-}" ]] && clear+=("$slug")
    done
    if ! $release_ok; then
      if out="$(sites_db -c "$(sites_clear_all_ready_sql)")"; then
        [[ -n "$out" ]] && warn "사무소 홈페이지가 없는 릴리스라 https_ready_at 을 모두 지움 (링크 숨김): ${out//$'\n'/, }"
      else
        warn "https_ready_at 을 지우지 못했습니다 — 다음 실행에 다시 시도합니다."
      fi
    fi
    if ((${#mark[@]})); then
      if out="$(sites_db -c "$(sites_set_ready_sql "${mark[@]}")")"; then
        [[ -n "$out" ]] && ok "HTTPS 준비 완료로 표시: ${out//$'\n'/, }"
      else
        warn "https_ready_at 을 기록하지 못했습니다 — 다음 실행에 다시 시도합니다."
      fi
    fi
    if ((${#clear[@]})); then
      if out="$(sites_db -c "$(sites_clear_ready_sql "${clear[@]}")")"; then
        [[ -n "$out" ]] && warn "HTTPS 서버가 없어 https_ready_at 을 지움 (링크 숨김): ${out//$'\n'/, }"
      else
        warn "https_ready_at 을 지우지 못했습니다 — 다음 실행에 다시 시도합니다."
      fi
    fi
  fi

  ((deferred > 0)) && ! $busy && log "인증서 ${deferred}건은 발급 한도(실행당 ${SITES_MAX_NEW_CERTS}건, 주 ${SITES_WEEKLY_CERTS}건 — 이번 주 ${week}건) 때문에 다음 실행으로 미룹니다."
  if [[ -t 1 ]]; then
    local d orphans=()
    for d in "$LE_LIVE_DIR/$SITE_CERT_PREFIX"*; do
      [[ -d "$d" ]] || continue
      slug="${d##*/"$SITE_CERT_PREFIX"}"
      [[ -n "${is_assigned[$slug]:-}" ]] || orphans+=("$slug")
    done
    if ((${#orphans[@]})); then
      log "배정된 사무소 홈페이지가 없는 인증서 ${#orphans[@]}개 (자동 갱신은 계속됨): ${orphans[*]}"
      log "  다시 쓸 일이 없으면: sudo certbot delete --cert-name ${SITE_CERT_PREFIX}<주소>"
    fi
  fi
  log "사무소 홈페이지: 운영 ${#live[@]}곳 (정지·미구독 포함 ${#assigned[@]}곳) · HTTPS ${#served[@]}곳 · 이번 발급 ${new}건 (실패 ${failed}) · 대기 ${deferred}건"
  ((failed == 0))
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  set -Eeuo pipefail
  sites_main "$@"
fi
