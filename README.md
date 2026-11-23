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
| `docs/qr/` | QR codes à imprimer et coller sur les bornes |
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

Tout fonctionne dans Expo Go, y compris le scan du QR code de la borne.

## Faire une partie

1. La borne se connecte au broker et publie `online` (voir le contrat).
2. Joueur 1 : onglet MATCH, scanne le QR code de la borne (`docs/qr/borne-01.png`). Il joue à gauche.
3. Joueur 2 : pareil sur son téléphone. Le serveur envoie `start` à la borne, compte à rebours de 5 s.
4. La borne envoie un `goal` à chaque point ; scores et stats bougent en direct dans les deux applis.
5. À 7 points, le serveur envoie `stop` à la borne et l'appli affiche l'écran de fin.

Les deux joueurs peuvent aussi arrêter la partie (« Fin du match » des deux côtés) : elle est notée interrompue.

## Choix techniques

- **MQTT** entre la borne et le serveur : c'est le standard pour l'ESP32 (PubSubClient), et le Last Will
  permet de savoir tout de suite quand une borne tombe.
- **QR code sur la borne** pour rejoindre une partie : marche sur iPhone et Android, dans Expo Go,
  sans matériel en plus côté borne.
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
- Pas de HTTPS ni d'authentification MQTT : c'est une config de développement en local.
