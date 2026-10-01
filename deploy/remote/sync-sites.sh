#!/bin/bash
# Copies a built site from the ops bucket into the folder Caddy serves: ./sync-sites.sh portal|admin
set -euo pipefail
cd /opt/innotech
source bootstrap.env
export AWS_REGION
site="${1:?usage: sync-sites.sh portal|admin}"
mkdir -p "sites/$site"
aws s3 sync --quiet --delete "s3://$OPS_BUCKET/sites/$site" "sites/$site"
echo "$site: $(find "sites/$site" -type f | wc -l) files"
