#!/usr/bin/env bash
# =============================================================================
# Party4R — Zero-downtime migration from Render free → new VPS
# Performs:
#   1. Dump current production DB (from MONGO_URL_SOURCE, e.g. Atlas)
#   2. Restore into new mongo (MONGO_URL_TARGET, e.g. on the new VPS)
#   3. Verify counts in both DBs match
# Then you flip DNS — see MIGRATION_PLAN.md for the full procedure.
# =============================================================================
set -euo pipefail

: "${MONGO_URL_SOURCE:?MONGO_URL_SOURCE not set (the OLD prod DB)}"
: "${MONGO_URL_TARGET:?MONGO_URL_TARGET not set (the NEW DB on your VPS or Atlas paid tier)}"
DB_NAME="${DB_NAME:-party4r}"

TS="$(date -u +%Y%m%d-%H%M%S)"
WORKDIR="/tmp/party4r-migrate-$TS"
mkdir -p "$WORKDIR"

echo "[$(date -u +%H:%M:%S)] 1/3 Dumping from SOURCE…"
mongodump --uri="$MONGO_URL_SOURCE" --db="$DB_NAME" \
          --archive="$WORKDIR/dump.archive.gz" --gzip --quiet
SRC_SIZE=$(du -h "$WORKDIR/dump.archive.gz" | cut -f1)
echo "   Dump size: $SRC_SIZE"

echo "[$(date -u +%H:%M:%S)] 2/3 Restoring into TARGET (with --drop)…"
mongorestore --uri="$MONGO_URL_TARGET" --drop --gzip \
             --archive="$WORKDIR/dump.archive.gz" --nsInclude="$DB_NAME.*"

echo "[$(date -u +%H:%M:%S)] 3/3 Verifying row counts match…"
for COL in users rooms messages friendships dm_messages reports push_tokens privacy_settings; do
  SRC=$(mongosh "$MONGO_URL_SOURCE/$DB_NAME" --quiet --eval "db.$COL.estimatedDocumentCount()" 2>/dev/null || echo 0)
  TGT=$(mongosh "$MONGO_URL_TARGET/$DB_NAME" --quiet --eval "db.$COL.estimatedDocumentCount()" 2>/dev/null || echo 0)
  if [ "$SRC" = "$TGT" ]; then
    echo "   ✅ $COL: $SRC documents on both ends"
  else
    echo "   ❌ $COL: SOURCE=$SRC  TARGET=$TGT  (MISMATCH — investigate)"
  fi
done

echo ""
echo "Migration data transfer complete."
echo "Next step: see MIGRATION_PLAN.md → §4 (DNS switchover)."
