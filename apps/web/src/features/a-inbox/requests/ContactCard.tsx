'use client';
import { DealRequestType, ProposalStatus } from '@house/shared';
import { Button, Callout, Icon, cx, useToast } from '@house/ui';
import { formatDateTime, formatPhone } from '@/lib/format';
import type { AgencyDealRequestDetail } from '../api/schemas';
import { isRequestActive } from '../lib/stage';
import styles from './Requests.module.css';

/** Why the contact is still hidden and what moves it forward. */
export function lockedHint(r: Pick<AgencyDealRequestDetail, 'status' | 'myProposal'>): string {
  if (!isRequestActive(r.status)) return '종료된 요청이라 연락처를 받을 수 없어요.';
  const proposal = r.myProposal?.status;
  if (!proposal) return '제안을 보내면 요청자가 검토한 뒤 연락처 공개 여부를 정해요.';
  if (proposal === ProposalStatus.ACCEPTED)
    return '요청자가 제안을 수락했어요. 연락처 공개 동의를 기다리고 있어요.';
  if (proposal === ProposalStatus.DECLINED || proposal === ProposalStatus.WITHDRAWN)
    return '이 요청의 연락처는 공개되지 않았어요.';
  return '요청자가 제안을 검토하고 있어요. 공개에 동의하면 알림으로 알려 드려요.';
}

export interface ContactCardProps {
  request: AgencyDealRequestDetail;
}

/**
 * Requester contact. Until the requester grants it to this office (DealRequestContactGrant) only
 * the masked name is known — nothing here reconstructs private data on the client.
 */
export function ContactCard({ request: r }: ContactCardProps) {
  const { toast } = useToast();
  const contact = r.contact;

  if (!contact) {
    return (
      <div className={styles.contact}>
        <div className={styles.contactTop}>
          <span className={styles.contactIcon}>
            <Icon name="lock" size={22} />
          </span>
          <p className={styles.contactText}>
            <span className={styles.contactName}>요청자 · 연락처 비공개</span>
            <span className={styles.contactHint}>{lockedHint(r)}</span>
          </p>
        </div>
      </div>
    );
  }

  const phone = formatPhone(contact.phone);
  const address = [contact.roadAddress, contact.addressDetail].filter(Boolean).join(' ');
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(phone);
      toast('전화번호를 복사했어요.');
    } catch {
      toast({ message: '복사하지 못했어요. 번호를 길게 눌러 복사해 주세요.', tone: 'error' });
    }
  };

  return (
    <div className={cx(styles.contact, styles.contactOpen)}>
      <div className={styles.contactTop}>
        <span className={styles.contactIcon}>
          <Icon name="phone" size={22} />
        </span>
        <p className={styles.contactText}>
          <span className={styles.contactName}>{contact.name} 님</span>
          <span className={styles.contactHint}>
            {contact.grantedAt
              ? `${formatDateTime(contact.grantedAt)}에 연락처를 공개했어요`
              : '연락처를 공개했어요'}
          </span>
        </p>
      </div>
      <div className={styles.phoneRow}>
        <a className={styles.phone} href={`tel:${contact.phone}`}>
          {phone}
        </a>
        <div className={styles.contactActions}>
          <Button
            size="sm"
            href={`tel:${contact.phone}`}
            iconLeft={<Icon name="phone" size={16} />}
          >
            전화 걸기
          </Button>
          <Button
            size="sm"
            variant="secondary"
            href={`sms:${contact.phone}`}
            iconLeft={<Icon name="mail" size={16} />}
          >
            문자
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => void copy()}
            iconLeft={<Icon name="copy" size={16} />}
          >
            번호 복사
          </Button>
        </div>
      </div>
      {r.type === DealRequestType.SELL_OR_LEASE && address && (
        <dl className={styles.facts}>
          <div className={cx(styles.fact, styles.factWide)}>
            <dt>상세 주소</dt>
            <dd>{address}</dd>
          </div>
        </dl>
      )}
      <Callout size="sm" icon="shield" tone="muted">
        공개받은 연락처와 주소·사진·설명은 이 요청의 중개 목적으로만 사용해 주세요. 요청자는 언제든
        공개를 취소할 수 있고, 요청이 끝나고 30일이 지나면 더 이상 볼 수 없어요.
      </Callout>
    </div>
  );
}
