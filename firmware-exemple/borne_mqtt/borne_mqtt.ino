/*
 * Exemple de partie réseau de la borne Pong (ESP32) — à intégrer dans le firmware de Nathan.
 * Implémente docs/CONTRAT-BORNE.md : statut + Last Will, affichage du QR code sur la matrice 24×24,
 * réception des commandes, envoi des buts, avec TLS et mot de passe pour le serveur en ligne.
 *
 * Bibliothèques (gestionnaire Arduino) :
 *   - PubSubClient (Nick O'Leary)
 *   - ArduinoJson (Benoît Blanchon), version 7
 *   - QRCode de Richard Moore (github.com/ricmoo/QRCode) : copier qrcode.c et qrcode.h dans le dossier du
 *     croquis en les renommant qrcode_gen.c / qrcode_gen.h (et corriger l'#include en tête de qrcode_gen.c).
 *     Sur ESP32, un <qrcode.h> existe déjà dans le cœur Arduino et masquerait la bibliothèque.
 *
 * Le jeu lui-même (matrice, boutons, balle) n'est pas ici : branche tes fonctions
 * sur les « À FAIRE » ci-dessous.
 */
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include "qrcode_gen.h"  // QRCode de ricmoo, renommé (voir en-tête)

// ─── Réglages ───────────────────────────────────────────────────────────────
const char* WIFI_SSID = "MON_WIFI";
const char* WIFI_PASS = "MON_MOT_DE_PASSE";
const char* BORNE_ID = "borne-01";       // = le QR code collé sur la borne : pong://borne/borne-01

// Serveur en ligne (démo) : TLS + mot de passe. Mettre à false pour le broker local du Mac.
#define SERVEUR_EN_LIGNE true

#if SERVEUR_EN_LIGNE
const char* MQTT_HOST = "pong.164-132-199-27.sslip.io";
const uint16_t MQTT_PORT = 8883;
const char* MQTT_PASS = "MOT_DE_PASSE_DE_LA_BORNE";  // donné par Mathis, propre à cette borne
// Autorité racine qui a signé le certificat du serveur (Let's Encrypt « ISRG Root X1 »).
// Coller ici le contenu de https://letsencrypt.org/certs/isrgrootx1.pem, lignes BEGIN/END comprises.
const char* ROOT_CA = R"PEM(
-----BEGIN CERTIFICATE-----
... à remplacer ...
-----END CERTIFICATE-----
)PEM";
WiFiClientSecure wifi;
#else
const char* MQTT_HOST = "192.168.1.42";  // IP du Mac qui fait tourner docker compose
const uint16_t MQTT_PORT = 1883;
WiFiClient wifi;
#endif

// ─── QR code sur la matrice ────────────────────────────────────────────────
// Le serveur envoie un code (« PONG:7K3QX9MZ ») tant qu'il reste une place dans la partie.
// QR version 1 = 21 × 21 modules : il tient dans la matrice 24 × 24 avec 1 pixel de marge.
const int MATRIX_SIZE = 24;
const int QR_OFFSET = 1;

// À FAIRE : remplacer par la fonction d'affichage de la matrice.
void setPixel(int x, int y, bool on) { /* matrix.drawPixel(x, y, on ? COULEUR_CLAIRE : NOIR); */ }
void showMatrix() { /* matrix.show(); */ }

void drawQr(const char* text) {
  QRCode qr;
  uint8_t buffer[qrcode_getBufferSize(1)];
  if (qrcode_initText(&qr, buffer, 1, ECC_QUARTILE, text) < 0) {
    Serial.println("Code trop long pour un QR version 1");
    return;
  }
  // Fond ALLUMÉ, modules sombres ÉTEINTS : les téléphones lisent des modules sombres sur fond clair.
  for (int y = 0; y < MATRIX_SIZE; y++) {
    for (int x = 0; x < MATRIX_SIZE; x++) {
      int mx = x - QR_OFFSET, my = y - QR_OFFSET;
      bool dark = mx >= 0 && my >= 0 && mx < qr.size && my < qr.size && qrcode_getModule(&qr, mx, my);
      setPixel(x, y, !dark);
    }
  }
  showMatrix();
}

// ─── Topics ─────────────────────────────────────────────────────────────────
String topicStatus = String("pong/bornes/") + BORNE_ID + "/status";
String topicCommands = String("pong/bornes/") + BORNE_ID + "/commands";
String topicEvents = String("pong/bornes/") + BORNE_ID + "/events";

PubSubClient mqtt(wifi);

// ─── État de la partie ──────────────────────────────────────────────────────
String matchId = "";     // vide = pas de partie en cours
bool playing = false;
int goalSeq = 0;         // numéro du dernier but envoyé (« seq » du contrat), remis à 0 à chaque « start »
bool botRight = false;   // partie contre le bot : la borne joue elle-même la raquette droite
bool remoteRight = false;         // joueur 2 au téléphone : la raquette droite obéit aux commandes « pad »
int remoteDir = 0;                // -1 monter, 1 descendre, 0 arrêt
unsigned long remoteAt = 0;       // millis() du dernier « pad » : sans commande depuis 400 ms, la raquette s'arrête
const unsigned long PAD_TIMEOUT_MS = 400;

// Stats de l'échange en cours, remises à zéro après chaque but.
int rallyHits = 0;       // renvois de raquette
int bounces = 0;         // rebonds sur les murs haut/bas
float maxSpeed = 1.0;    // multiple de la vitesse de départ

// ─── Commandes reçues du serveur ────────────────────────────────────────────
void onCommand(char* topic, byte* payload, unsigned int length) {
  JsonDocument doc;
  if (deserializeJson(doc, payload, length)) return;  // JSON invalide : on ignore
  const char* type = doc["type"] | "";

  if (strcmp(type, "qr") == 0) {
    // code = texte à afficher en QR ; null = plus de place, effacer le QR (afficher les pseudos, « PRÊTS ! »…)
    if (doc["code"].is<const char*>()) {
      // Un code pendant une partie : le serveur l'a arrêtée (coupure trop longue). Retour à l'attente.
      playing = false;
      botRight = false;
      remoteRight = false;
      matchId = "";
      drawQr(doc["code"]);
    } else Serial.println("QR masqué");

  } else if (strcmp(type, "lobby") == 0) {
    // Joueurs dans la salle. À FAIRE (facultatif) : afficher les pseudos à côté ou à la place du QR,
    // puis « PRÊTS ! » quand ready = true (ils lancent la partie depuis l'appli).
    const char* left = doc["left"] | "???";
    const char* right = doc["right"] | "???";
    bool ready = doc["ready"] | false;
    Serial.printf("Salle : %s vs %s%s\n", left, right, ready ? " (prêts, lancement depuis l'appli)" : "");


  } else if (strcmp(type, "start") == 0) {
    matchId = doc["matchId"].as<String>();
    int countdown = doc["countdown"] | 5;
    const char* left = doc["left"] | "???";
    const char* right = doc["right"] | "???";
    Serial.printf("Start %s : %s vs %s dans %ds\n", matchId.c_str(), left, right, countdown);
    // À FAIRE : afficher les pseudos, le compte à rebours, puis lancer la balle
    playing = true;
    goalSeq = 0;
    // « bot » = "right" : partie contre le bot. À FAIRE : piloter la raquette droite par l'IA, ignorer ses boutons.
    botRight = strcmp(doc["bot"] | "", "right") == 0;
    // « remote » = "right" : le joueur 2 joue avec son téléphone (commandes « pad »).
    remoteRight = strcmp(doc["remote"] | "", "right") == 0;
    remoteDir = 0;
    rallyHits = 0; bounces = 0; maxSpeed = 1.0;

  } else if (strcmp(type, "pad") == 0) {
    // Manette du téléphone. À FAIRE dans la boucle du jeu : si remoteRight, direction de la raquette droite =
    // (millis() - remoteAt < PAD_TIMEOUT_MS) ? remoteDir : 0.
    if (remoteRight && matchId == (doc["matchId"] | "")) {
      remoteDir = constrain((int)(doc["dir"] | 0), -1, 1);
      remoteAt = millis();
      // Facultatif : accusé de réception, pour que l'appli affiche la latence.
      JsonDocument ack;
      ack["type"] = "pad_ack";
      ack["matchId"] = matchId;
      ack["n"] = doc["n"] | 0;
      char buf[96];
      size_t len = serializeJson(ack, buf);
      mqtt.publish(topicEvents.c_str(), (const uint8_t*)buf, len, false);
    }

  } else if (strcmp(type, "score") == 0) {
    // À FAIRE (facultatif) : afficher doc["left"] et doc["right"] (score officiel)

  } else if (strcmp(type, "stop") == 0) {
    const char* reason = doc["reason"] | "";
    const char* winner = doc["winner"] | "";
    Serial.printf("Stop (%s), vainqueur : %s\n", reason, winner);
    // À FAIRE : arrêter la balle, afficher le vainqueur, revenir à l'écran d'attente
    playing = false;
    botRight = false;
    remoteRight = false;
    matchId = "";
  }
}

// ─── Événements envoyés au serveur ──────────────────────────────────────────
// À appeler par le jeu quand la balle sort : side = "left" si c'est le joueur de GAUCHE qui marque.
void sendGoal(const char* side) {
  if (!playing || matchId.isEmpty()) return;
  JsonDocument doc;
  doc["type"] = "goal";
  doc["matchId"] = matchId;
  doc["seq"] = ++goalSeq;  // un but renvoyé après une coupure doit garder le même seq
  doc["side"] = side;
  doc["rallyHits"] = rallyHits;
  doc["bounces"] = bounces;
  doc["maxSpeed"] = maxSpeed;
  char buf[256];
  size_t n = serializeJson(doc, buf);
  // Exemple simplifié : hors ligne, le but est perdu. Le firmware final le garde dans une file
  // et le renvoie tel quel à la reconnexion (voir « Coupure réseau » dans docs/CONTRAT-BORNE.md).
  mqtt.publish(topicEvents.c_str(), (const uint8_t*)buf, n, false);
  rallyHits = 0; bounces = 0; maxSpeed = 1.0;
  // Pas besoin de compter jusqu'à 7 : le serveur envoie « stop » quand la partie est gagnée.
}

// À appeler par le jeu pour couper la partie (ex. appui long sur reset).
void sendAbort() {
  if (matchId.isEmpty()) return;
  JsonDocument doc;
  doc["type"] = "abort";
  doc["matchId"] = matchId;
  char buf[128];
  size_t n = serializeJson(doc, buf);
  mqtt.publish(topicEvents.c_str(), (const uint8_t*)buf, n, false);
}

// À appeler par le jeu pendant l'échange :
void onPaddleHit() { rallyHits++; }
void onWallBounce() { bounces++; }
void onSpeedChange(float multiplier) { if (multiplier > maxSpeed) maxSpeed = multiplier; }

// ─── Connexion ──────────────────────────────────────────────────────────────
void connectWifi() {
  if (WiFi.status() == WL_CONNECTED) return;
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  Serial.print("Wi-Fi");
  while (WiFi.status() != WL_CONNECTED) { delay(300); Serial.print("."); }
  Serial.printf(" OK (%s)\n", WiFi.localIP().toString().c_str());
}

void connectMqtt() {
  while (!mqtt.connected()) {
    Serial.print("MQTT... ");
    // Last Will : si la borne disparaît, le broker publie « offline » à sa place.
#if SERVEUR_EN_LIGNE
    // Identifiant MQTT = id de la borne : le broker ne l'autorise que sur ses propres topics.
    bool ok = mqtt.connect(BORNE_ID, BORNE_ID, MQTT_PASS, topicStatus.c_str(), 1, true, "offline");
#else
    bool ok = mqtt.connect(BORNE_ID, topicStatus.c_str(), 1, true, "offline");
#endif
    if (ok) {
      Serial.println("OK");
      mqtt.publish(topicStatus.c_str(), "online", true);  // retained
      mqtt.subscribe(topicCommands.c_str(), 1);
      // Une partie en cours avant la coupure continue (le serveur attend 90 s) : on garde matchId.
      // Si le serveur l'a arrêtée entre-temps, il enverra un « qr » avec un code : retour à l'attente.
    } else {
      Serial.printf("échec (%d), nouvel essai dans 2 s\n", mqtt.state());
      delay(2000);
    }
  }
}

void setup() {
  Serial.begin(115200);
#if SERVEUR_EN_LIGNE
  wifi.setCACert(ROOT_CA);   // refuse tout serveur dont le certificat n'est pas signé par cette autorité
#endif
  mqtt.setServer(MQTT_HOST, MQTT_PORT);
  mqtt.setCallback(onCommand);
  mqtt.setBufferSize(512);   // les commandes « start » dépassent les 256 octets par défaut
  mqtt.setKeepAlive(10);     // le serveur voit la borne hors ligne ~15 s après une coupure
  connectWifi();
  connectMqtt();
  // À FAIRE : initialiser la matrice et les boutons
}

void loop() {
  connectWifi();
  connectMqtt();
  mqtt.loop();
  // À FAIRE : faire avancer le jeu (sans delay() long, sinon MQTT décroche)
}
