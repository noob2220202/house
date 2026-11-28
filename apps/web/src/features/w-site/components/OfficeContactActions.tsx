'use client';
import { InquirySource } from '@house/shared';
import { Button, Icon, cx, type ButtonSize } from '@house/ui';
import dynamic from 'next/dynamic';
import { useState, type MouseEvent } from 'react';
import { displayPhone, fullAddress, telHref } from '@/features/w-agencies/lib/agency';
import { logContactEvent } from '@/features/w-inquiry/api';
import type { InquiryTab } from '@/features/w-inquiry/components/InquiryDialog';
import styles from './OfficeSite.module.css';

// Interaction-only → its own chunk, loaded when a visitor opens 문의.
const InquiryDialog = dynamic(() => import('@/features/w-inquiry').then((m) => m.InquiryDialog), {
  ssr: false,
});

/** What the 문의 dialog of the office needs (the 공인중개사법 표시 items included). */
export interface OfficeContactAgency {
  id: string;
  name: string;
  phone: string;
  logoUrl?: string | null;
  representativeName: string;
  registrationNumber: string;
  roadAddress: string;
  addressDetail?: string | null;
}

export interface OfficeContactActionsProps {
  agency: OfficeContactAgency;
  /**
   * `header`: number + 문의하기 (desktop header), `icon`: a round call button (mobile header),
   * `hero` / `bar`: two equal buttons (hero, mobile sticky bar).
   */
  variant: 'header' | 'icon' | 'hero' | 'bar';
  className?: string;
}

/** Desktop has no dialer: the 전화 button then opens 바로 연락 (number to copy) instead. */
const hasFinePointer = () =>
  typeof window !== 'undefined' && window.matchMedia('(hover: hover) and (pointer: fine)').matches;

/**
 * 전화 + 문의하기 of the office's own site. 문의하기 opens the inquiry dialog on 문의 남기기 (guests:
 * name + phone + consent); 전화 dials on phones (logged as a CALL contact event, `source: SITE`)
 * and opens 바로 연락 on desktops.
 */
export function OfficeContactActions({ agency, variant, className }: OfficeContactActionsProps) {
  const [tab, setTab] = useState<InquiryTab | null>(null);
  const tel = telHref(agency.phone);
  const phone = displayPhone(agency.phone);

  const onCall = (e: MouseEvent<HTMLAnchorElement>) => {
    if (hasFinePointer()) {
      e.preventDefault();
      setTab('contact');
      return;
    }
    logContactEvent({
      agencyId: agency.id,
      listingId: null,
      channel: 'CALL',
      source: InquirySource.SITE,
    });
  };

  const size: ButtonSize = variant === 'bar' ? 'lg' : 'md';
  // A real `tel:` link (long-press, copy, assistive tech), styled like a secondary button:
  // `Button` with `href` takes no click handler.
  const call = tel && (
    <a
      className={variant === 'icon' ? styles.callIcon : cx(styles.callLink, styles[`call_${size}`])}
      href={tel}
      onClick={onCall}
      aria-label={`${agency.name}에 전화하기, ${phone}`}
    >
      <Icon name="phone" size={variant === 'icon' ? 20 : 18} />
      {variant === 'icon' ? null : variant === 'header' ? (
        <span className="num">{phone}</span>
      ) : (
        '전화하기'
      )}
    </a>
  );

  return (
    <div className={cx(styles.contactActs, styles[`contactActs_${variant}`], className)}>
      {call}
      {variant !== 'icon' && (
        <Button
          size={size}
          className={styles.askBtn}
          aria-haspopup="dialog"
          iconLeft={<Icon name="chat" size={18} />}
          onClick={() => setTab('message')}
        >
          문의하기
        </Button>
      )}
      {tab && (
        <InquiryDialog
          open
          onClose={() => setTab(null)}
          initialTab={tab}
          source={InquirySource.SITE}
          agency={{
            id: agency.id,
            name: agency.name,
            phone: agency.phone || null,
            logoUrl: agency.logoUrl,
            representativeName: agency.representativeName,
          }}
          details={[
            { label: '명칭', value: agency.name },
            { label: '소재지', value: fullAddress(agency) },
            { label: '연락처', value: agency.phone ? phone : null, num: true },
            { label: '등록번호', value: agency.registrationNumber, num: true },
            { label: '대표', value: agency.representativeName },
          ]}
          moreHref={null}
        />
      )}
    </div>
  );
}
