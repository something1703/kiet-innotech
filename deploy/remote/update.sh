#!/bin/bash
# Runs on the instance (as root, via SSM) for every API release: ./update.sh <image tag>
set -euo pipefail
TAG="${1:?usage: update.sh <image tag>}"
cd /opt/innotech
source bootstrap.env
mkdir -p sites/portal sites/admin caddy
export AWS_REGION

aws s3 cp --quiet "s3://$OPS_BUCKET/release/compose.yml" compose.yml
aws s3 cp --quiet "s3://$OPS_BUCKET/release/Caddyfile" caddy/Caddyfile
aws s3 cp --quiet "s3://$OPS_BUCKET/release/config.env" config.env
aws s3 cp --quiet "s3://$OPS_BUCKET/release/backup.sh" backup.sh
aws s3 cp --quiet "s3://$OPS_BUCKET/release/sync-sites.sh" sync-sites.sh
chmod 700 backup.sh sync-sites.sh

# Secrets are created here once and never leave the instance.
if [ ! -f secrets.env ]; then
  umask 077
  echo "DB_PASSWORD=$(openssl rand -hex 24)" > secrets.env
  echo "SESSION_SECRET=$(openssl rand -base64 48 | tr -d '\n/+=')" >> secrets.env
fi
umask 077
{ cat config.env; echo; cat secrets.env; echo "API_IMAGE=$ECR_REPOSITORY:$TAG"; } > .env

aws ecr get-login-password | docker login --username AWS --password-stdin "${ECR_REPOSITORY%%/*}" >/dev/null
docker compose pull --quiet api
docker compose up -d --wait db
docker compose run --rm --no-deps api alembic upgrade head
docker compose up -d --remove-orphans --wait
# Caddy reads its mounted Caddyfile only at start, so apply changes to it explicitly.
docker compose exec -T caddy caddy reload --config /etc/caddy/Caddyfile --force >/dev/null
docker image prune -f >/dev/null

# Database dump to S3 every 15 minutes.
cat > /etc/systemd/system/innotech-backup.service <<UNIT
[Unit]
Description=InnoTech database backup to S3
[Service]
Type=oneshot
ExecStart=/opt/innotech/backup.sh
UNIT
cat > /etc/systemd/system/innotech-backup.timer <<UNIT
[Unit]
Description=InnoTech database backup every 15 minutes
[Timer]
OnCalendar=*:0/15
Persistent=true
[Install]
WantedBy=timers.target
UNIT
systemctl daemon-reload
systemctl enable --now innotech-backup.timer >/dev/null

docker compose ps --format "table {{.Service}}\t{{.Status}}"
docker compose exec -T api python -c "import urllib.request; print(urllib.request.urlopen('http://127.0.0.1:8000/health').read().decode())"
