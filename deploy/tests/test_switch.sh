#!/usr/bin/env bash
# The service user switches releases/.active; the root-owned 'current' link points at it.
source "$(dirname "$0")/lib.sh"
load_common

mkdir -p "$RELEASES_DIR/20260101000000-aaaaaaa" "$RELEASES_DIR/20260102000000-bbbbbbb"
assert_eq "no release yet" "$(current_release)" ""
ln -s releases/.active "$CURRENT_LINK"
assert_eq "dangling current → no release" "$(current_release)" ""
( switch_current "$RELEASES_DIR/20260101000000-aaaaaaa" )
assert_eq "switch via .active" "$(current_release)" "$RELEASES_DIR/20260101000000-aaaaaaa"
assert_eq "current itself untouched" "$(readlink "$CURRENT_LINK")" "releases/.active"
( switch_current "$RELEASES_DIR/20260102000000-bbbbbbb" )
assert_eq "second switch" "$(current_release)" "$RELEASES_DIR/20260102000000-bbbbbbb"
assert_eq "list_releases ignores the .active link" "$(list_releases | tr '\n' ' ')" "20260101000000-aaaaaaa 20260102000000-bbbbbbb "
# Old layout (current → release dir directly) still switches, with a warning.
rm "$CURRENT_LINK" && ln -s "$RELEASES_DIR/20260101000000-aaaaaaa" "$CURRENT_LINK"
out="$( switch_current "$RELEASES_DIR/20260102000000-bbbbbbb" 2>&1 )"
assert_contains "legacy layout warns to re-run install.sh" "$out" "install.sh"
assert_eq "legacy layout switched" "$(current_release)" "$RELEASES_DIR/20260102000000-bbbbbbb"

if is_root && id "$HOUSE_USER" >/dev/null 2>&1; then
  chown root:root "$HOUSE_ROOT" && chmod 0755 "$HOUSE_ROOT"
  chown -R "$HOUSE_USER:$HOUSE_USER" "$RELEASES_DIR"
  rm "$CURRENT_LINK" && ln -s releases/.active "$CURRENT_LINK"
  out="$(runuser -u "$HOUSE_USER" -- env HOUSE_ROOT="$HOUSE_ROOT" bash -c "source '$KIT_DIR/lib/common.sh'; switch_current '$RELEASES_DIR/20260101000000-aaaaaaa'; current_release" 2>&1)"
  assert_eq "service user can switch with a root-owned /srv/house" "$out" "$RELEASES_DIR/20260101000000-aaaaaaa"
  check_fails "service user cannot repoint the root-owned current link" runuser -u "$HOUSE_USER" -- ln -sfn /tmp "$CURRENT_LINK"
else
  skip "switch as service user" "needs root"
fi
t_finish
