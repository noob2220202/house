'use client';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  DEAL_TYPE_LABEL,
  DealType,
  LISTING_STATUS_LABEL,
  ListingStatus,
  contactPhoneSchema,
} from '@house/shared';
import {
  Badge,
  BrokersBadge,
  Button,
  Callout,
  CategoryIcon,
  DealBadge,
  EmptyState,
  ErrorState,
  Icon,
  Input,
  Modal,
  Pagination,
  PhotoPlaceholder,
  PremiumBadge,
  Skeleton,
  photoKindForAsset,
  useDebouncedValue,
  useToast,
} from '@house/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { ROUTES } from '@/config/nav';
import { AGENT_ROUTES } from '@/features/a-agency/nav';
import { ConsolePage, ConsolePageHeader } from '@/features/a-agency/shell';
import { mediaImage } from '@/features/w-listing/lib/media';
import { ApiError, errorMessage } from '@/lib/api';
import { formatCount, formatDateShort } from '@/lib/format';
import { fetchCoBrokerCandidates, fetchComplex, joinCoBroker, listingKeys } from '../api/queries';
import type { CoBrokerCandidate } from '../api/schemas';
import { DEAL_KIND, priceText, rowLabel, rowTitle, specLine } from '../lib/display';
import { ComplexSearch } from '../wizard/Pickers';
import styles from './cobroker.module.css';

const joinSchema = z.object({
  contactName: z.string().trim().max(50, '50자 이내로 입력해 주세요.'),
  contactPhone: z.union([z.literal(''), contactPhoneSchema]),
});
type JoinValues = z.input<typeof joinSchema>;

function JoinDialog({
  target,
  onClose,
  onJoined,
}: {
  target: CoBrokerCandidate;
  onClose: () => void;
  onJoined: () => void;
}) {
  const { toast } = useToast();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<JoinValues>({
    resolver: zodResolver(joinSchema),
    defaultValues: { contactName: '', contactPhone: '' },
  });
  const [failure, setFailure] = useState<string | null>(null);

  const submit = async (values: JoinValues) => {
    setFailure(null);
    const parsed = joinSchema.parse(values);
    try {
      await joinCoBroker(target.id, {
        contactName: parsed.contactName || undefined,
        contactPhone: parsed.contactPhone || undefined,
      });
      toast({ message: '공동중개로 참여했어요. 매물 관리에서 확인할 수 있어요.' });
      onJoined();
    } catch (error) {
      if (error instanceof ApiError && error.isValidation) {
        const fields = error.fieldErrors();
        (['contactName', 'contactPhone'] as const).forEach((key) => {
          const message = fields[key];
          if (message) setError(key, { type: 'server', message });
        });
        if (Object.keys(fields).length > 0) return;
      }
      setFailure(errorMessage(error));
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      size="md"
      title="공동중개로 참여할까요?"
      description="참여하면 이 매물의 공개 페이지 ‘중개사무소’ 목록에 우리 사무소가 함께 표시돼요."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            취소
          </Button>
          <Button type="submit" form="join-form" loading={isSubmitting}>
            공동중개 참여
          </Button>
        </>
      }
    >
      <form
        id="join-form"
        className={styles.dialog}
        onSubmit={(e) => void handleSubmit(submit)(e)}
        noValidate
      >
        <p className={styles.target}>
          <b>{rowLabel(target)}</b>
          <span>
            {[specLine(target), `최초 등록 ${target.primaryAgencyName}`]
              .filter(Boolean)
              .join(' · ')}
          </span>
        </p>
        <div className={styles.two}>
          <Input
            label="담당자"
            placeholder="비우면 대표자 이름"
            autoComplete="name"
            error={errors.contactName?.message}
            {...register('contactName')}
          />
          <Input
            label="담당자 연락처"
            placeholder="비우면 사무소 대표번호"
            inputMode="tel"
            autoComplete="tel"
            error={errors.contactPhone?.message}
            {...register('contactPhone')}
          />
        </div>
        {failure && (
          <p className={styles.err} role="alert">
            {failure}
          </p>
        )}
        <Callout tone="info" title="참여 전에 확인해 주세요">
          소유자(임대인)에게 직접 중개 의뢰를 받은 매물만 참여할 수 있어요. 가격·사진 등 매물 정보는
          최초 등록 사무소가 관리하고, 우리 사무소는 언제든 나갈 수 있어요.
        </Callout>
      </form>
    </Modal>
  );
}

export interface CoBrokerViewProps {
  isOwner: boolean;
}

/**
 * /agent/listings/co-broker — pick a complex (and optionally a 동), see the listings other offices
 * already advertise there and join one as a co-broker instead of registering a duplicate.
 */
export function CoBrokerView({ isOwner }: CoBrokerViewProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const complexId = searchParams.get('complexId') ?? '';
  const [dong, setDong] = useState(searchParams.get('dong') ?? '');
  const dongTerm = useDebouncedValue(dong.trim(), 300);
  const [target, setTarget] = useState<CoBrokerCandidate | null>(null);
  const page = Math.max(1, Number(searchParams.get('page')) || 1);

  /** complexId · dong · page live in the URL (shareable, survives a reload). */
  const replaceQuery = (next: { complexId: string; dong?: string; page?: number }) => {
    const sp = new URLSearchParams();
    if (next.complexId) sp.set('complexId', next.complexId);
    if (next.complexId && next.dong) sp.set('dong', next.dong);
    if (next.complexId && next.page && next.page > 1) sp.set('page', String(next.page));
    const q = sp.toString();
    router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
  };

  const setComplexId = (id: string) => {
    setDong('');
    replaceQuery({ complexId: id });
  };

  // Typing a 동 narrows the list → back to page 1, and the URL follows.
  const urlDong = searchParams.get('dong') ?? '';
  useEffect(() => {
    if (!complexId || dongTerm === urlDong) return;
    replaceQuery({ complexId, dong: dongTerm });
    // Only the debounced 동 drives this (replaceQuery is recreated on every render).
  }, [dongTerm]);

  const complex = useQuery({
    queryKey: listingKeys.complex(complexId),
    queryFn: ({ signal }) => fetchComplex(complexId, signal),
    enabled: !!complexId,
    staleTime: 5 * 60_000,
  });
  const params = { complexId, dong: urlDong, page };
  const candidates = useQuery({
    queryKey: listingKeys.candidates(params),
    queryFn: ({ signal }) => fetchCoBrokerCandidates(params, signal),
    enabled: !!complexId,
  });
  const rows = candidates.data?.items ?? [];

  return (
    <ConsolePage width="wide">
      <ConsolePageHeader
        eyebrow="매물 · 공동중개"
        title="공동중개 매물 찾기"
        description="같은 집을 여러 사무소가 따로 올리면 중복 매물이 돼요. 이미 등록된 매물이 있으면 공동중개로 참여해 주세요 — 방문자에게는 한 매물로 보이고, 사무소가 함께 표시돼요."
        actions={
          <Button
            href={AGENT_ROUTES.listings}
            linkAs={Link}
            variant="secondary"
            iconLeft={<Icon name="list" size={18} />}
          >
            매물 목록
          </Button>
        }
      />

      {!isOwner && (
        <Callout tone="warn" title="공동중개 참여는 대표만 할 수 있어요">
          소속 공인중개사·중개보조원은 등록된 매물을 찾아볼 수만 있어요. 참여가 필요하면 대표
          (개업공인중개사)에게 요청해 주세요.
        </Callout>
      )}

      <section className={styles.pick} aria-label="단지 선택">
        {complexId ? (
          <div className={styles.pickRow}>
            <div className={styles.chosen} style={{ flex: '1 1 360px' }}>
              <span className={styles.chosenIc} aria-hidden="true">
                <CategoryIcon name="apt" size={24} />
              </span>
              <span className={styles.chosenT}>
                {complex.data ? (
                  <>
                    <b>{complex.data.name}</b>
                    <span>
                      {[
                        complex.data.roadAddress,
                        complex.data.households
                          ? `${formatCount(complex.data.households)}세대`
                          : null,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                  </>
                ) : complex.isError ? (
                  <b>단지 정보를 불러오지 못했어요</b>
                ) : (
                  <>
                    <Skeleton width={180} height={18} />
                    <Skeleton width={240} height={14} />
                  </>
                )}
              </span>
              <button type="button" className={styles.change} onClick={() => setComplexId('')}>
                단지 변경
              </button>
            </div>
            <div className={styles.pickDong}>
              <Input
                aria-label="동으로 좁히기"
                placeholder="동 (예: 103)"
                suffix="동"
                value={dong.replace(/동$/, '')}
                onChange={(e) => setDong(e.target.value)}
                maxLength={10}
              />
            </div>
          </div>
        ) : (
          <>
            <ComplexSearch
              label="공동중개할 단지 검색"
              onSelect={(item) => setComplexId(item.id)}
            />
            <p className={styles.quick}>
              <Icon name="info" size={16} />
              <span>
                단지를 선택하면 다른 사무소가 광고 중인 매물이 보여요. 원룸·주택·상가·토지는 최초
                등록 사무소에 직접 요청해 주세요.
              </span>
            </p>
          </>
        )}
      </section>

      {!complexId ? (
        <ol className={styles.steps}>
          <li className={styles.step}>
            <b>
              <span className={styles.stepN}>1</span>단지와 동 선택
            </b>
            의뢰받은 집이 있는 단지를 검색하고 동을 입력해요.
          </li>
          <li className={styles.step}>
            <b>
              <span className={styles.stepN}>2</span>같은 매물 확인
            </b>
            층·평형·가격을 보고 같은 집인지 확인해요. 다르면 새 매물로 등록해요.
          </li>
          <li className={styles.step}>
            <b>
              <span className={styles.stepN}>3</span>공동중개 참여
            </b>
            참여하면 공개 페이지에 우리 사무소가 함께 표시되고, 문의를 받을 수 있어요.
          </li>
        </ol>
      ) : (
        <section className={styles.panel} aria-labelledby="cb-list">
          <div className={styles.panelHd}>
            <h2 id="cb-list">
              다른 사무소가 등록한 매물 {candidates.data && <b>{candidates.data.total}</b>}
            </h2>
            <span>광고중 · 계약중인 매물만 보여요</span>
          </div>
          {candidates.isError ? (
            <div className={styles.state}>
              <ErrorState
                description={errorMessage(candidates.error)}
                onRetry={() => void candidates.refetch()}
              />
            </div>
          ) : candidates.isPending ? (
            <div role="status" aria-label="매물을 불러오는 중">
              {Array.from({ length: 3 }, (_, i) => (
                <div key={i} className={styles.row} aria-hidden="true">
                  <Skeleton width={88} height={66} radius={12} />
                  <div className={styles.info}>
                    <Skeleton width={120} height={16} />
                    <Skeleton width="60%" height={20} />
                    <Skeleton width="40%" height={14} />
                  </div>
                </div>
              ))}
            </div>
          ) : rows.length === 0 ? (
            <div className={styles.state}>
              <EmptyState
                icon="building"
                title={
                  dongTerm
                    ? `${dongTerm.replace(/동$/, '')}동에 등록된 매물이 없어요`
                    : '이 단지에 다른 사무소가 등록한 매물이 없어요'
                }
                description="같은 집이 아직 올라와 있지 않다면 새 매물로 등록해 주세요."
                action={
                  <Button
                    href={AGENT_ROUTES.listingNew}
                    linkAs={Link}
                    iconLeft={<Icon name="plus" size={18} />}
                  >
                    새 매물 등록
                  </Button>
                }
              />
            </div>
          ) : (
            <ul>
              {rows.map((row) => (
                <li key={row.id} className={styles.row}>
                  <span className={styles.thumb}>
                    {row.coverPhotoUrl ? (
                      <Image
                        {...mediaImage(row.coverPhotoUrl)}
                        alt=""
                        fill
                        sizes="88px"
                        loading="lazy"
                      />
                    ) : (
                      <PhotoPlaceholder kind={photoKindForAsset(row.assetType)} />
                    )}
                  </span>
                  <div className={styles.info}>
                    <span className={styles.badges}>
                      <DealBadge deal={DEAL_KIND[row.dealType]}>
                        {DEAL_TYPE_LABEL[row.dealType]}
                      </DealBadge>
                      {row.status !== ListingStatus.ACTIVE && (
                        <Badge tone="warn">{LISTING_STATUS_LABEL[row.status]}</Badge>
                      )}
                      <BrokersBadge count={row.agencyCount} light />
                    </span>
                    <a
                      className={styles.name}
                      href={ROUTES.listing(row.id)}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={`${rowTitle(row)} 공개 페이지 새 창으로 보기`}
                    >
                      {rowTitle(row)}
                    </a>
                    <span className={styles.sub}>
                      {specLine(row)}
                      {row.listingNo && (
                        <>
                          {specLine(row) && ' · '}
                          <span className={styles.no}>매물번호 {row.listingNo}</span>
                        </>
                      )}
                    </span>
                  </div>
                  <div className={styles.office}>
                    <span className={styles.price}>
                      {priceText(row)}
                      {row.dealType === DealType.PRESALE && typeof row.premium === 'number' && (
                        <PremiumBadge amount={row.premium} />
                      )}
                    </span>
                    <b>{row.primaryAgencyName}</b>
                    {row.verifiedAt && (
                      <span className={styles.verified}>
                        <Icon name="check-circle" size={14} />
                        실매물 확인 {formatDateShort(row.verifiedAt)}
                      </span>
                    )}
                  </div>
                  <div className={styles.act}>
                    {row.joined ? (
                      <span className={styles.joined}>
                        <Icon name="check" size={16} />
                        참여 중
                      </span>
                    ) : (
                      <Button
                        variant="soft"
                        disabled={!isOwner}
                        onClick={() => setTarget(row)}
                        aria-label={`${rowTitle(row)} 공동중개 참여`}
                      >
                        공동중개 참여
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
          {(candidates.data?.totalPages ?? 1) > 1 && (
            <div className={styles.pager}>
              <Pagination
                page={candidates.data?.page ?? page}
                totalPages={candidates.data?.totalPages ?? 1}
                onChange={(next) => replaceQuery({ complexId, dong: urlDong, page: next })}
              />
            </div>
          )}
        </section>
      )}

      {target && (
        <JoinDialog
          target={target}
          onClose={() => setTarget(null)}
          onJoined={() => {
            setTarget(null);
            void queryClient.invalidateQueries({ queryKey: listingKeys.all });
          }}
        />
      )}
    </ConsolePage>
  );
}
