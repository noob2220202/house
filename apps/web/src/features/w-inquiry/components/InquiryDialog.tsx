'use client';
import { InquirySource, type InquiryContactChannel, type InquiryCreated } from '@house/shared';
import { AgencyLogo, Button, Icon, Modal, Tabs } from '@house/ui';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useId, useRef, useState } from 'react';
import { ME_INQUIRY_ROUTES } from '../routes';
import { logContactEvent } from '../api';
import { ContactPanel, type InquiryDetailRow } from './ContactPanel';
import { InquiryForm } from './InquiryForm';
import styles from './inquiry.module.css';

export type InquiryTab = 'contact' | 'message';

export interface InquiryDialogAgency {
  id: string;
  name: string;
  /** Number the visitor calls (the listing's contact phone or the office phone); null = none. */
  phone: string | null;
  logoUrl?: string | null;
  representativeName?: string | null;
  /** Extra caption after the 대표 ("최초 등록 사무소"). */
  note?: string | null;
}

export interface InquiryDialogListing {
  id: string;
  /** 매물번호 as shown on the listing. */
  no: string;
  /** Short name of the listing for the SMS text and the form ("신대 레이크파크 103동 매매 4억 4,500"). */
  label: string;
}

export interface InquiryDialogProps {
  open: boolean;
  onClose: () => void;
  agency: InquiryDialogAgency;
  /** The listing asked about; omit for an inquiry to the office itself. */
  listing?: InquiryDialogListing | null;
  /** MAIN (this site) or SITE (the office's own 홈페이지). */
  source?: InquirySource;
  /** Tab shown first: 바로 연락 (전화 buttons) or 문의 남기기 (문의하기 buttons, the default). */
  initialTab?: InquiryTab;
  /** 표시·광고 명시사항 rows shown under 바로 연락. */
  details?: readonly InquiryDetailRow[];
  /** "사무소 정보와 다른 매물 보기" target (omit on the office's own page). */
  moreHref?: string | null;
}

/**
 * 중개사무소에 문의하기 — one dialog for the listing page, the complex panel and the office page.
 * Two parts: 바로 연락 (call / text / copy the number, each logged as a contact event) and
 * 문의 남기기 (a written inquiry the office answers in its 문의함; members read the answer under
 * MY > 문의 내역). Both panels stay mounted, so switching tabs keeps what was typed.
 */
export function InquiryDialog({
  open,
  onClose,
  agency,
  listing,
  source = InquirySource.MAIN,
  initialTab = 'message',
  details,
  moreHref,
}: InquiryDialogProps) {
  const idBase = `inq${useId().replace(/[^\w-]/g, '')}`;
  const hasPhone = !!agency.phone;
  const [tab, setTab] = useState<InquiryTab>(hasPhone ? initialTab : 'message');
  const [sent, setSent] = useState<InquiryCreated | null>(null);

  const onContact = (channel: InquiryContactChannel) =>
    logContactEvent({ agencyId: agency.id, listingId: listing?.id ?? null, channel, source });

  const caption = [
    agency.representativeName ? `대표 공인중개사 ${agency.representativeName}` : null,
    agency.note,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <Modal open={open} onClose={onClose} title="중개사무소에 문의하기" size="md">
      <div className={styles.dialog}>
        <div className={styles.head}>
          <AgencyLogo
            name={agency.name}
            seed={agency.id}
            size={52}
            image={
              agency.logoUrl ? (
                <Image
                  src={agency.logoUrl}
                  alt=""
                  fill
                  sizes="52px"
                  unoptimized={agency.logoUrl.startsWith('/mock-api/')}
                />
              ) : undefined
            }
          />
          <div className={styles.name}>
            <b>{agency.name}</b>
            {caption && <span>{caption}</span>}
          </div>
        </div>

        {sent ? (
          <SentState result={sent} agencyName={agency.name} onClose={onClose} />
        ) : (
          <>
            <Tabs<InquiryTab>
              className={styles.tabs}
              label="문의 방법"
              idBase={idBase}
              value={tab}
              onChange={setTab}
              items={[
                { value: 'contact', label: '바로 연락', disabled: !hasPhone },
                { value: 'message', label: '문의 남기기' },
              ]}
            />
            <div
              role="tabpanel"
              id={`${idBase}-panel-message`}
              aria-labelledby={`${idBase}-tab-message`}
              className={styles.panel}
              hidden={tab !== 'message'}
            >
              <InquiryForm
                agencyId={agency.id}
                agencyName={agency.name}
                listing={listing}
                source={source}
                onSent={setSent}
              />
            </div>
            <div
              role="tabpanel"
              id={`${idBase}-panel-contact`}
              aria-labelledby={`${idBase}-tab-contact`}
              className={styles.panel}
              hidden={tab !== 'contact'}
            >
              {agency.phone && (
                <ContactPanel
                  phone={agency.phone}
                  listing={listing}
                  details={details}
                  moreHref={moreHref}
                  onContact={onContact}
                />
              )}
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

function SentState({
  result,
  agencyName,
  onClose,
}: {
  result: InquiryCreated;
  agencyName: string;
  onClose: () => void;
}) {
  // The focused 문의 보내기 button unmounted with the form: keep focus (and the screen reader) in
  // the dialog on the result instead of dropping it to <body> behind the scrim.
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => headingRef.current?.focus({ preventScroll: true }), []);
  return (
    <div className={styles.done} role="status">
      <span className={styles.doneIcon} aria-hidden="true">
        <Icon name="check" size={28} />
      </span>
      <h3 ref={headingRef} tabIndex={-1}>
        문의를 보냈어요
      </h3>
      {result.member ? (
        <p>
          {agencyName}에서 답변하면 알림으로 알려 드려요.
          <br />
          MY &gt; 문의 내역에서 답변을 볼 수 있어요.
        </p>
      ) : (
        <p>중개사무소가 남겨 주신 번호로 연락드릴 거예요.</p>
      )}
      <div className={styles.doneActions}>
        <Button variant="secondary" onClick={onClose}>
          닫기
        </Button>
        {result.member && (
          <Button href={ME_INQUIRY_ROUTES.detail(result.id)} linkAs={Link}>
            문의 내역 보기
          </Button>
        )}
      </div>
    </div>
  );
}
