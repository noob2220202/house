'use client';
import {
  AgencyLogo,
  DealBadge,
  Icon,
  PhotoPlaceholder,
  PremiumBadge,
  VerifiedBadge,
  cx,
} from '@house/ui';
import { useQuery } from '@tanstack/react-query';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import Link from 'next/link';
import { useId, useRef, useState, type KeyboardEvent } from 'react';
import { ROUTES } from '@/config/nav';
import { formatPhone, type AreaUnit } from '@/lib/format';
import { logContactEvent } from '@/features/w-inquiry/api';
import { complexKeys, fetchListingAgencies } from '../api/queries';
import type { ComplexListingItem, ListingAgency } from '../api/schemas';
import {
  PRICE_RANGE_HINT,
  agencyMeta,
  askingSummary,
  listingHeadline,
  listingLabel,
  listingSpecs,
  placeholderKind,
  verifiedLabel,
} from '../lib/listing';
import styles from './panel.module.css';

// Interaction-only → its own chunk, loaded when a visitor opens 문의.
const InquiryDialog = dynamic(() => import('./InquiryDialog').then((m) => m.InquiryDialog), {
  ssr: false,
});

function BrokerLine({
  agency,
  listing,
  emphasised,
}: {
  agency: ListingAgency;
  listing: ComplexListingItem;
  emphasised: boolean;
}) {
  const [inquiry, setInquiry] = useState(false);
  const meta = agencyMeta(agency);
  const profile = ROUTES.agency(agency.agencyId);
  return (
    <li className={styles.bline}>
      <AgencyLogo
        name={agency.name}
        seed={agency.agencyId}
        size={40}
        image={agency.logoUrl ? <Image src={agency.logoUrl} alt="" fill sizes="40px" /> : undefined}
      />
      <span className={styles.blineT}>
        <b>
          <Link href={profile}>{agency.name}</Link>
          {agency.specialtyTag && <span className={styles.blineTag}>{agency.specialtyTag}</span>}
        </b>
        <span>
          {meta.ceo && (
            <span className={styles.ceo}>
              {meta.ceo}
              {meta.rest && ' · '}
            </span>
          )}
          {meta.rest}
        </span>
      </span>
      <span className={styles.blineAct}>
        {agency.phone && (
          <a
            className={cx(styles.ibtn, emphasised ? styles.ibtnCall : styles.ibtnCallO)}
            href={`tel:${agency.phone}`}
            title={formatPhone(agency.phone)}
            aria-label={`${agency.name}에 전화 문의 (${formatPhone(agency.phone)})`}
            onClick={() =>
              logContactEvent({
                agencyId: agency.agencyId,
                listingId: listing.id,
                channel: 'CALL',
                source: 'MAIN',
              })
            }
          >
            <Icon name="phone" size={20} />
          </a>
        )}
        <button
          type="button"
          className={styles.ibtn}
          aria-haspopup="dialog"
          aria-label={`${agency.name}에 문의하기`}
          onClick={() => setInquiry(true)}
        >
          <Icon name="chat" size={20} />
        </button>
      </span>
      {inquiry && (
        <InquiryDialog listing={listing} agency={agency} open onClose={() => setInquiry(false)} />
      )}
    </li>
  );
}

export interface ListingRowProps {
  listing: ComplexListingItem;
  unit: AreaUnit;
  /** Whether the co-broker list of this row is expanded. */
  open: boolean;
  onToggle: () => void;
}

/**
 * One listing of the complex: price, 동·층·면적·향, 실매물 확인 date and the "중개사무소 N곳" disclosure.
 * Esc inside the row closes an open disclosure and returns focus to its button (same in every host).
 */
export function ListingRow({ listing, unit, open, onToggle }: ListingRowProps) {
  const dropId = useId();
  const toggleRef = useRef<HTMLButtonElement>(null);
  const onKeyDown = (e: KeyboardEvent<HTMLLIElement>) => {
    if (e.key !== 'Escape' || !open || e.defaultPrevented) return;
    // The 문의 dialog is portalled: React bubbles its Esc here, but it is not inside the row's DOM.
    if (!e.currentTarget.contains(e.target as Node)) return;
    e.stopPropagation();
    onToggle();
    toggleRef.current?.focus();
  };
  const h = listingHeadline(listing);
  const s = listingSpecs(listing, unit);
  const verified = verifiedLabel(listing.verifiedAt ?? null);
  // List rows name the primary office only; the full disclosure loads when the row opens.
  const loadAgencies = open && listing.agencies.length === 0;
  const disclosed = useQuery({
    queryKey: complexKeys.listingAgencies(listing.id),
    queryFn: ({ signal }) => fetchListingAgencies(listing.id, signal),
    enabled: loadAgencies,
    staleTime: 5 * 60_000,
  });
  const agencies = listing.agencies.length > 0 ? listing.agencies : (disclosed.data ?? []);
  const count = Math.max(listing.agencyCount, agencies.length);
  // A price range is explained in code (design: "… · 중개사무소마다 호가가 달라요"), never by the title.
  const note = h.priceTo ? PRICE_RANGE_HINT : listing.title;
  const specs: React.ReactNode[] = [];
  if (s.dong) specs.push(<b key="dong">{s.dong}</b>);
  if (s.floor) specs.push(<span key="floor">{s.floor}</span>);
  if (s.area || s.exclusive)
    specs.push(
      <span key="area">
        {s.area} {s.exclusive && <span className={styles.m2}>{s.exclusive}</span>}
      </span>,
    );
  if (s.direction) specs.push(<span key="dir">{s.direction}</span>);

  return (
    <li className={cx(styles.row, open && styles.open)} onKeyDown={onKeyDown}>
      <Link className={styles.rowA} href={ROUTES.listing(listing.id)}>
        <span className={styles.rowPh}>
          {listing.coverPhotoUrl ? (
            <Image src={listing.coverPhotoUrl} alt="" fill sizes="92px" loading="lazy" />
          ) : (
            <PhotoPlaceholder kind={placeholderKind(listing.id)} />
          )}
          {listing.photoCount > 0 && (
            <span className={styles.rowPc}>
              <Icon name="image" size={12} />
              <span className="sr-only">사진 </span>
              {listing.photoCount}
              <span className="sr-only">장</span>
            </span>
          )}
        </span>
        <span className={styles.rowB}>
          <span className={styles.rowP}>
            <DealBadge deal={h.deal} />
            <b className={cx('price', 'price-sm', styles.rowPrice)}>
              {h.price}
              {h.priceTo && (
                <>
                  <span className={styles.rng}> ~ </span>
                  {h.priceTo}
                </>
              )}
            </b>
            {listing.premium != null && <PremiumBadge amount={listing.premium} />}
          </span>
          <span className={styles.rowS}>
            {specs.map((node, i) => (
              <span key={i} style={{ display: 'contents' }}>
                {i > 0 && <i aria-hidden="true" />}
                {node}
              </span>
            ))}
            {s.rooms && (
              <span className={styles.rmS}>
                <i aria-hidden="true" />
                {s.rooms}
              </span>
            )}
          </span>
          {(s.rooms || note) && (
            <span className={styles.rowN}>
              {s.rooms && (
                <span className={styles.rmN}>
                  {s.rooms}
                  {note && ' · '}
                </span>
              )}
              {note}
            </span>
          )}
        </span>
      </Link>
      <div className={styles.rowF}>
        {verified ? (
          <VerifiedBadge date={verified} className={styles.verified} />
        ) : (
          <span className={styles.unverified}>실매물 확인 전</span>
        )}
        <button
          ref={toggleRef}
          type="button"
          className={styles.brkBtn}
          aria-expanded={open}
          aria-controls={open ? dropId : undefined}
          onClick={onToggle}
        >
          <Icon name="users" size={16} />
          중개사무소 {count}곳
          <Icon name={open ? 'chevron-up' : 'chevron-down'} size={16} />
        </button>
      </div>
      {open && (
        <div
          className={styles.brkDrop}
          id={dropId}
          role="region"
          aria-label={`${listingLabel(listing)} 매물을 중개하는 사무소`}
        >
          <p className={styles.brkDropH}>
            <span>
              {count > 1 ? (
                <>
                  같은 매물을 <b>{count}곳</b>이 함께 중개해요
                </>
              ) : (
                <>
                  <b>1곳</b>이 중개하는 매물이에요
                </>
              )}
            </span>
            <span>{askingSummary(listing)}</span>
          </p>
          {agencies.length > 0 ? (
            <ul>
              {agencies.map((a, i) => (
                <BrokerLine key={a.agencyId} agency={a} listing={listing} emphasised={i === 0} />
              ))}
            </ul>
          ) : loadAgencies && disclosed.isPending ? (
            <p className={styles.brkDropH} aria-live="polite">
              <span>중개사무소 정보를 불러오고 있어요…</span>
            </p>
          ) : (
            <p className={styles.brkDropH}>
              <span>중개사무소 정보는 매물 상세에서 확인할 수 있어요.</span>
              <Link className="link" href={ROUTES.listing(listing.id)}>
                매물 상세
              </Link>
            </p>
          )}
        </div>
      )}
    </li>
  );
}
