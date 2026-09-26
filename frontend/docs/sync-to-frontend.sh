#!/usr/bin/env bash
# Publishes /app/docs → /app/frontend/docs byte-identically (frontend/docs is the location the GitHub sync provably carries).
set -euo pipefail
SRC="$(cd "$(dirname "$0")" && pwd)"; DST="$SRC/../frontend/docs"
rsync -a --delete --exclude 'sync-to-frontend.sh' "$SRC/" "$DST/"
cp "$SRC/sync-to-frontend.sh" "$DST/sync-to-frontend.sh"
diff -rq "$SRC" "$DST" >/dev/null && echo "docs → frontend/docs in sync ($(find "$DST" -type f | wc -l) files)"
