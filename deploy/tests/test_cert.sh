#!/usr/bin/env bash
# install.sh reuses a certificate only when its SANs cover every configured name.
source "$(dirname "$0")/lib.sh"
load_common

mk() {
  openssl req -x509 -newkey rsa:2048 -nodes -days 90 -subj "/CN=$1" -keyout "$T_TMP/k.pem" \
    -out "$2" -addext "subjectAltName=$3" >/dev/null 2>&1
}
mk example.com "$T_TMP/a.pem" "DNS:example.com,DNS:www.example.com,DNS:admin.example.com"
check "covers all three names" cert_covers "$T_TMP/a.pem" example.com www.example.com admin.example.com
check "name match is case-insensitive" cert_covers "$T_TMP/a.pem" EXAMPLE.com
check_fails "new admin subdomain not covered" cert_covers "$T_TMP/a.pem" example.com www.example.com office.example.com
check_fails "new domain not covered" cert_covers "$T_TMP/a.pem" example.org
mk www.example.com "$T_TMP/b.pem" "DNS:www.example.com"
check_fails "apex is not matched by www (exact names)" cert_covers "$T_TMP/b.pem" example.com
check_fails "missing file" cert_covers "$T_TMP/none.pem" example.com
grep -q 'cert_matches && openssl x509 -checkend' "$KIT_DIR/install.sh" && pass "install.sh CERT_OK requires matching SANs" ||
  fail "install.sh CERT_OK does not check SANs"
grep -q 'ADMIN_BASE_URL, API_BASE_URL, CORS_ORIGINS, NEXT_PUBLIC_SITE_URL, KAKAO_REDIRECT_URI, NAVER_REDIRECT_URI, GOOGLE_REDIRECT_URI' "$KIT_DIR/install.sh" &&
  pass "install.sh warns which .env keys to edit after a domain change" || fail "domain-change .env warning missing"
t_finish
