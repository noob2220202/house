'use client';
import { InquirySource, type InquiryContactChannel } from '@house/shared';
import dynamic from 'next/dynamic';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { logContactEvent } from '@/features/w-inquiry/api';
import type { InquiryTab } from '@/features/w-inquiry/components/InquiryDialog';
import { clearIntent, readIntent, useAuthGate } from '@/lib/auth/gate';
import { useFavoriteActions } from '@/lib/favorites/useFavorite';
import type { ListingDetail } from '../api/schemas';
import type { CalcTab } from '../lib/calcPreview';
import type { ListingOfficeVariant } from '../lib/office';

const ShareDialog = dynamic(() => import('./ShareDialog').then((m) => m.ShareDialog), {
  ssr: false,
});
const ReportDialog = dynamic(() => import('./ReportDialog').then((m) => m.ReportDialog), {
  ssr: false,
});
const ContactDialog = dynamic(() => import('./ContactDialog').then((m) => m.ContactDialog), {
  ssr: false,
});
const CalcSheet = dynamic(() => import('./CalcSheet').then((m) => m.CalcSheet), { ssr: false });

export interface ListingInteractionsValue {
  listing: ListingDetail;
  /** Set on an office's own 홈페이지 (no 관심 / 신고 here: they link to the main site). */
  office: ListingOfficeVariant | null;
  /** 관심 state of THIS listing. `count` already includes the viewer's own toggle. */
  favorite: { on: boolean; count: number; pending: boolean; toggle: () => void };
  /** 관심 state of any listing (similar cards). */
  isFavorite: (id: string) => boolean;
  toggleFavorite: (id: string) => void;
  openShare: () => void;
  /** Auth-gated: signed-out visitors are sent to /login and come back to the open form. */
  openReport: () => void;
  /**
   * 문의 dialog of one office (default: the first). `tab`: 바로 연락 for the 전화 buttons, 문의 남기기
   * (default) for the 문의하기 buttons.
   */
  openContact: (agencyId?: string, tab?: InquiryTab) => void;
  /** Logs a 전화 / 문자 / 번호 복사 press made outside the dialog (a plain `tel:` link). */
  logContact: (channel: InquiryContactChannel, agencyId: string) => void;
  openCalc: (tab: CalcTab) => void;
}

const Ctx = createContext<ListingInteractionsValue | null>(null);

export function useListingInteractions(): ListingInteractionsValue {
  const value = useContext(Ctx);
  if (!value) throw new Error('useListingInteractions must be used inside <ListingInteractions>');
  return value;
}

/**
 * Client state shared by every interactive piece of the listing page: 관심 toggle (auth-gated,
 * optimistic), share / report / contact dialogs and the calculator sheet. Dialog code is split out
 * and only loaded when first opened.
 */
export function ListingInteractions({
  listing,
  inquirySource = InquirySource.MAIN,
  office = null,
  children,
}: {
  listing: ListingDetail;
  /** Where inquiries and contact events come from: this site (MAIN) or the office's 홈페이지 (SITE). */
  inquirySource?: InquirySource;
  /** The office variant of the page (`ListingPage` `office`). */
  office?: ListingOfficeVariant | null;
  children: ReactNode;
}) {
  const [share, setShare] = useState(false);
  const [report, setReport] = useState(false);
  const [contact, setContact] = useState<{ agencyId: string; tab: InquiryTab } | null>(null);
  const [calc, setCalc] = useState<CalcTab | null>(null);

  // 관심: the shared favourites module (one id cache, gate, resume-after-login and toasts site-wide).
  // A heart clicked before login comes back as `?intent=favorite&target=listings:<id>`; a bare
  // `?intent=favorite` resumes this page's listing.
  const favorites = useFavoriteActions('listings', { primaryId: listing.id });
  const { gate, status } = useAuthGate();
  const toggleFavorite = favorites.toggle;

  const openReport = useCallback(() => gate(() => setReport(true), 'report'), [gate]);

  // Resume the report form the visitor opened before being sent to /login (?intent=report).
  useEffect(() => {
    if (status === 'loading') return;
    if (readIntent()?.intent !== 'report') return;
    clearIntent();
    if (status === 'authenticated') setReport(true);
  }, [status]);

  // The server count already includes the viewer's own heart; only a change since load moves it.
  const on = favorites.has(listing.id);
  const [initiallyOn, setInitiallyOn] = useState<boolean | null>(null);
  if (initiallyOn === null && status !== 'loading' && !favorites.isPending) setInitiallyOn(on);
  const countDelta = initiallyOn === null ? 0 : Number(on) - Number(initiallyOn);
  const isPending = favorites.pending;
  const isFavorite = favorites.has;

  const value = useMemo<ListingInteractionsValue>(
    () => ({
      listing,
      office,
      favorite: {
        on,
        count: Math.max(0, listing.favoriteCount + countDelta),
        pending: isPending,
        toggle: () => toggleFavorite(listing.id),
      },
      isFavorite,
      toggleFavorite,
      openShare: () => setShare(true),
      openReport,
      openContact: (agencyId, tab = 'message') => {
        const id = agencyId ?? listing.agencies[0]?.agencyId;
        setContact(id ? { agencyId: id, tab } : null);
      },
      logContact: (channel, agencyId) =>
        logContactEvent({ agencyId, listingId: listing.id, channel, source: inquirySource }),
      openCalc: setCalc,
    }),
    [
      listing,
      office,
      on,
      countDelta,
      isPending,
      isFavorite,
      toggleFavorite,
      openReport,
      inquirySource,
    ],
  );

  const contactAgency = listing.agencies.find((a) => a.agencyId === contact?.agencyId) ?? null;

  return (
    <Ctx.Provider value={value}>
      {children}
      {share && <ShareDialog listing={listing} open onClose={() => setShare(false)} />}
      {report && <ReportDialog listing={listing} open onClose={() => setReport(false)} />}
      {contactAgency && (
        <ContactDialog
          listing={listing}
          agency={contactAgency}
          initialTab={contact?.tab}
          source={inquirySource}
          hideAgencyLink={inquirySource === InquirySource.SITE}
          open
          onClose={() => setContact(null)}
        />
      )}
      {calc && (
        <CalcSheet
          listing={listing}
          tab={calc}
          onTabChange={setCalc}
          onClose={() => setCalc(null)}
        />
      )}
    </Ctx.Provider>
  );
}
