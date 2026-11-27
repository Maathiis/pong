#!/usr/bin/env bash
# Sauvegarde de la base Pong, gardée 30 jours (RGPD : les comptes supprimés disparaissent aussi des sauvegardes
# au bout de 30 jours). Lancée chaque nuit par cron et avant chaque déploiement (deploy/install.sh).
#   sudo ./deploy/sauvegarde.sh [étiquette]
set -euo pipefail
cd "$(dirname "$0")/.."
DEST=/srv/pong-sauvegardes
RETENTION_JOURS=30
COMPOSE="docker compose -f docker-compose.prod.yml"

mkdir -p "$DEST" && chmod 700 "$DEST"
if [ -z "$($COMPOSE ps -q --status running db 2>/dev/null)" ]; then
  echo "Base arrêtée : pas de sauvegarde."
  exit 0
fi
FILE="$DEST/pong-$(date +%Y%m%d-%H%M)${1:+-$1}.sql.gz"
$COMPOSE exec -T db pg_dump -U pong pong | gzip > "$FILE"
chmod 600 "$FILE"
find "$DEST" -name 'pong-*.sql.gz' -mtime +"$RETENTION_JOURS" -delete
# anciennes sauvegardes manuelles (avant ce script) : même durée de conservation
find "$DEST" -name 'avant-*.sql' -mtime +"$RETENTION_JOURS" -delete
echo "Sauvegarde : $FILE ($(du -h "$FILE" | cut -f1)), conservation $RETENTION_JOURS jours."
