'use client';
import { Icon, PhotoPlaceholder, Skeleton } from '@house/ui';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { ROUTES } from '@/config/nav';
import { dealApi, dealKeys } from '../api/client';
import type { PickedAgency } from '../lib/form-common';
import styles from './form/form.module.css';

/** Reach of an "all agencies" request for the given region codes (shared by ReachCard and ScopeFields). */
export function useReach(regionCodes: readonly string[]) {
  const query = { regionCodes: [...regionCodes], pageSize: 3 };
  return useQuery({
    queryKey: dealKeys.targets(query),
    queryFn: ({ signal }) => dealApi.targetAgencies(query, signal),
    // Without a region there is nothing to count yet.
    enabled: regionCodes.length > 0,
    placeholderData: (prev) => prev,
    staleTime: 5 * 60_000,
  });
}

export interface ReachCardProps {
  regionCodes: readonly string[];
  /** SELECTED_AGENCIES: the picked offices are listed instead of the regional reach. */
  selected?: readonly PickedAgency[] | null;
  /** 내놓기 → "매물 주소 근처", 구하기 → "희망 지역". */
  kind: 'sell' | 'find';
}

/** Ink aside card "몇 곳의 중개사가 받나요?" (design `.dr-reach`). */
export function ReachCard({ regionCodes, selected, kind }: ReachCardProps) {
  const { data, isLoading, isError, refetch } = useReach(regionCodes);
  const picked = selected ?? null;
  const hasRegion = regionCodes.length > 0;
  const count = picked ? picked.length : hasRegion ? data?.total : undefined;
  const isPending = isLoading;
  const rest = picked ? 0 : Math.max(0, (data?.total ?? 0) - (data?.items.length ?? 0));

  return (
    <section className={styles.reach} aria-labelledby="deal-reach-t">
      <h2 id="deal-reach-t" className={styles.reachQ}>
        몇 곳의 중개사가 받나요?
      </h2>
      <p className={styles.reachN} aria-live="polite">
        {count === undefined ? (
          isError || !hasRegion ? (
            <>
              <b className="num">–</b>곳
            </>
          ) : (
            <Skeleton width={72} height={48} radius={12} className={styles.reachSk} />
          )
        ) : (
          <>
            <b className="num">{count}</b>곳
          </>
        )}
      </p>
      <p className={styles.reachD}>
        {picked ? (
          <>직접 고른 중개사무소에만 전달돼요. 다른 중개사무소에는 요청이 보이지 않아요.</>
        ) : kind === 'sell' ? (
          <>
            {hasRegion
              ? `매물 주소 근처${data?.areaLabel ? `, ${data.areaLabel}에서` : '에서'} 활동하는`
              : '주소를 입력하면 그 주변에서 활동하는'}{' '}
            중개사무소에 동시에 전달돼요. 여러 곳이 같은 매물을 올려도 사이트에는 <b>1건</b>으로만
            보여요.
          </>
        ) : (
          <>
            {hasRegion
              ? `희망 지역${data?.areaLabel ? `(${data.areaLabel})` : ''}에서 활동하는`
              : '지역을 고르면 그곳에서 활동하는'}{' '}
            중개사무소에 동시에 전달돼요. 아직 광고하지 않은 매물도 <b>먼저</b> 제안받을 수 있어요.
          </>
        )}
      </p>
      {picked ? (
        picked.length > 0 && (
          <ul className={styles.reachList}>
            {picked.map((a) => (
              <li key={a.id}>
                <span className={styles.reachPh}>
                  <PhotoPlaceholder kind="office" />
                </span>
                <span className={styles.reachT}>
                  <b>{a.name}</b>
                  {a.specialty && <span>{a.specialty}</span>}
                </span>
                <span />
              </li>
            ))}
          </ul>
        )
      ) : !hasRegion ? null : isError ? (
        <p className={styles.reachErr} role="alert">
          중개사무소 정보를 불러오지 못했어요.{' '}
          <button type="button" onClick={() => void refetch()}>
            다시 시도
          </button>
        </p>
      ) : (
        <>
          <ul className={styles.reachList} aria-busy={isPending}>
            {isPending
              ? [0, 1, 2].map((i) => (
                  <li key={i} aria-hidden="true">
                    <Skeleton width={40} height={40} radius={10} className={styles.reachSk} />
                    <Skeleton width="70%" height={14} className={styles.reachSk} />
                    <Skeleton width={36} height={14} className={styles.reachSk} />
                  </li>
                ))
              : (data?.items ?? []).map((a) => (
                  <li key={a.id}>
                    <span className={styles.reachPh}>
                      <PhotoPlaceholder kind="office" />
                    </span>
                    <span className={styles.reachT}>
                      <b>{a.name}</b>
                      {a.specialty && <span>{a.specialty}</span>}
                    </span>
                    {typeof a.avgResponseMinutes === 'number' && (
                      <span className={styles.reachR}>
                        평균 응답
                        <b className="num">{a.avgResponseMinutes}분</b>
                      </span>
                    )}
                  </li>
                ))}
          </ul>
          {!isPending && (
            <p className={styles.reachMore}>
              {rest > 0 ? `외 ${rest}곳 · ` : ''}
              <Link href={ROUTES.agencies}>중개사무소 전체 보기</Link>
            </p>
          )}
        </>
      )}
      <p className={styles.reachFoot}>
        <Icon name="shield" size={16} />
        <span>
          승인된 중개사무소 회원만 요청을 받을 수 있고, 연락처는 내가 동의한 곳에만 공개돼요.
        </span>
      </p>
    </section>
  );
}
