# Pong connecté

Projet du module IoT (MBA 2e année), en binôme : Mathis fait l'appli mobile et l'API, Nathan la borne ESP32.
Lire `README.md` pour l'architecture et `docs/CONTRAT-BORNE.md` pour les échanges MQTT avec la borne.
Le contrat MQTT est partagé avec Nathan : toute modification doit être reportée dans ce document.

## Structure

- `api/` : Nest.js 12 (ESM : imports relatifs en `.js`), Drizzle ORM + Postgres, Socket.IO, mqtt.js.
  - `src/matches/matches.service.ts` porte toute la logique de partie (états WAITING → COUNTDOWN → LIVE → FINISHED / INTERRUPTED / CANCELLED).
  - Schéma dans `src/db/schema.ts` ; après une modification : `npm run db:generate` (crée la migration SQL dans `drizzle/`).
- `app/` : Expo SDK 58, Expo Router (`src/app/`), voir aussi `app/AGENTS.md`.
  - Installer les paquets avec `npx expo install`, garder la compatibilité Expo Go.
  - Vérifier avec `npx tsc --noEmit`.
- Textes de l'interface en français.

## Direction artistique « Pixel soleil »

Reprendre les maquettes (artefact « Pong Connecté — Maquettes de l'appli ») et les composants de `app/src/components/ui.tsx`.

- Fond crème `#FFF1C9`, encre violet nuit `#2B1B4D` (textes, contours, ombres).
- Couleurs vives : ciel `#6FC3FF` (bandeaux), orange `#FF7A3D` (action principale, onglet actif), abricot `#FFB24D`,
  menthe `#5EE6D0` (joueur gauche), rose `#FF8FB1` (joueur droit, actions destructives), citron vert `#9BEA6A` (victoire, en ligne).
- Polices : Press Start 2P pour les titres, étiquettes et chiffres ; VT323 pour le texte courant.
- Contours de 3 à 4 px, ombres dures décalées (4-5 px, sans flou), angles droits, aucun dégradé.
- Titres blancs avec ombre portée violette ; nuages en rectangles blancs dans les bandeaux.
- Barre d'onglets violette en bas : ACCUEIL / MATCH / RÉGLAGES, icônes pixel 8×8.
