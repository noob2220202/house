'use client';
import { zodResolver } from '@hookform/resolvers/zod';
import { DealRequestType } from '@house/shared';
import { Button, Chip, Icon, IconButton, Input, Textarea, cx, useToast } from '@house/ui';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { ApiError, errorMessage } from '@/lib/api';
import { formatPriceHint, parsePriceInput } from '@/lib/format';
import { fetchListingCandidates, inboxKeys, sendProposal } from '../api/queries';
import type { AgencyDealRequestDetail, InboxListing, MyProposal } from '../api/schemas';
import { rankListings } from '../lib/match';
import {
  EMPTY_PROPOSAL_FORM,
  OFFER_LABEL,
  PROPOSAL_LISTINGS_MAX,
  PROPOSAL_TEXT_MAX,
  appendTemplate,
  offerKindOf,
  proposalFormSchema,
  proposalTemplates,
  toProposalBody,
  type ProposalFormValues,
} from '../lib/proposal';
import { ListingMini } from '../ui/ListingMini';
import { ListingPicker } from './ListingPicker';
import styles from './Requests.module.css';

export interface ProposalFormProps {
  request: AgencyDealRequestDetail;
  /** Used by the greeting template. */
  agencyName?: string | null;
  memberName?: string | null;
  onSent: (proposal: MyProposal) => void;
  /** The API says the request can no longer take our proposal (closed / duplicate) → reload it. */
  onStale: () => void;
}

/** The requester's own price, as text for the "희망가 그대로" shortcut. */
function desiredPrice(r: AgencyDealRequestDetail): { price: string; rent: string } | null {
  if (typeof r.desiredSalePrice === 'number')
    return { price: String(r.desiredSalePrice), rent: '' };
  if (typeof r.desiredMonthlyRent === 'number')
    return { price: String(r.desiredDeposit ?? 0), rent: String(r.desiredMonthlyRent) };
  if (typeof r.desiredDeposit === 'number') return { price: String(r.desiredDeposit), rent: '' };
  return null;
}

/** Proposal composer: message (+ starters), suggested price for 내놓기, listings picker. */
export function ProposalForm({
  request: r,
  agencyName,
  memberName,
  onSent,
  onStale,
}: ProposalFormProps) {
  const { toast } = useToast();
  const [listings, setListings] = useState<InboxListing[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const sell = r.type === DealRequestType.SELL_OR_LEASE;
  const offerKind = offerKindOf(r);
  const templates = useMemo(
    () => proposalTemplates(r, { agencyName, memberName }),
    [r, agencyName, memberName],
  );

  const {
    register,
    handleSubmit,
    setValue,
    setError,
    control,
    formState: { errors },
  } = useForm<ProposalFormValues>({
    resolver: zodResolver(proposalFormSchema),
    defaultValues: EMPTY_PROPOSAL_FORM,
    mode: 'onBlur',
  });
  const message = useWatch({ control, name: 'message' });
  const offerPrice = useWatch({ control, name: 'offerPrice' });
  const offerRent = useWatch({ control, name: 'offerRent' });

  // Same cache entry as the picker's first page → "조건에 맞는 매물 N건" costs nothing extra.
  const candidates = useQuery({
    queryKey: inboxKeys.candidates(r.id, ''),
    queryFn: ({ signal }) => fetchListingCandidates(r.id, '', signal),
    staleTime: 60_000,
  });
  const fullMatches = useMemo(
    () => rankListings(r, candidates.data?.items ?? []).filter((m) => m.match.full).length,
    [r, candidates.data],
  );

  const applyListings = (next: InboxListing[]) => {
    setListings(next);
    setValue(
      'listingIds',
      next.map((l) => l.id),
      { shouldValidate: true },
    );
  };

  const mutation = useMutation({
    mutationFn: (values: ProposalFormValues) =>
      sendProposal(r.id, toProposalBody(values, offerKind)),
    onSuccess: (proposal) => {
      toast('제안을 보냈어요. 요청자가 확인하면 알려 드릴게요.');
      onSent(proposal);
    },
    onError: (error) => {
      if (error instanceof ApiError && error.isValidation) {
        const fields = error.fieldErrors();
        if (fields.message) setError('message', { message: fields.message });
        if (fields.listingIds) setError('listingIds', { message: fields.listingIds });
        if (fields.message || fields.listingIds) return;
      }
      toast({ message: errorMessage(error), tone: 'error' });
      if (
        error instanceof ApiError &&
        (error.code === 'PROPOSAL_DUPLICATE' ||
          error.code === 'DEAL_REQUEST_CLOSED' ||
          error.code === 'DEAL_REQUEST_NOT_TARGETED' ||
          error.isNotFound)
      )
        onStale();
    },
  });

  const desired = desiredPrice(r);
  const priceValue = parsePriceInput(offerPrice);
  const rentValue = parsePriceInput(offerRent);
  const over = message.trim().length > PROPOSAL_TEXT_MAX;

  return (
    <>
      <form
        className={styles.form}
        noValidate
        onSubmit={(e) => void handleSubmit((values) => mutation.mutate(values))(e)}
      >
        <div className={styles.group}>
          <div className={styles.groupHead}>
            <span className={styles.groupTitle} id="proposal-templates">
              문장 빠르게 넣기
            </span>
          </div>
          <div className={styles.templates} role="group" aria-labelledby="proposal-templates">
            {templates.map((t) => (
              <Chip
                key={t.label}
                iconLeft={<Icon name="plus" size={14} />}
                onClick={() =>
                  setValue('message', appendTemplate(message, t.text), {
                    shouldDirty: true,
                    shouldValidate: !!errors.message,
                  })
                }
              >
                {t.label}
              </Chip>
            ))}
          </div>
          <Textarea
            label="제안 내용"
            required
            rows={7}
            placeholder={
              sell
                ? '예상 거래 기간, 최근 거래 경험, 광고·촬영 지원처럼 요청자가 궁금해할 내용을 적어 주세요.'
                : '추천하는 매물과 이유, 방문 가능한 시간처럼 요청자가 궁금해할 내용을 적어 주세요.'
            }
            error={errors.message?.message}
            {...register('message')}
          />
          <span className={cx(styles.counter, over && styles.counterOver)} aria-hidden="true">
            {message.trim().length.toLocaleString('ko-KR')} /{' '}
            {PROPOSAL_TEXT_MAX.toLocaleString('ko-KR')}
          </span>
        </div>

        {offerKind && (
          <div className={styles.group}>
            <div className={styles.groupHead}>
              <span className={styles.groupTitle}>
                {OFFER_LABEL[offerKind]}
                <small>선택</small>
              </span>
              {desired && (
                <button
                  type="button"
                  className={styles.linkBtn}
                  onClick={() => {
                    setValue('offerPrice', desired.price, { shouldValidate: true });
                    setValue('offerRent', desired.rent, { shouldValidate: true });
                  }}
                >
                  희망가 그대로
                </button>
              )}
            </div>
            <div className={cx(styles.offerFields, offerKind !== 'monthly' && styles.offerSingle)}>
              <Input
                aria-label={
                  offerKind === 'monthly'
                    ? '예상 보증금 (만원)'
                    : `${OFFER_LABEL[offerKind]} (만원)`
                }
                placeholder={
                  offerKind === 'monthly' ? '보증금 · 예: 3000' : '예: 4억 4,000 또는 44000'
                }
                inputMode="text"
                autoComplete="off"
                suffix="만원"
                error={errors.offerPrice?.message}
                {...register('offerPrice')}
              />
              {offerKind === 'monthly' && (
                <Input
                  aria-label="예상 월세 (만원)"
                  placeholder="월세 · 예: 90"
                  inputMode="numeric"
                  autoComplete="off"
                  suffix="만원"
                  error={errors.offerRent?.message}
                  {...register('offerRent')}
                />
              )}
            </div>
            <p className={styles.offerHint} aria-live="polite">
              {priceValue !== null ? (
                <span>
                  <b>
                    {formatPriceHint(priceValue)}
                    {offerKind === 'monthly' &&
                      rentValue !== null &&
                      ` / 월 ${formatPriceHint(rentValue)}`}
                  </b>
                  으로 제안해요
                </span>
              ) : (
                <span>실제 거래될 만한 금액을 알려 주면 요청자가 비교하기 쉬워요.</span>
              )}
            </p>
          </div>
        )}

        <div className={styles.group}>
          <div className={styles.groupHead}>
            <span className={styles.groupTitle}>
              {sell ? '참고 매물' : '추천 매물'}
              <small>선택 · 최대 {PROPOSAL_LISTINGS_MAX}건</small>
            </span>
          </div>
          <p className={styles.groupHelp}>
            {sell
              ? '같은 단지·지역에서 광고 중인 우리 매물을 첨부하면 시세를 설명하기 좋아요.'
              : fullMatches > 0
                ? `요청 조건에 모두 맞는 광고중 매물이 ${fullMatches}건 있어요.`
                : '조건에 가까운 광고중 매물을 골라 함께 보내세요.'}
          </p>
          {listings.length > 0 && (
            <ul className={styles.attachedList}>
              {listings.map((l) => (
                <li key={l.id} className={styles.attachedItem}>
                  <ListingMini listing={l} />
                  <IconButton
                    label={`${l.title} 첨부 취소`}
                    variant="plain"
                    size={36}
                    onClick={() => applyListings(listings.filter((x) => x.id !== l.id))}
                  >
                    <Icon name="close" size={18} />
                  </IconButton>
                </li>
              ))}
            </ul>
          )}
          <Button
            type="button"
            variant="secondary"
            block
            iconLeft={<Icon name={listings.length > 0 ? 'edit' : 'plus'} size={16} />}
            onClick={() => setPickerOpen(true)}
          >
            {listings.length > 0
              ? `매물 다시 고르기 (${listings.length}건 선택)`
              : '내 매물에서 고르기'}
          </Button>
          {errors.listingIds?.message && (
            <p className={styles.fieldError} role="alert">
              {errors.listingIds.message}
            </p>
          )}
        </div>

        <div className={styles.group}>
          <Button type="submit" size="lg" block loading={mutation.isPending}>
            제안 보내기
          </Button>
          <p className={styles.submitNote}>
            제안은 요청 하나에 한 번만 보낼 수 있고, 보낸 뒤에는 수정할 수 없어요.
          </p>
        </div>
      </form>
      <ListingPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        request={r}
        selected={listings}
        onApply={applyListings}
      />
    </>
  );
}
