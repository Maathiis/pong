# Déployer Pong sur le VPS

Adresse publique : **https://pong.164-132-199-27.sslip.io** (API) et **pong.164-132-199-27.sslip.io:8883** (MQTT des bornes).
sslip.io est un service gratuit : tout nom en `<ip-avec-des-tirets>.sslip.io` pointe vers cette IP, sans rien configurer.
Pour passer plus tard à un vrai domaine, il suffira de changer le nom dans `deploy/pong.caddy`, `deploy/sync-mqtt-cert.sh`
et dans l'appli / le firmware.

## Comment Pong cohabite avec Fireline

```
VPS (164.132.199.27)
├── /srv/fireline/edge/      Caddy « edge » : seul sur les ports 80/443, HTTPS automatique pour chaque site
│   └── sites/*.caddy        un fichier par site → on y ajoute pong.caddy
├── /srv/fireline/…          Fireline (préprod, prod) : ses conteneurs, sa base, ses volumes
└── /srv/pong/               Pong : API + Postgres + Mosquitto, dans le projet Docker « pong »
```

- Chaque projet a ses propres conteneurs, réseau interne et volumes : la base Pong et la base Fireline sont séparées.
- L'API Pong n'ouvre aucun port. Elle rejoint le réseau Docker `fireline-edge` (celui de Caddy) sous le nom `pong-api`.
- Seul Mosquitto ouvre un port à lui, `8883`, parce que les bornes parlent MQTT et pas HTTP.
- `edge` est partagé : on **recharge** Caddy (`caddy reload`), on ne le redémarre jamais, pour ne pas couper Fireline.

## En une commande

Depuis le dossier `pong` sur le Mac :

```bash
./deploy/push.sh
```

Le script envoie le projet dans `/srv/pong`, puis lance `deploy/install.sh` sur le VPS, qui fait toutes les étapes
ci-dessous (secrets, Caddy, comptes MQTT, certificat, pare-feu, lancement, cron, vérification) et affiche à la fin
le mot de passe de `borne-01`. Il se relance sans risque pour chaque mise à jour : ce qui existe déjà est gardé.
Si l'utilisateur SSH n'est pas `ubuntu` : `PONG_VPS=debian@vps-fbac818c.vps.ovh.net ./deploy/push.sh`.

Le détail, étape par étape, pour comprendre ou dépanner :

## Première installation

### 1. Préparer le dossier sur le VPS

```bash
ssh ubuntu@vps-fbac818c.vps.ovh.net
sudo mkdir -p /srv/pong && sudo chown "$USER": /srv/pong
exit
```

### 2. Envoyer le projet depuis le Mac

Depuis le dossier `pong` sur le Mac (l'appli n'est pas nécessaire sur le serveur) :

```bash
rsync -az --delete \
  --exclude .git --exclude app --exclude node_modules --exclude .env --exclude 'deploy/mosquitto/secrets' \
  ./ ubuntu@vps-fbac818c.vps.ovh.net:/srv/pong/
```

La suite se passe sur le VPS : `ssh ubuntu@vps-fbac818c.vps.ovh.net` puis `cd /srv/pong`.

### 3. Créer les secrets

```bash
cat > .env <<EOF
POSTGRES_PASSWORD=$(openssl rand -hex 32)
MQTT_API_PASSWORD=$(openssl rand -hex 32)
JWT_SECRET=$(openssl rand -hex 32)
TARGET_SCORE=7
EOF
chmod 600 .env
chmod +x deploy/*.sh
```

Ce fichier ne quitte jamais le serveur (exclu du rsync et de git).

### 4. Ajouter Pong à Caddy

```bash
sudo cp deploy/pong.caddy /srv/fireline/edge/sites/pong.caddy
docker exec edge-caddy-1 caddy reload --config /etc/caddy/Caddyfile
curl -sI https://pong.164-132-199-27.sslip.io | head -1
```

La dernière commande répond `502` : c'est normal, l'API n'est pas encore lancée. Ce qui compte, c'est que
Caddy vient d'obtenir le certificat HTTPS (sinon : `docker logs edge-caddy-1 --tail 30`).

### 5. Créer les comptes MQTT

```bash
sudo ./deploy/mqtt-user.sh pong-api "$(grep MQTT_API_PASSWORD .env | cut -d= -f2)"
sudo ./deploy/mqtt-user.sh borne-01
```

La seconde commande affiche le mot de passe de la borne : **à transmettre à Nathan** (pas par un canal public).
Une borne de plus = `sudo ./deploy/mqtt-user.sh borne-02`.

### 6. Donner le certificat à Mosquitto

```bash
sudo ./deploy/sync-mqtt-cert.sh
```

Puis, pour suivre les renouvellements automatiques de Caddy, l'ajouter au cron de root (`sudo crontab -e`) :

```
17 4 * * 1 /srv/pong/deploy/sync-mqtt-cert.sh >> /var/log/pong-cert.log 2>&1
```

### 7. Ouvrir le port MQTT

```bash
sudo ufw status
```

Si le pare-feu est actif : `sudo ufw allow 8883/tcp`. S'il est inactif, rien à faire.

### 8. Lancer

```bash
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml logs -f api   # attendre « API prête » et « Connecté au broker »
```

Vérification depuis n'importe où : `curl https://pong.164-132-199-27.sslip.io/api/health` → `{"ok":true}`.

## Tester avec la borne virtuelle

Le plus simple : `./outils/borne-virtuelle/lancer.sh` (lit le mot de passe sur le VPS, ouvre la page et branche la borne).
À la main : ouvre `outils/borne-virtuelle/index.html`, clique « Serveur en ligne », entre le mot de passe de `borne-01`, puis
« Brancher la borne ». Elle passe par `wss://pong.164-132-199-27.sslip.io/mqtt` (Caddy → Mosquitto, port 9001
interne), avec les mêmes comptes et les mêmes droits qu'une vraie borne.

## Brancher l'appli

Dans `app/.env` sur le Mac :

```
EXPO_PUBLIC_API_URL=https://pong.164-132-199-27.sslip.io
```

Relance `npx expo start`. Plus besoin de Tailscale ni du même Wi-Fi : le téléphone passe par Internet.
Si une adresse avait été enregistrée dans Réglages → Adresse du serveur, vide le champ et enregistre.

## Tester le broker depuis le Mac

```bash
mosquitto_pub -h pong.164-132-199-27.sslip.io -p 8883 \
  --cafile "$(brew --prefix)/etc/ca-certificates/cert.pem" \
  -u borne-01 -P '<mot de passe de la borne>' \
  -t pong/bornes/borne-01/status -m online -r -q 1
```

L'appli doit afficher « Borne en ligne ». Sans mot de passe, ou en écrivant sur `pong/bornes/borne-02/…`, le broker refuse.

## Mettre à jour

Sur le Mac, relancer le `rsync` de l'étape 2, puis sur le VPS :

```bash
cd /srv/pong && docker compose -f docker-compose.prod.yml up -d --build
```

Les migrations de base s'appliquent toutes seules au démarrage de l'API.

## Commandes utiles

| Besoin | Commande (dans `/srv/pong`) |
| --- | --- |
| État des conteneurs | `docker compose -f docker-compose.prod.yml ps` |
| Logs de l'API / du broker | `docker compose -f docker-compose.prod.yml logs -f api` (ou `mqtt`) |
| Sauvegarder la base | `docker compose -f docker-compose.prod.yml exec db pg_dump -U pong pong > sauvegarde.sql` |
| Tout arrêter (données gardées) | `docker compose -f docker-compose.prod.yml down` |
| Retirer Pong de Caddy | `sudo rm /srv/fireline/edge/sites/pong.caddy` puis `caddy reload` (étape 4) |

## Si le certificat n'arrive pas

Let's Encrypt limite le nombre de certificats par domaine, et `sslip.io` est partagé par beaucoup de monde.
En cas de refus, Caddy essaie automatiquement un second fournisseur gratuit (ZeroSSL) : rien à faire, mais
la borne devra alors connaître l'autorité de ZeroSSL au lieu de celle de Let's Encrypt (voir `docs/CONTRAT-BORNE.md`).
Pour savoir qui a signé : `openssl s_client -connect pong.164-132-199-27.sslip.io:8883 </dev/null 2>/dev/null | grep issuer`.
Si ça bloque durablement, la solution propre est un vrai nom de domaine.

## Avant la démo

On garde `sslip.io` pour la démo (décision du 26/11) : c'est un service DNS tiers gratuit, sans garantie.
La veille, vérifier depuis le partage de connexion qui servira le jour J :
`curl https://pong.164-132-199-27.sslip.io/api/health` doit répondre `{"ok":true}`, et la borne doit passer « en ligne ».
Prévoir un second téléphone pour le partage de connexion, en secours.
