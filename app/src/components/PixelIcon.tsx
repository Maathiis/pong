import { View } from 'react-native';

/** Icônes 8×8 des maquettes, dessinées avec des rectangles [x, y, largeur, hauteur]. */
const ICONS = {
  home: [
    [3, 0, 2, 1],
    [2, 1, 4, 1],
    [1, 2, 6, 1],
    [0, 3, 8, 1],
    [1, 4, 6, 4],
  ],
  match: [
    [0, 1, 1, 6],
    [7, 1, 1, 6],
    [3, 3, 2, 2],
  ],
  settings: [
    [3, 0, 2, 2],
    [3, 6, 2, 2],
    [0, 3, 2, 2],
    [6, 3, 2, 2],
    [2, 2, 4, 4],
  ],
  // flèches de la manette
  up: [
    [3, 0, 2, 1],
    [2, 1, 4, 1],
    [1, 2, 6, 1],
    [0, 3, 8, 1],
    [3, 4, 2, 4],
  ],
  down: [
    [3, 0, 2, 4],
    [0, 4, 8, 1],
    [1, 5, 6, 1],
    [2, 6, 4, 1],
    [3, 7, 2, 1],
  ],
} as const;

export type IconName = keyof typeof ICONS;

export function PixelIcon({ name, color, size = 24 }: { name: IconName; color: string; size?: number }) {
  const u = size / 8;
  return (
    <View style={{ width: size, height: size }} accessible={false}>
      {ICONS[name].map(([x, y, w, h], i) => (
        <View
          key={i}
          style={{ position: 'absolute', left: x * u, top: y * u, width: w * u, height: h * u, backgroundColor: color }}
        />
      ))}
    </View>
  );
}
