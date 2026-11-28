#!/usr/bin/env bash
# rollback.sh: refuses targets that cannot boot with today's .env/DB (OPS-03) and targets that do
# not know every applied migration unless --force + a typed name (OPS-04); on a failed health
# check it switches back to the release that was live before.
source "$(dirname "$0")/lib.sh"
r="$KIT_DIR/rollback.sh"
src="$(cat "$r")"

# ─── control flow (static: the switch path itself needs PM2) ───
pre="$(grep -n 'lib/preflight.cjs' "$r" | head -1 | cut -d: -f1)"
sw="$(grep -n '^switch_current "\$TARGET"' "$r" | head -1 | cut -d: -f1)"
[[ -n "$pre" && -n "$sw" ]] && ((pre < sw)) && pass "preflight runs before switch_current" ||
  fail "rollback switches without a preflight"
assert_contains "preflight failure says nothing was switched" "$src" "전환하지 않았습니다"
assert_contains "--no-preflight escape hatch" "$src" "--no-preflight) PREFLIGHT=false"
health_fail="$(awk '/^if pm2_apply "\$CURRENT_LINK" && health_check "\$TARGET"/,/^fi$/' "$r")"
# A target without office sites: house-sites runs at once (it takes their servers down).
health_ok="$(sed -n '1,/^else$/p' <<<"$health_fail")"
assert_contains "a target without office sites starts house-sites at once" "$health_ok" 'if [[ ! -d "$TARGET/$SITES_WEB_ROUTE"'
assert_contains "  … through its systemd unit" "$health_ok" "systemctl start --no-block house-sites.service"
assert_contains "failed health check switches back" "$(sed -n '/^else$/,/^fi$/p' <<<"$health_fail")" "restore_previous"
restore="$(awk '/^restore_previous\(\) \{/,/^\}/' "$r")"
assert_contains "switch back goes to the previously live release" "$restore" 'switch_current "$CURRENT"'
assert_contains "switch back reloads PM2" "$restore" 'pm2_apply "$CURRENT_LINK"'
assert_contains "signals after the switch also switch back" "$src" "trap 'restore_previous; exit 143' TERM"
assert_contains "detached run keeps --force" "$src" 'DETACHED_ARGS+=(--force)'
assert_contains "detached run keeps --no-preflight" "$src" 'DETACHED_ARGS+=(--no-preflight)'
mc="$(grep -n 'migrations_unknown_to "\$TARGET"' "$r" | head -1 | cut -d: -f1)"
cf="$(grep -n '진행할까요' "$r" | head -1 | cut -d: -f1)"
[[ -n "$mc" && -n "$cf" ]] && ((mc < cf)) && pass "migration check before the confirmation" ||
  fail "no migration check before confirming"
assert_not_contains "no 'older code keeps working' claim" "$src" "so older code
# keeps working"

if ! is_root || ! id house >/dev/null 2>&1 || ! pg_available; then
  skip "rollback.sh end to end" "needs root, the 'house' user and PostgreSQL"
  t_finish
  exit $?
fi

# ─── end to end up to the switch, as the service user ───
load_common
DB="hdt_rb_$$"
t_on_exit "tpsql -d postgres -c 'DROP DATABASE IF EXISTS \"$DB\"' >/dev/null 2>&1"
tpsql -d postgres -c "CREATE DATABASE \"$DB\"" >/dev/null
tpsql -d "$DB" -c "CREATE TABLE _prisma_migrations (id text PRIMARY KEY, migration_name text NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(), finished_at timestamptz, rolled_back_at timestamptz);
  INSERT INTO _prisma_migrations VALUES ('1', '20260101000000_a', now(), now(), NULL),
    ('2', '20260301000000_b', now(), now(), NULL), ('3', '20260302000000_c', now(), NULL, now())" >/dev/null

L="$T_TMP/log"
mkdir -p "$L" "$HOUSE_ROOT/bin"
chown root:house "$SHARED_DIR" && chmod 0750 "$SHARED_DIR"
: >"$SHARED_DIR/.deploy.lock" && chown root:house "$SHARED_DIR/.deploy.lock" && chmod 0660 "$SHARED_DIR/.deploy.lock"
printf 'LOG_DIR=%s\nAPI_PORT=14510\nWEB_PORT=14520\nADMIN_PORT=14530\nWORKER_PORT=14540\nPREFLIGHT_OFFSET=7\n' "$L" >"$DEPLOY_CONF"
printf 'DATABASE_URL=postgresql://%s:%s@%s:%s/%s?schema=public\n' "$TEST_PG_USER" "$TEST_PG_PASSWORD" "$TEST_PG_HOST" "$TEST_PG_PORT" "$DB" >"$ENV_FILE"
chown root:house "$ENV_FILE" "$DEPLOY_CONF" && chmod 0640 "$ENV_FILE" "$DEPLOY_CONF"

# live = newest; OLD lacks migration b; NOBOOT knows every migration but exits at boot.
LIVE=20260302000000-ccccccc OLD=20260101000000-aaaaaaa NOBOOT=20260301000000-bbbbbbb
mkrel() {
  local d="$RELEASES_DIR/$1" m
  shift
  mkdir -p "$d/apps/api/dist" "$d/apps/web" "$d/apps/admin"
  for m in "$@"; do mkdir -p "$d/apps/api/prisma/schema/migrations/$m"; done
  cp "$REPO_DIR/ecosystem.config.cjs" "$d/"
  echo 'process.exit(3)' >"$d/apps/api/dist/main.js"
}
mkrel "$LIVE" 20260101000000_a 20260301000000_b 20260302000000_c
mkrel "$OLD" 20260101000000_a
mkrel "$NOBOOT" 20260101000000_a 20260301000000_b
chown -R house:house "$RELEASES_DIR" "$L"
ln -s "$RELEASES_DIR/$LIVE" "$ACTIVE_LINK" && ln -s releases/.active "$CURRENT_LINK"
rb() { HOUSE_ROOT="$HOUSE_ROOT" bash "$r" "$@" </dev/null 2>&1; }

out="$(rb "$OLD")" && rc=0 || rc=$?
((rc != 0)) && pass "target missing an applied migration is refused" || fail "rollback to $OLD proceeded" "$out"
assert_contains "lists the migration the target does not know" "$out" "20260301000000_b"
assert_not_contains "a rolled-back migration is not listed" "$out" "20260302000000_c"
assert_contains "asks for --force" "$out" "--force"
out="$(rb "$OLD" --force -y)" && rc=0 || rc=$?
((rc != 0)) && pass "--force still needs the release name typed at a terminal (even with -y)" || fail "--force -y proceeded" "$out"
assert_contains "explains the typed confirmation" "$out" "릴리스 이름을 직접 입력"
assert_eq "current unchanged after refused rollbacks" "$(current_release)" "$RELEASES_DIR/$LIVE"

out="$(rb "$NOBOOT" -y --foreground)" && rc=0 || rc=$?
((rc != 0)) && pass "target that cannot boot is refused" || fail "rollback to a non-booting release proceeded" "$out"
assert_contains "migration check passes for a target that knows every migration" "$out" "DB 마이그레이션 호환"
assert_contains "preflight booted the target with the current .env" "$out" "preflight api: FAILED (exited with code 3)"
assert_contains "says nothing was switched" "$out" "전환하지 않았습니다"
assert_eq "current still the live release after a failed preflight" "$(current_release)" "$RELEASES_DIR/$LIVE"
assert_contains "rollback logged" "$(cat "$L/deploy.log")" "사전 기동 점검"
t_finish
