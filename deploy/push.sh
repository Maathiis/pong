#!/usr/bin/env bash
# Depuis le Mac : envoie le projet sur le VPS puis installe / met à jour Pong.
#   ./deploy/push.sh                      (utilisateur ubuntu par défaut)
#   PONG_VPS=debian@vps-fbac818c.vps.ovh.net ./deploy/push.sh
# sudo demandera peut-être le mot de passe du VPS : c'est normal.
set -euo pipefail
cd "$(dirname "$0")/.."
HOST="${PONG_VPS:-ubuntu@vps-fbac818c.vps.ovh.net}"

ssh -t "$HOST" 'sudo mkdir -p /srv/pong && sudo chown "$USER": /srv/pong'
rsync -az --delete \
  --exclude .git --exclude app --exclude node_modules --exclude .env --exclude 'deploy/mosquitto/secrets' \
  ./ "$HOST:/srv/pong/"
ssh -t "$HOST" 'sudo /srv/pong/deploy/install.sh'
