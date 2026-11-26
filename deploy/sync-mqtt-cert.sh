#!/usr/bin/env bash
# Copie le certificat HTTPS que Caddy a obtenu pour le domaine de Pong vers Mosquitto (TLS du port 8883).
# Caddy le renouvelle tout seul tous les ~60 jours : ce script tourne chaque semaine via cron
# et ne redémarre Mosquitto que si le certificat a changé.
#   sudo ./deploy/sync-mqtt-cert.sh
set -euo pipefail
cd "$(dirname "$0")/.."

domain="${PONG_DOMAIN:-pong.164-132-199-27.sslip.io}"
caddy_data="$(docker volume inspect edge_caddy-data -f '{{.Mountpoint}}')"
dir="$(find "$caddy_data/caddy/certificates" -mindepth 2 -maxdepth 2 -type d -name "$domain" | head -n 1)"

if [ -z "$dir" ]; then
  echo "Pas encore de certificat pour $domain. Ouvre https://$domain une fois (Caddy le demande à ce moment-là), puis relance." >&2
  exit 1
fi

secrets=deploy/mosquitto/secrets
mkdir -p "$secrets"

if cmp -s "$dir/$domain.crt" "$secrets/cert.pem" 2>/dev/null; then
  echo "Certificat déjà à jour."
  exit 0
fi

install -o 1883 -g 1883 -m 644 "$dir/$domain.crt" "$secrets/cert.pem"
install -o 1883 -g 1883 -m 600 "$dir/$domain.key" "$secrets/key.pem"
chown 1883:1883 "$secrets"
chmod 700 "$secrets"
echo "Certificat copié pour $domain."

if [ -n "$(docker compose -f docker-compose.prod.yml ps -q mqtt)" ]; then
  docker compose -f docker-compose.prod.yml restart mqtt
fi
