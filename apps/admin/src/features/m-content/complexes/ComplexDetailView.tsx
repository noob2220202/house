'use client';
import { ASSET_TYPE_LABEL, AdminRole } from '@house/shared';
import {
  BackLink,
  Badge,
  Button,
  Callout,
  ConfirmDialog,
  Icon,
  Modal,
  Panel,
  Skeleton,
  Tabs,
  useToast,
} from '@house/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { AdminPageHeader } from '@/components/shell';
import { env } from '@/config/env';
import { ADMIN_ROUTES } from '@/config/nav';
import { ApiError, errorMessage, qk } from '@/lib/api';
import { useAdminSession } from '@/lib/auth';
import { formatCount, formatDate, formatDateTime } from '@/lib/format';
import { complexes } from '../api';
import type { ComplexDetail } from '../api/schemas';
import { LoadError } from '../components/LoadError';
import s from '../components/shared.module.css';
import { useUrlState } from '../lib/use-url-state';
import { AreaTypesPanel } from './AreaTypesPanel';
import { ComplexFactsForm } from './ComplexFactsForm';
import { TRADE_SYNC_ROUTE } from './ComplexesTabs';
import { PhotosPanel } from './PhotosPanel';
import styles from './complexes.module.css';

type Tab = 'facts' | 'areas' | 'photos';
const TAB_BASE = 'complex';
const CRUMB = ['매물 · 회원', { label: '단지 관리', href: ADMIN_ROUTES.complexes }] as const;

function Summary({ complex }: { complex: ComplexDetail }) {
  return (
    <div className={s.aside}>
      <Panel title="한눈에 보기">
        <div className={styles.miniStats}>
          <div className={styles.mini}>
            <span className={styles.miniLabel}>게시 매물</span>
            <span className={styles.miniValue}>{formatCount(complex.activeListingCount)}</span>
          </div>
          <div className={styles.mini}>
            <span className={styles.miniLabel}>조회</span>
            <span className={styles.miniValue}>{formatCount(complex.viewCount)}</span>
          </div>
          <div className={styles.mini}>
            <span className={styles.miniLabel}>관심</span>
            <span className={styles.miniValue}>{formatCount(complex.favoriteCount)}</span>
          </div>
        </div>
        <dl className={`${s.facts} ${styles.asideGap}`}>
          <dt>등록일</dt>
          <dd>{formatDate(complex.createdAt)}</dd>
          <dt>마지막 수정</dt>
          <dd>{formatDateTime(complex.updatedAt)}</dd>
          <dt>단지 ID</dt>
          <dd className={styles.mono}>{complex.id}</dd>
        </dl>
      </Panel>

      <Panel
        title="실거래가"
        actions={
          <Link href={TRADE_SYNC_ROUTE} className={styles.syncLink}>
            동기화 내역
            <Icon name="chevron-right" size={16} />
          </Link>
        }
      >
        <dl className={s.facts}>
          <dt>연결된 거래</dt>
          <dd>{formatCount(complex.trades.total)}건</dd>
          <dt>최근 거래일</dt>
          <dd>
            {complex.trades.lastDealDate ? formatDate(complex.trades.lastDealDate) : '거래 없음'}
          </dd>
          <dt>평형 미연결</dt>
          <dd>{formatCount(complex.trades.unmatched)}건</dd>
        </dl>
        {complex.trades.unmatched > 0 ? (
          <Callout size="sm" tone="warn" className={styles.asideGap}>
            신고 면적과 맞는 평형이 없어 연결되지 않은 거래가{' '}
            <strong>{formatCount(complex.trades.unmatched)}건</strong> 있어요. 평형의 전용면적을
            확인해 주세요.
          </Callout>
        ) : complex.areaTypes.length === 0 ? (
          <Callout size="sm" tone="muted" className={styles.asideGap}>
            평형을 등록하면 다음 동기화부터 실거래가가 연결돼요.
          </Callout>
        ) : null}
      </Panel>
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className={s.stackLg} aria-busy="true">
      <Skeleton height={32} width={280} />
      <Skeleton height={44} />
      <div className={s.split}>
        <Skeleton height={520} radius={16} />
        <Skeleton height={300} radius={16} />
      </div>
    </div>
  );
}

/** 단지 상세 · 수정: 기본 정보 form, 평형, 사진 tabs + a summary column. */
export function ComplexDetailView({ id }: { id: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const { can } = useAdminSession();
  const queryClient = useQueryClient();
  const [url, setUrl] = useUrlState({ tab: 'facts' });
  const tab: Tab = url.tab === 'areas' || url.tab === 'photos' ? url.tab : 'facts';
  const [dirty, setDirty] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const key = qk('admin-complexes', 'detail', id);
  const detail = useQuery({
    queryKey: key,
    queryFn: ({ signal }) => complexes.get(id, { signal }),
  });
  const refetch = () => void queryClient.invalidateQueries({ queryKey: key });

  const remove = useMutation({
    mutationFn: () => complexes.remove(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-complexes', 'list'] });
      toast('단지를 삭제했어요.');
      router.replace(ADMIN_ROUTES.complexes);
    },
    onError: (e) => {
      setConfirmDelete(false);
      toast({ message: errorMessage(e), tone: 'error' });
    },
  });

  if (detail.isError) {
    const notFound = detail.error instanceof ApiError && detail.error.isNotFound;
    return (
      <>
        <AdminPageHeader title="단지 상세" crumb={CRUMB} />
        <BackLink linkAs={Link} href={ADMIN_ROUTES.complexes}>
          단지 목록
        </BackLink>
        <Panel>
          <LoadError
            error={detail.error}
            title={notFound ? '단지를 찾을 수 없어요' : undefined}
            onRetry={notFound ? undefined : () => void detail.refetch()}
          />
        </Panel>
      </>
    );
  }
  const complex = detail.data;
  if (!complex)
    return (
      <>
        <AdminPageHeader title="단지 상세" crumb={CRUMB} />
        <DetailSkeleton />
      </>
    );

  const address = complex.roadAddress ?? complex.jibunAddress ?? complex.emdName;
  const facts = [
    complex.households ? `${formatCount(complex.households)}세대` : null,
    complex.buildings ? `${complex.buildings}개 동` : null,
    complex.builtYear ? `${complex.builtYear}년 준공` : null,
  ].filter(Boolean);

  return (
    <>
      <AdminPageHeader title={complex.name} crumb={CRUMB} />
      <BackLink linkAs={Link} href={ADMIN_ROUTES.complexes}>
        단지 목록
      </BackLink>

      <div className={styles.head}>
        <div>
          <h2 className={styles.headTitle}>
            {complex.name}
            <Badge tone="brand">{ASSET_TYPE_LABEL[complex.assetType]}</Badge>
            {complex.areaTypes.length === 0 && <Badge tone="warn">평형 없음</Badge>}
            {complex.photos.length === 0 && <Badge tone="warn">사진 없음</Badge>}
          </h2>
          <p className={styles.headSub}>
            {address ?? '주소 미입력'}
            {facts.length > 0 && ` · ${facts.join(' · ')}`}
          </p>
        </div>
        <div className={styles.headActions}>
          <Button
            variant="secondary"
            href={`${env.siteUrl}/complex/${complex.id}`}
            target="_blank"
            rel="noopener noreferrer"
            iconLeft={<Icon name="external-link" size={18} />}
          >
            사용자 화면에서 보기
          </Button>
          {can(AdminRole.ADMIN) && (
            <Button
              variant="ghost"
              className={s.dangerText}
              iconLeft={<Icon name="trash" size={18} />}
              onClick={() => setConfirmDelete(true)}
            >
              단지 삭제
            </Button>
          )}
        </div>
      </div>

      <Tabs<Tab>
        label="단지 정보 종류"
        idBase={TAB_BASE}
        value={tab}
        onChange={(next) => setUrl({ tab: next })}
        items={[
          {
            value: 'facts',
            label: (
              <>
                기본 정보
                {dirty && (
                  <span
                    className={styles.dirtyDot}
                    role="img"
                    aria-label="저장하지 않은 변경 있음"
                  />
                )}
              </>
            ),
          },
          { value: 'areas', label: '평형', count: complex.areaTypes.length },
          { value: 'photos', label: '사진', count: complex.photos.length },
        ]}
      />

      <div className={s.split}>
        <div className={s.stackLg}>
          {/* The facts form stays mounted so unsaved edits survive a look at the other tabs. */}
          <div
            role="tabpanel"
            id={`${TAB_BASE}-panel-facts`}
            aria-labelledby={`${TAB_BASE}-tab-facts`}
            hidden={tab !== 'facts'}
          >
            <ComplexFactsForm complex={complex} onDirtyChange={setDirty} />
          </div>
          {tab === 'areas' && (
            <div
              role="tabpanel"
              id={`${TAB_BASE}-panel-areas`}
              aria-labelledby={`${TAB_BASE}-tab-areas`}
              className={s.stackLg}
            >
              <AreaTypesPanel complex={complex} onChanged={refetch} />
            </div>
          )}
          {tab === 'photos' && (
            <div
              role="tabpanel"
              id={`${TAB_BASE}-panel-photos`}
              aria-labelledby={`${TAB_BASE}-tab-photos`}
              className={s.stackLg}
            >
              <PhotosPanel complex={complex} onChanged={refetch} />
            </div>
          )}
        </div>
        <Summary complex={complex} />
      </div>

      {complex.activeListingCount > 0 ? (
        // Deleting would only fail with COMPLEX_HAS_LISTINGS — say so instead of offering a 삭제 button.
        <Modal
          open={confirmDelete}
          onClose={() => setConfirmDelete(false)}
          title="이 단지는 지금 삭제할 수 없어요"
          description={`게시 중인 매물 ${formatCount(complex.activeListingCount)}건이 연결되어 있어요. 매물이 모두 거래 완료되거나 내려간 뒤에 삭제할 수 있어요.`}
          footer={
            <Button variant="secondary" onClick={() => setConfirmDelete(false)}>
              확인
            </Button>
          }
        />
      ) : (
        <ConfirmDialog
          open={confirmDelete}
          onClose={() => setConfirmDelete(false)}
          onConfirm={() => remove.mutate()}
          title={`${complex.name} 단지를 삭제할까요?`}
          description="평형, 사진, 연결된 실거래가 정보가 함께 삭제되고 되돌릴 수 없어요."
          confirmLabel="삭제"
          danger
          loading={remove.isPending}
        />
      )}
    </>
  );
}

/** 단지 등록: the facts form; after saving the operator lands on the 평형 tab of the new complex. */
export function ComplexCreateView() {
  const router = useRouter();
  const { toast } = useToast();
  return (
    <>
      <AdminPageHeader title="단지 등록" crumb={CRUMB} />
      <BackLink linkAs={Link} href={ADMIN_ROUTES.complexes}>
        단지 목록
      </BackLink>
      <Callout size="sm" tone="info">
        기본 정보를 먼저 등록한 뒤 평형과 사진을 추가해요. 실거래가는 다음 동기화 때 국토부 단지
        코드와 지번으로 연결돼요.
      </Callout>
      <ComplexFactsForm
        onSaved={(saved) => {
          toast('단지를 등록했어요. 이어서 평형을 추가해 주세요.');
          router.replace(`${ADMIN_ROUTES.complexes}/${saved.id}?tab=areas`);
        }}
      />
    </>
  );
}
