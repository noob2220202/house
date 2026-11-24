'use client';
import { AgencyLogo, Button, Icon, Modal, useToast } from '@house/ui';
import Image from 'next/image';
import Link from 'next/link';
import { BRAND } from '@/config/brand';
import { ROUTES } from '@/config/nav';
import { formatPhone } from '@/lib/format';
import type { ComplexListingItem, ListingAgency } from '../api/schemas';
import { listingLabel, listingNo } from '../lib/listing';
import styles from './inquiry.module.css';

const telHref = (phone: string) => `tel:${phone.replace(/[^\d+]/g, '')}`;

/**
 * 문의하기 of one co-brokering office — same flow as the listing page's contact dialog: the office's
 * 표시·광고 명시사항 (명칭, 소재지, 연락처, 등록번호, 대표) with call / text actions and the listing number.
 * There is no in-app chat backend; an inquiry is a phone call or a pre-filled text message.
 */
export function InquiryDialog({
  listing,
  agency,
  open,
  onClose,
}: {
  listing: ComplexListingItem;
  agency: ListingAgency;
  open: boolean;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const phone = agency.phone;
  const pretty = phone ? formatPhone(phone) : null;
  const no = listingNo(listing);
  const subject = [listing.complexName, listingLabel(listing)].filter(Boolean).join(' ');
  const message = `[${BRAND.name}] 매물번호 ${no} (${subject}) 보고 문의드립니다.`;

  const copy = async () => {
    if (!pretty) return;
    try {
      await navigator.clipboard.writeText(pretty);
      toast({ message: '전화번호를 복사했어요.' });
    } catch {
      toast({ message: '복사하지 못했어요. 번호를 직접 눌러 주세요.', tone: 'error' });
    }
  };

  const info: { label: string; value: string | null; num?: boolean }[] = [
    { label: '명칭', value: agency.name },
    { label: '소재지', value: agency.roadAddress },
    { label: '연락처', value: pretty, num: true },
    { label: '등록번호', value: agency.registrationNumber, num: true },
    { label: '대표', value: agency.representativeName },
    { label: '매물번호', value: no, num: true },
  ];

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="중개사무소에 문의하기"
      description="전화나 문자로 바로 문의할 수 있어요. 매물번호를 말씀하시면 안내가 빨라요."
      footer={
        phone ? (
          <>
            <Button
              variant="secondary"
              href={`sms:${phone.replace(/[^\d+]/g, '')}?&body=${encodeURIComponent(message)}`}
              iconLeft={<Icon name="chat" size={18} />}
            >
              문자 보내기
            </Button>
            <Button href={telHref(phone)} iconLeft={<Icon name="phone" size={18} />}>
              전화 걸기
            </Button>
          </>
        ) : (
          <Button href={ROUTES.agency(agency.agencyId)} linkAs={Link}>
            사무소 정보 보기
          </Button>
        )
      }
    >
      <div className={styles.contact}>
        <div className={styles.head}>
          <AgencyLogo
            name={agency.name}
            seed={agency.agencyId}
            size={56}
            image={
              agency.logoUrl ? <Image src={agency.logoUrl} alt="" fill sizes="56px" /> : undefined
            }
          />
          <div className={styles.name}>
            <b>{agency.name}</b>
            <span>
              {agency.representativeName && `대표 공인중개사 ${agency.representativeName}`}
              {agency.representativeName && agency.isPrimary && ' · '}
              {agency.isPrimary && '최초 등록 사무소'}
            </span>
          </div>
        </div>
        {pretty && (
          <button type="button" className={styles.phone} onClick={() => void copy()}>
            <span className="num">{pretty}</span>
            <span className={styles.copy}>
              <Icon name="copy" size={14} />
              번호 복사
            </span>
          </button>
        )}
        <dl className={styles.info}>
          {info
            .filter((row): row is { label: string; value: string; num?: boolean } => !!row.value)
            .map((row) => (
              <div key={row.label}>
                <dt>{row.label}</dt>
                <dd className={row.num ? 'num' : undefined}>{row.value}</dd>
              </div>
            ))}
        </dl>
        <Link className={styles.more} href={ROUTES.agency(agency.agencyId)}>
          사무소 정보와 다른 매물 보기
          <Icon name="chevron-right" size={16} />
        </Link>
      </div>
    </Modal>
  );
}
