import type { EnumValue } from './define';

export const RegionLevel = {
  SIDO: 'SIDO',
  SGG: 'SGG',
  EMD: 'EMD',
  RI: 'RI',
} as const;
export type RegionLevel = EnumValue<typeof RegionLevel>;
