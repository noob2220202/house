import {
  ASSET_TYPE_LABEL,
  DEAL_TYPE_LABEL,
  DealRequestType,
  DealRequestVisibility,
} from '@house/shared';
import {
  Button,
  DealBadge,
  Icon,
  PhotoPlaceholder,
  dealKindOf,
  photoKindForAsset,
  type IconName,
} from '@house/ui';
import Image from 'next/image';
import Link from 'next/link';
import { ROUTES } from '@/config/nav';
import { formatDateKorean } from '@/lib/format';
import type { DealRequestDetail } from '../../api/schemas';
import { requestPriceLines, requestSubtitle, requestTitle } from '../../lib/summary';
import styles from './complete.module.css';

const NEXT: readonly { icon: IconName; title: string; body: string }[] = [
  {
    icon: 'bell',
    title: '제안 도착',
    body: '중개사무소가 요청을 확인하고 제안을 보내면 알림으로 알려드려요.',
  },
  {
    icon: 'list',
    title: '제안 비교',
    body: '내 요청 관리에서 받은 제안을 나란히 비교해 보세요.',
  },
  {
    icon: 'phone',
    title: '연락처 공개 · 선택',
    body: '마음에 드는 중개사무소에만 연락처를 공개하고 진행하면 돼요.',
  },
];

/** "요청을 등록했어요" — shown right after a 내놓기 / 구하기 request is created. */
export function CompleteView({ request }: { request: DealRequestDetail }) {
  const sell = request.type === DealRequestType.SELL_OR_LEASE;
  const price = requestPriceLines(request)[0];
  const cover = request.photos[0]?.variants.thumb?.url;
  const count = request.targetAgencyCount;
  return (
    <section className={styles.sec} aria-labelledby="deal-done-t">
      <div className="container">
        <div className={styles.wrap}>
          <div className={styles.card}>
            <div className={styles.head}>
              <span className={styles.badge} aria-hidden="true">
                <Icon name="check" size={28} />
              </span>
              <p className="eyebrow">{sell ? '내놓기 요청 완료' : '구하기 요청 완료'}</p>
              <h1 id="deal-done-t" className={`t-h1 ${styles.title}`}>
                {count > 0 ? (
                  <>
                    중개사무소 <b className="num">{count}곳</b>에 전달했어요
                  </>
                ) : (
                  '요청을 등록했어요'
                )}
              </h1>
              <p className="t-body">
                {request.visibility === DealRequestVisibility.SELECTED_AGENCIES
                  ? '직접 고른 중개사무소에만 요청이 전달됐어요.'
                  : sell
                    ? '매물 근처에서 활동하는 중개사무소에 요청이 전달됐어요.'
                    : '희망 지역에서 활동하는 중개사무소에 요청이 전달됐어요.'}
                {request.expiresAt && (
                  <> {formatDateKorean(request.expiresAt)}까지 제안을 받을 수 있어요.</>
                )}{' '}
                연락처{sell ? '와 상세 주소' : ''}는 내가 공개에 동의한 중개사무소만 볼 수 있어요.
              </p>
            </div>

            <div className={styles.box}>
              <span className={styles.boxPh}>
                {cover ? (
                  <Image src={cover} alt="" fill sizes="76px" unoptimized />
                ) : (
                  <PhotoPlaceholder kind={photoKindForAsset(request.assetType)} />
                )}
              </span>
              <div className={styles.boxText}>
                <span className={styles.boxTags}>
                  {request.dealTypes.map((d) => (
                    <DealBadge key={d} deal={dealKindOf(d)}>
                      {DEAL_TYPE_LABEL[d]}
                    </DealBadge>
                  ))}
                  <span className="t-cap">{ASSET_TYPE_LABEL[request.assetType]}</span>
                </span>
                <b className={styles.boxName}>{requestTitle(request)}</b>
                <span className="t-cap">{requestSubtitle(request)}</span>
              </div>
              {price && (
                <div className={styles.boxPrice}>
                  <span className="t-cap">{price.label}</span>
                  <span className={`price price-sm ${styles.v}`}>{price.value}</span>
                </div>
              )}
            </div>

            <div>
              <h2 className="t-title" style={{ marginBottom: 12 }}>
                이제 이렇게 진행돼요
              </h2>
              <ol className={styles.next}>
                {NEXT.map((s, i) => (
                  <li key={s.title} className={styles.nextI}>
                    <div className={styles.nextTop}>
                      <span className={styles.nextIc}>
                        <Icon name={s.icon} size={20} />
                      </span>
                      <span className={styles.nextN}>0{i + 1}</span>
                    </div>
                    <h3 className={styles.nextT}>{s.title}</h3>
                    <p className="t-sm">{s.body}</p>
                  </li>
                ))}
              </ol>
            </div>

            <div className={styles.actions}>
              <Button
                href={`${ROUTES.myRequests}/${request.id}`}
                linkAs={Link}
                size="lg"
                iconRight={<Icon name="arrow-right" size={20} />}
              >
                내 요청 확인하기
              </Button>
              <Button href={ROUTES.home} linkAs={Link} size="lg" variant="secondary">
                홈으로
              </Button>
            </div>
          </div>

          <div className={styles.other}>
            <div className={styles.otherT}>
              <b>{sell ? '이사 갈 집도 찾고 있나요?' : '내놓을 집도 있나요?'}</b>
              <span>
                {sell
                  ? '원하는 조건을 등록하면 맞춤 매물을 제안받을 수 있어요.'
                  : '매물을 등록하면 근처 중개사무소에 한 번에 전달돼요.'}
              </span>
            </div>
            <Button
              href={sell ? ROUTES.dealFind : ROUTES.dealSell}
              linkAs={Link}
              variant="secondary"
              iconRight={<Icon name="arrow-right" size={18} />}
            >
              {sell ? '구하기 등록하기' : '내놓기 등록하기'}
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
