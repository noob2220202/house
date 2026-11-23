#!/usr/bin/env bash
# psql as the app role, connected with DATABASE_URL from /srv/house/shared/.env. The password
# travels in the environment (PGPASSWORD), never on the command line (/proc/*/cmdline is public).
#   sudo /srv/house/db-shell.sh                      # interactive
#   sudo /srv/house/db-shell.sh -c 'select count(*) from users'
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")" && pwd)"
# shellcheck source=lib/common.sh
source "$SCRIPT_DIR/lib/common.sh"

ensure_house_user "$@"
load_conf
pg_export_env
exec psql "$@"
