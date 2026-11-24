import { ASSET_TYPE_LABEL, type AssetType } from '@house/shared';
import { AgencyLogo, Button, Icon } from '@house/ui';
import Image from 'next/image';
import Link from 'next/link';
import { ROUTES } from '@/config/nav';
import { formatCount } from '@/lib/format/number';
import { agencyStats, type AgencyItem } from '../../api/schemas';
import { imageProps } from '../../lib/media';
import { SectionHeader } from '../SectionHeader';
import styles from './Agencies.module.css';

/** "신대 레이크파크 단지 전문" when the API sends a tagline, else derived from the specialties. */
export function agencyTag(a: Pick<AgencyItem, 'tagline' | 'specialties'>): string | null {
  if (a.tagline) return a.tagline;
  const labels = a.specialties
    .map((s) => ASSET_TYPE_LABEL[s as AssetType])
    .filter(Boolean)
    .slice(0, 2);
  return labels.length ? `${labels.join('·')} 전문` : null;
}

export interface AgenciesSectionProps {
  agencies: readonly AgencyItem[];
  /** Total approved offices on the platform (`GET /home/summary`). */
  total?: number | null;
}

/**
 * "함께하는 중개사무소": partner offices strip linking to the office pages and the office search.
 * Renders nothing when the list is empty (new platform / API unavailable).
 */
export function AgenciesSection({ agencies, total }: AgenciesSectionProps) {
  if (agencies.length === 0) return null;
  return (
    <section className={styles.section} aria-labelledby="home-agency-h">
      <div className="container">
        <SectionHeader
          id="home-agency-h"
          title={
            <>
              함께하는 중개사무소
              {typeof total === 'number' && total > 0 && (
                <>
                  {' '}
                  <span className={styles.hl}>{formatCount(total)}</span>곳
                </>
              )}
            </>
          }
          caption="순천 공인중개사가 직접 등록하고, 현장에서 실매물을 확인합니다"
          actions={
            <div className={styles.actions}>
              <Button href={ROUTES.agentApply} linkAs={Link} variant="secondary">
                중개사 회원 가입
              </Button>
              <Button
                href={ROUTES.agencies}
                linkAs={Link}
                iconRight={<Icon name="arrow-right" size={18} />}
              >
                중개사무소 찾기
              </Button>
            </div>
          }
        />
        <ul className={styles.grid}>
          {agencies.map((a) => {
            const tag = agencyTag(a);
            const stats = agencyStats(a);
            return (
              <li key={a.id} className={styles.item}>
                <Link href={ROUTES.agency(a.id)} className={styles.card}>
                  <AgencyLogo
                    name={a.name}
                    seed={a.id}
                    size={64}
                    image={
                      a.logoUrl ? (
                        <Image {...imageProps(a.logoUrl)} alt="" fill sizes="64px" loading="lazy" />
                      ) : undefined
                    }
                  />
                  <span className={styles.main}>
                    {tag && (
                      <span className={styles.tag}>
                        <Icon name="star" size={14} />
                        {tag}
                      </span>
                    )}
                    <b className={styles.name}>{a.name}</b>
                    {a.representativeName && (
                      <span className={styles.meta}>대표 공인중개사 {a.representativeName}</span>
                    )}
                    <span className={styles.stats}>
                      <span>
                        매물 <b>{formatCount(a.activeListingCount)}</b>
                      </span>
                      {stats.deals30d !== null && (
                        <span>
                          30일 거래 <b>{formatCount(stats.deals30d)}</b>
                        </span>
                      )}
                      {stats.avgResponseMinutes !== null && (
                        <span>
                          평균 응답 <b>{formatCount(Math.round(stats.avgResponseMinutes))}분</b>
                        </span>
                      )}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
