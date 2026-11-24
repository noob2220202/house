'use client';
import { Tabs } from '@house/ui';
import { useState, type ReactNode } from 'react';
import { useUrlState } from '../lib/use-url-state';
import { AppLinksForm } from './AppLinksForm';
import { BusinessInfoForm } from './BusinessInfoForm';
import { ContactForm } from './ContactForm';
import { FeaturesForm } from './FeaturesForm';
import { SeoForm } from './SeoForm';
import styles from './settings.module.css';

type Tab = 'business' | 'contact' | 'seo' | 'apps' | 'features';
const TABS: { value: Tab; label: string }[] = [
  { value: 'business', label: '사업자 정보' },
  { value: 'contact', label: '고객센터' },
  { value: 'seo', label: '검색 노출' },
  { value: 'apps', label: '앱 링크' },
  { value: 'features', label: '기능 설정' },
];
const FORMS: Record<Tab, () => ReactNode> = {
  business: () => <BusinessInfoForm />,
  contact: () => <ContactForm />,
  seo: () => <SeoForm />,
  apps: () => <AppLinksForm />,
  features: () => <FeaturesForm />,
};
const BASE = 'site-settings';

/**
 * 사이트 정보: one tab per site-setting key (BUSINESS_INFO · CONTACT · SEO · APP_LINKS · FEATURES). A tab's form
 * stays mounted (hidden) once opened, so unsaved edits survive a look at another tab.
 */
export function SiteSettingsView() {
  const [url, setUrl] = useUrlState({ tab: 'business' });
  const tab = TABS.some((t) => t.value === url.tab) ? (url.tab as Tab) : 'business';
  const [opened, setOpened] = useState<readonly Tab[]>([tab]);
  const visible = opened.includes(tab) ? opened : [...opened, tab];
  return (
    <>
      <Tabs<Tab>
        label="사이트 설정 종류"
        idBase={BASE}
        items={TABS}
        value={tab}
        onChange={(next) => {
          if (!opened.includes(next)) setOpened([...visible, next]);
          setUrl({ tab: next });
        }}
      />
      {TABS.filter((t) => visible.includes(t.value)).map((t) => (
        <div
          key={t.value}
          role="tabpanel"
          id={`${BASE}-panel-${t.value}`}
          aria-labelledby={`${BASE}-tab-${t.value}`}
          className={styles.tabPanel}
          hidden={t.value !== tab}
        >
          {FORMS[t.value]()}
        </div>
      ))}
    </>
  );
}
