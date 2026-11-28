'use client';
import {
  AGENCY_SUBSCRIPTION_MEMO_MAX,
  AdminRole,
  AgencySubscriptionState,
  SUBSCRIPTION_PRODUCT_LABEL,
  SubscriptionProduct,
  adminSubscriptionCreateSchema,
  type AdminSubscriptionCreateInput,
} from '@house/shared';
import {
  Badge,
  Button,
  Callout,
  Chip,
  ConfirmDialog,
  ErrorState,
  Icon,
  Input,
  Modal,
  Panel,
  Select,
  Skeleton,
  StatusPill,
  Textarea,
  cx,
  useToast,
} from '@house/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useId, useState } from 'react';
import { ADMIN_ROUTES } from '@/config/nav';
import { errorMessage } from '@/lib/api';
import { useAdminSession } from '@/lib/auth';
import { formatDate, toKstDateString } from '@/lib/format';
import {
  createAgencySubscription,
  fetchAgencySubscriptions,
  modKeys,
  updateAgencySubscription,
} from '../api/queries';
import type { AdminAgencyDetail, AgencySubscription } from '../api/schemas';
import {
  SUBSCRIPTION_STATE_META,
  subscriptionEndFor,
  subscriptionPeriod,
  subscriptionPeriodLine,
} from '../lib/labels';
import s from '../ui/ui.module.css';
import st from './site.module.css';

const PRODUCTS = Object.values(SubscriptionProduct);
const PRODUCT_OPTIONS = PRODUCTS.map((p) => ({ value: p, label: SUBSCRIPTION_PRODUCT_LABEL[p] }));
const QUICK_MONTHS = [1, 3, 6, 12] as const;

/** Subscriptions and the site both change (a site may become live), as does the dashboard. */
function useRefresh() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: ['admin-agencies'] });
    void queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] });
  };
}

type FieldErrors = Partial<Record<keyof AdminSubscriptionCreateInput, string>>;

/** 원 typed with or without commas → integer; '' → null; anything else → NaN (schema error). */
function parseWon(text: string): number | null {
  const digits = text.replace(/[,\s원]/g, '');
  if (digits === '') return null;
  return /^\d+$/.test(digits) ? Number(digits) : Number.NaN;
}

/** 기간 추가 — records a period paid offline (bank transfer). Validated with the shared schema. */
function AddSubscriptionDialog({
  agency,
  onClose,
}: {
  agency: AdminAgencyDetail;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const refresh = useRefresh();
  const formId = useId();
  const today = toKstDateString();
  const [product, setProduct] = useState<SubscriptionProduct>(SubscriptionProduct.SITE);
  const [startsOn, setStartsOn] = useState(today);
  const [endsOn, setEndsOn] = useState(subscriptionEndFor(today, 12));
  const [amount, setAmount] = useState('');
  const [memo, setMemo] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const create = useMutation({
    mutationFn: (body: AdminSubscriptionCreateInput) => createAgencySubscription(agency.id, body),
    onSuccess: (created) => {
      refresh();
      toast(`${SUBSCRIPTION_PRODUCT_LABEL[created.product]} 이용 기간을 기록했어요.`);
      onClose();
    },
  });

  const submit = () => {
    const parsed = adminSubscriptionCreateSchema.safeParse({
      product,
      startsOn,
      endsOn: endsOn || null,
      amountWon: parseWon(amount),
      memo,
    });
    if (!parsed.success) {
      const next: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof AdminSubscriptionCreateInput | undefined;
        if (key && !next[key]) next[key] = issue.message;
      }
      setErrors(next);
      return;
    }
    setErrors({});
    create.mutate(parsed.data);
  };

  return (
    <Modal
      open
      onClose={create.isPending ? () => undefined : onClose}
      size="md"
      title="이용 기간 기록"
      description="계좌이체로 받은 이용료와 기간을 기록해요. 결제는 사이트에서 받지 않아요."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={create.isPending}>
            취소
          </Button>
          <Button type="submit" form={formId} loading={create.isPending}>
            기록하기
          </Button>
        </>
      }
    >
      <form
        id={formId}
        className={s.dialogBody}
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          if (!create.isPending) submit();
        }}
      >
        <div className={s.dialogTarget}>
          {agency.name}
          <small>대표 {agency.representativeName}</small>
        </div>
        <Select
          label="상품"
          required
          options={PRODUCT_OPTIONS}
          value={product}
          onChange={(e) => setProduct(e.target.value as SubscriptionProduct)}
          error={errors.product}
          help={
            product === SubscriptionProduct.PLATFORM
              ? '메인 사이트 입점은 아직 유료 적용이 되지 않아요. 기록만 남아요.'
              : undefined
          }
        />
        <div className={st.formGrid}>
          <Input
            type="date"
            label="시작일"
            required
            value={startsOn}
            onChange={(e) => setStartsOn(e.target.value)}
            error={errors.startsOn}
          />
          <Input
            type="date"
            label="종료일"
            value={endsOn}
            min={startsOn || undefined}
            onChange={(e) => setEndsOn(e.target.value)}
            error={errors.endsOn}
            help="이 날까지 이용할 수 있어요. 비우면 종료일 없이 이어져요."
          />
        </div>
        <div className={st.quickRange} role="group" aria-label="기간 빠르게 정하기">
          {QUICK_MONTHS.map((months) => {
            const end = subscriptionEndFor(startsOn, months);
            return (
              <Chip
                key={months}
                selected={!!end && end === endsOn}
                disabled={!end}
                onClick={() => setEndsOn(end)}
              >
                {months === 12 ? '1년' : `${months}개월`}
              </Chip>
            );
          })}
          <Chip selected={endsOn === ''} onClick={() => setEndsOn('')}>
            종료일 없음
          </Chip>
        </div>
        <Input
          label="받은 금액"
          inputMode="numeric"
          suffix="원"
          placeholder="무료로 제공하면 0"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          error={errors.amountWon}
          help="원 단위로 입력해 주세요. 비우면 금액 없이 기록돼요."
        />
        <Textarea
          label="메모"
          rows={3}
          maxLength={AGENCY_SUBSCRIPTION_MEMO_MAX}
          placeholder="입금자명, 입금일, 할인 내용 등"
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          error={errors.memo}
        />
        {create.isError && (
          <Callout size="sm" tone="danger" live>
            {errorMessage(create.error)}
          </Callout>
        )}
      </form>
    </Modal>
  );
}

/** 이용 종료 — moves the last day to `endsOn` (default: today, never before the start). */
function EndSubscriptionDialog({
  subscription,
  onClose,
}: {
  subscription: AgencySubscription;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const refresh = useRefresh();
  const formId = useId();
  const today = toKstDateString();
  const [endsOn, setEndsOn] = useState(
    today < subscription.startsOn ? subscription.startsOn : today,
  );
  const [error, setError] = useState<string | null>(null);
  const end = useMutation({
    mutationFn: (day: string) => updateAgencySubscription(subscription.id, { endsOn: day }),
    onSuccess: () => {
      refresh();
      toast('이용 종료일을 바꿨어요.');
      onClose();
    },
    onError: (e) => setError(errorMessage(e)),
  });
  return (
    <Modal
      open
      onClose={end.isPending ? () => undefined : onClose}
      title="이용 종료일 변경"
      description={`${SUBSCRIPTION_PRODUCT_LABEL[subscription.product]} · ${subscriptionPeriod(subscription)}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={end.isPending}>
            취소
          </Button>
          <Button type="submit" form={formId} loading={end.isPending}>
            종료일 저장
          </Button>
        </>
      }
    >
      <form
        id={formId}
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          if (!/^\d{4}-\d{2}-\d{2}$/.test(endsOn)) return setError('종료일을 선택해 주세요.');
          if (endsOn < subscription.startsOn)
            return setError('종료일은 시작일과 같거나 그 이후여야 합니다.');
          setError(null);
          end.mutate(endsOn);
        }}
      >
        <Input
          type="date"
          label="종료일"
          required
          value={endsOn}
          min={subscription.startsOn}
          onChange={(e) => setEndsOn(e.target.value)}
          error={error ?? undefined}
          help="이 날까지 이용할 수 있어요 (그날 포함)."
          data-autofocus
        />
      </form>
    </Modal>
  );
}

function SubscriptionRow({
  item,
  canEdit,
  onEnd,
  onCancel,
}: {
  item: AgencySubscription;
  canEdit: boolean;
  onEnd: () => void;
  onCancel: () => void;
}) {
  const meta = SUBSCRIPTION_STATE_META[item.state];
  const open =
    item.state === AgencySubscriptionState.ACTIVE ||
    item.state === AgencySubscriptionState.SCHEDULED;
  return (
    <li className={cx(s.row, st.subRow)}>
      <span className={s.rowMain}>
        <span className={st.subTitle}>
          <span className={s.rowTitle}>{SUBSCRIPTION_PRODUCT_LABEL[item.product]}</span>
          <StatusPill tone={meta.tone}>{meta.label}</StatusPill>
        </span>
        <span className={cx(s.rowSub, s.num)}>{subscriptionPeriodLine(item)}</span>
        {item.memo && <span className={s.rowSub}>{item.memo}</span>}
        <span className={s.rowSub}>
          {[
            item.createdByName ? `${item.createdByName} 기록` : null,
            formatDate(item.createdAt),
            item.canceledAt ? `${formatDate(item.canceledAt)} 취소` : null,
          ]
            .filter(Boolean)
            .join(' · ')}
        </span>
      </span>
      {canEdit && open && (
        <span className={st.subActions}>
          <Button size="sm" variant="secondary" onClick={onEnd}>
            종료일 변경
          </Button>
          <Button size="sm" variant="danger" onClick={onCancel}>
            취소
          </Button>
        </span>
      )}
    </li>
  );
}

/**
 * 이용 기간 (subscriptions) of one office: 사무소 홈페이지 (SITE) and 메인 사이트 입점 (PLATFORM) periods paid offline.
 * Both products are free for now — whether a missing subscription matters is the FEATURES
 * switch (사이트 정보 › 기능 설정). Recording needs ADMIN or higher; operators read only.
 */
export function AgencySubscriptionsPanel({ agency }: { agency: AdminAgencyDetail }) {
  const { can } = useAdminSession();
  const canEdit = can(AdminRole.ADMIN);
  const { toast } = useToast();
  const refresh = useRefresh();
  const [adding, setAdding] = useState(false);
  const [ending, setEnding] = useState<AgencySubscription | null>(null);
  const [canceling, setCanceling] = useState<AgencySubscription | null>(null);
  const query = useQuery({
    queryKey: modKeys.agencySubscriptions(agency.id),
    queryFn: ({ signal }) => fetchAgencySubscriptions(agency.id, signal),
  });
  const cancel = useMutation({
    mutationFn: (id: string) => updateAgencySubscription(id, { cancel: true }),
    onSuccess: () => {
      refresh();
      toast('이용 기간을 취소했어요. 기록은 남아 있어요.');
      setCanceling(null);
    },
    onError: (e) => {
      toast({ message: errorMessage(e), tone: 'error' });
      setCanceling(null);
    },
  });
  const data = query.data;

  return (
    <Panel
      id="subscriptions"
      title="이용 기간"
      count={data ? data.items.length : undefined}
      description="사무소 홈페이지 · 메인 사이트 입점 이용 기간 (계좌이체 후 직접 기록)"
      flush
      actions={
        canEdit ? (
          <Button
            size="sm"
            variant="secondary"
            iconLeft={<Icon name="plus" size={16} />}
            onClick={() => setAdding(true)}
          >
            이용 기간 기록
          </Button>
        ) : undefined
      }
    >
      {query.isPending ? (
        <div className={st.emptyNote} aria-busy="true" aria-label="이용 기간을 불러오는 중">
          <Skeleton height={16} width="50%" />
          <Skeleton height={44} radius={10} style={{ marginTop: 10 }} />
        </div>
      ) : query.isError || !data ? (
        <ErrorState
          compact
          title="이용 기간을 불러오지 못했어요"
          description="잠시 후 다시 시도해 주세요."
          onRetry={() => void query.refetch()}
        />
      ) : (
        <>
          <div className={st.current} aria-label="오늘 기준 이용 상태">
            {PRODUCTS.map((p) => (
              <span key={p}>
                {SUBSCRIPTION_PRODUCT_LABEL[p]}
                <Badge tone={data.current[p] ? 'success' : 'neutral'}>
                  {data.current[p] ? '이용 중' : '이용 기간 없음'}
                </Badge>
              </span>
            ))}
          </div>
          {data.items.length === 0 ? (
            <p className={st.emptyNote}>
              기록된 이용 기간이 없어요. 지금은 두 상품 모두 무료로 제공 중이라, 유료 적용을 켜기
              전까지는 이용 기간이 없어도 그대로 이용할 수 있어요.
              {canEdit && (
                <>
                  {' '}
                  유료 적용은{' '}
                  <Link className="link" href={`${ADMIN_ROUTES.siteInfo}?tab=features`}>
                    사이트 정보 › 기능 설정
                  </Link>
                  에서 정해요.
                </>
              )}
            </p>
          ) : (
            <ul className={s.rows}>
              {data.items.map((item) => (
                <SubscriptionRow
                  key={item.id}
                  item={item}
                  canEdit={canEdit}
                  onEnd={() => setEnding(item)}
                  onCancel={() => setCanceling(item)}
                />
              ))}
            </ul>
          )}
        </>
      )}

      {adding && <AddSubscriptionDialog agency={agency} onClose={() => setAdding(false)} />}
      {ending && (
        <EndSubscriptionDialog
          key={ending.id}
          subscription={ending}
          onClose={() => setEnding(null)}
        />
      )}
      <ConfirmDialog
        open={!!canceling}
        onClose={() => !cancel.isPending && setCanceling(null)}
        onConfirm={() => canceling && cancel.mutate(canceling.id)}
        title="이 이용 기간을 취소할까요?"
        description={
          canceling
            ? `${SUBSCRIPTION_PRODUCT_LABEL[canceling.product]} · ${subscriptionPeriod(canceling)}. 취소한 기간은 이용 기간으로 치지 않고, 기록은 작업 기록과 함께 남아요.`
            : undefined
        }
        confirmLabel="이용 기간 취소"
        danger
        loading={cancel.isPending}
      />
    </Panel>
  );
}
