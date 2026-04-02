/**
 * Tema oscuro principal (coherente con la tab bar flotante).
 * Importar desde pantallas y `App.tsx` para fondos, texto y tarjetas.
 */
export const theme = {
  bg: '#141210',
  bgElevated: '#1E1C1A',
  card: '#262320',
  cardHover: '#2E2B28',
  border: 'rgba(255,255,255,0.09)',
  borderStrong: 'rgba(255,255,255,0.14)',
  text: '#F4F1EC',
  textSecondary: '#A8A29A',
  textMuted: '#7A756D',
  accent: '#C97B6E',
  accentSoft: 'rgba(201, 123, 110, 0.22)',
  pillBg: 'rgba(201, 123, 110, 0.2)',
  trackBg: '#3A3633',
  rowDivider: 'rgba(255,255,255,0.06)',
  errorBg: 'rgba(198, 40, 40, 0.18)',
  errorText: '#FFAB91',
  successMuted: 'rgba(129, 199, 132, 0.2)',
  successText: '#A5D6A7',
  warningBg: 'rgba(230, 81, 0, 0.2)',
  warningText: '#FFCC80',
  overlay: 'rgba(0,0,0,0.55)',
  inputBg: '#1E1C1A',
} as const;
