'use client';
import { ASSET_TYPE_LABEL, DEAL_TYPE_LABEL, LISTING_OPTION_LABEL } from '@house/shared';
import { Badge, DealBadge, Icon, cx, photoKindForAsset, useToast } from '@house/ui';
import Link from 'next/link';
import { useMemo, type MouseEvent } from 'react';
import { ROUTES } from '@/config/nav';
import { AGENT_ROUTES } from '@/features/a-agency/nav';
import { BrokersCard } from '@/features/w-listing/components/BrokersCard';
import { DescriptionSection } from '@/features/w-listing/components/DescriptionSection';
import { FactsSection } from '@/features/w-listing/components/FactsSection';
import { Gallery } from '@/features/w-listing/components/Gallery';
import { Glyph, OPTION_META } from '@/features/w-listing/components/icons';
import { ListingInteractions } from '@/features/w-listing/components/ListingInteractions';
import { LocationSection } from '@/features/w-listing/components/LocationSection';
import page from '@/features/w-listing/components/page.module.css';
import {
  addressLine,
  descriptionParagraphs,
  headlinePrice,
  listingName,
  listingSubtitle,
  mapHref as listingMapHref,
} from '@/features/w-listing/lib/view';
import { formatDateShort, formatPhone, toKstDateString } from '@/lib/format';
import { buildPreviewDetail, missingAgencyDisclosure } from '../lib/preview';
import { previewAllows, previewControlOf } from '../lib/preview-guard';
import { useRequirements } from './Checklist';
import { useWizard } from './context';
import styles from './wizard.module.css';

/**
 * Step 7 — the listing exactly as visitors will see it: rendered with the public listing page's own
 * components (gallery, facts + 명시사항, description, options, 공동중개 사무소 disclosure, location)
 * from a payload shaped like `GET /listings/:id`. 호수 and (when chosen) the exact floor are absent,
 * just like in the public API.
 */
export function StepPreview() {
  const { listing, complex, photos, verifications, agencies, goToField, goToStep } = useWizard();
  const { payload, requirements, done, total } = useRequirements();
  const { toast } = useToast();
  const missing = requirements.filter((r) => !r.done);

  const detail = useMemo(
    () =>
      buildPreviewDetail(payload, {
        listing,
        complex,
        photos,
        verifications,
        agencies,
        today: toKstDateString(),
      }),
    [payload, listing, complex, photos, verifications, agencies],
  );

  const primary = agencies.find((a) => a.isPrimary) ?? agencies[0];
  const officeMissing = missingAgencyDisclosure(primary);
  const price = headlinePrice(detail);
  const name = listingName(detail);
  const subtitle = listingSubtitle(detail);
  const title = [name, detail.property.dong].filter(Boolean).join(' ');
  const paragraphs = descriptionParagraphs(detail.description);

  // Live actions (관심·문의·신고·공유) and links that would leave the wizard do nothing here.
  const guard = (e: MouseEvent<HTMLDivElement>) => {
    const control = previewControlOf(e.target);
    if (!control || !e.currentTarget.contains(control) || previewAllows(control)) return;
    e.preventDefault();
    e.stopPropagation();
    toast({ message: '미리보기 화면이라 링크와 버튼은 동작하지 않아요.', tone: 'info' });
  };

  return (
    <>
      <div className={styles.previewTop}>
        <section className={styles.readyCard} aria-labelledby="pv-ready">
          <h3 id="pv-ready">
            <Icon name="shield" size={18} />
            표시·광고 명시사항{' '}
            <span className="num">
              {done} / {total}
            </span>
          </h3>
          {missing.length === 0 ? (
            <p className={styles.readyOk}>
              <Icon name="check-circle" size={18} />
              필수 표시사항을 모두 입력했어요. 아래 화면을 확인하고 게시해 주세요.
            </p>
          ) : (
            <>
              <p className={cx(styles.readyOk, styles.readyWarn)}>
                <Icon name="alert" size={18} />
                아래 {missing.length}개 항목을 입력해야 게시할 수 있어요. 누르면 해당 칸으로
                이동해요.
              </p>
              <ul className={styles.missing}>
                {missing.map((r) => (
                  <li key={r.field}>
                    <button
                      type="button"
                      className={styles.missingBtn}
                      onClick={() => goToField(r.formField)}
                    >
                      {r.label}
                      <Icon name="chevron-right" size={14} />
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
          {photos.length === 0 && (
            <p className={cx(styles.readyOk, styles.readyWarn)}>
              <Icon name="image" size={18} />
              <span>
                사진이 없어요.{' '}
                <button type="button" className="link" onClick={() => goToStep(3)}>
                  사진 올리기
                </button>
              </span>
            </p>
          )}
          {verifications.length === 0 && (
            <p className={cx(styles.readyOk, styles.readyWarn)}>
              <Icon name="info" size={18} />
              <span>
                실매물 확인 기록이 없어요.{' '}
                <button type="button" className="link" onClick={() => goToStep(5)}>
                  확인 기록하기
                </button>
              </span>
            </p>
          )}
        </section>

        <section className={styles.readyCard} aria-labelledby="pv-office">
          <h3 id="pv-office">
            <Icon name="store" size={18} />
            함께 표시되는 중개사무소 정보
          </h3>
          {primary ? (
            <dl className={styles.office}>
              <dt>명칭</dt>
              <dd>{primary.name}</dd>
              <dt>소재지</dt>
              <dd>{[primary.roadAddress, primary.addressDetail].filter(Boolean).join(', ')}</dd>
              <dt>연락처</dt>
              <dd className="num">{formatPhone(primary.phone)}</dd>
              <dt>등록번호</dt>
              <dd className="num">{primary.registrationNumber}</dd>
              <dt>대표자</dt>
              <dd>{primary.representativeName}</dd>
            </dl>
          ) : (
            <p className={cx(styles.readyOk, styles.readyWarn)}>
              <Icon name="alert" size={18} />
              사무소 정보를 불러오지 못했어요. 게시할 때 서버에서 다시 확인해요.
            </p>
          )}
          {primary && officeMissing.length > 0 && (
            <p className={cx(styles.readyOk, styles.readyWarn)}>
              <Icon name="alert" size={18} />
              <span>
                {officeMissing.join(' · ')} 정보가 비어 있어요.{' '}
                <Link className="link" href={AGENT_ROUTES.profile}>
                  사무소 프로필에서 입력
                </Link>
              </span>
            </p>
          )}
          <p className={styles.help}>
            공인중개사법 제18조의2에 따라 사무소의 명칭·소재지·연락처·등록번호와 개업공인중개사의
            성명이 매물과 함께 표시돼요.
          </p>
        </section>
      </div>

      <div className={styles.frame} data-preview-frame="" onClickCapture={guard}>
        <div className={styles.frameBar}>
          <Icon name="eye" size={16} />
          <b>미리보기</b>
          <span>방문자에게 보이는 화면이에요 · 버튼은 동작하지 않아요</span>
          <span className={styles.frameUrl}>
            {listing && listing.status !== 'DRAFT'
              ? ROUTES.listing(listing.id)
              : '게시하면 공개 주소가 생겨요'}
          </span>
        </div>
        <ListingInteractions listing={detail}>
          <div className={styles.frameBody}>
            <Gallery
              photos={detail.photos}
              title={title}
              shotLabel={null}
              placeholder={photoKindForAsset(detail.assetType)}
              backHref={AGENT_ROUTES.listings}
            />
            <div className={styles.pvCols}>
              <article className={styles.pvMain} aria-label="매물 정보 미리보기">
                <header className={page.head}>
                  <div className={page.badges}>
                    <DealBadge deal={price.kind} solid>
                      {DEAL_TYPE_LABEL[detail.dealType]}
                    </DealBadge>
                    <Badge>{ASSET_TYPE_LABEL[detail.assetType]}</Badge>
                    {detail.verifiedAt && (
                      <span className={page.verified}>
                        <Icon name="check-circle" size={14} />
                        실매물 확인 {formatDateShort(detail.verifiedAt)}
                      </span>
                    )}
                    {detail.agencies.length > 1 && (
                      <span className={page.brokers}>
                        <Icon name="users" size={14} />
                        중개사 {detail.agencies.length}곳 공동중개
                      </span>
                    )}
                  </div>
                  <div className={page.titleBox}>
                    <h2 className={cx('t-h1', page.title)}>
                      {name || '매물 이름'}
                      {subtitle && (
                        <>
                          {' '}
                          <span className={page.titleSub}>{subtitle}</span>
                        </>
                      )}
                    </h2>
                    <p className={page.addr}>
                      <span className={page.addrT}>
                        <Icon name="map-pin" size={16} />
                        <span>{addressLine(detail) || '소재지를 입력해 주세요'}</span>
                      </span>
                    </p>
                  </div>
                  <div className={page.price}>
                    <div className={page.priceMain}>
                      <span className={cx(page.priceK, `t-${price.kind}`)}>{price.label}</span>
                      <p className={cx('price', 'price-xl', page.priceV)}>
                        {price.text}
                        {price.unit && <span className="unit">{price.unit}</span>}
                      </p>
                      {price.note && <span className={page.priceNote}>{price.note}</span>}
                    </div>
                  </div>
                </header>

                <FactsSection listing={detail} />
                <DescriptionSection
                  paragraphs={paragraphs}
                  highlights={detail.highlights}
                  byline={primary ? `${primary.name} 작성` : null}
                />
                {detail.options.length > 0 && (
                  <section className={page.sec} aria-labelledby="pv-opt">
                    <div className={page.secHd}>
                      <h2 className={page.secT} id="pv-opt">
                        옵션 <span className={cx(page.secN, 'num')}>{detail.options.length}</span>
                      </h2>
                    </div>
                    <ul className={page.opts}>
                      {detail.options.map((o) => (
                        <li key={o} className={page.opt}>
                          <span className={page.optIc}>
                            <Glyph name={OPTION_META[o].glyph} size={22} />
                          </span>
                          <span className={page.optT}>
                            <b>{LISTING_OPTION_LABEL[o]}</b>
                            <span>{OPTION_META[o].group}</span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}
                {detail.property.roadAddress && (
                  <LocationSection
                    center={{ lat: detail.property.lat, lng: detail.property.lng }}
                    address={detail.property.roadAddress}
                    markerTitle={title}
                    shortTitle={detail.property.dong}
                    dealLabel={DEAL_TYPE_LABEL[detail.dealType]}
                    priceText={price.text}
                    nearby={[]}
                    mapHref={listingMapHref(detail)}
                  />
                )}
              </article>
              <aside className={styles.pvSide} aria-label="중개사무소 표시 미리보기">
                <BrokersCard agencies={detail.agencies} idPrefix="pv" />
              </aside>
            </div>
          </div>
        </ListingInteractions>
      </div>
    </>
  );
}
