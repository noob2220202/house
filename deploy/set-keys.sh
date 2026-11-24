#!/usr/bin/env bash
# Enter the external service keys one by one, without opening an editor.
#   sudo /srv/house/set-keys.sh          → asks for every key (Enter keeps the current value)
#   sudo /srv/house/set-keys.sh kakao    → only one service: kakao|naver|google|data|vworld
#     (kakao = 로그인 REST API 키 + 시크릿 + 지도 JavaScript 키 — one 카카오 앱, docs/KEY_SETUP.md)
# Secrets are typed hidden and written only to /srv/house/shared/.env (root:house 0640).
# Run deploy.sh afterwards so the apps pick the new values up.
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")" && pwd)"
# shellcheck source=lib/common.sh
source "$SCRIPT_DIR/lib/common.sh"

[[ $EUID -eq 0 ]] || die "root로 실행하세요: sudo $HOUSE_ROOT/set-keys.sh"
[[ -f "$ENV_FILE" ]] || die "$ENV_FILE 이 없습니다. 먼저 install.sh 를 실행하세요."

# service|KEY|secret(1/0)|label|where to find it|format regex
FIELDS=(
  "kakao|KAKAO_CLIENT_ID|0|카카오 REST API 키|developers.kakao.com → 앱 → 플랫폼 키 → REST API 키|^[0-9a-f]{32}$"
  "kakao|KAKAO_CLIENT_SECRET|1|카카오 클라이언트 시크릿|REST API 키 카드 → 클라이언트 시크릿 (사용함으로 켜기)|^[A-Za-z0-9]{16,64}$"
  "kakao|NEXT_PUBLIC_KAKAO_MAP_KEY|0|카카오 JavaScript 키 (지도, 공개값)|같은 앱 → 플랫폼 키 → JavaScript 키 (사이트 도메인 등록 + 카카오맵 ON)|^[0-9a-f]{32}$"
  "naver|NAVER_CLIENT_ID|0|네이버 로그인 Client ID|developers.naver.com → Application → 내 애플리케이션|^[A-Za-z0-9_-]{8,64}$"
  "naver|NAVER_CLIENT_SECRET|1|네이버 로그인 Client Secret|같은 화면의 Client Secret|^[A-Za-z0-9_-]{6,64}$"
  "google|GOOGLE_CLIENT_ID|0|Google 클라이언트 ID|console.cloud.google.com → Google 인증 플랫폼 → 클라이언트|^[0-9]+-[a-z0-9]+\.apps\.googleusercontent\.com$"
  "google|GOOGLE_CLIENT_SECRET|1|Google 클라이언트 보안 비밀번호|같은 클라이언트의 보안 비밀번호 (GOCSPX-…)|^[A-Za-z0-9_-]{20,64}$"
  "data|DATA_GO_KR_SERVICE_KEY|1|공공데이터포털 일반 인증키 (Decoding)|data.go.kr → 마이페이지 → 인증키 → Decoding|^[A-Za-z0-9+/=]{40,200}$"
  "vworld|VWORLD_API_KEY|1|브이월드 인증키 (선택)|vworld.kr → 오픈API → 인증키 관리|^[A-Za-z0-9-]{20,64}$"
)
ONLY="${1:-}"
if [[ "$ONLY" == map ]]; then
  die "지도는 이제 카카오맵입니다 (네이버 클라우드 지도 키는 쓰지 않습니다): sudo $HOUSE_ROOT/set-keys.sh kakao"
fi
if [[ -n "$ONLY" && ! "$ONLY" =~ ^(kakao|naver|google|data|vworld)$ ]]; then
  die "알 수 없는 항목: $ONLY (kakao|naver|google|data|vworld 중 하나)"
fi

mask() {
  local v="$1"
  if [[ -z "$v" ]]; then printf '비어 있음'; elif ((${#v} <= 8)); then printf '설정됨'; else printf '설정됨 (…%s)' "${v: -4}"; fi
}

# Replace KEY=… in place (or append), keeping every other line. Values are written double-quoted.
env_set() {
  local key="$1" val="$2" tmp
  tmp="$(mktemp "$SHARED_DIR/.env.XXXXXX")"
  awk -v k="$key" -v line="$key=\"$val\"" '
    BEGIN { done = 0 }
    {
      l = $0; sub(/^[[:space:]]*(export[[:space:]]+)?/, "", l)
      if (!done && index(l, k "=") == 1) { print line; done = 1; next }
      print
    }
    END { if (!done) print line }
  ' "$ENV_FILE" >"$tmp"
  chown root:"$HOUSE_USER" "$tmp"
  chmod 0640 "$tmp"
  mv -f "$tmp" "$ENV_FILE"
}

changed=0
step "외부 서비스 키 입력 (Enter = 지금 값 유지, 비밀값은 화면에 보이지 않습니다)"
for f in "${FIELDS[@]}"; do
  IFS='|' read -r svc key secret label where re <<<"$f"
  [[ -z "$ONLY" || "$ONLY" == "$svc" ]] || continue
  cur="$(env_get "$key")"
  printf '\n%s%s%s  %s[%s]%s\n  %s찾는 곳: %s%s\n' "$C_BLU" "$label" "$C_RST" "$C_DIM" "$(mask "$cur")" "$C_RST" "$C_DIM" "$where" "$C_RST"
  while true; do
    if [[ "$secret" == 1 ]]; then
      read -r -s -p "  붙여넣기: " val || val="" # end of input = keep the current value
      echo
    else
      read -r -p "  붙여넣기: " val || val=""
    fi
    val="${val#"${val%%[![:space:]]*}"}"
    val="${val%"${val##*[![:space:]]}"}"
    [[ -z "$val" ]] && break
    if [[ "$val" == *'"'* || "$val" == *\\* || "$val" =~ [[:space:]] ]]; then
      warn "공백·따옴표·역슬래시가 들어 있습니다. 값만 다시 복사해 붙여넣으세요."
      continue
    fi
    if [[ ! "$val" =~ $re ]]; then
      warn "형식이 예상과 다릅니다 (길이 ${#val}자). 다른 칸의 값을 붙여넣지 않았는지 확인하세요."
      read -r -p "  그래도 저장할까요? [y/N] " yn || yn=""
      [[ "$yn" =~ ^[Yy]$ ]] || continue
    fi
    env_set "$key" "$val"
    changed=1
    ok "$key 저장"
    break
  done
done

# Maps moved from Naver Cloud to Kakao (DECISIONS D13): old lines are harmless and left as they are.
legacy=()
for key in NAVER_MAP_CLIENT_ID NAVER_MAP_CLIENT_SECRET NEXT_PUBLIC_NAVER_MAP_KEY_ID; do
  if [[ -n "$(env_get "$key")" ]]; then legacy+=("$key"); fi
done
if ((${#legacy[@]})); then
  printf '\n%s참고: %s 는 더 이상 쓰지 않습니다 (지도 = 카카오맵). 지워도 됩니다: sudo nano %s%s\n' \
    "$C_DIM" "${legacy[*]}" "$ENV_FILE" "$C_RST"
fi

step "현재 상태"
for f in "${FIELDS[@]}"; do
  IFS='|' read -r _ key _ label _ _ <<<"$f"
  v="$(env_get "$key")"
  if [[ -n "$v" ]]; then ok "$label"; else printf '%s  ✘ %s (비어 있음)%s\n' "$C_YLW" "$label" "$C_RST"; fi
done

if ((changed)); then
  printf '\n%s바뀐 키를 사이트에 반영하려면:%s  sudo %s/deploy.sh\n' "$C_BLU" "$C_RST" "$HOUSE_ROOT"
  printf '  (NEXT_PUBLIC_* 값이 바뀌었으면 deploy.sh 가 같은 커밋이어도 웹/관리자를 자동으로 다시 빌드합니다.)\n'
else
  printf '\n바뀐 값이 없습니다.\n'
fi
