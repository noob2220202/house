'use client';
import { Button, Icon, Modal, PhotoPlaceholder, useToast } from '@house/ui';
import Image from 'next/image';
import Link from 'next/link';
import { BRAND } from '@/config/brand';
import { ROUTES } from '@/config/nav';
import type { ListingAgency, ListingDetail } from '../api/schemas';
import { mediaImage } from '../lib/media';
import { displayPhone, listingFullTitle, listingNo, telHref } from '../lib/view';
import { Glyph } from './icons';
import styles from './dialogs.module.css';

/**
 * 문의하기: the office's full 표시·광고 명시사항 (명칭, 소재지, 연락처, 등록번호, 대표) with call / text
 * actions. There is no in-app chat backend — an inquiry is a phone call or a pre-filled text message.
 */
export function ContactDialog({
  listing,
  agency,
  open,
  onClose,
}: {
  listing: ListingDetail;
  agency: ListingAgency;
  open: boolean;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const phone = agency.contactPhone ?? agency.phone;
  const pretty = displayPhone(phone);
  const message = `[${BRAND.name}] 매물번호 ${listingNo(listing)} (${listingFullTitle(listing)}) 보고 문의드립니다.`;
  const smsHref = `sms:${phone.replace(/[^\d+]/g, '')}?&body=${encodeURIComponent(message)}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(pretty);
      toast({ message: '전화번호를 복사했어요.' });
    } catch {
      toast({ message: '복사하지 못했어요. 번호를 직접 눌러 주세요.', tone: 'error' });
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="중개사무소에 문의하기"
      description="전화나 문자로 바로 문의할 수 있어요. 매물번호를 말씀하시면 안내가 빨라요."
      footer={
        <>
          <Button variant="secondary" href={smsHref} iconLeft={<Glyph name="message" size={18} />}>
            문자 보내기
          </Button>
          <Button href={telHref(phone)} iconLeft={<Icon name="phone" size={18} />}>
            전화 걸기
          </Button>
        </>
      }
    >
      <div className={styles.contact}>
        <div className={styles.contactHead}>
          <span className={styles.contactLogo}>
            {agency.logoUrl ? (
              <Image {...mediaImage(agency.logoUrl)} alt="" fill sizes="56px" />
            ) : (
              <PhotoPlaceholder kind="office" />
            )}
          </span>
          <div className={styles.contactName}>
            <b>{agency.name}</b>
            <span>
              대표 공인중개사 {agency.representativeName}
              {agency.isPrimary ? ' · 최초 등록 사무소' : ''}
            </span>
          </div>
        </div>
        <button type="button" className={styles.contactPhone} onClick={() => void copy()}>
          <span className="num">{pretty}</span>
          <span className={styles.contactCopy}>
            <Icon name="copy" size={14} />
            번호 복사
          </span>
        </button>
        <dl className={styles.contactInfo}>
          <div>
            <dt>명칭</dt>
            <dd>{agency.name}</dd>
          </div>
          <div>
            <dt>소재지</dt>
            <dd>{[agency.roadAddress, agency.addressDetail].filter(Boolean).join(', ')}</dd>
          </div>
          <div>
            <dt>연락처</dt>
            <dd className="num">{displayPhone(agency.phone)}</dd>
          </div>
          <div>
            <dt>등록번호</dt>
            <dd className="num">{agency.registrationNumber}</dd>
          </div>
          <div>
            <dt>대표</dt>
            <dd>{agency.representativeName}</dd>
          </div>
          <div>
            <dt>매물번호</dt>
            <dd className="num">{listingNo(listing)}</dd>
          </div>
        </dl>
        <Link className={styles.contactMore} href={ROUTES.agency(agency.agencyId)}>
          사무소 정보와 다른 매물 보기
          <Icon name="chevron-right" size={16} />
        </Link>
      </div>
    </Modal>
  );
}
