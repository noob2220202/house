'use client';
import type { InquiryContactChannel } from '@house/shared';
import { Icon, useToast } from '@house/ui';
import Link from 'next/link';
import { formatPhone } from '@/lib/format';
import { smsHref, smsMessage, telHref } from '../lib';
import styles from './inquiry.module.css';

export interface InquiryDetailRow {
  label: string;
  value: string | null | undefined;
  /** Tabular figures (phone, 등록번호, 매물번호). */
  num?: boolean;
}

export interface ContactPanelProps {
  phone: string;
  listing?: { no: string; label: string } | null;
  /** 표시·광고 명시사항 of the office (명칭 · 소재지 · 연락처 · 등록번호 · 대표 …); empty rows are skipped. */
  details?: readonly InquiryDetailRow[];
  /** "사무소 정보와 다른 매물 보기" target. */
  moreHref?: string | null;
  /** Called for every 전화 / 문자 / 번호 복사 press (contact event). */
  onContact: (channel: InquiryContactChannel) => void;
}

/**
 * 바로 연락: the office number (tap to copy), 문자 보내기 with the listing number pre-filled and
 * 전화 걸기. Each press is logged as a contact event so the office sees it in its 문의함.
 */
export function ContactPanel({ phone, listing, details, moreHref, onContact }: ContactPanelProps) {
  const { toast } = useToast();
  const pretty = formatPhone(phone);
  const rows = (details ?? []).filter((r): r is InquiryDetailRow & { value: string } => !!r.value);

  const copy = async () => {
    onContact('COPY');
    try {
      await navigator.clipboard.writeText(pretty);
      toast({ message: '전화번호를 복사했어요.' });
    } catch {
      toast({ message: '복사하지 못했어요. 번호를 직접 눌러 주세요.', tone: 'error' });
    }
  };

  return (
    <>
      <button
        type="button"
        className={styles.phone}
        onClick={() => void copy()}
        aria-label={`전화번호 ${pretty} 복사`}
      >
        <span className="num">{pretty}</span>
        <span className={styles.copy} aria-hidden="true">
          <Icon name="copy" size={14} />
          번호 복사
        </span>
      </button>
      <div className={styles.actions}>
        <a
          className={`${styles.action} ${styles.actionSecondary}`}
          href={smsHref(phone, smsMessage(listing))}
          onClick={() => onContact('SMS')}
        >
          <Icon name="chat" size={18} />
          문자 보내기
        </a>
        <a
          className={`${styles.action} ${styles.actionPrimary}`}
          href={telHref(phone)}
          onClick={() => onContact('CALL')}
        >
          <Icon name="phone" size={18} />
          전화 걸기
        </a>
      </div>
      <p className={styles.hint}>
        {listing
          ? '사무소 번호로 바로 연결돼요. 매물번호를 말씀하시면 안내가 빨라요.'
          : '사무소 번호로 바로 연결돼요.'}
      </p>
      {rows.length > 0 && (
        <dl className={styles.info}>
          {rows.map((row) => (
            <div key={row.label}>
              <dt>{row.label}</dt>
              <dd className={row.num ? 'num' : undefined}>{row.value}</dd>
            </div>
          ))}
        </dl>
      )}
      {moreHref && (
        <Link className={styles.more} href={moreHref}>
          사무소 정보와 다른 매물 보기
          <Icon name="chevron-right" size={16} />
        </Link>
      )}
    </>
  );
}
