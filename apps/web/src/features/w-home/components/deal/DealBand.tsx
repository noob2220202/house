import { Button, Icon, StatusPill } from '@house/ui';
import Link from 'next/link';
import { ROUTES } from '@/config/nav';
import styles from './DealBand.module.css';

const SELL_STEPS = [
  { title: '매물 정보 남기기', text: '주소 · 희망 가격 · 입주 가능일만 남기면 돼요' },
  { title: '동네 중개사 제안 받기', text: '그 단지를 잘 아는 중개사무소가 먼저 연락드려요' },
  { title: '내가 고른 곳과 거래', text: '연락처는 선택한 중개사무소에만 공개돼요' },
];

/**
 * Illustrative 구하기 request — the inputs of a request (marked "요청 예시"), not user data and not
 * a market figure: no 단지 and no price.
 */
const REQUEST_EXAMPLE = [
  { field: '지역', value: '신대지구' },
  { field: '거래', value: '매매' },
  { field: '면적', value: '34평' },
  { field: '금액', value: '원하는 예산 이하' },
];

export interface DealBandProps {
  /** Approved offices of the site (GET /home/summary agencyCount); null hides the reach line. */
  agencyCount?: number | null;
}

/** 내놓기 / 구하기 band (desktop & tablet; the mobile home uses <DealQuick /> instead). */
export function DealBand({ agencyCount = null }: DealBandProps) {
  const reach = typeof agencyCount === 'number' && agencyCount > 0 ? agencyCount : null;
  const reachText = reach === null ? null : `순천 중개사무소 ${reach.toLocaleString('ko-KR')}곳`;
  return (
    <section className={`only-lg ${styles.section}`} aria-label="내놓기와 구하기">
      <div className={`container ${styles.band}`}>
        <article className={`${styles.card} ${styles.sell}`}>
          <div className={styles.head}>
            <span className={styles.icon}>
              <Icon name="home-up" size={28} />
            </span>
            <p className={styles.kicker}>내놓기</p>
            <h2 className={styles.title}>집을 내놓을 생각이 있나요?</h2>
            <p className={styles.lead}>한 번 등록하면 동네 중개사무소가 먼저 연락드려요.</p>
          </div>
          <ol className={styles.steps}>
            {SELL_STEPS.map((s, i) => (
              <li key={s.title}>
                <span className={styles.no} aria-hidden="true">
                  {i + 1}
                </span>
                <span className={styles.step}>
                  <b>{s.title}</b>
                  <span>{s.text}</span>
                </span>
              </li>
            ))}
          </ol>
          <Button
            href={ROUTES.dealSell}
            linkAs={Link}
            size="lg"
            className={styles.cta}
            iconRight={<Icon name="arrow-right" size={20} />}
          >
            내놓기 시작하기
          </Button>
        </article>

        <article className={`${styles.card} ${styles.find}`}>
          <div className={styles.head}>
            <span className={styles.icon}>
              <Icon name="home-search" size={28} />
            </span>
            <p className={styles.kicker}>구하기</p>
            <h2 className={styles.title}>찾는 조건의 집이 없나요?</h2>
            <p className={styles.lead}>조건을 남기면 맞는 매물을 가진 중개사가 제안해요.</p>
          </div>
          <div
            className={styles.req}
            role="img"
            aria-label={`구하기 요청 예시: 신대지구, 매매, 34평, 원하는 예산 이하 조건으로 요청하면 ${
              reachText ? `${reachText}에 한 번에 전달되고 ` : ''
            }조건에 맞는 매물을 중개사가 제안합니다`}
          >
            <div className={styles.reqHead} aria-hidden="true">
              <b>요청 예시</b>
              <StatusPill tone="scheduled">제안을 받아요</StatusPill>
            </div>
            <div className={styles.reqChips} aria-hidden="true">
              {REQUEST_EXAMPLE.map((c) => (
                <span key={c.field} className={styles.reqChip}>
                  <span>{c.field}</span>
                  <b>{c.value}</b>
                </span>
              ))}
            </div>
            {reachText && (
              <div className={styles.reqTo} aria-hidden="true">
                <span className={styles.avatars}>
                  <i>
                    <Icon name="building" size={16} />
                  </i>
                </span>
                <span>
                  <b>{reachText}</b>에 한 번에 전달돼요
                </span>
              </div>
            )}
          </div>
          <Button
            href={ROUTES.dealFind}
            linkAs={Link}
            size="lg"
            className={styles.cta}
            iconRight={<Icon name="arrow-right" size={20} />}
          >
            구하기 요청 남기기
          </Button>
        </article>
      </div>
    </section>
  );
}
