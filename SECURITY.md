# Signaler une faille de sécurité

Merci de ne pas publier de faille dans un ticket public.

- Sur GitHub : onglet **Security**, puis **Report a vulnerability** (signalement privé, visible des seuls auteurs).
- Indiquer : la partie concernée (application, API, broker MQTT, borne), les étapes pour reproduire, l'impact.

Nous accusons réception sous 7 jours et indiquons la correction prévue. Le dossier de sécurité du projet
(risques connus, mesures en place, grille ETSI EN 303 645) est tenu à jour dans la documentation technique.

Périmètre : le serveur de démonstration `pong.164-132-199-27.sslip.io`, l'API (`api/`), l'application (`app/`),
la borne et son firmware (`firmware/`). Merci de ne pas tester de déni de service sur le serveur de démonstration.
