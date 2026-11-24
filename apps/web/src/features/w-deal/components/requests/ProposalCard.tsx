'use client';
import { DEAL_TYPE_LABEL, ProposalStatus } from '@house/shared';
import {
  AgencyLogo,
  Badge,
  Button,
  Checkbox,
  DealBadge,
  Icon,
  PhotoPlaceholder,
  Switch,
  cx,
  dealKindOf,
  photoKindForAsset,
} from '@house/ui';
import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import { ROUTES } from '@/config/nav';
import {
  formatCount,
  formatDateShort,
  formatDealPrice,
  formatPhone,
  formatRelativeTime,
  formatSqm,
} from '@/lib/format';
import type { Proposal, ProposalListing } from '../../api/schemas';
import { isProposalPending, PROPOSAL_STATUS_LABEL } from '../../lib/labels';
import styles from './requests.module.css';

const STATUS_TONE: Record<ProposalStatus, 'brand' | 'neutral' | 'success' | 'danger'> = {
  SENT: 'brand',
  VIEWED: 'neutral',
  ACCEPTED: 'success',
  DECLINED: 'neutral',
  WITHDRAWN: 'neutral',
};

export function ProposalStatusBadge({ status }: { status: ProposalStatus }) {
  return <Badge tone={STATUS_TONE[status]}>{PROPOSAL_STATUS_LABEL[status]}</Badge>;
}

export function listingPriceText(l: ProposalListing): string {
  return formatDealPrice({
    dealType: l.dealType,
    price: l.price,
    deposit: l.deposit,
    monthlyRent: l.monthlyRent,
  });
}

function ListingRow({ listing }: { listing: ProposalListing }) {
  return (
    <Link href={ROUTES.listing(listing.id)} className={styles.listing}>
      <span className={styles.listingPh}>
        {listing.thumbUrl ? (
          <Image src={listing.thumbUrl} alt="" fill sizes="56px" />
        ) : (
          <PhotoPlaceholder kind={photoKindForAsset(listing.assetType)} />
        )}
      </span>
      <span className={styles.listingT}>
        <b>{listing.title}</b>
        <span>
          {[
            typeof listing.exclusiveArea === 'number'
              ? `전용 ${formatSqm(listing.exclusiveArea)}`
              : null,
            listing.floorLabel,
          ]
            .filter(Boolean)
            .join(' · ')}
        </span>
      </span>
      <span className={styles.listingP}>
        <DealBadge deal={dealKindOf(listing.dealType)}>
          {DEAL_TYPE_LABEL[listing.dealType]}
        </DealBadge>
        {listingPriceText(listing)}
      </span>
    </Link>
  );
}

export interface ProposalCardProps {
  proposal: Proposal;
  /** The request still accepts answers (OPEN / MATCHED). */
  active: boolean;
  /** What a contact grant reveals, e.g. "김하늘 · 010-0000-1234 · 103동 1502호". */
  revealText: string;
  /** Kinds of data a grant reveals, e.g. "이름·휴대폰 번호와 상세 주소". */
  revealHint: string;
  /** Server "now" for relative times. */
  now: string;
  busy?: boolean;
  onAccept: () => void;
  onDecline: () => void;
  onToggleContact: (grant: boolean) => void;
  /** Compare selection (hidden when undefined). */
  compare?: { checked: boolean; onChange: (checked: boolean) => void; disabled?: boolean };
}

/** One received proposal: agency, message, suggested listings, contact consent and the answer buttons. */
export function ProposalCard({
  proposal: p,
  active,
  revealText,
  revealHint,
  now,
  busy,
  onAccept,
  onDecline,
  onToggleContact,
  compare,
}: ProposalCardProps) {
  const [open, setOpen] = useState(false);
  const pending = isProposalPending(p.status);
  const accepted = p.status === ProposalStatus.ACCEPTED;
  const off = p.status === ProposalStatus.DECLINED || p.status === ProposalStatus.WITHDRAWN;
  const long = p.message.length > 140 || p.message.split('\n').length > 3;
  const a = p.agency;
  // A new grant only while the proposal is still in play; a grant given earlier can always be
  // taken back — also after the request was closed, cancelled or expired.
  const canGrant = active && (pending || accepted);
  const showSwitch = canGrant || p.contactGranted;

  return (
    <li
      className={cx(
        styles.prop,
        p.status === ProposalStatus.SENT && active && styles.isNew,
        accepted && styles.isAccepted,
        off && styles.isOff,
      )}
    >
      <div className={styles.propHd}>
        <AgencyLogo
          name={a.name}
          seed={a.id}
          size={48}
          image={a.logoUrl ? <Image src={a.logoUrl} alt="" fill sizes="48px" /> : undefined}
        />
        <div className={styles.propT}>
          <h3 className={styles.propName}>
            <Link href={ROUTES.agency(a.id)}>{a.name}</Link>
          </h3>
          <p className={styles.propMeta}>
            {a.specialty && <b>{a.specialty}</b>}
            {p.memberName && p.memberIsAssistant ? (
              <span>
                중개보조원 {p.memberName}
                {a.representativeName && ` · 대표 공인중개사 ${a.representativeName}`}
              </span>
            ) : (
              (p.memberName ?? a.representativeName) && (
                <span>담당 {p.memberName ?? a.representativeName}</span>
              )
            )}
            {typeof a.avgResponseMinutes === 'number' && (
              <span>평균 응답 {a.avgResponseMinutes}분</span>
            )}
            {typeof a.activeListingCount === 'number' && (
              <span>보유 매물 {formatCount(a.activeListingCount)}건</span>
            )}
          </p>
        </div>
        <div className={styles.propSide}>
          <ProposalStatusBadge status={p.status} />
          <span className="t-cap">{formatRelativeTime(p.createdAt, now)} 도착</span>
        </div>
      </div>

      {p.memberName && p.memberIsAssistant && (
        <p className={styles.propNote}>
          <Icon name="info" size={14} />
          중개보조원이 보낸 제안이에요. 중개보조원은 공인중개사의 업무를 돕는 직원이며, 연락은 사무소
          대표번호로 연결돼요.
        </p>
      )}
      <p className={cx(styles.propMsg, long && !open && styles.clamp)}>{p.message}</p>
      {long && (
        <button
          type="button"
          className={styles.moreBtn}
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
        >
          {open ? '접기' : '제안 내용 더 보기'}
        </button>
      )}

      {p.listings.length > 0 && (
        <div className={styles.listings}>
          <p className={styles.listingsT}>추천 매물 {p.listings.length}건</p>
          {p.listings.map((l) => (
            <ListingRow key={l.id} listing={l} />
          ))}
        </div>
      )}

      {(canGrant || p.contactGranted) && (
        <div className={cx(styles.consent, p.contactGranted && styles.on)}>
          <div className={styles.consentT}>
            <b>
              <Icon name={p.contactGranted ? 'check-circle' : 'lock'} size={16} />
              {p.contactGranted ? '내 연락처를 공개했어요' : '내 연락처는 아직 비공개예요'}
            </b>
            <span>
              {p.contactGranted
                ? `${revealText} · 언제든 다시 비공개로 바꿀 수 있어요.`
                : `공개하면 이 중개사무소가 ${revealHint}를 볼 수 있어요.`}
            </span>
          </div>
          {showSwitch && (
            <Switch
              checked={p.contactGranted}
              disabled={busy}
              onChange={(e) => onToggleContact(e.target.checked)}
              aria-label={`${a.name}에 내 연락처 공개`}
            >
              연락처 공개
            </Switch>
          )}
        </div>
      )}

      <div className={styles.propFt}>
        {compare && pending && active ? (
          <Checkbox
            checked={compare.checked}
            disabled={compare.disabled && !compare.checked}
            onChange={(e) => compare.onChange(e.target.checked)}
          >
            비교에 담기
          </Checkbox>
        ) : !pending ? (
          <span className={cx(styles.answered, accepted && styles.ok)}>
            {accepted && <Icon name="check-circle" size={16} />}
            {PROPOSAL_STATUS_LABEL[p.status]}
            {p.respondedAt ? ` · ${formatDateShort(p.respondedAt)}` : ''}
          </span>
        ) : (
          <span />
        )}
        <div className={styles.propActions}>
          {a.phone && (accepted || p.contactGranted) && (
            <Button
              href={`tel:${a.phone}`}
              variant="secondary"
              iconLeft={<Icon name="phone" size={18} />}
              aria-label={`${a.name}에 전화하기 ${formatPhone(a.phone)}`}
            >
              전화하기
            </Button>
          )}
          {pending && active && (
            <>
              <Button type="button" variant="secondary" onClick={onDecline} disabled={busy}>
                거절
              </Button>
              <Button type="button" onClick={onAccept} disabled={busy}>
                제안 수락
              </Button>
            </>
          )}
        </div>
      </div>
    </li>
  );
}
