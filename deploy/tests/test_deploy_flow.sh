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

# Next caches: only the optimized images are carried forward (carry_image_cache).
bld="$(awk '/─── 5. build/,/─── 6. migrate/' "$d")"
assert_contains "build stage carries the previous image cache" "$bld" 'carry_image_cache "$PREV_RELEASE" "$RELEASE"'
assert_not_contains "no whole .next/cache copy" "$bld" '.next/cache/"'
load_common
if have_cmd rsync; then
  prev="$T_TMP/prev" new="$T_TMP/new"
  mkdir -p "$prev/apps/web/.next/cache/"{fetch-cache,images/x,webpack,swc} "$prev/apps/admin/.next/cache/webpack" "$new"
  touch "$prev/apps/web/.next/cache/fetch-cache/q1" "$prev/apps/web/.next/cache/images/x/a.webp" \
    "$prev/apps/web/.next/cache/webpack/pack" "$prev/apps/web/.next/cache/swc/s" "$prev/apps/admin/.next/cache/webpack/pack"
  carry_image_cache "$prev" "$new"
  assert_eq "cache copy keeps only .next/cache/images" \
    "$(cd "$new" && find . -mindepth 1 | sort | tr '\n' ' ')" \
    "./apps ./apps/web ./apps/web/.next ./apps/web/.next/cache ./apps/web/.next/cache/images ./apps/web/.next/cache/images/x ./apps/web/.next/cache/images/x/a.webp "
fi

# Post-deploy image smoke: GET /_next/image for a stored upload, 200 + image/*; skipped when empty.
up="$T_TMP/uploads"
mkdir -p "$up/tmp" "$up/listings/2026"
assert_eq "no upload yet: no sample" "$(media_sample_path "$up")" ""
check "no upload yet: image smoke skips (passes)" image_smoke 1 "$up" 1 0
touch "$up/listings/2026/empty.webp" # 0 bytes: not a sample
printf 'x' >"$up/tmp/UPPER.webp"     # nginx would not serve this name
printf 'x' >"$up/listings/notes.txt"
assert_eq "only names nginx serves under /media" "$(media_sample_path "$up")" ""
printf 'RIFF' >"$up/listings/2026/a_b-1.webp"
assert_eq "sample upload path" "$(media_sample_path "$up")" "listings/2026/a_b-1.webp"
if have_cmd node && have_cmd curl; then
  SP=$((40000 + RANDOM % 20000))
  node -e 'require("http").createServer((q, r) => {
    const ok = q.url === "/_next/image?url=%2Fmedia%2Flistings%2F2026%2Fa_b-1.webp&w=64&q=75";
    r.statusCode = ok ? 200 : 400;
    r.setHeader("content-type", ok && process.argv[2] === "image" ? "image/webp" : "text/html");
    r.end(ok ? "img" : "bad " + q.url);
  }).listen(+process.argv[1], "127.0.0.1")' "$SP" image &
  img_pid=$!
  node -e 'require("http").createServer((q, r) => { r.setHeader("content-type", "text/html"); r.end("x"); })
    .listen(+process.argv[1], "127.0.0.1")' "$((SP + 1))" &
  html_pid=$!
  t_on_exit "kill $img_pid $html_pid"
  for _ in $(seq 1 25); do curl -s -o /dev/null "http://127.0.0.1:$SP/" && curl -s -o /dev/null "http://127.0.0.1:$((SP + 1))/" && break; sleep 0.2; done
  check "image smoke passes on 200 image/* (encoded /media URL)" image_smoke "$SP" "$up" 1 0
  check_fails "image smoke fails on 200 text/html" image_smoke "$((SP + 1))" "$up" 2 0
  check_fails "image smoke fails when the web server is down" image_smoke "$((SP + 2))" "$up" 1 0
fi
sm="$(grep -n 'image_smoke "\$WEB_PORT"' "$d" | head -1 | cut -d: -f1)"
hc="$(grep -n 'health_check "\$RELEASE" 45 2' "$d" | head -1 | cut -d: -f1)"
tr_="$(grep -n '^trap - ERR INT TERM HUP' "$d" | tail -1 | cut -d: -f1)"
[[ -n "$sm" && -n "$hc" && -n "$tr_" ]] && ((sm > hc && sm > tr_)) &&
  pass "image smoke runs after the health check, outside the rollback trap" ||
  fail "image smoke placement" "smoke=$sm health=$hc trap=$tr_"
assert_contains "image smoke failure is repeated in the summary" "$(cat "$d")" '[[ -n "$IMAGE_SMOKE_NOTE" ]] && warn "$IMAGE_SMOKE_NOTE"'

if is_root; then
  check "deploy.sh --help works" bash "$d" --help
else
  skip "deploy.sh --help" "needs root"
fi
t_finish
