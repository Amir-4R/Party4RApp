#!/usr/bin/env bash
# =============================================================================
# Party4R — restore from a mongodump archive
# Usage: ./scripts/restore.sh /path/to/party4r-YYYYMMDD-HHMMSS.archive.gz
# =============================================================================
set -euo pipefail

ARCHIVE="${1:-}"
if [ -z "$ARCHIVE" ] || [ ! -f "$ARCHIVE" ]; then
  echo "Usage: $0 <archive.gz>"
  exit 1
 fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."
set -a; [ -f .env ] && . .env; set +a
DB_NAME="${DB_NAME:-party4r}"
MONGO_URL="${MONGO_URL:?MONGO_URL must be set}"

read -p "⚠️  This will OVERWRITE the '$DB_NAME' database. Continue? (yes/N): " CONFIRM
[ "$CONFIRM" = "yes" ] || { echo "Aborted."; exit 1; }

echo "[$(date -u +%H:%M:%S)] Restoring $ARCHIVE → $DB_NAME"
if command -v mongorestore >/dev/null 2>&1; then
  mongorestore --uri="$MONGO_URL" --drop --gzip --archive="$ARCHIVE" --nsInclude="$DB_NAME.*"
else
  docker compose exec -T mongo mongorestore --uri="$MONGO_URL" \
          --drop --gzip --archive --nsInclude="$DB_NAME.*" < "$ARCHIVE"
fi
echo "[$(date -u +%H:%M:%S)] Restore complete."
