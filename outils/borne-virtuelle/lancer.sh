#!/usr/bin/env bash
# Ouvre la borne virtuelle avec la connexion MQTT déjà remplie, et la branche toute seule.
#   ./outils/borne-virtuelle/lancer.sh             serveur en ligne, borne-01 (mot de passe lu sur le VPS par SSH)
#   ./outils/borne-virtuelle/lancer.sh borne-02    autre borne du serveur en ligne
#   ./outils/borne-virtuelle/lancer.sh --local     broker du Mac (docker compose up), sans mot de passe
# Sans SSH : PONG_BORNE_PASS='<mot de passe>' ./outils/borne-virtuelle/lancer.sh
# Le mot de passe n'est jamais écrit sur le disque : il passe dans le fragment de l'adresse (#…), que le navigateur
# n'envoie pas au serveur, et la page l'efface aussitôt. Ctrl+C arrête le petit serveur local.
set -euo pipefail
cd "$(dirname "$0")"

HOST="${PONG_VPS:-ubuntu@vps-fbac818c.vps.ovh.net}"
DOMAIN=pong.164-132-199-27.sslip.io
mode=online
borne=borne-01
for arg in "$@"; do
  case "$arg" in
    --local) mode=local ;;
    -h|--help) sed -n '2,8p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) borne="$arg" ;;
  esac
done

if [ "$mode" = local ]; then
  url="ws://localhost:9001"
  pass=""
else
  url="wss://$DOMAIN/mqtt"
  pass="${PONG_BORNE_PASS:-}"
  if [ -z "$pass" ]; then
    echo "Lecture du mot de passe de $borne sur le VPS…"
    pass=$(ssh -o BatchMode=yes -o ConnectTimeout=10 "$HOST" \
      "sudo awk -v b='$borne' '\$1==b {print \$2}' /srv/pong/deploy/mosquitto/secrets/comptes-bornes.txt") || {
      echo "Connexion SSH au VPS impossible. Donne le mot de passe avec PONG_BORNE_PASS='…'." >&2
      exit 1
    }
    if [ -z "$pass" ]; then
      echo "Aucun mot de passe enregistré pour $borne sur le VPS (comptes-bornes.txt)." >&2
      echo "Crée le compte avec : sudo ./deploy/mqtt-user.sh $borne (sur le VPS), puis PONG_BORNE_PASS='…'." >&2
      exit 1
    fi
  fi
fi

# Page servie en local (127.0.0.1 uniquement), sur un port libre.
port=$(python3 -c 'import socket; s = socket.socket(); s.bind(("127.0.0.1", 0)); print(s.getsockname()[1])')
python3 -m http.server "$port" --bind 127.0.0.1 >/dev/null 2>&1 &
server=$!
trap 'kill $server 2>/dev/null' EXIT
for _ in $(seq 1 50); do
  curl -sf "http://127.0.0.1:$port/index.html" >/dev/null && break
  sleep 0.1
done

enc() { python3 -c 'import sys, urllib.parse; print(urllib.parse.quote(sys.argv[1], safe=""))' "$1"; }
open "http://127.0.0.1:$port/index.html#url=$(enc "$url")&borne=$(enc "$borne")&pass=$(enc "$pass")&auto=1"

echo "Borne virtuelle ouverte : $borne → $url"
echo "Ctrl+C pour arrêter."
wait "$server"
