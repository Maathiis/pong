#!/usr/bin/env bash
# Installe ou met à jour Pong sur le VPS. À lancer EN ROOT dans /srv/pong (deploy/push.sh le fait depuis le Mac) :
#   sudo /srv/pong/deploy/install.sh
# Relançable sans risque : ce qui existe déjà (secrets, comptes MQTT, certificat) est gardé.
set -euo pipefail
cd "$(dirname "$0")/.."

DOMAIN="${PONG_DOMAIN:-pong.164-132-199-27.sslip.io}"
COMPOSE="docker compose -f docker-compose.prod.yml"
SECRETS=deploy/mosquitto/secrets
step() { printf '\n\033[1;35m▶ %s\033[0m\n' "$*"; }

[ "$(id -u)" = 0 ] || { echo "À lancer avec sudo." >&2; exit 1; }
chmod +x deploy/*.sh

step "Secrets (.env)"
if [ ! -f .env ]; then
  cat > .env <<EOF
POSTGRES_PASSWORD=$(openssl rand -hex 32)
MQTT_API_PASSWORD=$(openssl rand -hex 32)
JWT_SECRET=$(openssl rand -hex 32)
TARGET_SCORE=7
EOF
  chmod 600 .env
  echo "Créé."
else
  echo "Déjà là, gardé."
fi

step "Caddy : publication de https://$DOMAIN"
SITES="$(docker inspect edge-caddy-1 --format '{{range .Mounts}}{{if eq .Destination "/etc/caddy/sites"}}{{.Source}}{{end}}{{end}}')"
[ -d "$SITES" ] || { echo "Dossier sites/ de Caddy introuvable." >&2; exit 1; }
sed "s/^pong\.[^ ]* {/$DOMAIN {/" deploy/pong.caddy > "$SITES/pong.caddy"
docker exec edge-caddy-1 caddy reload --config /etc/caddy/Caddyfile
curl -s -o /dev/null --max-time 20 "https://$DOMAIN" || true   # déclenche la demande de certificat

step "Comptes MQTT"
mkdir -p "$SECRETS"
has_user() { [ -f "$SECRETS/passwd" ] && grep -q "^$1:" "$SECRETS/passwd"; }
if ! has_user pong-api; then
  ./deploy/mqtt-user.sh pong-api "$(grep '^MQTT_API_PASSWORD=' .env | cut -d= -f2)" >/dev/null
  echo "Compte pong-api créé."
fi
if ! has_user borne-01; then
  PASS="$(openssl rand -hex 16)"
  ./deploy/mqtt-user.sh borne-01 "$PASS" >/dev/null
  echo "borne-01 $PASS" >> "$SECRETS/comptes-bornes.txt"
  chmod 600 "$SECRETS/comptes-bornes.txt"
  echo "Compte borne-01 créé."
fi

step "Certificat TLS pour Mosquitto"
for i in $(seq 1 30); do
  if ./deploy/sync-mqtt-cert.sh 2>/dev/null; then break; fi
  [ "$i" = 30 ] && { echo "Caddy n'a pas encore le certificat : voir docker logs edge-caddy-1" >&2; exit 1; }
  sleep 4
done
chown -R 1883:1883 "$SECRETS"
chmod 700 "$SECRETS"

step "Pare-feu"
if command -v ufw >/dev/null && ufw status | grep -q "Status: active"; then
  ufw allow 8883/tcp >/dev/null && echo "Port 8883 ouvert."
else
  echo "ufw inactif, rien à faire."
fi

step "Lancement (build de l'API)"
$COMPOSE up -d --build

step "Renouvellement automatique du certificat (cron)"
( crontab -l 2>/dev/null | grep -v sync-mqtt-cert || true
  echo "17 4 * * 1 $(pwd)/deploy/sync-mqtt-cert.sh >> /var/log/pong-cert.log 2>&1" ) | crontab -
echo "OK."

step "Vérification"
for i in $(seq 1 30); do
  if curl -fs --max-time 5 "https://$DOMAIN/api/health" >/dev/null; then
    echo "API en ligne : https://$DOMAIN/api"
    break
  fi
  [ "$i" = 30 ] && { echo "L'API ne répond pas : $COMPOSE logs api" >&2; exit 1; }
  sleep 3
done
$COMPOSE ps

printf '\n\033[1;32mPong est en ligne.\033[0m\n'
echo "Comptes des bornes (à donner à Nathan, pas en public) :"
cat "$SECRETS/comptes-bornes.txt"
