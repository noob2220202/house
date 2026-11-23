#!/usr/bin/env bash
# One-screen server status: release, PM2 apps, health endpoints, services, disk, backups, TLS.
#   sudo /srv/house/status.sh
set -Euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")" && pwd)"
# shellcheck source=lib/common.sh
source "$SCRIPT_DIR/lib/common.sh"
load_conf

# Pads by display width (Hangul is two columns wide).
row() {
  local label="$1" hangul="${1//[^가-힣]/}"
  local pad=$((16 - ${#label} - ${#hangul}))
  ((pad < 1)) && pad=1
  printf '  %s%*s%s\n' "$label" "$pad" '' "$2"
}
badge() { if [[ "$1" == 0 ]]; then printf '%s정상%s' "$C_GRN" "$C_RST"; else printf '%s실패%s' "$C_RED" "$C_RST"; fi; }

step "릴리스"
CUR="$(current_release)"
if [[ -n "$CUR" ]]; then
  row "현재" "$(basename "$CUR")"
  row "커밋" "$(sed -n 's/^subject=//p' "$CUR/RELEASE_INFO" 2>/dev/null)"
  row "배포 시각" "$(sed -n 's/^deployed_at=//p' "$CUR/RELEASE_INFO" 2>/dev/null)"
else
  row "현재" "(아직 배포 안 됨)"
fi
row "보관 릴리스" "$(list_releases | wc -l)개 ($RELEASES_DIR)"

step "PM2 앱"
# shellcheck disable=SC2016 # positional args expand in the child shell / node
pm2_cmd jlist 2>/dev/null | node -e '
  let s = "";
  process.stdin.on("data", (d) => (s += d)).on("end", () => {
    let list = [];
    try { list = JSON.parse(s); } catch { console.log("  (PM2 응답 없음)"); return; }
    const rows = list.filter((p) => p.name.startsWith("house-"));
    if (rows.length === 0) { console.log("  (실행 중인 앱 없음 — ./deploy.sh 실행)"); return; }
    for (const p of rows) {
      const e = p.pm2_env;
      const up = e.status === "online" ? Math.round((Date.now() - e.pm_uptime) / 60000) + "분" : "-";
      const mem = p.monit ? Math.round(p.monit.memory / 1048576) + "MB" : "-";
      console.log(`  ${p.name.padEnd(14)} #${String(p.pm_id).padEnd(3)} ${e.status.padEnd(8)} uptime ${up.padEnd(7)} mem ${mem.padEnd(6)} restarts ${e.restart_time}`);
    }
  });
'

step "헬스체크"
for p in "api|http://127.0.0.1:${API_PORT}/api/v1/health/ready" \
  "web|http://127.0.0.1:${WEB_PORT}/healthz" "admin|http://127.0.0.1:${ADMIN_PORT}/healthz"; do
  http_ok "${p#*|}"
  row "${p%%|*}" "$(badge $?)  ${p#*|}"
done
if [[ -n "$CUR" ]] && worker_uses_http "$CUR"; then
  http_ok "http://127.0.0.1:${WORKER_PORT}/api/v1/health/ready"
  row "worker" "$(badge $?)  http://127.0.0.1:${WORKER_PORT}/api/v1/health/ready"
fi
if [[ -n "$DOMAIN" ]]; then
  scheme=https
  [[ "$TLS_ENABLED" == true ]] || scheme=http
  port=443
  [[ "$scheme" == https ]] || port=80
  # Through the local nginx with the real Host/SNI (works before DNS points here).
  curl -fs --noproxy '*' -o /dev/null --max-time 8 --resolve "$DOMAIN:$port:127.0.0.1" "$scheme://$DOMAIN/api/v1/health"
  row "nginx" "$(badge $?)  $scheme://$DOMAIN/api/v1/health"
fi

step "서비스"
for svc in nginx postgresql redis-server cron fail2ban; do
  if has_systemd; then
    state="$(systemctl is-active "$svc" 2>/dev/null || true)"
  else
    case "$svc" in
      postgresql) pgrep -f 'postgres -D' >/dev/null && state=active || state=inactive ;;
      redis-server) pgrep -x redis-server >/dev/null && state=active || state=inactive ;;
      *) pgrep -x "$svc" >/dev/null && state=active || state="inactive/미설치" ;;
    esac
  fi
  row "$svc" "${state:-unknown}"
done

step "디스크 / 메모리"
df -h / "$UPLOAD_ROOT" "$BACKUP_DIR" 2>/dev/null | awk 'NR == 1 || !seen[$1]++' | sed 's/^/  /'
free -h | sed 's/^/  /'
row "업로드" "$(du -sh "$UPLOAD_ROOT" 2>/dev/null | cut -f1)"

step "백업"
LAST_DUMP="$(find "$BACKUP_DIR/db" -maxdepth 1 -name '*.dump' -printf '%T@ %p\n' 2>/dev/null | sort -rn | head -1 | cut -d' ' -f2-)"
if [[ -n "$LAST_DUMP" ]]; then
  age_h=$(( ($(date +%s) - $(stat -c %Y "$LAST_DUMP")) / 3600 ))
  flag=""
  ((age_h > 26)) && flag="  ${C_RED}← 26시간 넘게 백업 없음${C_RST}"
  row "최근 DB" "$(basename "$LAST_DUMP") (${age_h}시간 전)${flag}"
else
  row "최근 DB" "${C_RED}없음${C_RST}"
fi
row "업로드 스냅샷" "$(find "$BACKUP_DIR/uploads" -mindepth 1 -maxdepth 1 -type d -name '20*' -printf '%f\n' 2>/dev/null | sort | tail -1)"
row "총 사용량" "$(du -sh "$BACKUP_DIR" 2>/dev/null | cut -f1)"

step "TLS 인증서"
CERT=/etc/letsencrypt/live/house/fullchain.pem
if [[ -r "$CERT" ]]; then
  end="$(openssl x509 -enddate -noout -in "$CERT" | cut -d= -f2)"
  days=$(( ($(date -d "$end" +%s) - $(date +%s)) / 86400 ))
  row "만료" "$end (${days}일 남음)"
elif [[ -e "$CERT" ]]; then
  row "만료" "(root 권한으로 실행하면 표시됩니다)"
else
  row "만료" "인증서 없음 (TLS_ENABLED=${TLS_ENABLED})"
fi
echo
