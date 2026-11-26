/**
 * Design tokens shared by web and native. The web defines the same colors in src/index.css (oklch);
 * these are the exact hex equivalents. Change both together.
 */
export const colors = {
  background: '#110d0a',
  foreground: '#f6f1e9',
  card: '#1b1612',
  cardForeground: '#f6f1e9',
  popover: '#1e1814',
  popoverForeground: '#f6f1e9',
  primary: '#f3bd5c',
  primaryForeground: '#271a09',
  secondary: '#2a241f',
  secondaryForeground: '#f6f1e9',
  muted: '#28211d',
  mutedForeground: '#a9a094',
  accent: '#2d2620',
  accentForeground: '#f6f1e9',
  destructive: '#ef6856',
  border: '#f6ede017',
  input: '#f6ede024',
  ring: '#f3bd5c99',
  like: '#34d399',
} as const

export const radius = 12
