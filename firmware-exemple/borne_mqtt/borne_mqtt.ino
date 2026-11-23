/*
 * Exemple de partie réseau de la borne Pong (ESP32) — à intégrer dans le firmware de Nathan.
 * Implémente docs/CONTRAT-BORNE.md : statut + Last Will, réception des commandes, envoi des buts.
 *
 * Bibliothèques (gestionnaire Arduino) :
 *   - PubSubClient (Nick O'Leary)
 *   - ArduinoJson (Benoît Blanchon), version 7
 *
 * Le jeu lui-même (matrice, boutons, balle) n'est pas ici : branche tes fonctions
 * sur les « À FAIRE » ci-dessous.
 */
#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>

// ─── Réglages ───────────────────────────────────────────────────────────────
const char* WIFI_SSID = "MON_WIFI";
const char* WIFI_PASS = "MON_MOT_DE_PASSE";
const char* MQTT_HOST = "192.168.1.42";  // IP du Mac qui fait tourner docker compose
const uint16_t MQTT_PORT = 1883;
const char* BORNE_ID = "borne-01";       // = le QR code collé sur la borne : pong://borne/borne-01

// ─── Topics ─────────────────────────────────────────────────────────────────
String topicStatus = String("pong/bornes/") + BORNE_ID + "/status";
String topicCommands = String("pong/bornes/") + BORNE_ID + "/commands";
String topicEvents = String("pong/bornes/") + BORNE_ID + "/events";

WiFiClient wifi;
PubSubClient mqtt(wifi);

// ─── État de la partie ──────────────────────────────────────────────────────
String matchId = "";     // vide = pas de partie en cours
bool playing = false;

// Stats de l'échange en cours, remises à zéro après chaque but.
int rallyHits = 0;       // renvois de raquette
int bounces = 0;         // rebonds sur les murs haut/bas
float maxSpeed = 1.0;    // multiple de la vitesse de départ

// ─── Commandes reçues du serveur ────────────────────────────────────────────
void onCommand(char* topic, byte* payload, unsigned int length) {
  JsonDocument doc;
  if (deserializeJson(doc, payload, length)) return;  // JSON invalide : on ignore
  const char* type = doc["type"] | "";

  if (strcmp(type, "lobby") == 0) {
    // À FAIRE (facultatif) : afficher « <left> VS ??? » sur la matrice
    const char* left = doc["left"] | "???";
    Serial.printf("Lobby : %s attend\n", left);

  } else if (strcmp(type, "start") == 0) {
    matchId = doc["matchId"].as<String>();
    int countdown = doc["countdown"] | 5;
    const char* left = doc["left"] | "???";
    const char* right = doc["right"] | "???";
    Serial.printf("Start %s : %s vs %s dans %ds\n", matchId.c_str(), left, right, countdown);
    // À FAIRE : afficher les pseudos, le compte à rebours, puis lancer la balle
    playing = true;
    rallyHits = 0; bounces = 0; maxSpeed = 1.0;

  } else if (strcmp(type, "score") == 0) {
    // À FAIRE (facultatif) : afficher doc["left"] et doc["right"] (score officiel)

  } else if (strcmp(type, "stop") == 0) {
    const char* reason = doc["reason"] | "";
    const char* winner = doc["winner"] | "";
    Serial.printf("Stop (%s), vainqueur : %s\n", reason, winner);
    // À FAIRE : arrêter la balle, afficher le vainqueur, revenir à l'écran d'attente
    playing = false;
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
  doc["side"] = side;
  doc["rallyHits"] = rallyHits;
  doc["bounces"] = bounces;
  doc["maxSpeed"] = maxSpeed;
  char buf[256];
  size_t n = serializeJson(doc, buf);
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
    if (mqtt.connect(BORNE_ID, topicStatus.c_str(), 1, true, "offline")) {
      Serial.println("OK");
      mqtt.publish(topicStatus.c_str(), "online", true);  // retained
      mqtt.subscribe(topicCommands.c_str(), 1);
      // Une partie éventuellement en cours avant la coupure a été interrompue côté serveur.
      playing = false;
      matchId = "";
    } else {
      Serial.printf("échec (%d), nouvel essai dans 2 s\n", mqtt.state());
      delay(2000);
    }
  }
}

void setup() {
  Serial.begin(115200);
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
