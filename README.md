# Pong connecté

Module IoT, MBA 2e année. Mathis : appli mobile et API. Nathan : la borne (ESP32, matrice LED, raquettes).

```
 Téléphone (Expo)  ──HTTP + Socket.IO──▶  API Nest.js  ──SQL──▶  Postgres
                                            │
                                            └──MQTT──▶  Mosquitto  ◀──Wi-Fi──  Borne ESP32
```

| Dossier | Contenu |
| --- | --- |
| `docker-compose.yml` | Postgres, Mosquitto (broker MQTT) et l'API |
| `api/` | API Nest.js + Drizzle : comptes, parties, stats, classement, pont MQTT ↔ appli |
| `app/` | Appli Expo (React Native), D.A. « Pixel soleil » |
| `docs/CONTRAT-BORNE.md` | **Pour Nathan** : tout ce que la borne doit envoyer et recevoir |
| `docs/DEPLOIEMENT.md` | Mise en ligne sur le VPS (https://pong.164-132-199-27.sslip.io) |
| `docker-compose.prod.yml`, `deploy/` | Config de production : Mosquitto sécurisé (TLS, comptes, droits), Caddy, scripts |
| `docs/qr-matrice-exemple.png` | Rendu attendu du QR code sur la matrice 24 × 24 de la borne |
| `outils/borne-virtuelle/` | Borne simulée dans le navigateur (matrice 24 × 24, QR, raquettes) pour tester sans le matériel |
| `firmware-exemple/` | Croquis Arduino qui implémente le contrat, à intégrer au firmware |

## Lancer le back

Il faut Docker Desktop.

```bash
docker compose up -d --build
docker compose logs -f api      # l'API est joignable sur http://localhost:3001/api
```

- API : `http://localhost:3001/api` (test : `curl localhost:3001/api/health`)
- Broker MQTT pour la borne : port `1883` sur l'IP du Mac
- Postgres : `localhost:5432`, utilisateur / mot de passe / base `pong`

Les tables sont créées automatiquement au démarrage de l'API (migrations dans `api/drizzle/`).

Tout remettre à zéro (base comprise) : `docker compose down -v`.

## Lancer l'appli

```bash
cd app
npm install
npx expo start
```

Scanne le QR code du terminal avec **Expo Go** (le téléphone doit être sur le même Wi-Fi que le Mac).
L'appli trouve l'API toute seule : elle prend l'IP du Mac qui lui sert le code, port 3001.
Si besoin, l'adresse se change dans Réglages → Adresse du serveur, ou avec `EXPO_PUBLIC_API_URL` dans `app/.env`.

Tout fonctionne dans Expo Go, y compris le scan du QR code affiché par la borne.

## Faire une partie

1. La borne se connecte au broker et publie `online` (voir le contrat) : le serveur lui envoie un code,
   qu'elle affiche en **QR code sur sa matrice 24 × 24**.
2. Joueur 1 : onglet MATCH, il scanne le QR de la matrice. Il joue à gauche. La borne affiche aussitôt un nouveau QR.
3. Joueur 2 : il scanne le nouveau QR. Les deux sont prêts : l'un d'eux appuie sur « Lancer la partie »
   (compte à rebours de 5 s).
4. La borne envoie un `goal` à chaque point ; scores et stats bougent en direct dans les deux applis.
5. À 7 points, le serveur envoie `stop` à la borne et l'appli affiche l'écran de fin. Un nouveau QR s'affiche.

**Alertes** (Réglages) : balle plus rapide qu'un seuil choisi par le joueur, balle de match, borne hors ligne.
Elles s'affichent en bannière dans l'appli, avec vibration, et un son si « Sons rétro » est activé.

Les deux joueurs peuvent aussi arrêter la partie (« Fin du match » des deux côtés) : elle est notée interrompue.

## Tester sans la borne : la borne virtuelle

`outils/borne-virtuelle/index.html` se comporte exactement comme l'ESP32 (même contrat MQTT) : matrice 24 × 24
dessinée à l'écran (QR, attente, compte à rebours, jeu, victoire) et boutons des raquettes.

1. `docker compose up -d` (le broker local accepte aussi le WebSocket, port 9001).
2. Ouvre `outils/borne-virtuelle/index.html` dans Chrome ou Safari sur le Mac, puis « Brancher la borne ».
3. Scanne le QR de l'écran avec l'appli sur deux téléphones (ou deux comptes), puis « Lancer la partie ».
4. Joue au clavier (Z/W et S à gauche, ↑ et ↓ à droite), aux boutons, ou coche « Robot » pour jouer seul.

« Couper le Wi-Fi » simule une panne de la borne (le broker publie son Last Will), « Reset » envoie un `abort`.

## Choix techniques

- **MQTT** entre la borne et le serveur : c'est le standard pour l'ESP32 (PubSubClient), et le Last Will
  permet de savoir tout de suite quand une borne tombe.
- **QR code dynamique sur la matrice** pour rejoindre une partie : le code change à chaque joueur, après chaque
  partie et toutes les 5 minutes, donc il faut être devant la borne pour jouer (une photo ou un badge copié ne
  servent à rien). Marche sur iPhone et Android, dans Expo Go, sans matériel en plus.
- **Le serveur fait foi pour le score** : la borne envoie les buts, le serveur compte, décide de la fin et
  calcule les stats (buts d'affilée, échange le plus long…).
- Les parties ouvertes sont fermées si l'API redémarre ou si la borne passe hors ligne.

## Variables d'environnement (facultatives)

| Variable | Défaut | Rôle |
| --- | --- | --- |
| `JWT_SECRET` | `change-moi-en-local` | Signature des sessions |
| `TARGET_SCORE` | `7` | Points pour gagner |

À mettre dans un fichier `.env` à la racine (voir `.env.example`).

## Ce qui n'est pas encore fait

- Les réglages « Alertes » et « Sons rétro » sont enregistrés sur le compte, mais aucune notification push
  ni aucun son n'est encore branché.
- Le `docker-compose.yml` local n'a ni HTTPS ni authentification MQTT ; la version en ligne (`docker-compose.prod.yml`) a les deux.
