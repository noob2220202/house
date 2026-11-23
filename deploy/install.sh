#!/usr/bin/env bash
# First-time (and idempotent re-run) server setup for the house platform on Ubuntu 22.04 / 24.04.
# No Docker: Node 22 (NodeSource) + pnpm (corepack) + PM2, PostgreSQL 16 + PostGIS 3 + pg_trgm
# (PGDG), Redis, Nginx, Certbot, UFW, fail2ban, backups via cron.
#
#   sudo ./deploy/install.sh --domain example.com --email ops@example.com \
#        --repo git@github.com:OWNER/REPO.git [--branch main] [--admin-subdomain admin]
#
# Safe to re-run: existing secrets (.env), database, roles and certificates are kept.
# Run with --help for all options.
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")" && pwd)"
# shellcheck source=lib/common.sh
source "$SCRIPT_DIR/lib/common.sh"

# Templates always sit next to this script (repo checkout deploy/, or the installed /srv/house/bin).
TPL_DIR="$SCRIPT_DIR/nginx"
# Repo files (.env.example, package.json): the checkout this script lives in, else the active release.
if [[ -f "$SCRIPT_DIR/../apps/api/.env.example" ]]; then
  SRC_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
else
  SRC_ROOT="$(readlink -f "${HOUSE_ROOT:-/srv/house}/current" 2>/dev/null || true)"
fi

usage() {
  cat <<'EOF'
사용법: sudo ./deploy/install.sh --domain <도메인> --email <관리자메일> [옵션]

필수
  --domain example.com        서비스 도메인 (apex). www.<도메인>은 apex로 리다이렉트됩니다.
  --email ops@example.com     Let's Encrypt 인증서 만료 알림 메일 (--no-tls면 생략 가능)

선택
  --repo URL                  Git 저장소 (비공개 저장소는 git@github.com:OWNER/REPO.git 형식 권장)
  --branch main               배포 브랜치 (기본 main)
  --admin-subdomain admin     관리자 서브도메인 (기본 admin → admin.<도메인>)
  --db-name house             PostgreSQL DB 이름 (기본 house)
  --db-user house             PostgreSQL 역할 이름 (기본 house)
  --redis-port 6379           Redis 포트 (기본 6379)
  --ssh-port 22               UFW에서 열어 둘 SSH 포트 (기본 22)
  --no-tls                    인증서 발급 생략, HTTP 전용 nginx 설정 (테스트용)
  --staging                   Let's Encrypt 스테이징 서버 사용 (발급 테스트)
  --skip-upgrade              apt upgrade 생략
  --skip-firewall             UFW 설정 생략
  --skip-fail2ban             fail2ban 설정 생략
  --skip-swap                 스왑 파일 생성 생략
  --skip-timezone             시간대(Asia/Seoul) 설정 생략
  --skip-pm2-startup          PM2 부팅 자동 시작(systemd) 등록 생략
  --nginx-only                nginx 설정만 다시 생성하고 종료 (deploy.conf 값 사용)
  --kit-only                  배포 스크립트(/srv/house/bin)만 root 소유로 다시 설치하고 종료.
                              저장소 체크아웃에서 실행하면 그 deploy/ 를, /srv/house/bin 에서 실행하면
                              REPO_URL 에서 root 가 직접 받은 deploy/ 를 설치합니다.
  --kit-ref <브랜치|커밋>     --kit-only 로 받을 브랜치 또는 전체 커밋 해시 (기본: deploy.conf 의 BRANCH)
  -h, --help                  도움말

systemd가 없는 환경(컨테이너 등)에서는 UFW·fail2ban·PM2 startup·서비스 enable을 자동으로 건너뜁니다.
EOF
}

# ─── options ────────────────────────────────────────────────────────────────────────────────
OPT_DOMAIN="" OPT_EMAIL="" OPT_REPO="" OPT_BRANCH="" OPT_ADMIN_SUB="admin"
OPT_DB_NAME="" OPT_DB_USER="" OPT_REDIS_PORT="" OPT_SSH_PORT=22
NO_TLS=false STAGING=false SKIP_UPGRADE=false SKIP_FIREWALL=false SKIP_FAIL2BAN=false
SKIP_SWAP=false SKIP_TIMEZONE=false SKIP_PM2_STARTUP=false NGINX_ONLY=false KIT_ONLY=false OPT_KIT_REF=""

need_arg() { [[ $# -ge 2 && -n "$2" && "$2" != --* ]] || die "옵션 $1 에 값이 필요합니다."; }
while [[ $# -gt 0 ]]; do
  case "$1" in
    --domain) need_arg "$@"; OPT_DOMAIN="${2,,}"; shift 2 ;;
    --email) need_arg "$@"; OPT_EMAIL="$2"; shift 2 ;;
    --repo) need_arg "$@"; OPT_REPO="$2"; shift 2 ;;
    --branch) need_arg "$@"; OPT_BRANCH="$2"; shift 2 ;;
    --admin-subdomain) need_arg "$@"; OPT_ADMIN_SUB="${2,,}"; shift 2 ;;
    --db-name) need_arg "$@"; OPT_DB_NAME="$2"; shift 2 ;;
    --db-user) need_arg "$@"; OPT_DB_USER="$2"; shift 2 ;;
    --redis-port) need_arg "$@"; OPT_REDIS_PORT="$2"; shift 2 ;;
    --ssh-port) need_arg "$@"; OPT_SSH_PORT="$2"; shift 2 ;;
    --no-tls) NO_TLS=true; shift ;;
    --staging) STAGING=true; shift ;;
    --skip-upgrade) SKIP_UPGRADE=true; shift ;;
    --skip-firewall) SKIP_FIREWALL=true; shift ;;
    --skip-fail2ban) SKIP_FAIL2BAN=true; shift ;;
    --skip-swap) SKIP_SWAP=true; shift ;;
    --skip-timezone) SKIP_TIMEZONE=true; shift ;;
    --skip-pm2-startup) SKIP_PM2_STARTUP=true; shift ;;
    --nginx-only) NGINX_ONLY=true; shift ;;
    --kit-only) KIT_ONLY=true; shift ;;
    --kit-ref) need_arg "$@"; OPT_KIT_REF="$2"; shift 2 ;;
    -h | --help) usage; exit 0 ;;
    *) usage >&2; die "알 수 없는 옵션: $1" ;;
  esac
done

[[ $EUID -eq 0 ]] || die "root 권한이 필요합니다: sudo $0 $*"

# Previous answers (re-runs, --nginx-only) come from deploy.conf (parsed and validated, never
# sourced); flags override them.
load_conf

# ─── deploy kit (bin/) ──────────────────────────────────────────────────────────────────────
# Root runs bin/, so it is only ever written here, as root, from a source root trusts: the
# checkout this script runs from, or REPO_URL fetched by root itself (root-owned known_hosts;
# the service user's mirror is not trusted).
install_kit_links() {
  local s
  for s in deploy rollback status backup restore create-admin db-shell; do
    [[ -f "$BIN_DIR/$s.sh" ]] && ln -sfn "$BIN_DIR/$s.sh" "$HOUSE_ROOT/$s.sh"
  done
  return 0
}

kit_from_repo() {
  local ref="$1" tmp key="/home/$HOUSE_USER/.ssh/id_ed25519" want
  [[ -n "$REPO_URL" ]] || die "REPO_URL이 없습니다. 저장소 체크아웃 안의 deploy/install.sh --kit-only 로 실행하세요."
  if [[ "$ref" =~ ^[0-9a-f]{40}$ ]]; then
    want="$ref"
  elif [[ "$ref" =~ ^[0-9a-f]{7,39}$ ]]; then
    die "--kit-ref 는 전체 커밋 해시(40자) 또는 브랜치 이름이어야 합니다."
  else
    conf_valid BRANCH "$ref" || die "--kit-ref 형식이 올바르지 않습니다: $ref"
    want="refs/heads/$ref"
  fi
  tmp="$(mktemp -d)"
  local -a ssh_cmd=(ssh -F /dev/null -o BatchMode=yes -o IdentitiesOnly=yes -o StrictHostKeyChecking=yes
    -o "UserKnownHostsFile=$KNOWN_HOSTS_FILE")
  if [[ -f "$key" && ! -L "$key" ]]; then
    install -m 0600 -o root -g root "$key" "$tmp/key"
    ssh_cmd+=(-i "$tmp/key")
  fi
  git init -q --bare "$tmp/repo"
  if ! GIT_SSH_COMMAND="${ssh_cmd[*]}" git -C "$tmp/repo" -c protocol.version=2 fetch -q --depth 1 "$REPO_URL" "$want"; then
    rm -rf "$tmp"
    die "저장소에서 배포 스크립트를 받지 못했습니다: $REPO_URL $ref"
  fi
  mkdir "$tmp/kit"
  git -C "$tmp/repo" archive FETCH_HEAD deploy | tar -x --no-same-owner -C "$tmp/kit"
  log "받은 커밋: $(git -C "$tmp/repo" rev-parse FETCH_HEAD)"
  kit_install "$tmp/kit/deploy" "$BIN_DIR"
  rm -rf "$tmp"
}

if $KIT_ONLY; then
  [[ -d "$HOUSE_ROOT" && ! -L "$HOUSE_ROOT" ]] || die "$HOUSE_ROOT 가 없습니다. 먼저 전체 install.sh 를 실행하세요."
  chown root:root "$HOUSE_ROOT"
  chmod 0755 "$HOUSE_ROOT"
  step "배포 스크립트 설치 ($BIN_DIR, root 소유)"
  if [[ "$SCRIPT_DIR" != "$(readlink -f "$BIN_DIR")" ]]; then
    kit_install "$SCRIPT_DIR" "$BIN_DIR"
  else
    kit_from_repo "${OPT_KIT_REF:-$BRANCH}"
  fi
  install_kit_links
  ok "배포 스크립트 갱신 완료"
  exit 0
fi

DOMAIN="${OPT_DOMAIN:-$DOMAIN}"
[[ -n "$DOMAIN" ]] || { usage >&2; die "--domain 이 필요합니다."; }
if [[ -n "$OPT_DOMAIN" || -z "$ADMIN_DOMAIN" ]]; then ADMIN_DOMAIN="${OPT_ADMIN_SUB}.${DOMAIN}"; fi
REPO_URL="${OPT_REPO:-$REPO_URL}"
BRANCH="${OPT_BRANCH:-$BRANCH}"
DB_NAME="${OPT_DB_NAME:-$DB_NAME}"
DB_USER="${OPT_DB_USER:-$DB_USER}"
REDIS_PORT="${OPT_REDIS_PORT:-6379}"
if $NO_TLS; then TLS_ENABLED=false; elif ! $NGINX_ONLY; then TLS_ENABLED=true; fi

[[ "$DOMAIN" =~ $DOMAIN_RE ]] || die "도메인 형식이 올바르지 않습니다: $DOMAIN (한글 도메인은 punycode xn--… 로 입력)"
[[ "$ADMIN_DOMAIN" =~ $DOMAIN_RE ]] || die "관리자 도메인 형식이 올바르지 않습니다: $ADMIN_DOMAIN"
[[ "$DB_NAME" =~ $PG_IDENT_RE ]] || die "--db-name 은 소문자/숫자/_ 만 허용됩니다."
[[ "$DB_USER" =~ $PG_IDENT_RE ]] || die "--db-user 는 소문자/숫자/_ 만 허용됩니다."
is_port "$REDIS_PORT" || die "--redis-port 가 올바르지 않습니다."
is_port "$OPT_SSH_PORT" || die "--ssh-port 가 올바르지 않습니다."
conf_valid BRANCH "$BRANCH" || die "--branch 형식이 올바르지 않습니다."
conf_valid REPO_URL "$REPO_URL" || die "--repo 형식이 올바르지 않습니다: $REPO_URL"
if ! $NO_TLS && ! $NGINX_ONLY; then
  [[ "$OPT_EMAIL" =~ ^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$ ]] ||
    die "--email 이 필요합니다 (인증서 만료 알림용). 테스트라면 --no-tls 를 사용하세요."
fi

export DEBIAN_FRONTEND=noninteractive
export NEEDRESTART_MODE=a # Ubuntu 22.04+: restart services after upgrades without a dialog
APT_OPTS=(-y -q -o Dpkg::Options::=--force-confdef -o Dpkg::Options::=--force-confold)
SUMMARY_WARNINGS=()
note_warn() {
  warn "$1"
  SUMMARY_WARNINGS+=("$1")
}

# ─── generic helpers ────────────────────────────────────────────────────────────────────────
os_codename() { . /etc/os-release && printf '%s' "${VERSION_CODENAME:-}"; }

apt_update() { apt-get update -q -o Acquire::Retries=3; }

# Installs only packages that are not installed yet: never upgrades an existing package (which
# would restart a running PostgreSQL/Redis); upgrades are --skip-upgrade / unattended-upgrades.
apt_install_missing() {
  local -a missing=()
  local p
  for p in "$@"; do
    dpkg-query -W -f='${Status}' "$p" 2>/dev/null | grep -q 'install ok installed' || missing+=("$p")
  done
  if ((${#missing[@]})); then
    log "apt install: ${missing[*]}"
    apt-get install "${APT_OPTS[@]}" --no-install-recommends "${missing[@]}"
  fi
}

# Service control that works with systemd, SysV init scripts (containers) or neither.
svc() {
  local action="$1" name="$2"
  if has_systemd; then
    case "$action" in
      enable) systemctl enable --now "$name" ;;
      *) systemctl "$action" "$name" ;;
    esac
  elif [[ -x "/etc/init.d/$name" ]]; then
    case "$action" in
      enable) service "$name" status >/dev/null 2>&1 || service "$name" start ;;
      reload) service "$name" reload || service "$name" restart ;;
      *) service "$name" "$action" ;;
    esac
  else
    return 2
  fi
}

write_if_changed() {
  # write_if_changed <path> <mode> [owner] < content ; returns 0 if the file changed
  local dest="$1" mode="$2" owner="${3:-root:root}" tmp
  tmp="$(mktemp)"
  cat >"$tmp"
  [[ -L "$dest" ]] && rm -f "$dest"
  if [[ -f "$dest" ]] && cmp -s "$tmp" "$dest"; then
    rm -f "$tmp"
    chown "$owner" "$dest"
    chmod "$mode" "$dest"
    return 1
  fi
  install -m "$mode" -o "${owner%%:*}" -g "${owner##*:}" "$tmp" "$dest"
  rm -f "$tmp"
  return 0
}

rand_hex() { openssl rand -hex "$1"; }
rand_b64() { openssl rand -base64 "$1" | tr -d '\n'; }

as_house() { run_as_house "$@"; }

# Directories: anything inside a house-owned directory is created/changed AS house (a root
# chown/chmod there could be redirected by a planted symlink); directories in root-owned
# parents are handled by root after refusing symlinks.
root_dir() {
  local mode="$1" owner="$2" path="$3"
  [[ -L "$path" ]] && die "$path 가 심볼릭 링크입니다. 확인 후 제거하고 다시 실행하세요."
  install -d -m "$mode" -o "${owner%%:*}" -g "${owner##*:}" "$path"
  chown "$owner" "$path"
  chmod "$mode" "$path"
}
house_dir() {
  local mode="$1" path="$2" group="${3:-$HOUSE_USER}"
  if [[ "$(stat -c %U "$(dirname "$path")")" == "$HOUSE_USER" ]]; then
    as_house install -d -m "$mode" "$path"
  else
    root_dir "$mode" "$HOUSE_USER:$group" "$path"
  fi
}
# root_file <mode> <owner:group> <path>: an existing file is re-owned, a missing one created empty.
root_file() {
  local mode="$1" owner="$2" path="$3"
  [[ -L "$path" ]] && rm -f "$path"
  [[ -e "$path" && ! -f "$path" ]] && die "$path 가 일반 파일이 아닙니다."
  [[ -f "$path" ]] || : >"$path"
  chown "$owner" "$path"
  chmod "$mode" "$path"
}

# ─── nginx (also used alone by --nginx-only) ────────────────────────────────────────────────
CERT_PEM=/etc/letsencrypt/live/house/fullchain.pem
cert_matches() { [[ -s "$CERT_PEM" ]] && cert_covers "$CERT_PEM" "$DOMAIN" "www.$DOMAIN" "$ADMIN_DOMAIN"; }

render_template() {
  # render_template <src> <dest> ; replaces {{KEY}} placeholders, drops IPv6 listens if no IPv6
  local src="$1" dest="$2" hsts=""
  [[ "$TLS_ENABLED" == true ]] &&
    hsts='add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;'
  local content
  content="$(
    sed -e "s|{{DOMAIN}}|${DOMAIN}|g" \
      -e "s|{{ADMIN_DOMAIN}}|${ADMIN_DOMAIN}|g" \
      -e "s|{{API_PORT}}|${API_PORT}|g" \
      -e "s|{{WEB_PORT}}|${WEB_PORT}|g" \
      -e "s|{{ADMIN_PORT}}|${ADMIN_PORT}|g" \
      -e "s|{{UPLOAD_PUBLIC}}|${UPLOAD_ROOT}/public|g" \
      -e "s|{{CERT_NAME}}|house|g" \
      -e "s|{{HSTS_LINE}}|${hsts}|g" "$src"
  )"
  if [[ ! -f /proc/net/if_inet6 ]]; then
    content="$(grep -v 'listen \[::\]' <<<"$content")"
  fi
  if grep -q '{{[A-Z_]*}}' <<<"$content"; then die "치환되지 않은 템플릿 변수: $src"; fi
  printf '%s\n' "$content" | write_if_changed "$dest" 0644 || true
}

configure_nginx() {
  step "Nginx 설정 (${DOMAIN}, ${ADMIN_DOMAIN}, TLS=${TLS_ENABLED})"
  local tpl="$TPL_DIR" mode_tpl
  install -d -m 0755 /etc/nginx/snippets /etc/nginx/house /var/www/letsencrypt
  local f
  for f in house-proxy.conf house-csp.conf house-acme.conf house-web-locations.conf \
    house-admin-locations.conf house-server-common.conf; do
    write_if_changed "/etc/nginx/snippets/$f" 0644 <"$tpl/snippets/$f" || true
  done
  render_template "$tpl/snippets/house-security-headers.conf.template" /etc/nginx/snippets/house-security-headers.conf
  render_template "$tpl/snippets/house-media.conf.template" /etc/nginx/snippets/house-media.conf
  render_template "$tpl/snippets/house-tls.conf.template" /etc/nginx/snippets/house-tls.conf
  render_template "$tpl/house-upstreams.conf.template" /etc/nginx/conf.d/house.conf
  [[ -f /etc/nginx/house/admin-allowlist.conf ]] ||
    install -m 0644 "$tpl/admin-allowlist.conf.example" /etc/nginx/house/admin-allowlist.conf

  local have_cert=false
  # A certificate for other names (domain changed) would break TLS: bootstrap over HTTP instead.
  cert_matches && have_cert=true
  if [[ "$TLS_ENABLED" == true && "$have_cert" == true ]]; then
    mode_tpl="$tpl/house.conf.template"
  else
    mode_tpl="$tpl/house-http.conf.template"
    if [[ "$TLS_ENABLED" == true ]]; then
      # Bootstrap: plain HTTP until certbot has a certificate (no HSTS yet).
      TLS_ENABLED=false render_template "$tpl/snippets/house-security-headers.conf.template" \
        /etc/nginx/snippets/house-security-headers.conf
    fi
  fi
  render_template "$mode_tpl" /etc/nginx/sites-available/house.conf
  ln -sfn /etc/nginx/sites-available/house.conf /etc/nginx/sites-enabled/house.conf
  rm -f /etc/nginx/sites-enabled/default

  nginx -t 2>&1 | sed 's/^/    /' || true
  nginx -t >/dev/null 2>&1 || die "nginx 설정 검사 실패 (위 메시지 확인)"
  nginx_reload
  ok "nginx 설정 적용 ($(basename "$mode_tpl"))"
}

nginx_reload() {
  if pgrep -x nginx >/dev/null 2>&1; then
    svc reload nginx >/dev/null 2>&1 || nginx -s reload
  else
    svc enable nginx >/dev/null 2>&1 || nginx
  fi
}

if $NGINX_ONLY; then
  have nginx || die "nginx가 설치되어 있지 않습니다. 먼저 전체 install.sh를 실행하세요."
  configure_nginx
  exit 0
fi

# A .env generated earlier in --no-tls mode still has http:// URLs; switch exactly those.
upgrade_env_to_https() {
  [[ "$(env_get PUBLIC_BASE_URL)" == "http://${DOMAIN}" ]] || return 0
  local d="${DOMAIN//./\\.}" a="${ADMIN_DOMAIN//./\\.}"
  sed -i -E "/^(PUBLIC_BASE_URL|ADMIN_BASE_URL|API_BASE_URL|CORS_ORIGINS|[A-Z]+_REDIRECT_URI)=/ s#http://(${d}|${a})([/,]|\$)#https://\\1\\2#g" "$ENV_FILE"
  ok ".env 의 사이트 주소를 https:// 로 변경 (재배포 필요: ./deploy.sh)"
}

# ─── 1. OS / packages ───────────────────────────────────────────────────────────────────────
step "운영체제 확인"
# shellcheck source=/dev/null
. /etc/os-release
case "${ID:-}:${VERSION_ID:-}" in
  ubuntu:24.04 | ubuntu:22.04) ok "$PRETTY_NAME" ;;
  ubuntu:*) note_warn "검증되지 않은 Ubuntu 버전입니다: $PRETTY_NAME (22.04/24.04 권장)" ;;
  *) die "Ubuntu 22.04/24.04 전용 스크립트입니다: ${PRETTY_NAME:-unknown}" ;;
esac
CODENAME="$(os_codename)"
if has_systemd; then
  ok "systemd 사용 가능"
else
  note_warn "systemd가 없습니다 (컨테이너?) — 서비스 자동 시작/UFW/fail2ban/PM2 startup을 건너뜁니다."
fi

step "패키지 목록 갱신 및 시스템 업데이트"
apt_update
if $SKIP_UPGRADE; then
  log "apt upgrade 생략 (--skip-upgrade)"
else
  apt-get "${APT_OPTS[@]}" upgrade
fi
apt_install_missing ca-certificates curl gnupg lsb-release git rsync cron logrotate openssl \
  unattended-upgrades apt-transport-https procps util-linux tzdata openssh-client
ok "기본 패키지 설치"

step "자동 보안 업데이트 (unattended-upgrades)"
write_if_changed /etc/apt/apt.conf.d/20auto-upgrades 0644 <<'EOF' || true
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
APT::Periodic::AutocleanInterval "7";
EOF
write_if_changed /etc/apt/apt.conf.d/52house-unattended-upgrades 0644 <<'EOF' || true
// house: security updates only (Ubuntu defaults), no automatic reboot; reboot manually at night.
Unattended-Upgrade::Remove-Unused-Kernel-Packages "true";
Unattended-Upgrade::Remove-Unused-Dependencies "true";
Unattended-Upgrade::Automatic-Reboot "false";
EOF
ok "보안 업데이트 매일 자동 설치 (재부팅은 수동)"

step "시간대 Asia/Seoul"
if $SKIP_TIMEZONE; then
  log "생략 (--skip-timezone)"
elif has_systemd && have timedatectl; then
  timedatectl set-timezone Asia/Seoul
  ok "timedatectl set-timezone Asia/Seoul"
else
  ln -sfn /usr/share/zoneinfo/Asia/Seoul /etc/localtime
  echo "Asia/Seoul" >/etc/timezone
  ok "/etc/localtime → Asia/Seoul"
fi

step "스왑"
MEM_MB=$(awk '/MemTotal/ {print int($2/1024)}' /proc/meminfo)
if $SKIP_SWAP; then
  log "생략 (--skip-swap)"
elif ((MEM_MB >= 4096)); then
  ok "메모리 ${MEM_MB}MB ≥ 4GB — 스왑 불필요"
elif [[ -n "$(swapon --show --noheadings 2>/dev/null)" ]]; then
  ok "스왑이 이미 있습니다: $(swapon --show --noheadings | awk '{print $1" "$3}' | tr '\n' ' ')"
else
  SWAP_MB=$((MEM_MB < 2048 ? 2048 : 4096))
  if [[ ! -f /swapfile ]]; then
    fallocate -l "${SWAP_MB}M" /swapfile 2>/dev/null || dd if=/dev/zero of=/swapfile bs=1M count="$SWAP_MB" status=none
    chmod 600 /swapfile
    mkswap /swapfile >/dev/null
  fi
  if swapon /swapfile 2>/dev/null; then
    grep -q '^/swapfile ' /etc/fstab || echo '/swapfile none swap sw 0 0' >>/etc/fstab
    write_if_changed /etc/sysctl.d/60-house-swap.conf 0644 <<<"vm.swappiness=10" || true
    sysctl -q -p /etc/sysctl.d/60-house-swap.conf || true
    ok "스왑 ${SWAP_MB}MB 생성 (/swapfile)"
  else
    note_warn "스왑을 켤 수 없습니다 (권한/가상화 제한). 메모리 ${MEM_MB}MB로 계속합니다."
  fi
fi

# ─── 2. service user & directories ──────────────────────────────────────────────────────────
step "서비스 사용자 '$HOUSE_USER' 및 디렉터리"
if ! id "$HOUSE_USER" >/dev/null 2>&1; then
  useradd --system --create-home --home-dir "/home/$HOUSE_USER" --shell /bin/bash "$HOUSE_USER"
  ok "사용자 생성: $HOUSE_USER"
else
  ok "사용자 존재: $HOUSE_USER"
fi
# Root runs bin/ and parses shared/: those belong to root. The service user (which runs the
# internet-facing apps and every npm build script) owns only releases, the mirror and caches.
# Earlier installs made all of /srv/house house-owned; this takes it back.
root_dir 0755 root:root "$HOUSE_ROOT"
rm -rf "$HOUSE_ROOT/.bin.old" "$HOUSE_ROOT"/.bin.new.* "$HOUSE_ROOT"/.bin.stage.* "$HOUSE_ROOT"/.current.tmp.*
root_dir 0755 root:root "$BIN_DIR"
root_dir 0750 "root:$HOUSE_USER" "$SHARED_DIR"
root_dir 0755 "$HOUSE_USER:$HOUSE_USER" "$RELEASES_DIR"
root_dir 0755 "$HOUSE_USER:$HOUSE_USER" "$MIRROR_DIR"
root_dir 0755 "$HOUSE_USER:$HOUSE_USER" "$SHARED_DIR/pnpm-store"
root_dir 0755 "$HOUSE_USER:$HOUSE_USER" "$SHARED_DIR/turbo-cache"
root_file 0660 "root:$HOUSE_USER" "$SHARED_DIR/.deploy.lock"
root_file 0660 "root:$HOUSE_USER" "$SHARED_DIR/.backup.lock"
for f in "$ENV_FILE" "$DEPLOY_CONF"; do
  [[ -L "$f" ]] && die "$f 가 심볼릭 링크입니다. 확인 후 실제 파일로 바꾸고 다시 실행하세요."
done
house_dir 0755 /var/lib/house
house_dir 0755 "$UPLOAD_ROOT"
house_dir 0755 "$UPLOAD_ROOT/public"
# Private documents (중개사무소 등록증 등): only the service user can read them, never nginx.
house_dir 0700 "$UPLOAD_ROOT/private"
house_dir 0700 "$BACKUP_DIR"
for d in db uploads pre-migrate pre-restore config; do house_dir 0700 "$BACKUP_DIR/$d"; done
house_dir 0750 "$LOG_DIR" adm
house_dir 0750 "$LOG_DIR/pm2"

# 'current' (root-owned) → releases/.active (switched by deploy.sh as the service user).
migrate_current_link() {
  local now target
  [[ -e "$CURRENT_LINK" && ! -L "$CURRENT_LINK" ]] && die "$CURRENT_LINK 가 심볼릭 링크가 아닙니다."
  now="$(readlink "$CURRENT_LINK" 2>/dev/null || true)"
  [[ "$now" == "releases/.active" ]] && return 0
  if [[ -n "$now" ]]; then
    target="$(readlink -e "$CURRENT_LINK" 2>/dev/null || true)"
    if [[ -d "$target" && "$(dirname "$target")" == "$(readlink -f "$RELEASES_DIR")" ]]; then
      as_house ln -sfn "$target" "$ACTIVE_LINK"
    fi
  fi
  ln -sfn releases/.active "$HOUSE_ROOT/.current.tmp.$$"
  mv -Tf "$HOUSE_ROOT/.current.tmp.$$" "$CURRENT_LINK"
}
migrate_current_link
ok "$HOUSE_ROOT (root) · bin (root) · shared (root:$HOUSE_USER) · releases, repo.git (서비스 사용자)"
ok "$UPLOAD_ROOT/{public,private}, $BACKUP_DIR, $LOG_DIR"

# SSH deploy key so the service user can pull a private repository.
house_dir 0700 "/home/$HOUSE_USER/.ssh"
if [[ ! -f "/home/$HOUSE_USER/.ssh/id_ed25519" ]]; then
  as_house ssh-keygen -q -t ed25519 -N '' -C "house-deploy@$(hostname)" -f "/home/$HOUSE_USER/.ssh/id_ed25519"
  ok "배포용 SSH 키 생성"
fi
DEPLOY_PUBKEY="$(as_house cat "/home/$HOUSE_USER/.ssh/id_ed25519.pub")"
REPO_HOST=""
if [[ "$REPO_URL" =~ ^git@([^:]+): ]]; then REPO_HOST="${BASH_REMATCH[1]}"; fi
if [[ "$REPO_URL" =~ ^ssh://([^@/]+@)?([^/:]+) ]]; then REPO_HOST="${BASH_REMATCH[2]}"; fi
if [[ -n "$REPO_HOST" ]]; then
  # Root-owned copy (deploy.sh and --kit-only use it), plus the service user's own file.
  KNOWN="/home/$HOUSE_USER/.ssh/known_hosts"
  if ! ssh-keygen -F "$REPO_HOST" -f "$KNOWN_HOSTS_FILE" >/dev/null 2>&1; then
    SCAN="$(ssh-keyscan -T 10 -t ed25519,ecdsa,rsa "$REPO_HOST" 2>/dev/null || true)"
    if [[ -n "$SCAN" ]]; then
      { cat "$KNOWN_HOSTS_FILE" 2>/dev/null || true; printf '%s\n' "$SCAN"; } |
        write_if_changed "$KNOWN_HOSTS_FILE" 0644 "root:$HOUSE_USER" || true
      ok "known_hosts에 $REPO_HOST 호스트 키 등록 ($KNOWN_HOSTS_FILE)"
    else
      note_warn "$REPO_HOST 호스트 키를 가져오지 못했습니다 (네트워크 확인)."
    fi
  fi
  if [[ -f "$KNOWN_HOSTS_FILE" ]] && ! as_house ssh-keygen -F "$REPO_HOST" -f "$KNOWN" >/dev/null 2>&1; then
    # shellcheck disable=SC2016 # $1 expands in the child shell
    grep -v '^#' "$KNOWN_HOSTS_FILE" | as_house bash -c 'umask 077; cat >>"$1"' _ "$KNOWN"
  fi
fi

# ─── 3. Node.js 22 + pnpm + PM2 ─────────────────────────────────────────────────────────────
step "Node.js 22 (NodeSource), pnpm (corepack), PM2"
node_major() { /usr/bin/node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0; }
if [[ "$(node_major)" != "22" ]]; then
  install -d -m 0755 /etc/apt/keyrings
  curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key |
    gpg --dearmor --yes -o /etc/apt/keyrings/nodesource.gpg
  chmod 0644 /etc/apt/keyrings/nodesource.gpg
  write_if_changed /etc/apt/sources.list.d/nodesource.list 0644 \
    <<<"deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_22.x nodistro main" || true
  # Prefer NodeSource over Ubuntu's older nodejs package.
  write_if_changed /etc/apt/preferences.d/nodesource 0644 <<'EOF' || true
Package: nodejs
Pin: origin deb.nodesource.com
Pin-Priority: 600
EOF
  apt_update
  if dpkg-query -W -f='${Status}' nodejs 2>/dev/null | grep -q 'install ok installed'; then
    apt-get install "${APT_OPTS[@]}" nodejs
  else
    apt_install_missing nodejs
  fi
fi
[[ "$(node_major)" == "22" ]] || die "/usr/bin/node 가 Node 22가 아닙니다: $(/usr/bin/node -v 2>/dev/null || echo 없음)"
ok "node $(/usr/bin/node -v) (/usr/bin/node)"

PNPM_SPEC="pnpm@10"
if [[ -n "$SRC_ROOT" && -f "$SRC_ROOT/package.json" ]]; then
  pm="$(sed -n 's/.*"packageManager": *"\(pnpm@[0-9][0-9.]*\)".*/\1/p' "$SRC_ROOT/package.json")"
  [[ -n "$pm" ]] && PNPM_SPEC="$pm"
fi
/usr/bin/corepack enable --install-directory /usr/bin pnpm
as_house /usr/bin/corepack prepare "$PNPM_SPEC" --activate >/dev/null
ok "pnpm $(cd "/home/$HOUSE_USER" && as_house /usr/bin/pnpm --version) (corepack, $PNPM_SPEC)"

PM2_VERSION="6"
if ! have pm2 || [[ "$(pm2 --version 2>/dev/null | cut -d. -f1)" != "$PM2_VERSION" ]]; then
  # --prefix /usr: next to the NodeSource node, whatever npm prefix the root user configured.
  /usr/bin/npm install -g --prefix /usr --no-fund --no-audit "pm2@${PM2_VERSION}" >/dev/null
fi
ok "pm2 $(pm2 --version 2>/dev/null | tail -1)"

# ─── 4. secrets (.env values) — existing .env always wins ───────────────────────────────────
step "비밀값 준비"
ENV_EXISTS=false
[[ -f "$ENV_FILE" ]] && ENV_EXISTS=true
url_password() { sed -n 's|^[a-z]*://[^:/@]*:\([^@]*\)@.*|\1|p' <<<"$1"; }
if $ENV_EXISTS; then
  EXISTING_DB_URL="$(env_get DATABASE_URL)"
  EXISTING_REDIS_URL="$(env_get REDIS_URL)"
  DB_PASSWORD="$(url_password "$EXISTING_DB_URL")"
  REDIS_PASSWORD="$(url_password "$EXISTING_REDIS_URL")"
  # The DB/role names in an existing .env win over flags so a re-run never points elsewhere.
  if [[ "$EXISTING_DB_URL" =~ ^postgres(ql)?://([^:]+):[^@]*@[^/]+/([^?]+) ]]; then
    DB_USER="${BASH_REMATCH[2]}" DB_NAME="${BASH_REMATCH[3]}"
  fi
  if [[ "$EXISTING_REDIS_URL" =~ :([0-9]+)/[0-9]+$ ]]; then REDIS_PORT="${BASH_REMATCH[1]}"; fi
  [[ -n "$DB_PASSWORD" ]] || die "$ENV_FILE 의 DATABASE_URL에서 비밀번호를 읽을 수 없습니다."
  [[ -n "$REDIS_PASSWORD" ]] || die "$ENV_FILE 의 REDIS_URL에서 비밀번호를 읽을 수 없습니다 (redis://:비밀번호@...)."
  ok "기존 $ENV_FILE 의 DB/Redis 비밀번호 사용 (덮어쓰지 않음)"
else
  DB_PASSWORD="$(rand_hex 24)"
  REDIS_PASSWORD="$(rand_hex 32)"
  ok "새 비밀번호 생성 (DB, Redis)"
fi

# ─── 5. PostgreSQL 16 + PostGIS 3 + pg_trgm ─────────────────────────────────────────────────
step "PostgreSQL 16 + PostGIS 3 + pg_trgm"
if [[ ! -f /etc/apt/sources.list.d/pgdg.list ]]; then
  install -d -m 0755 /etc/apt/keyrings
  curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc |
    gpg --dearmor --yes -o /etc/apt/keyrings/postgresql.gpg
  chmod 0644 /etc/apt/keyrings/postgresql.gpg
  echo "deb [signed-by=/etc/apt/keyrings/postgresql.gpg] https://apt.postgresql.org/pub/repos/apt ${CODENAME}-pgdg main" \
    >/etc/apt/sources.list.d/pgdg.list
  apt_update
  ok "PGDG 저장소 추가 (${CODENAME}-pgdg)"
fi
apt_install_missing postgresql-16 postgresql-client-16 postgresql-16-postgis-3 postgresql-common

PG_CLUSTER_LINE="$(pg_lsclusters -h 2>/dev/null | awk '$1 == 16' | head -1)"
if [[ -z "$PG_CLUSTER_LINE" ]]; then
  pg_createcluster 16 main --start >/dev/null
  PG_CLUSTER_LINE="$(pg_lsclusters -h | awk '$1 == 16' | head -1)"
  ok "클러스터 생성: 16/main"
fi
read -r _ PG_CLUSTER PG_PORT PG_STATUS _ <<<"$PG_CLUSTER_LINE"
if [[ "$PG_STATUS" != online* ]]; then
  if has_systemd; then systemctl start "postgresql@16-${PG_CLUSTER}"; else pg_ctlcluster 16 "$PG_CLUSTER" start; fi
fi
if has_systemd; then systemctl enable postgresql >/dev/null 2>&1 || true; fi
ok "기존/신규 클러스터 사용: 16/${PG_CLUSTER} (port ${PG_PORT})"

pg_super() { runuser -u postgres -- psql -X -q -v ON_ERROR_STOP=1 -p "$PG_PORT" "$@"; }
pg_super -d postgres -Atc 'select 1' >/dev/null || die "postgres 슈퍼유저로 접속할 수 없습니다 (peer 인증 확인)."

# Password goes through stdin, never argv. Names were validated above; the password is hex.
if [[ "$(pg_super -d postgres -Atc "select 1 from pg_roles where rolname = '${DB_USER}'")" == 1 ]]; then
  pg_super -d postgres <<<"ALTER ROLE \"${DB_USER}\" WITH LOGIN PASSWORD '${DB_PASSWORD}';"
  ok "역할 존재: ${DB_USER} (비밀번호를 .env 값과 동기화)"
else
  pg_super -d postgres <<<"CREATE ROLE \"${DB_USER}\" WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE PASSWORD '${DB_PASSWORD}';"
  ok "역할 생성: ${DB_USER}"
fi
if [[ "$(pg_super -d postgres -Atc "select 1 from pg_database where datname = '${DB_NAME}'")" != 1 ]]; then
  pg_super -d postgres -c "CREATE DATABASE \"${DB_NAME}\" OWNER \"${DB_USER}\" ENCODING 'UTF8' TEMPLATE template0;"
  ok "DB 생성: ${DB_NAME}"
else
  ok "DB 존재: ${DB_NAME}"
fi
# Extensions need a superuser (PostGIS is not "trusted"); migrations then find them in place.
pg_super -d "$DB_NAME" -c "SET client_min_messages = warning; CREATE EXTENSION IF NOT EXISTS postgis; CREATE EXTENSION IF NOT EXISTS pg_trgm;"
pg_super -d "$DB_NAME" -c "REVOKE ALL ON DATABASE \"${DB_NAME}\" FROM PUBLIC; GRANT CONNECT, TEMP ON DATABASE \"${DB_NAME}\" TO \"${DB_USER}\";"
PG_VERSIONS="$(pg_super -d "$DB_NAME" -Atc "select extname || ' ' || extversion from pg_extension where extname in ('postgis','pg_trgm') order by 1" | tr '\n' ' ')"
ok "확장: ${PG_VERSIONS}"
PGPASSWORD="$DB_PASSWORD" psql -X -h 127.0.0.1 -p "$PG_PORT" -U "$DB_USER" -d "$DB_NAME" -Atc 'select 1' >/dev/null ||
  die "앱 계정(${DB_USER})으로 127.0.0.1:${PG_PORT} 접속 실패 (pg_hba.conf 확인)"
ok "앱 계정 TCP 접속 확인 (127.0.0.1:${PG_PORT})"

# ─── 6. Redis ───────────────────────────────────────────────────────────────────────────────
step "Redis (127.0.0.1:${REDIS_PORT}, 비밀번호, noeviction)"
apt_install_missing redis-server
MAXMEM_MB=$((MEM_MB / 8))
((MAXMEM_MB < 128)) && MAXMEM_MB=128
((MAXMEM_MB > 1024)) && MAXMEM_MB=1024
# A drop-in included at the end of redis.conf overrides the package defaults.
# noeviction: BullMQ queues and login sessions must never be silently evicted.
REDIS_CHANGED=false
write_if_changed /etc/redis/house.conf 0640 root:redis <<EOF && REDIS_CHANGED=true
# Managed by house deploy/install.sh
bind 127.0.0.1
protected-mode yes
port ${REDIS_PORT}
requirepass ${REDIS_PASSWORD}
maxmemory ${MAXMEM_MB}mb
maxmemory-policy noeviction
appendonly yes
appendfsync everysec
EOF
if ! grep -q '^include /etc/redis/house.conf' /etc/redis/redis.conf; then
  printf '\n# house overrides\ninclude /etc/redis/house.conf\n' >>/etc/redis/redis.conf
  REDIS_CHANGED=true
fi
redis_ping() { REDISCLI_AUTH="$REDIS_PASSWORD" redis-cli -h 127.0.0.1 -p "$REDIS_PORT" ping 2>/dev/null; }
if $REDIS_CHANGED || [[ "$(redis_ping)" != PONG ]]; then
  if has_systemd; then
    systemctl enable redis-server >/dev/null 2>&1 || true
    systemctl restart redis-server
  elif [[ -x /etc/init.d/redis-server ]]; then
    service redis-server restart >/dev/null 2>&1 || service redis-server start >/dev/null 2>&1 || true
  fi
  if [[ "$(redis_ping)" != PONG ]]; then
    # No init system that manages redis: start it with the packaged config.
    pkill -u redis -f "redis-server .*:${REDIS_PORT}" 2>/dev/null || true
    install -d -m 0755 -o redis -g redis /run/redis /var/log/redis
    runuser -u redis -- redis-server /etc/redis/redis.conf --daemonize yes --supervised no
  fi
  for _ in 1 2 3 4 5 6 7 8 9 10; do [[ "$(redis_ping)" == PONG ]] && break; sleep 1; done
fi
[[ "$(redis_ping)" == PONG ]] || die "Redis(127.0.0.1:${REDIS_PORT})에 비밀번호로 접속할 수 없습니다. 같은 포트를 쓰는 다른 Redis가 있는지 확인하세요."
ok "Redis 응답 확인 (maxmemory ${MAXMEM_MB}mb, noeviction, AOF)"

# ─── 7. deploy.conf + .env ──────────────────────────────────────────────────────────────────
step "설정 파일 ($DEPLOY_CONF, $ENV_FILE)"
SCHEME=https
[[ "$TLS_ENABLED" == true ]] || SCHEME=http
conf_render | write_if_changed "$DEPLOY_CONF" 0640 "root:$HOUSE_USER" || true
ok "deploy.conf"

ENV_EXAMPLE="${SRC_ROOT:-/nonexistent}/apps/api/.env.example"
if $ENV_EXISTS; then
  # The service user only reads it (an app compromise must not rewrite its own config).
  chown "root:$HOUSE_USER" "$ENV_FILE"
  chmod 0640 "$ENV_FILE"
  ok ".env 가 이미 있습니다 — 내용은 그대로 둡니다 ($ENV_FILE, root:$HOUSE_USER 0640)"
else
  [[ -f "$ENV_EXAMPLE" ]] || die "$ENV_EXAMPLE 이 없습니다. 저장소 체크아웃 안에서 install.sh를 실행하세요."
  BASE="${SCHEME}://${DOMAIN}"
  ADMIN_BASE="${SCHEME}://${ADMIN_DOMAIN}"
  declare -A PROD=(
    [NODE_ENV]=production [HOST]=127.0.0.1 [PORT]="$API_PORT" [TRUST_PROXY]=loopback
    [LOG_LEVEL]=info [LOG_PRETTY]=false [SWAGGER_ENABLED]=false
    [PUBLIC_BASE_URL]="$BASE" [ADMIN_BASE_URL]="$ADMIN_BASE" [API_BASE_URL]="$BASE"
    [CORS_ORIGINS]="${BASE},${ADMIN_BASE}"
    [DATABASE_URL]="postgresql://${DB_USER}:${DB_PASSWORD}@127.0.0.1:${PG_PORT}/${DB_NAME}?schema=public"
    [REDIS_URL]="redis://:${REDIS_PASSWORD}@127.0.0.1:${REDIS_PORT}/0"
    [COOKIE_SECRET]="$(rand_b64 48)" [COOKIE_DOMAIN]="" [COOKIE_SECURE]=""
    [TOTP_ENCRYPTION_KEY]="$(rand_b64 32)"
    [KAKAO_REDIRECT_URI]="${BASE}/api/v1/auth/oauth/kakao/callback"
    [NAVER_REDIRECT_URI]="${BASE}/api/v1/auth/oauth/naver/callback"
    [GOOGLE_REDIRECT_URI]="${BASE}/api/v1/auth/oauth/google/callback"
    [UPLOAD_DIR]="${UPLOAD_ROOT}/public" [PRIVATE_UPLOAD_DIR]="${UPLOAD_ROOT}/private"
    [MEDIA_BASE_URL]=/media [JOBS_ENABLED]=true [SEED_ADMIN_EMAIL]="" [SEED_ADMIN_PASSWORD]=""
  )
  TMP_ENV="$(mktemp)"
  {
    echo "# ─────────────────────────────────────────────────────────────────────────────"
    echo "# PRODUCTION environment — generated by deploy/install.sh on $(date '+%Y-%m-%d %H:%M')"
    echo "# from apps/api/.env.example. Secrets below were generated on this server: keep this"
    echo "# file private (0600) and back it up somewhere safe. After editing: ./deploy.sh"
    echo "# ─────────────────────────────────────────────────────────────────────────────"
    # Replace KEY= lines that have a production value (inline comments dropped), keep the rest.
    while IFS= read -r line || [[ -n "$line" ]]; do
      if [[ "$line" =~ ^([A-Z][A-Z0-9_]*)= ]] && [[ -v "PROD[${BASH_REMATCH[1]}]" ]]; then
        key="${BASH_REMATCH[1]}"
        printf '%s=%s\n' "$key" "${PROD[$key]}"
        unset "PROD[$key]"
      else
        printf '%s\n' "$line"
      fi
    done <"$ENV_EXAMPLE"
    for key in "${!PROD[@]}"; do printf '%s=%s\n' "$key" "${PROD[$key]}"; done
  } >"$TMP_ENV"
  # Fail closed if a development placeholder survived.
  if grep -Eq '^(COOKIE_SECRET|TOTP_ENCRYPTION_KEY)=.*(dev-only|change-me|ZGV2LW9ubHkt)' "$TMP_ENV"; then
    rm -f "$TMP_ENV"
    die "개발용 비밀값이 남아 있습니다. .env.example 형식을 확인하세요."
  fi
  install -m 0640 -o root -g "$HOUSE_USER" "$TMP_ENV" "$ENV_FILE"
  rm -f "$TMP_ENV"
  ok ".env 생성 (비밀값 자동 생성, root:$HOUSE_USER 0640)"
fi
# Written by the service user into its own backup directory (never a root write there).
# shellcheck disable=SC2016 # $1/$2 expand in the child shell
as_house bash -c 'umask 077; cp "$1" "$2"' _ "$ENV_FILE" "$BACKUP_DIR/config/env.$(date +%Y%m%d).bak" || true

# ─── 8. deploy scripts → /srv/house/bin ─────────────────────────────────────────────────────
step "배포 스크립트 설치 ($BIN_DIR, root 소유)"
if [[ "$SCRIPT_DIR" != "$(readlink -f "$BIN_DIR")" ]]; then
  kit_install "$SCRIPT_DIR" "$BIN_DIR"
else
  # Re-run from bin/ itself: keep the files, take ownership back.
  kit_validate "$BIN_DIR" || die "$BIN_DIR 검증 실패 — 저장소 체크아웃의 deploy/install.sh 로 다시 실행하세요."
  chown -R root:root "$BIN_DIR"
  chmod -R go-w "$BIN_DIR"
  note_warn "$BIN_DIR 에서 실행했습니다. 이전 설치에서 서비스 사용자 소유였다면 신뢰할 수 있는 체크아웃으로 --kit-only 를 다시 실행하세요."
fi
install_kit_links
ok "$HOUSE_ROOT/deploy.sh, rollback.sh, status.sh, backup.sh, restore.sh, create-admin.sh, db-shell.sh"

# ─── 9. Git mirror ──────────────────────────────────────────────────────────────────────────
step "Git 저장소 미러"
REPO_READY=false
MIRROR_SSH="ssh -o BatchMode=yes"
[[ -f "$KNOWN_HOSTS_FILE" ]] && MIRROR_SSH+=" -o UserKnownHostsFile=$KNOWN_HOSTS_FILE -o StrictHostKeyChecking=yes"
if [[ -z "$REPO_URL" ]]; then
  note_warn "--repo 가 지정되지 않았습니다. 나중에: sudo $BIN_DIR/install.sh --domain $DOMAIN --repo <URL> --no-tls(또는 --email ...)"
elif [[ -f "$MIRROR_DIR/HEAD" ]]; then
  as_house git -C "$MIRROR_DIR" remote set-url origin "$REPO_URL"
  if as_house env GIT_SSH_COMMAND="$MIRROR_SSH" git -C "$MIRROR_DIR" fetch --prune -q origin; then
    REPO_READY=true
    ok "미러 갱신: $MIRROR_DIR"
  else
    note_warn "저장소를 가져오지 못했습니다 — 아래 배포 키를 저장소에 등록했는지 확인하세요."
  fi
elif as_house env GIT_SSH_COMMAND="$MIRROR_SSH" git clone -q --mirror "$REPO_URL" "$MIRROR_DIR"; then
  REPO_READY=true
  ok "미러 생성: $MIRROR_DIR"
else
  rm -rf "$MIRROR_DIR"
  root_dir 0755 "$HOUSE_USER:$HOUSE_USER" "$MIRROR_DIR"
  note_warn "저장소를 복제하지 못했습니다 — 비공개 저장소라면 아래 배포 키를 GitHub에 등록 후 ./deploy.sh 를 실행하세요."
fi

# ─── 10. Nginx + Certbot ────────────────────────────────────────────────────────────────────
step "Nginx 설치"
apt_install_missing nginx
install -d -m 0755 /var/www/letsencrypt
configure_nginx

CERT_OK=false
if [[ "$TLS_ENABLED" == true ]]; then
  step "Let's Encrypt 인증서 (${DOMAIN}, www.${DOMAIN}, ${ADMIN_DOMAIN})"
  apt_install_missing certbot python3-certbot-nginx
  write_if_changed /etc/letsencrypt/renewal-hooks/deploy/house-nginx-reload.sh 0755 <<'EOF' || true
#!/bin/sh
# Reload nginx after certbot renews the certificate (installed by house deploy/install.sh).
nginx -t -q && { systemctl reload nginx 2>/dev/null || nginx -s reload; }
EOF
  if cert_matches && openssl x509 -checkend 2592000 -noout -in "$CERT_PEM" >/dev/null 2>&1; then
    CERT_OK=true
    ok "유효한 인증서가 이미 있습니다 (30일 이상 남음, ${DOMAIN}/www/${ADMIN_DOMAIN} 포함)"
  else
    if [[ -s "$CERT_PEM" ]] && ! cert_matches; then
      log "기존 인증서에 ${DOMAIN}, www.${DOMAIN}, ${ADMIN_DOMAIN} 중 빠진 이름이 있습니다 → 새 이름으로 다시 발급"
    fi
    for name in "$DOMAIN" "www.$DOMAIN" "$ADMIN_DOMAIN"; do
      getent ahosts "$name" >/dev/null || note_warn "DNS에서 $name 을(를) 찾을 수 없습니다 (A 레코드 확인)."
    done
    # --cert-name with a new -d list replaces the certificate's name set.
    CERTBOT_ARGS=(certonly --webroot -w /var/www/letsencrypt --cert-name house
      -d "$DOMAIN" -d "www.$DOMAIN" -d "$ADMIN_DOMAIN"
      --email "$OPT_EMAIL" --agree-tos --no-eff-email --non-interactive --keep-until-expiring)
    $STAGING && CERTBOT_ARGS+=(--staging)
    if certbot "${CERTBOT_ARGS[@]}"; then
      CERT_OK=true
      ok "인증서 발급 완료"
    else
      note_warn "인증서 발급 실패 — DNS가 이 서버를 가리키는지 확인 후 install.sh를 다시 실행하세요 (HTTP 모드로 계속)."
    fi
  fi
  if $CERT_OK; then
    configure_nginx
    if has_systemd; then systemctl enable --now certbot.timer >/dev/null 2>&1 || true; fi
    upgrade_env_to_https
  fi
fi

# An existing .env is never rewritten: after a domain change, say exactly what to edit.
url_host() { local u="${1#*://}"; printf '%s' "${u%%[/:]*}"; }
if $ENV_EXISTS; then
  ENV_HOST="$(url_host "$(env_get PUBLIC_BASE_URL)")"
  ENV_ADMIN_HOST="$(url_host "$(env_get ADMIN_BASE_URL)")"
  if [[ "$ENV_HOST" != "$DOMAIN" || "$ENV_ADMIN_HOST" != "$ADMIN_DOMAIN" ]]; then
    note_warn ".env 의 주소(${ENV_HOST:-없음}, ${ENV_ADMIN_HOST:-없음})가 새 도메인(${DOMAIN}, ${ADMIN_DOMAIN})과 다릅니다. sudo nano ${ENV_FILE} 에서 PUBLIC_BASE_URL, ADMIN_BASE_URL, API_BASE_URL, CORS_ORIGINS, KAKAO_REDIRECT_URI, NAVER_REDIRECT_URI, GOOGLE_REDIRECT_URI 를 ${SCHEME}://${DOMAIN} / ${SCHEME}://${ADMIN_DOMAIN} 기준으로 고치고, 각 로그인 콘솔의 Redirect URI도 바꾼 뒤 sudo ${HOUSE_ROOT}/deploy.sh"
  fi
fi

# ─── 11. PM2 runtime ────────────────────────────────────────────────────────────────────────
step "PM2 (로그 순환, 부팅 시 자동 시작)"
as_house env PM2_HOME="/home/$HOUSE_USER/.pm2" pm2 ping >/dev/null
if ! as_house env PM2_HOME="/home/$HOUSE_USER/.pm2" pm2 jlist 2>/dev/null | grep -q '"name":"pm2-logrotate"'; then
  as_house env PM2_HOME="/home/$HOUSE_USER/.pm2" pm2 install pm2-logrotate >/dev/null
fi
for kv in max_size=50M retain=14 compress=true dateFormat=YYYY-MM-DD_HH-mm-ss rotateInterval='0 0 * * *'; do
  as_house env PM2_HOME="/home/$HOUSE_USER/.pm2" pm2 set "pm2-logrotate:${kv%%=*}" "${kv#*=}" >/dev/null
done
ok "pm2-logrotate (50MB/매일, 14개 보관, 압축)"
if $SKIP_PM2_STARTUP; then
  log "PM2 startup 생략 (--skip-pm2-startup)"
elif has_systemd; then
  env PATH="$PATH" pm2 startup systemd -u "$HOUSE_USER" --hp "/home/$HOUSE_USER" >/dev/null
  systemctl enable "pm2-${HOUSE_USER}" >/dev/null 2>&1 || true
  ok "systemd 서비스 pm2-${HOUSE_USER} (재부팅 시 앱 자동 시작)"
else
  note_warn "systemd가 없어 PM2 부팅 자동 시작을 등록하지 않았습니다."
fi

# ─── 12. logrotate + cron ───────────────────────────────────────────────────────────────────
step "logrotate, cron (백업)"
write_if_changed /etc/logrotate.d/house 0644 <<EOF || true
# deploy/backup logs (PM2 app logs are rotated by pm2-logrotate)
${LOG_DIR}/*.log {
    su ${HOUSE_USER} ${HOUSE_USER}
    weekly
    rotate 12
    compress
    delaycompress
    missingok
    notifempty
    copytruncate
}
EOF
write_if_changed /etc/cron.d/house 0644 <<EOF || true
# house platform jobs (installed by deploy/install.sh)
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
# 매일 03:30 DB 백업 + 업로드 스냅샷, 14일 보관 (최근 7개는 항상 보관)
30 3 * * * ${HOUSE_USER} ${BIN_DIR}/backup.sh --cron >> ${LOG_DIR}/backup.log 2>&1
EOF
svc enable cron >/dev/null 2>&1 || note_warn "cron 서비스를 시작하지 못했습니다 (컨테이너라면 정상)."
ok "/etc/cron.d/house, /etc/logrotate.d/house"

# ─── 13. firewall + fail2ban ────────────────────────────────────────────────────────────────
step "방화벽 (UFW) / fail2ban"
# Never lock the operator out: also allow the port of this SSH session and sshd's own ports.
SSH_PORTS=("$OPT_SSH_PORT")
[[ -n "${SSH_CONNECTION:-}" ]] && SSH_PORTS+=("$(awk '{print $4}' <<<"$SSH_CONNECTION")")
if have sshd; then
  while read -r p; do SSH_PORTS+=("$p"); done < <(sshd -T 2>/dev/null | awk '$1 == "port" {print $2}')
fi
mapfile -t SSH_PORTS < <(printf '%s\n' "${SSH_PORTS[@]}" | grep -E '^[0-9]+$' | sort -un)
SSH_PORTS_CSV="$(IFS=,; echo "${SSH_PORTS[*]}")"
if $SKIP_FIREWALL; then
  log "UFW 생략 (--skip-firewall)"
elif ! has_systemd; then
  note_warn "systemd가 없어 UFW 설정을 건너뜁니다."
else
  apt_install_missing ufw
  for p in "${SSH_PORTS[@]}"; do ufw allow "${p}/tcp" comment 'ssh' >/dev/null; done
  ufw allow 80/tcp comment 'http' >/dev/null
  ufw allow 443/tcp comment 'https' >/dev/null
  ufw default deny incoming >/dev/null
  ufw default allow outgoing >/dev/null
  ufw --force enable >/dev/null
  ok "UFW: SSH(${SSH_PORTS[*]}), 80, 443 허용 (그 외 차단)"
fi
if $SKIP_FAIL2BAN; then
  log "fail2ban 생략 (--skip-fail2ban)"
elif ! has_systemd; then
  note_warn "systemd가 없어 fail2ban 설정을 건너뜁니다."
else
  apt_install_missing fail2ban python3-systemd
  write_if_changed /etc/fail2ban/jail.d/house.conf 0644 <<EOF || true
# Installed by house deploy/install.sh
[DEFAULT]
bantime = 1h
findtime = 10m
maxretry = 5
backend = systemd

[sshd]
enabled = true
port = ${SSH_PORTS_CSV}

# No nginx-limit-req jail: Korean mobile carriers put many users behind one CGNAT address, and
# banning it would lock all of them out of 80/443. Per-IP 429s (nginx) and per-user limits
# (API, Redis) handle abuse instead.
EOF
  systemctl enable fail2ban >/dev/null 2>&1 || true
  systemctl restart fail2ban
  ok "fail2ban: sshd"
fi

# ─── summary ────────────────────────────────────────────────────────────────────────────────
cat <<EOF

${C_GRN}════════════════════════════════════════════════════════════════════════════
 서버 기본 설치가 끝났습니다.
════════════════════════════════════════════════════════════════════════════${C_RST}
 사이트       ${SCHEME}://${DOMAIN}   (www → apex)
 관리자       ${SCHEME}://${ADMIN_DOMAIN}
 DB           PostgreSQL 16 / ${DB_NAME} (역할 ${DB_USER}, 127.0.0.1:${PG_PORT})
 Redis        127.0.0.1:${REDIS_PORT} (비밀번호 설정됨)
 설정 파일    ${ENV_FILE}   (root:${HOUSE_USER} 0640, 비밀값 자동 생성됨)
 배포 설정    ${DEPLOY_CONF}
 업로드       ${UPLOAD_ROOT}/public (공개)  ·  ${UPLOAD_ROOT}/private (비공개)
 백업         ${BACKUP_DIR} (매일 03:30 DB·업로드, 14일 보관)
 로그         ${LOG_DIR}

${C_BLU}▶ 다음 할 일${C_RST}
 1) .env 에 외부 서비스 키를 넣으세요:   sudo nano ${ENV_FILE}
    - KAKAO_CLIENT_ID / KAKAO_CLIENT_SECRET     (카카오 developers.kakao.com)
    - NAVER_CLIENT_ID / NAVER_CLIENT_SECRET     (네이버 developers.naver.com)
    - GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET   (console.cloud.google.com)
    - NAVER_MAP_CLIENT_ID / NAVER_MAP_CLIENT_SECRET (네이버 클라우드 플랫폼 Maps)
    - DATA_GO_KR_SERVICE_KEY                    (공공데이터포털 data.go.kr, 실거래가)
    각 콘솔에 등록할 로그인 Redirect URI:
      ${SCHEME}://${DOMAIN}/api/v1/auth/oauth/kakao/callback
      ${SCHEME}://${DOMAIN}/api/v1/auth/oauth/naver/callback
      ${SCHEME}://${DOMAIN}/api/v1/auth/oauth/google/callback
    (SMS 발송 서비스는 사용하지 않으므로 SMS 키는 필요 없습니다.)
 2) 배포:          sudo ${HOUSE_ROOT}/deploy.sh
 3) 관리자 계정:   sudo ${HOUSE_ROOT}/create-admin.sh   (첫 로그인 때 OTP 등록)
 4) 상태 확인:     sudo ${HOUSE_ROOT}/status.sh
EOF
if [[ -n "$REPO_URL" && "$REPO_READY" != true ]]; then
  cat <<EOF

${C_YLW}▶ 저장소 접근 설정 필요${C_RST}
 GitHub 저장소 → Settings → Deploy keys → Add deploy key (Allow write 체크 해제) 에 아래 키를 등록:
   ${DEPLOY_PUBKEY}
 그 다음 sudo ${HOUSE_ROOT}/deploy.sh 를 실행하면 저장소를 자동으로 가져옵니다.
EOF
fi
if ((${#SUMMARY_WARNINGS[@]})); then
  printf '\n%s▶ 확인할 경고%s\n' "$C_YLW" "$C_RST"
  for w in "${SUMMARY_WARNINGS[@]}"; do printf '  - %s\n' "$w"; done
fi
if [[ "$TLS_ENABLED" != true ]]; then
  printf '\n%s※ --no-tls 모드입니다. 운영에서는 HTTPS가 필수입니다(로그인 쿠키는 HTTPS에서만 동작).%s\n' "$C_YLW" "$C_RST"
elif ! $CERT_OK; then
  printf '\n%s※ 인증서가 아직 없습니다. DNS 설정 후 같은 명령으로 install.sh 를 다시 실행하세요.%s\n' "$C_YLW" "$C_RST"
fi
echo
