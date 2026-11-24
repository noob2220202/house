import type { LatLng } from '@/lib/map';

/**
 * Service area of the platform (순천시 행정구역, rounded outwards: 송광면 in the west, 별량면 ·
 * 해룡면 in the south, 주암면 · 승주읍 in the north). An office pin outside it is a mistake.
 */
export const SERVICE_AREA = {
  swLat: 34.8,
  swLng: 127.18,
  neLat: 35.15,
  neLng: 127.65,
} as const;

export const SERVICE_AREA_MESSAGE = '순천시 안에 있는 사무소 위치만 등록할 수 있어요.';

export function isInServiceArea(p: LatLng): boolean {
  return (
    p.lat >= SERVICE_AREA.swLat &&
    p.lat <= SERVICE_AREA.neLat &&
    p.lng >= SERVICE_AREA.swLng &&
    p.lng <= SERVICE_AREA.neLng
  );
}

/**
 * Smallest map zoom at which a moved map counts as a position pick (street level — at overview
 * zooms one arrow key moves the centre by hundreds of metres).
 */
export const MIN_PICK_ZOOM = 15;
