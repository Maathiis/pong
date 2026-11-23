# Contrat borne ↔ serveur (MQTT)

Ce document décrit tout ce que la borne (ESP32) doit savoir faire pour fonctionner avec l'API et l'appli.
Le jeu lui-même (balle, raquettes, matrice, boutons) reste entièrement côté borne. Le serveur ne fait que :
dire à la borne quand une partie commence et s'arrête, avec les pseudos, et recevoir les buts avec leurs stats.

## Connexion

| Réglage | Valeur en local |
| --- | --- |
| Broker | Mosquitto, lancé par `docker compose up` |
| Hôte | l'adresse IP du Mac sur le Wi-Fi (ex. `192.168.1.42`) |
| Port | `1883` (TCP, sans TLS) |
| Identifiants | aucun en local (connexion anonyme autorisée) |
| Client ID | l'identifiant de la borne, ex. `borne-01` |

Chaque borne a un identifiant fixe (`borne-01`, `borne-02`…), écrit en dur dans le firmware.
C'est aussi ce qu'il y a dans le QR code collé sur la borne : `pong://borne/borne-01`.
Le joueur scanne ce QR code avec l'appli pour rejoindre la partie. La borne n'a rien à faire pour ça.

Toutes les topics commencent par `pong/bornes/<id>/`.

## 1. Statut : `pong/bornes/<id>/status` (borne → serveur)

- À la connexion, la borne publie `online` (texte brut, **retained**, QoS 1).
- Elle déclare un **Last Will** sur la même topic : `offline`, retained, QoS 1.
  Si la borne perd le Wi-Fi ou plante, le broker publie `offline` tout seul (après ~1,5 × le keepalive).

Sans `online`, l'appli affiche « Borne hors ligne » et refuse de lancer une partie.
Si la borne passe `offline` pendant une partie, la partie est notée « interrompue ».

## 2. Commandes : `pong/bornes/<id>/commands` (serveur → borne)

La borne s'abonne à cette topic (QoS 1). Messages en JSON, toujours avec un champ `type`.

### `lobby` : un joueur attend

```json
{ "type": "lobby", "left": "NATHAN", "right": null }
```

Facultatif à gérer : la matrice peut afficher « NATHAN VS ??? ». Envoyé quand le premier joueur rejoint.

### `start` : la partie commence

```json
{ "type": "start", "matchId": "6f1c…", "countdown": 5, "targetScore": 7, "left": "NATHAN", "right": "MATHIS" }
```

- `countdown` : secondes de compte à rebours à afficher avant d'engager la balle.
- `left` / `right` : pseudos (2 à 8 caractères, majuscules et chiffres, donc affichables sur la matrice).
- **La borne garde `matchId`** : elle doit le renvoyer dans chaque événement.

### `score` : score officiel après chaque but

```json
{ "type": "score", "matchId": "6f1c…", "left": 5, "right": 6, "matchPoint": "right" }
```

Facultatif à gérer : la borne peut afficher son propre compteur. `matchPoint` vaut `left`, `right` ou `null`.

### `stop` : la partie est terminée

```json
{ "type": "stop", "matchId": "6f1c…", "reason": "finished", "winner": "left" }
```

- `reason` : `finished` (un joueur a atteint `targetScore`), `interrupted` (les deux joueurs ont demandé la fin dans l'appli) ou `cancelled` (le second joueur n'est jamais venu).
- `winner` : `left`, `right` ou `null`.
- À réception, la borne arrête la balle, peut afficher le vainqueur, puis revient en attente.

**C'est le serveur qui décide de la fin** : la borne n'a pas besoin de compter jusqu'à 7, elle attend `stop`.

## 3. Événements : `pong/bornes/<id>/events` (borne → serveur)

QoS 1, JSON.

### `goal` : un point est marqué

```json
{ "type": "goal", "matchId": "6f1c…", "side": "left", "rallyHits": 14, "bounces": 9, "maxSpeed": 2.8 }
```

| Champ | Sens |
| --- | --- |
| `side` | qui **marque** le point : `left` ou `right` |
| `rallyHits` | nombre de renvois de raquette pendant l'échange qui vient de finir |
| `bounces` | nombre de rebonds sur les murs (haut/bas) pendant cet échange |
| `maxSpeed` | vitesse max de la balle pendant l'échange, en multiple de la vitesse de départ (1.0 = départ) |

`rallyHits`, `bounces` et `maxSpeed` sont facultatifs (0 par défaut), mais ce sont eux qui remplissent
les stats de l'appli (« échange le + long », « rebonds total », « vitesse balle max »).
Les « buts d'affilée » sont calculés par le serveur.

### `abort` : la borne coupe la partie

```json
{ "type": "abort", "matchId": "6f1c…" }
```

Par exemple sur un appui long sur reset. La partie est notée « interrompue ».

Un événement dont le `matchId` n'est pas la partie en cours de cette borne est ignoré.

## Déroulé d'une partie

```
Joueur 1 scanne le QR      →  serveur publie  lobby {left:"NATHAN", right:null}
Joueur 2 scanne le QR      →  serveur publie  start {matchId, countdown:5, left, right, targetScore:7}
… la borne joue …
But à gauche               ←  borne publie    goal {matchId, side:"left", rallyHits, bounces, maxSpeed}
                           →  serveur publie  score {matchId, left:1, right:0, matchPoint:null}
… jusqu'à 7 …
                           →  serveur publie  stop {matchId, reason:"finished", winner:"left"}
```

## Tester sans l'appli

Avec `mosquitto_sub` / `mosquitto_pub` (Homebrew : `brew install mosquitto`) :

```bash
# voir tout ce qui passe
mosquitto_sub -h localhost -t 'pong/#' -v

# se déclarer en ligne
mosquitto_pub -h localhost -t pong/bornes/borne-01/status -m online -r -q 1

# après que deux joueurs ont scanné, récupérer le matchId dans le message « start » affiché par mosquitto_sub, puis :
mosquitto_pub -h localhost -t pong/bornes/borne-01/events -q 1 \
  -m '{"type":"goal","matchId":"<matchId>","side":"left","rallyHits":6,"bounces":3,"maxSpeed":1.8}'
```

Le score bouge dans l'appli des deux joueurs à chaque message.

Un exemple de croquis Arduino qui implémente ce contrat se trouve dans `firmware-exemple/borne_mqtt/`.
