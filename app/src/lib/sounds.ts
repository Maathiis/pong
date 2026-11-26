import { createAudioPlayer, type AudioPlayer } from 'expo-audio';

/** Bruitages 8 bits (générés en ondes carrées, dossier assets/sounds). Joués seulement si « Sons rétro » est activé. */
const SOURCES = {
  point: require('../../assets/sounds/point.wav'),
  alerte: require('../../assets/sounds/alerte.wav'),
  victoire: require('../../assets/sounds/victoire.wav'),
  defaite: require('../../assets/sounds/defaite.wav'),
  depart: require('../../assets/sounds/depart.wav'),
} as const;

export type SoundName = keyof typeof SOURCES;

const players: Partial<Record<SoundName, AudioPlayer>> = {};

export function playSound(name: SoundName) {
  try {
    const player = (players[name] ??= createAudioPlayer(SOURCES[name]));
    player.seekTo(0).catch(() => undefined);
    player.play();
  } catch {
    // un son raté ne doit jamais bloquer l'appli
  }
}
