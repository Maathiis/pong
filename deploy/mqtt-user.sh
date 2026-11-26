#!/usr/bin/env bash
# Crée ou change le mot de passe d'un compte MQTT, puis recharge le broker.
#   sudo ./deploy/mqtt-user.sh borne-01            → mot de passe généré et affiché
#   sudo ./deploy/mqtt-user.sh pong-api <motdepasse>
set -euo pipefail
cd "$(dirname "$0")/.."

user="${1:?usage : sudo $0 <identifiant> [mot de passe]}"
pass="${2:-$(openssl rand -hex 16)}"
secrets=deploy/mosquitto/secrets

mkdir -p "$secrets"
chown 1883:1883 "$secrets"   # 1883 = utilisateur « mosquitto » dans le conteneur
chmod 700 "$secrets"

create=""
[ -f "$secrets/passwd" ] || create="-c"

docker compose -f docker-compose.prod.yml run --rm --no-deps --user 1883:1883 \
  --entrypoint mosquitto_passwd mqtt $create -b /mosquitto/secrets/passwd "$user" "$pass"

# Recharge les comptes si le broker tourne déjà (sans couper les bornes connectées).
if [ -n "$(docker compose -f docker-compose.prod.yml ps -q mqtt)" ]; then
  docker compose -f docker-compose.prod.yml kill -s HUP mqtt >/dev/null
fi

echo "Compte MQTT prêt → identifiant : $user   mot de passe : $pass"
