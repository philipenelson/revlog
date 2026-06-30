// Pixel values. Mirrors the --radius-* scale in tokens.css (the web CSS bridge).
export const radius = {
  sm: 6,
  md: 10,
  lg: 16,
  xl: 24,
} as const;

export type RadiusScale = typeof radius;
