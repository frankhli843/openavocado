#!/usr/bin/env bash
# prodavo-deploy.sh — deploy AvocadoCore to George VPS as a systemd service.
# Run from WSL: bash scripts/prodavo-deploy.sh
# Requires SSH access to clawed-george (see ~/.ssh/config).
set -euo pipefail

REMOTE="clawed-george"
DEPLOY_DIR="/root/prodavo"
SERVICE="avocadocore-prodavo"
PORT="3001"
BRANCH="feat/prodavo-deployment"
REPO="https://github.com/frankhli843/avocadocore.git"

echo "==> prodavo deploy: $REMOTE $DEPLOY_DIR"

ssh "$REMOTE" bash -s <<REMOTE_SCRIPT
set -euo pipefail

# ── 1. Disk check ─────────────────────────────────────────────────────────────
AVAIL=\$(df -BG / | awk 'NR==2 {gsub("G","",\$4); print \$4}')
echo "Disk available: \${AVAIL}G"
if [ "\$AVAIL" -lt 2 ]; then
  echo "ERROR: Less than 2G free. Run /root/clawed-disk-cleanup.sh first."
  exit 1
fi

# ── 2. Ensure Node + pnpm ─────────────────────────────────────────────────────
node --version
if ! command -v pnpm &>/dev/null; then
  corepack enable
  corepack prepare pnpm@latest --activate
fi
pnpm --version

# ── 3. Clone or update repo ───────────────────────────────────────────────────
if [ ! -d "$DEPLOY_DIR/.git" ]; then
  git clone --branch $BRANCH $REPO $DEPLOY_DIR
else
  cd $DEPLOY_DIR
  git fetch origin
  git checkout $BRANCH
  git reset --hard origin/$BRANCH
fi

cd $DEPLOY_DIR

# ── 4. Install deps ───────────────────────────────────────────────────────────
pnpm install --frozen-lockfile

# ── 5. Read env file ─────────────────────────────────────────────────────────
ENV_FILE="$DEPLOY_DIR/.env.prodavo"
if [ ! -f "\$ENV_FILE" ]; then
  echo "ERROR: \$ENV_FILE not found. Create it from .env.example with real secrets."
  exit 1
fi

# ── 6. Build ──────────────────────────────────────────────────────────────────
echo "==> Building Next.js..."
env \$(cat "\$ENV_FILE" | grep -v '^#' | xargs) pnpm build

# ── 7. Create data directory ──────────────────────────────────────────────────
mkdir -p /var/prodavo/data /var/prodavo/runtime_artifacts
chmod 750 /var/prodavo /var/prodavo/data /var/prodavo/runtime_artifacts

# ── 8. Write systemd service unit ─────────────────────────────────────────────
cat > /etc/systemd/system/$SERVICE.service <<UNIT
[Unit]
Description=AvocadoCore prodavo
After=network.target

[Service]
Type=simple
WorkingDirectory=$DEPLOY_DIR
EnvironmentFile=$DEPLOY_DIR/.env.prodavo
Environment=NODE_ENV=production
Environment=AVOCADOCORE_DB_PATH=/var/prodavo/data/avocadocore.db
Environment=AVOCADOCORE_ARTIFACTS_PATH=/var/prodavo/runtime_artifacts
Environment=PORT=$PORT
ExecStart=/usr/local/bin/node node_modules/.bin/next start -p $PORT
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal
SyslogIdentifier=$SERVICE

[Install]
WantedBy=multi-user.target
UNIT

# ── 9. Enable + restart service ───────────────────────────────────────────────
systemctl daemon-reload
systemctl enable $SERVICE
systemctl restart $SERVICE

# ── 10. Health check ──────────────────────────────────────────────────────────
sleep 10
HTTP=\$(curl -s -o /dev/null -w "%{http_code}" http://localhost:$PORT/api/health 2>/dev/null || echo 0)
if [ "\$HTTP" = "200" ]; then
  echo "==> prodavo healthy at http://localhost:$PORT/api/health"
else
  echo "ERROR: health check failed (HTTP \$HTTP)"
  journalctl -u $SERVICE -n 30 --no-pager
  exit 1
fi

REMOTE_SCRIPT

echo "==> Deploy complete. prodavo is running on George VPS port $PORT"
echo "==> Public URL: https://avocadocore.89-167-21-6.nip.io"
