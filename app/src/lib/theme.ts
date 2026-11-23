/** Direction artistique « Pixel soleil » : couleurs vives sur fond crème, contours violet nuit. */
export const colors = {
  cream: '#FFF1C9',
  ink: '#2B1B4D',
  inkSoft: '#5A4A7A',
  white: '#FFFFFF',
  sky: '#6FC3FF',
  orange: '#FF7A3D',
  apricot: '#FFB24D',
  mint: '#5EE6D0',
  pink: '#FF8FB1',
  lime: '#9BEA6A',
  lilac: '#E3D9F5',
  online: '#1E9E3A',
  offline: '#D9480F',
  // couleurs des chiffres dans les cartes de stats
  statSpeed: '#D9480F',
  statStreak: '#0B7A6B',
  statRally: '#B3245A',
  statBounces: '#2B5FD9',
} as const;

export const fonts = {
  pixel: 'PressStart2P_400Regular',
  mono: 'VT323_400Regular',
} as const;

/** Bordure épaisse + ombre dure décalée, la signature des maquettes. */
export const block = (shadow = 4) => ({
  borderWidth: 4,
  borderColor: colors.ink,
  boxShadow: shadow ? `${shadow}px ${shadow}px 0px ${colors.ink}` : undefined,
});
