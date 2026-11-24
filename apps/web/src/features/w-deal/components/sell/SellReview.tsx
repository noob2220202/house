'use client';
import { ASSET_TYPE_LABEL, DEAL_TYPE_LABEL, DealRequestVisibility } from '@house/shared';
import { Button, FormSection, Icon } from '@house/ui';
import Image from 'next/image';
import type { ReactNode } from 'react';
import { formatPhone } from '@/lib/format';
import { parseMoney } from '../../lib/form-common';
import { VISIBILITY_LABEL } from '../../lib/labels';
import { sellAddressDetail, sellPriceLabel, type SellFormValues } from '../../lib/sell-form';
import styles from '../form/form.module.css';
import { sellPriceText } from './SellSteps';
import { sellAreaText, sellMoveInText } from './SellSummary';

export function ReviewSection({
  letter,
  title,
  onEdit,
  children,
}: {
  letter: string;
  title: string;
  onEdit: () => void;
  children: ReactNode;
}) {
  return (
    <FormSection
      letter={letter}
      title={title}
      note={
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={onEdit}
          iconLeft={<Icon name="edit" size={16} />}
          aria-label={`${title} 수정`}
        >
          수정
        </Button>
      }
    >
      <dl className={styles.reviewDl}>{children}</dl>
    </FormSection>
  );
}

export function ReviewItem({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

export const PrivateTag = () => (
  <span className={styles.private}>
    <Icon name="lock" size={12} />
    동의한 중개사에게만
  </span>
);

/** Step 4 — everything entered, grouped like the form, with 수정 shortcuts back to each step. */
export function SellReview({
  v,
  reachTotal,
  goTo,
}: {
  v: SellFormValues;
  reachTotal?: number;
  goTo: (step: number) => void;
}) {
  const detail = sellAddressDetail(v);
  const selected = v.visibility === DealRequestVisibility.SELECTED_AGENCIES;
  return (
    <>
      <ReviewSection letter="A" title="매물 기본 정보" onEdit={() => goTo(0)}>
        <ReviewItem label="매물 유형">
          {v.assetType ? ASSET_TYPE_LABEL[v.assetType] : '-'}
        </ReviewItem>
        <ReviewItem label="주소">
          {v.roadAddress}
          {v.complexName && <small>{v.complexName}</small>}
        </ReviewItem>
        {detail && (
          <ReviewItem label="상세 주소">
            {detail}
            <PrivateTag />
          </ReviewItem>
        )}
      </ReviewSection>
      <ReviewSection letter="B" title="거래 조건" onEdit={() => goTo(1)}>
        <ReviewItem label="거래 유형">{v.dealType ? DEAL_TYPE_LABEL[v.dealType] : '-'}</ReviewItem>
        <ReviewItem label={sellPriceLabel(v.dealType)}>
          <span className="num">{sellPriceText(v, parseMoney) || '-'}</span>
          {v.priceNegotiable && <small>가격 협의 가능</small>}
        </ReviewItem>
        <ReviewItem label="전용면적">{sellAreaText(v) || '-'}</ReviewItem>
        <ReviewItem label="입주 가능일">{sellMoveInText(v) || '-'}</ReviewItem>
        {v.description.trim() && <ReviewItem label="매물 설명">{v.description.trim()}</ReviewItem>}
      </ReviewSection>
      <ReviewSection letter="C" title="사진 · 연락처" onEdit={() => goTo(2)}>
        <ReviewItem label="매물 사진">
          {v.photos.length === 0 ? (
            '없음'
          ) : (
            <span className={styles.reviewPhotos}>
              {v.photos.map((p, i) => (
                <span key={p.id} className={styles.reviewPhoto}>
                  {p.url && (
                    <Image src={p.url} alt={`사진 ${i + 1}`} fill sizes="72px" unoptimized />
                  )}
                </span>
              ))}
            </span>
          )}
        </ReviewItem>
        <ReviewItem label="연락처">
          {v.contactName} · <span className="num">{formatPhone(v.contactPhone)}</span>
          <PrivateTag />
        </ReviewItem>
      </ReviewSection>
      <ReviewSection letter="D" title="전달 범위 · 동의" onEdit={() => goTo(2)}>
        <ReviewItem label="공개 범위">
          {VISIBILITY_LABEL[v.visibility]}
          <small>
            {selected
              ? v.targetAgencies.map((a) => a.name).join(', ')
              : reachTotal !== undefined
                ? `매물 근처 중개사무소 ${reachTotal}곳에 함께 전달돼요`
                : '매물 근처 중개사무소에 함께 전달돼요'}
          </small>
        </ReviewItem>
        <ReviewItem label="약관 동의">개인정보 수집·이용, 중개사무소 정보 제공에 동의함</ReviewItem>
      </ReviewSection>
    </>
  );
}
