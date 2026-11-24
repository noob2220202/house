import type { ElementType, ReactNode } from 'react';

/**
 * Link element used by components that render anchors. Pass `next/link` from apps:
 * `<Button href="/map/apt" linkAs={Link}>`. Defaults to a plain `<a>`.
 */
export type LinkAs = ElementType<{ href: string; className?: string; children?: ReactNode }>;

export type DealKind = 'sale' | 'jeonse' | 'monthly' | 'presale';

export const DEAL_KIND_LABEL: Record<DealKind, string> = {
  sale: '매매',
  jeonse: '전세',
  monthly: '월세',
  presale: '분양권',
};

/** Maps the backend DealType enum (SALE/JEONSE/MONTHLY/PRESALE) to the UI deal kind. */
export function dealKindOf(dealType: string): DealKind {
  switch (dealType.toUpperCase()) {
    case 'JEONSE':
      return 'jeonse';
    case 'MONTHLY':
      return 'monthly';
    case 'PRESALE':
      return 'presale';
    default:
      return 'sale';
  }
}
