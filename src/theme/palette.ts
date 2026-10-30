/**
 * The Sendero palette (research-visuals D6). Marigold values are design choices across the
 * yellow-to-deep-orange range of Tagetes erecta ligules; rosa mexicano is sRGB (228, 0, 124) and is
 * used for decoration and large display type only (3:1 floor). Warm white text on night indigo
 * measures 16.9:1 (WCAG relative luminance).
 */
export const palette = {
  night: '#14102B',
  deepViolet: '#2B1B4E',
  softViolet: '#5B3A8C',
  marigoldLight: '#FFC20E',
  marigold: '#F58A07',
  marigoldDeep: '#E8650A',
  marigoldCore: '#B84A00',
  rosaMexicano: '#E4007C',
  candle: '#FFD58A',
  warmWhite: '#FFF4E0',
} as const;

export type PaletteColor = keyof typeof palette;
