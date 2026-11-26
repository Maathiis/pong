# Contrat borne ↔ serveur (MQTT)

Ce document décrit tout ce que la borne (ESP32) doit savoir faire pour fonctionner avec l'API et l'appli.
Le jeu lui-même (balle, raquettes, matrice, boutons) reste entièrement côté borne. Le serveur ne fait que :
lui donner le QR code à afficher pour que les joueurs rejoignent la partie, lui dire quand la partie commence
et s'arrête, avec les pseudos, et recevoir les buts avec leurs stats.

**En résumé, la borne doit :**
1. se connecter au broker et publier `online` (avec `offline` en Last Will) ;
2. afficher sur la matrice 24 × 24 le QR code reçu dans la commande `qr` (et l'effacer quand le code est `null`) ;
3. obéir aux commandes `start` et `stop` (et, si possible, afficher `lobby` et `score`) ;
4. publier `goal` à chaque point.

## Connexion

| Réglage | Serveur en ligne (démo) | En local (Mac) |
| --- | --- | --- |
| Hôte | `pong.164-132-199-27.sslip.io` | l'IP du Mac (ex. `192.168.1.42`) |
| Port | `8883`, **TLS obligatoire** | `1883`, sans TLS |
| Identifiant MQTT | l'identifiant de la borne, ex. `borne-01` | aucun |
| Mot de passe | fourni par Mathis (un par borne) | aucun |
| Client ID | l'identifiant de la borne | l'identifiant de la borne |

Sur le serveur en ligne :
- **TLS** : la borne vérifie le certificat du serveur. Il est signé par Let's Encrypt, dont l'autorité racine est
  « ISRG Root X1 » (fichier : https://letsencrypt.org/certs/isrgrootx1.pem) : c'est elle qu'on donne à `WiFiClientSecure::setCACert`.
- **Droits** : une borne ne peut publier que sur `pong/bornes/<son id>/status` et `/events`, et ne lit que
  `pong/bornes/<son id>/commands`. L'identifiant MQTT doit donc être exactement l'id de la borne.

Chaque borne a un identifiant fixe (`borne-01`, `borne-02`…), écrit en dur dans le firmware.

Toutes les topics commencent par `pong/bornes/<id>/`.

## 1. Statut : `pong/bornes/<id>/status` (borne → serveur)

- À la connexion, la borne publie `online` (texte brut, **retained**, QoS 1).
- Elle déclare un **Last Will** sur la même topic : `offline`, retained, QoS 1.
  Si la borne perd le Wi-Fi ou plante, le broker publie `offline` tout seul (après ~1,5 × le keepalive).

Sans `online`, l'appli affiche « Borne hors ligne » et refuse de lancer une partie.
Si la borne passe `offline` pendant une partie, la partie est notée « interrompue ».

## 2. Commandes : `pong/bornes/<id>/commands` (serveur → borne)

La borne s'abonne à cette topic (QoS 1). Messages en JSON, toujours avec un champ `type`.

### `qr` : le QR code à afficher sur la matrice

```json
{ "type": "qr", "code": "PONG:7K3QX9MZ" }
{ "type": "qr", "code": null }
```

- Tant qu'il reste une place (borne libre, ou un seul joueur dans la salle), le serveur envoie un `code` :
  la borne l'affiche en QR code sur sa matrice, les joueurs le scannent avec l'appli pour rejoindre.
- **Le code change** à chaque joueur qui rejoint, après chaque partie et toutes les 5 minutes : il faut
  toujours afficher le dernier reçu. Un ancien code est refusé (une photo du QR ne sert plus à rien).
- `code: null` : la salle est complète ou la partie a commencé → effacer le QR (afficher les pseudos, le jeu…).
- Le code fait toujours 13 caractères (`PONG:` + 8 lettres/chiffres), en majuscules : il tient dans un
  **QR version 1 (21 × 21 modules)**, niveau de correction Q, avec 1 pixel de marge dans la matrice 24 × 24.
- **Fond allumé, modules sombres éteints** : les téléphones lisent des modules sombres sur fond clair.
  Luminosité moyenne (une matrice trop forte « bave » et le QR devient illisible). Rendu attendu : `docs/qr-matrice-exemple.png`.

### `lobby` : les joueurs dans la salle

```json
{ "type": "lobby", "left": "NATHAN", "right": null, "ready": false }
```

Envoyé à chaque joueur qui rejoint ou quitte. `ready` passe à `true` quand les deux joueurs sont là :
ils lancent la partie depuis l'appli. Facultatif à gérer : la matrice peut afficher « NATHAN VS ??? » à côté
du QR, puis « PRÊTS ! ».

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

- `reason` : `finished` (un joueur a atteint `targetScore`), `interrupted` (les deux joueurs ont demandé la fin dans l'appli) ou `cancelled` (salle fermée sans partie : personne n'a lancé dans les 2 minutes, ou tout le monde est parti).
- Juste après `stop`, le serveur envoie un nouveau `qr` pour la partie suivante.
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

Un `goal` ou un `abort` dont le `matchId` n'est pas la partie en cours de cette borne est ignoré.

## Déroulé d'une partie

```
Borne en ligne             ←  borne publie    status "online"
                           →  serveur publie  qr {code:"PONG:7K3QX9MZ"}           (la matrice affiche le QR)
Joueur 1 scanne le QR      →  serveur publie  lobby {left:"NATHAN", right:null, ready:false}
                           →  serveur publie  qr {code:"PONG:Q4M8ZK2C"}           (nouveau code pour le joueur 2)
Joueur 2 scanne le QR      →  serveur publie  lobby {left:"NATHAN", right:"MATHIS", ready:true}
                           →  serveur publie  qr {code:null}                      (effacer le QR)
« Lancer » dans l'appli    →  serveur publie  start {matchId, countdown:5, left, right, targetScore:7}
… la borne joue …
But à gauche               ←  borne publie    goal {matchId, side:"left", rallyHits, bounces, maxSpeed}
                           →  serveur publie  score {matchId, left:1, right:0, matchPoint:null}
… jusqu'à 7 …
                           →  serveur publie  stop {matchId, reason:"finished", winner:"left"}
                           →  serveur publie  qr {code:"PONG:…"}                  (prête pour la suivante)
```

## Tester sans l'appli

Avec `mosquitto_sub` / `mosquitto_pub` (Homebrew : `brew install mosquitto`), sur le broker local.
Pour le serveur en ligne, ajouter `-p 8883 --cafile "$(brew --prefix)/etc/ca-certificates/cert.pem" -u borne-01 -P '<mot de passe>'`
et remplacer `localhost` par `pong.164-132-199-27.sslip.io` (voir `docs/DEPLOIEMENT.md`).

```bash
# voir tout ce qui passe
mosquitto_sub -h localhost -t 'pong/#' -v

# se déclarer en ligne : mosquitto_sub affiche aussitôt le code à mettre en QR
mosquitto_pub -h localhost -t pong/bornes/borne-01/status -m online -r -q 1

# une fois la partie lancée depuis l'appli, récupérer le matchId dans le message « start » affiché par mosquitto_sub, puis :
mosquitto_pub -h localhost -t pong/bornes/borne-01/events -q 1 \
  -m '{"type":"goal","matchId":"<matchId>","side":"left","rallyHits":6,"bounces":3,"maxSpeed":1.8}'
```

Le score bouge dans l'appli des deux joueurs à chaque message.

La borne virtuelle (`outils/borne-virtuelle/index.html`) implémente tout ce contrat dans un navigateur :
c'est la référence à comparer en cas de doute sur un message.

Un exemple de croquis Arduino qui implémente ce contrat se trouve dans `firmware-exemple/borne_mqtt/`.
