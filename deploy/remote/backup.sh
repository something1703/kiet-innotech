#!/bin/bash
# Dumps the database to S3 (custom format, restore with pg_restore). Run by a systemd timer every 15 minutes.
set -euo pipefail
cd /opt/innotech
source bootstrap.env
export AWS_REGION
key="backups/db/$(date -u +%Y/%m/%d/%H%M%S).dump"
docker compose exec -T db pg_dump -U innotech -Fc innotech | aws s3 cp --quiet - "s3://$OPS_BUCKET/$key"
echo "Backed up to s3://$OPS_BUCKET/$key"
