import type { ReactNode } from 'react';
import { ContentTabs } from '@/features/m-content/components/ContentTabs';

/** 콘텐츠: 공지사항 · FAQ · 동네TV · 메인 화면 편집 share one tab row under the topbar. */
export default function ContentLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <ContentTabs />
      {children}
    </>
  );
}
