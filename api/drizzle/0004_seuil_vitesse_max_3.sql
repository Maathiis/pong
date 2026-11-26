-- La balle de la borne plafonne à x3,2 : un seuil d'alerte au-delà de x3 ne se déclencherait jamais.
UPDATE "users" SET "speed_alert_threshold" = 3 WHERE "speed_alert_threshold" > 3;
