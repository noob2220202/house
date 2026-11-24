'use client';
import { SegmentedControl, Tabs } from '@house/ui';
import { useDevQuery } from '../api/dev';
import s from '../components/shared.module.css';
import { useUrlState } from '../lib/use-url-state';
import type { Days } from './parts';
import { AdsSection, DealRequestsSection, ListingsSection, TrafficSection } from './sections';

type Tab = 'traffic' | 'listings' | 'requests' | 'ads';
const TABS: { value: Tab; label: string }[] = [
  { value: 'traffic', label: '방문 · 가입' },
  { value: 'listings', label: '매물' },
  { value: 'requests', label: '내놓기 · 구하기' },
  { value: 'ads', label: '광고' },
];
const PERIODS = [
  { value: '7', label: '7일' },
  { value: '30', label: '30일' },
  { value: '90', label: '90일' },
] as const;
const BASE = 'stats';

/** 통계: traffic, listings, deal requests and ads over the last 7 / 30 / 90 days. */
export function StatsView() {
  const dev = useDevQuery();
  const [url, setUrl] = useUrlState({ tab: 'traffic', days: '30' });
  const tab = TABS.some((t) => t.value === url.tab) ? (url.tab as Tab) : 'traffic';
  const days: Days = url.days === '7' ? 7 : url.days === '90' ? 90 : 30;
  const props = { days, dev };
  return (
    <>
      <div className={s.bar}>
        <Tabs<Tab>
          className={s.barTabs}
          label="통계 종류"
          idBase={BASE}
          items={TABS}
          value={tab}
          onChange={(next) => setUrl({ tab: next })}
        />
        <div className={s.barEnd}>
          <SegmentedControl
            label="조회 기간"
            size="sm"
            value={String(days) as (typeof PERIODS)[number]['value']}
            onChange={(next) => setUrl({ days: next })}
            options={PERIODS}
          />
        </div>
      </div>
      <div
        role="tabpanel"
        id={`${BASE}-panel-${tab}`}
        aria-labelledby={`${BASE}-tab-${tab}`}
        style={{ display: 'contents' }}
      >
        {tab === 'traffic' && <TrafficSection {...props} />}
        {tab === 'listings' && <ListingsSection {...props} />}
        {tab === 'requests' && <DealRequestsSection {...props} />}
        {tab === 'ads' && <AdsSection {...props} />}
      </div>
    </>
  );
}
