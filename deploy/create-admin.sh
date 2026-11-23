#!/usr/bin/env bash
# Create the first SUPER_ADMIN (or another admin) without putting the password in any file.
# TOTP (OTP 앱) is enrolled on the first login, before any admin page works.
#   sudo /srv/house/create-admin.sh
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")" && pwd)"
# shellcheck source=lib/common.sh
source "$SCRIPT_DIR/lib/common.sh"

ensure_house_user "$@"
load_conf
CUR="$(current_release)"
[[ -n "$CUR" ]] || die "아직 배포된 릴리스가 없습니다. 먼저 ./deploy.sh 를 실행하세요."

read -r -p "관리자 이메일: " EMAIL
[[ "$EMAIL" =~ ^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$ ]] || die "이메일 형식이 올바르지 않습니다."
read -r -s -p "비밀번호 (12자 이상): " PW1
echo
read -r -s -p "비밀번호 확인: " PW2
echo
[[ "$PW1" == "$PW2" ]] || die "비밀번호가 일치하지 않습니다."
((${#PW1} >= 12)) || die "비밀번호는 12자 이상이어야 합니다."

# The seed is idempotent: it creates the admin only if the email does not exist yet.
cd "$CUR/apps/api"
ADMIN_BOOTSTRAP_EMAIL="$EMAIL" ADMIN_BOOTSTRAP_PASSWORD="$PW1" pnpm exec prisma db seed
scheme=https
[[ "$TLS_ENABLED" == true ]] || scheme=http
ok "완료. ${scheme}://${ADMIN_DOMAIN} 에서 로그인하고 OTP 앱(Google Authenticator 등)을 등록하세요."
