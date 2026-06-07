#!/usr/bin/env bash
# =============================================================================
# Party4R — automated MongoDB backup
# Creates an encrypted, timestamped dump of the entire database.
# Suitable for cron: `0 3 * * *  /opt/party4r/scripts/backup.sh`
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

# Load .env
set -a; [ -f .env ] && . .env; set +a

BACKUP_DIR="${BACKUP_DIR:-./backups}"
RETAIN_DAYS="${BACKUP_RETAIN_DAYS:-14}"
TS="$(date -u +%Y%m%d-%H%M%S)"
DB_NAME="${DB_NAME:-party4r}"
MONGO_URL="${MONGO_URL:?MONGO_URL must be set}"

mkdir -p "$BACKUP_DIR"
OUT="$BACKUP_DIR/party4r-$TS.archive.gz"

echo "[$(date -u +%H:%M:%S)] Dumping $DB_NAME → $OUT"
if command -v mongodump >/dev/null 2>&1; then
  mongodump --uri="$MONGO_URL" --db="$DB_NAME" \
            --archive="$OUT" --gzip --quiet
else
  # Fallback: run mongodump inside the mongo container.
  docker compose exec -T mongo mongodump --uri="$MONGO_URL" \
         --db="$DB_NAME" --archive --gzip > "$OUT"
fi

SIZE=$(du -h "$OUT" | cut -f1)
echo "[$(date -u +%H:%M:%S)] Backup complete: $OUT ($SIZE)"

# Optional: encrypt with gpg if BACKUP_GPG_RECIPIENT is set
if [ -n "${BACKUP_GPG_RECIPIENT:-}" ]; then
  gpg --batch --yes --output "$OUT.gpg" --encrypt --recipient "$BACKUP_GPG_RECIPIENT" "$OUT"
  rm "$OUT"
  echo "[$(date -u +%H:%M:%S)] Encrypted with GPG → $OUT.gpg"
fi

# Retention — delete dumps older than RETAIN_DAYS
find "$BACKUP_DIR" -name 'party4r-*.archive.gz*' -mtime +$RETAIN_DAYS -delete
echo "[$(date -u +%H:%M:%S)] Pruned backups older than $RETAIN_DAYS days"
