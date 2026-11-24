'use client';
import { Tabs } from '@house/ui';
import Link from 'next/link';
import { ADMIN_ROUTES } from '@/config/nav';

export const TRADE_SYNC_ROUTE = `${ADMIN_ROUTES.complexes}/trade-sync`;

export function ComplexesTabs({ current }: { current: 'list' | 'sync' }) {
  return (
    <Tabs
      label="단지 관리 메뉴"
      value={current}
      linkAs={Link}
      items={[
        { value: 'list', label: '단지 목록', href: ADMIN_ROUTES.complexes },
        { value: 'sync', label: '실거래가 동기화', href: TRADE_SYNC_ROUTE },
      ]}
    />
  );
}
