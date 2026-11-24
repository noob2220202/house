import type { ReactNode } from 'react';
import { SiteShell } from '@/components/layout';

/**
 * Chrome of the w-content pages (공지사항, FAQ, 동네TV, 약관, 계산기, 검색, 커뮤니티, 고객센터).
 *
 * Same default <SiteShell> as `(site)`, but deliberately WITHOUT a group-level `loading.tsx`: a
 * loading boundary above a page makes Next stream the shell before the page has resolved, so a
 * `notFound()` / `redirect()` thrown by the page (unknown notice id, unknown terms slug or version)
 * can no longer change the status code — it would answer 200 + client-side 404 / meta refresh.
 * List pages that want a skeleton add a `loading.tsx` in their own leaf segment
 * (`notices/(list)/loading.tsx` keeps `notices/[id]` outside the boundary).
 */
export default function ContentLayout({ children }: { children: ReactNode }) {
  return <SiteShell>{children}</SiteShell>;
}
