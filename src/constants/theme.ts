// Design tokens, matching the web app's :root variables.
export const colors = {
  bgScreen: '#070707',
  bgCard: '#171717',
  bgCardMuted: '#262626',

  textPrimary: '#FFFFFF',
  textSecondary: '#B2B2B2',
  textTertiary: '#7D7D7D',

  btnPrimaryBg: '#F3F3F3',
  btnPrimaryFg: '#000000',
  btnSecondaryBg: '#262626',
  btnSecondaryFg: '#FFFFFF',

  highlight: '#FF0000',
  divider: 'rgba(255,255,255,0.10)',
  border: 'rgba(255,255,255,0.15)',
  focalLine: '#292929',
};

export const shadows = {
  small: 'inset 6px 6px 6px rgba(255,255,255,0.03), inset -6px -6px 6px rgba(0,0,0,0.31)',
  regular: 'inset 10px 10px 10px rgba(255,255,255,0.03), inset -10px -10px 10px rgba(0,0,0,0.31)',
};

// Tinos is metrically compatible with Times New Roman, the web app's display font,
// and looks the same on iOS and Android.
export const fonts = {
  display: 'Tinos_700Bold',
};

export const clamp = (min: number, v: number, max: number) => Math.max(min, Math.min(max, v));
