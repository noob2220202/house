import { Button, Icon } from '@house/ui';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { ROUTES } from '@/config/nav';
import { FindArt, SellArt } from './art';
import { DraftCta, DraftPill } from './DraftResume';
import styles from './intro.module.css';

const TRUST = ['등록·이용 무료', '연락처는 동의 후 공개', '언제든 요청 중단'];

function Bullets({ items }: { items: readonly string[] }) {
  return (
    <ul className={styles.bul}>
      {items.map((text) => (
        <li key={text}>
          <Icon name="check-circle" size={18} />
          {text}
        </li>
      ))}
    </ul>
  );
}

/** Hero: breadcrumb, headline and the two entry cards (내 집 내놓기 / 원하는 집 구하기). */
export function DealHero({ crumb }: { crumb?: ReactNode }) {
  return (
    <section className={styles.hero} aria-labelledby="deal-title">
      <div className={`container ${styles.heroIn}`}>
        {crumb}
        <div className={styles.heroHead}>
          <div className={styles.heroTitleWrap}>
            <p className="eyebrow">내놓기 · 구하기</p>
            <h1 id="deal-title" className={`t-display ${styles.heroTitle}`}>
              집 내놓을 때도, 구할 때도
              <br />
              <span className={styles.hl}>순천 중개사가 먼저</span> 연락드려요
            </h1>
          </div>
          <div className={styles.heroSide}>
            <p className="t-body">
              한 번만 등록하면 우리 동네 공인중개사무소가 직접 확인하고 연락해요. 여러 곳을 돌며
              같은 설명을 반복하지 않아도 돼요.
            </p>
            <ul className={styles.trust}>
              {TRUST.map((text) => (
                <li key={text}>
                  <Icon name="check" size={18} />
                  {text}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className={styles.choices}>
          <article className={`${styles.choice} ${styles.ink}`} aria-labelledby="deal-sell-t">
            <div className={styles.choiceBody}>
              <div className={styles.choiceTop}>
                <span className={styles.choiceIc}>
                  <Icon name="home-up" size={26} />
                </span>
                <DraftPill kind="sell" />
              </div>
              <div className={styles.choiceText}>
                <p className={styles.who}>집주인 · 임대인</p>
                <h2 id="deal-sell-t" className={styles.choiceT}>
                  내 집 내놓기
                </h2>
                <p className={styles.choiceD}>매물을 등록하면 지역 중개사가 연락드려요</p>
              </div>
              <Bullets
                items={[
                  '주소만 넣으면 단지·면적 정보 자동 입력',
                  '매물 근처 중개사무소에 한 번에 전달',
                  '제안을 비교하고 맡길 곳은 직접 선택',
                ]}
              />
              <div className={styles.choiceFt}>
                <DraftCta
                  kind="sell"
                  href={ROUTES.dealSell}
                  label="내놓기 시작하기"
                  variant="primary"
                />
              </div>
            </div>
            <div className={styles.art}>
              <SellArt />
            </div>
          </article>

          <article className={styles.choice} aria-labelledby="deal-find-t">
            <div className={styles.choiceBody}>
              <div className={styles.choiceTop}>
                <span className={styles.choiceIc}>
                  <Icon name="home-search" size={26} />
                </span>
                <DraftPill kind="find" />
              </div>
              <div className={styles.choiceText}>
                <p className={styles.who}>매수인 · 임차인</p>
                <h2 id="deal-find-t" className={styles.choiceT}>
                  원하는 집 구하기
                </h2>
                <p className={styles.choiceD}>조건을 등록하면 맞춤 매물을 제안받아요</p>
              </div>
              <Bullets
                items={[
                  '지역 · 평형 · 예산만 고르면 끝',
                  '아직 올라오지 않은 매물도 먼저 제안',
                  '마음에 드는 제안에만 답장',
                ]}
              />
              <div className={styles.choiceFt}>
                <DraftCta
                  kind="find"
                  href={ROUTES.dealFind}
                  label="구하기 시작하기"
                  variant="secondary"
                />
              </div>
            </div>
            <div className={`${styles.art} ${styles.artMap}`}>
              <FindArt />
              <div className={styles.req}>
                <span className={styles.reqK}>요청 예시</span>
                <span className={styles.reqV}>
                  신대지구 · 매매 · 34평
                  <br />
                  원하는 예산 이하
                </span>
              </div>
              <div className={styles.note}>
                <Icon name="bell" size={16} />
                <span>
                  <b>새 제안</b>이 오면 알려 드려요
                </span>
              </div>
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}

const ScaleIcon = (
  <svg
    width={22}
    height={22}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.75}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M12 4v16M7.5 20h9" />
    <path d="M5 8h14" />
    <path d="m5 8-2.5 6a2.5 2.5 0 0 0 5 0zM19 8l-2.5 6a2.5 2.5 0 0 0 5 0z" />
  </svg>
);

const HOW: readonly { n: string; icon: ReactNode; title: string; body: string; chip: string }[] = [
  {
    n: '01',
    icon: <Icon name="edit" size={22} />,
    title: '등록',
    body: '매물 또는 원하는 조건을 입력해요. 주소로 단지 정보가 채워져요.',
    chip: '주소만 넣으면 자동 입력',
  },
  {
    n: '02',
    icon: <Icon name="users" size={22} />,
    title: '중개사 확인·제안',
    body: '지역 중개사가 내용을 확인하고 시세·조건에 맞춰 제안을 보내거나 매물을 추천해요.',
    chip: '연락처는 동의 후 공개',
  },
  {
    n: '03',
    icon: ScaleIcon,
    title: '비교 후 선택',
    body: '받은 제안을 나란히 비교하고, 맡길 곳을 한 곳 또는 여러 곳 고르세요.',
    chip: '선택 전까지 무료',
  },
];

/** "이렇게 진행돼요" — three steps shared by 내놓기 and 구하기. */
export function DealHowItWorks() {
  return (
    <section className={styles.how} aria-labelledby="deal-how-t">
      <div className="container">
        <div className={styles.howBox}>
          <div className={styles.howHd}>
            <h2 id="deal-how-t" className={styles.howH}>
              이렇게 진행돼요
            </h2>
            <p className="t-sm">
              내놓기와 구하기 모두 <br className="only-lg" />
              같은 순서로 진행돼요.
            </p>
          </div>
          <ol className={styles.steps}>
            {HOW.map((s, i) => (
              <li key={s.n} className={styles.step}>
                <div className={styles.stepTop}>
                  <span className={styles.stepN}>{s.n}</span>
                  <span className={styles.stepIc}>{s.icon}</span>
                  {i < HOW.length - 1 && (
                    <span className={styles.stepArrow} aria-hidden="true">
                      <Icon name="arrow-right" size={16} />
                    </span>
                  )}
                </div>
                <h3 className={styles.stepT}>{s.title}</h3>
                <p className="t-sm">{s.body}</p>
                <span className={styles.stepM}>{s.chip}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

export const DEAL_FAQ: readonly { q: string; a: string }[] = [
  {
    q: '내놓기·구하기에 비용이 드나요?',
    a: '등록과 이용은 모두 무료예요. 거래가 성사되면 계약한 중개사무소에 중개보수만 내면 되고, 금액은 지방자치단체 조례가 정한 상한 요율을 넘지 않아요.',
  },
  {
    q: '여러 중개사가 연락하면 번거롭지 않나요?',
    a: '제안은 사이트 알림으로 먼저 도착하고, 연락처는 내가 동의한 중개사무소에만 공개돼요. 마음에 드는 중개사를 고른 뒤에는 요청을 종료해 나머지 제안을 한 번에 멈출 수 있어요.',
  },
  {
    q: '등록한 매물은 언제 사이트에 보이나요?',
    a: '내놓기 요청 자체는 공개되지 않아요. 중개사가 현장을 확인하고 의뢰를 받으면 그때 실매물 확인 날짜와 함께 매물로 올라가요.',
  },
  {
    q: '동·호수 같은 상세 주소도 중개사에게 보이나요?',
    a: '아니요. 연락처와 도로명 주소·동·호수·층·정확한 면적·사진·설명은 내가 연락처 공개에 동의한 중개사무소만 볼 수 있어요. 그 전에는 읍면동·단지명, 면적 구간, 희망 가격 같은 기본 조건과 약 200m 단위의 대략적인 위치만 전달돼요.',
  },
];

/** FAQ block (native <details> accordion; the first item is open). */
export function DealFaq() {
  return (
    <section className={styles.faq} aria-labelledby="deal-faq-t">
      <div className={`container ${styles.faqIn}`}>
        <div className={styles.faqHd}>
          <p className="eyebrow">FAQ</p>
          <h2 id="deal-faq-t" className="t-h2">
            자주 묻는 질문
          </h2>
          <p className="t-sm">더 궁금한 점은 전체 자주 묻는 질문에서 찾아보세요.</p>
          {/* 고객센터 (/support) has no page yet — link it here once it exists. */}
          <div className={styles.faqActions}>
            <Button
              href={ROUTES.faq}
              linkAs={Link}
              variant="secondary"
              iconRight={<Icon name="chevron-right" size={18} />}
            >
              전체 FAQ 보기
            </Button>
          </div>
        </div>
        <div className={styles.acc}>
          {DEAL_FAQ.map((item, i) => (
            <details key={item.q} className={styles.accI} open={i === 0}>
              <summary>
                <span>{item.q}</span>
                <span className={styles.accIc}>
                  <Icon name="chevron-down" size={18} />
                </span>
              </summary>
              <p className="t-body">
                {item.a}
                {i === 0 && (
                  <>
                    {' '}
                    미리 계산해 보고 싶다면{' '}
                    <Link className="link" href={`${ROUTES.tools}#fee`}>
                      중개보수 계산기
                    </Link>
                    를 이용해 보세요.
                  </>
                )}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
