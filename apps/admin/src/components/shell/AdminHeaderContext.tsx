'use client';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export interface AdminPageHeader {
  /** Topbar title (defaults to the sidebar label of the current route). */
  title?: string;
  /** Crumb parts shown above the title, e.g. ['콘텐츠', '배너·팝업 관리'] (defaults to the nav group). */
  crumb?: readonly (string | { label: string; href: string })[];
}

interface Ctx {
  header: AdminPageHeader | null;
  setHeader: (h: AdminPageHeader | null) => void;
}
const AdminHeaderContext = createContext<Ctx | null>(null);

export function AdminHeaderProvider({ children }: { children: ReactNode }) {
  const [header, setHeader] = useState<AdminPageHeader | null>(null);
  const value = useMemo(() => ({ header, setHeader }), [header]);
  return <AdminHeaderContext.Provider value={value}>{children}</AdminHeaderContext.Provider>;
}

export function useAdminHeaderValue(): AdminPageHeader | null {
  return useContext(AdminHeaderContext)?.header ?? null;
}

/**
 * Override the topbar title / crumb from a page (detail pages, edit screens):
 *   useAdminPageHeader({ title: '배너 수정', crumb: ['운영', { label: '배너·팝업 관리', href: '/banners' }] });
 */
export function useAdminPageHeader(header: AdminPageHeader): void {
  const ctx = useContext(AdminHeaderContext);
  const setHeader = ctx?.setHeader;
  const key = JSON.stringify(header);
  useEffect(() => {
    if (!setHeader) return;
    setHeader(JSON.parse(key) as AdminPageHeader);
    return () => setHeader(null);
  }, [key, setHeader]);
}

/** Server-component friendly variant: render `<AdminPageHeader title="…" />` anywhere in the page. */
export function AdminPageHeader(props: AdminPageHeader): null {
  useAdminPageHeader(props);
  return null;
}
