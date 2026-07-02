export const fontSize = {
  xs: 12,
  sm: 14,
  base: 16,
  lg: 18,
  xl: 20,
  '2xl': 24,
  '3xl': 30,
  '4xl': 36,
} as const;

export const fontWeight = {
  normal: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
} as const;

export const lineHeight = {
  tight: 1.25,
  snug: 1.375,
  normal: 1.5,
  relaxed: 1.625,
} as const;

// Mobile-only values (web loads Outfit as a variable font via next/font and
// selects weight with CSS `font-weight`; see apps/web/src/app/layout.tsx).
// React Native doesn't honor `fontWeight` against a statically-loaded custom
// font -- @expo-google-fonts/outfit registers each weight as its own named
// font, so every weight actually used gets its own explicit token here
// rather than one `display` name paired with a `fontWeight` style (see ADR
// 0032). `sans`/`mono` stay as plain family names since nothing on mobile
// loads or uses them yet.
export const fontFamily = {
  display: 'Outfit_400Regular',
  displaySemibold: 'Outfit_600SemiBold',
  displayBold: 'Outfit_700Bold',
  sans: 'DM Sans',
  mono: 'Geist Mono',
} as const;

export type TypographyTokens = {
  fontSize: typeof fontSize;
  fontWeight: typeof fontWeight;
  lineHeight: typeof lineHeight;
  fontFamily: typeof fontFamily;
};
