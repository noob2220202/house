import { FLOOR_CLASS_LABEL, FloorClass } from '@house/shared';

/** Splits a building into thirds: 저 / 중 / 고. Basement and 1F are always 저. */
export function floorClassOf(floor: number, totalFloors: number): FloorClass {
  if (floor <= 1 || totalFloors <= 0) return FloorClass.LOW;
  const ratio = floor / totalFloors;
  if (ratio <= 1 / 3) return FloorClass.LOW;
  if (ratio <= 2 / 3) return FloorClass.MID;
  return FloorClass.HIGH;
}

/** "저" | "중" | "고" */
export function floorClassShort(cls: FloorClass): string {
  return FLOOR_CLASS_LABEL[cls].charAt(0);
}

export interface FloorInfo {
  /** Exact floor (may be hidden by the broker → null). */
  floor?: number | null;
  totalFloors?: number | null;
  floorClass?: FloorClass | null;
  /** When false the public page shows only 저/중/고 (공동주택 관행). Default true if `floor` is present. */
  showExact?: boolean;
}

/**
 * Floor text for lists: "고/25층" (class), "3/4층" (exact, e.g. 원룸), "지하 1/5층", "고층".
 * One rule for every card: a known floor is shown exactly (the API sends `floor` only when the
 * broker publishes it), even when the 저/중/고 class comes along; `showExact: false` forces the
 * class. Returns "" when nothing is known.
 */
export function formatFloor({ floor, totalFloors, floorClass, showExact }: FloorInfo): string {
  const total = totalFloors && totalFloors > 0 ? `${totalFloors}층` : '';
  const exact = floor !== null && floor !== undefined && showExact !== false;
  if (exact) {
    const f = floor < 0 ? `지하 ${Math.abs(floor)}` : String(floor);
    return total ? `${f}/${total}` : `${f}층`;
  }
  const cls =
    floorClass ??
    (floor !== null && floor !== undefined && totalFloors
      ? floorClassOf(floor, totalFloors)
      : null);
  if (!cls) return total ? `총 ${total}` : '';
  return total ? `${floorClassShort(cls)}/${total}` : FLOOR_CLASS_LABEL[cls];
}
