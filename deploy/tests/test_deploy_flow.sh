#!/usr/bin/env bash
# deploy.sh control-flow regressions (static: the real flow needs PM2, a repo and a build).
source "$(dirname "$0")/lib.sh"
d="$KIT_DIR/deploy.sh"

# Reload-only branch (same commit, .env changed): preflight must run before pm2_apply.
branch="$(awk '/이미 배포된 커밋입니다/,/^fi$/' "$d")"
pre="$(grep -n 'preflight.cjs' <<<"$branch" | head -1 | cut -d: -f1)"
apply="$(grep -n 'pm2_apply' <<<"$branch" | head -1 | cut -d: -f1)"
[[ -n "$pre" && -n "$apply" ]] && ((pre < apply)) && pass "reload-only path preflights the new .env before reloading" ||
  fail "reload-only path reloads PM2 without a preflight"
assert_contains "reload-only failure says the service is unchanged" "$branch" "현재 서비스는 바뀌지 않았습니다"
assert_contains "failure prints the last-good .env restore command" "$(cat "$d")" 'install -m 0640 -o root -g $HOUSE_USER $LAST_GOOD_ENV $ENV_FILE'
[[ "$(grep -c 'save_last_good_env$' "$d")" -ge 2 ]] && pass "last-good .env saved after both health-check paths" ||
  fail "last-good .env not saved on every success path"

# Migration detection: no swallowed psql errors; dump decided by table presence.
mig="$(awk '/─── 6. migrate/,/─── 7. preflight/' "$d")"
assert_not_contains "no '|| true' on the applied-migrations query" "$mig" "|| true)"
assert_eq "no stderr suppression on psql" "$(grep -E 'psql|PSQL' <<<"$mig" | grep -c '2>/dev/null')" "0"
assert_contains "uses to_regclass for _prisma_migrations" "$(cat "$KIT_DIR/lib/common.sh")" "to_regclass('public._prisma_migrations')"
assert_contains "migrate stage uses the shared applied-migrations query" "$mig" 'APPLIED="$(db_applied_migrations)"'

# OPS-05: migrations never overlap a pg_dump and run with lock/statement timeouts.
lk="$(grep -n 'flock -n 8' <<<"$mig" | head -1 | cut -d: -f1)"
md="$(grep -n 'pnpm exec prisma migrate deploy' <<<"$mig" | head -1 | cut -d: -f1)"
[[ -n "$lk" && -n "$md" ]] && ((lk < md)) && pass "backup lock taken before prisma migrate deploy" ||
  fail "migrate deploy runs without the backup lock"
assert_contains "migrate stage locks the backup lock file" "$mig" '.backup.lock'
assert_contains "migrate deploy gets the timeout URL" "$mig" 'DATABASE_URL="$MIGRATE_URL" pnpm exec prisma migrate deploy'
assert_contains "timeout URL built by migrate_db_url" "$mig" 'migrate_db_url "$(env_get DATABASE_URL)"'
assert_contains "backup lock released after the migrate stage" "$mig" 'exec 8>&-'
assert_contains "backup.sh waits for the lock instead of failing the nightly backup" "$(cat "$KIT_DIR/backup.sh")" 'flock -w 1800 8'

# OPS-07: a failed (P3009) migration is detected before migrating and explained on failure.
fm="$(grep -n 'db_failed_migrations' <<<"$mig" | head -1 | cut -d: -f1)"
[[ -n "$fm" && -n "$md" ]] && ((fm < md)) && pass "failed migrations checked before migrate deploy" ||
  fail "no failed-migration check before migrate deploy"
pd="$(grep -n 'PRE_DUMP=' <<<"$mig" | head -1 | cut -d: -f1)"
((fm < pd)) && pass "failed-migration check runs before another pre-migrate dump" ||
  fail "a failed migration still triggers another pre-migrate dump"
assert_contains "pre-migration dump whenever public has tables" "$mig" "PUBLIC_TABLES > 0"
assert_contains "psql runs with ON_ERROR_STOP" "$(cat "$d")" "ON_ERROR_STOP=1"
onerr="$(awk '/^on_error\(\) \{/,/^\}/' "$d")"
assert_contains "on_error always reports an applied migration" "$onerr" "migration_warning"
assert_contains "on_error prints the pre-migrate dump for a failed migrate stage" "$onerr" 'warn "마이그레이션 전 백업: $PRE_DUMP"'
assert_contains "on_error prints the resolve hint for failed migrations" "$onerr" 'migrate_resolve_hint'
assert_contains "resolve hint names the prisma command" "$(cat "$KIT_DIR/lib/common.sh")" 'prisma migrate resolve --rolled-back'
assert_contains "OPERATIONS.md documents P3009 recovery" "$(cat "$REPO_DIR/docs/OPERATIONS.md")" 'P3009 복구'

assert_not_contains "migration warning is not only inside rollback_now" "$(awk '/^rollback_now\(\) \{/,/^\}/' "$d")" "MIGRATED"

# Switch ordering: SWITCHED is set before current moves, so a signal right after still rolls back.
sw="$(grep -n 'SWITCHED=1' "$d" | head -1 | cut -d: -f1)"
mv="$(grep -n 'switch_current "\$RELEASE"' "$d" | head -1 | cut -d: -f1)"
((sw < mv)) && pass "SWITCHED set before switch_current" || fail "SWITCHED set after the switch"

# A broken network fails pnpm install fast instead of hanging the deploy.
inst="$(awk '/─── 4. install/,/─── 5. build/' "$d")"
assert_contains "pnpm install has a hard timeout" "$inst" 'timeout --kill-after=30 "$PNPM_INSTALL_TIMEOUT" pnpm install'
assert_contains "pnpm fetch retries limited" "$inst" 'npm_config_fetch_retries=2'
assert_contains "pnpm per-request fetch timeout" "$inst" 'npm_config_fetch_timeout=30000'
assert_contains "timeout failure explains the network" "$inst" '인터넷 연결'
if have_cmd timeout; then
  t0=$(date +%s)
  timeout --kill-after=1 1 sleep 30
  rc=$?
  (($(date +%s) - t0 < 5 && rc == 124)) && pass "timeout(1) stops a hung command (exit 124)" || fail "timeout(1) did not stop the command (rc $rc)"
fi
PNPM_INSTALL_TIMEOUT=abc
eval "$(grep -E '^\[\[ "\$PNPM_INSTALL_TIMEOUT" =~' "$d")"
assert_eq "invalid PNPM_INSTALL_TIMEOUT falls back to 900" "$PNPM_INSTALL_TIMEOUT" "900"

# Next caches: build caches reused, the unbounded runtime fetch cache never copied forward.
bld="$(awk '/─── 5. build/,/─── 6. migrate/' "$d")"
assert_contains "previous .next/cache reused without fetch-cache" "$bld" "rsync -a --exclude=/fetch-cache/"
assert_not_contains "no whole-cache cp -a" "$bld" 'cp -a "$PREV_RELEASE/apps/$app/.next/cache"'
if have_cmd rsync; then
  prev="$T_TMP/prev/.next/cache" new="$T_TMP/new/.next/cache"
  mkdir -p "$prev/fetch-cache" "$prev/images/x" "$prev/webpack" "$new"
  touch "$prev/fetch-cache/q1" "$prev/images/x/a.webp" "$prev/webpack/pack"
  rsync -a --exclude=/fetch-cache/ "$prev/" "$new/"
  [[ -f "$new/images/x/a.webp" && -f "$new/webpack/pack" && ! -e "$new/fetch-cache" ]] &&
    pass "cache copy keeps images + webpack, drops fetch-cache" || fail "cache copy result" "$(find "$new")"
fi

if is_root; then
  check "deploy.sh --help works" bash "$d" --help
else
  skip "deploy.sh --help" "needs root"
fi
t_finish
