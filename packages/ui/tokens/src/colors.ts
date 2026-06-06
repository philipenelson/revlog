export const googleBrand = {
  blue:   '#4285F4',
  green:  '#34A853',
  yellow: '#FBBC05',
  red:    '#EA4335',
} as const;

export const colors = {
  teal: {
    300: '#67E2F0',
    400: '#22CBEA',
    500: '#14B8D4',
    600: '#0E9AB3',
    700: '#0A7A8F',
  },
  neutral: {
    50:  '#EDF0F8',
    100: '#C8CCDE',
    200: '#8C8FA8',
    300: '#50527A',
    400: '#34375A',
    500: '#1F2338',
    600: '#1A1D2E',
    700: '#131620',
    800: '#0B0D14',
    900: '#07080D',
  },
  success: {
    500: '#34D399',
    600: '#10B981',
  },
  warning: {
    500: '#FB923C',
    600: '#EA7116',
  },
  danger: {
    500: '#F87171',
    600: '#EF4444',
  },
} as const;

export type ColorScale = typeof colors;
