'use client';
import { BannerStatus, type PopupPage } from '@house/shared';
import {
  Button,
  Checkbox,
  Chip,
  EmptyState,
  ErrorState,
  Icon,
  Skeleton,
  StatusPill,
  useToast,
} from '@house/ui';
import Link from 'next/link';
import { ADMIN_ROUTES } from '@/config/nav';
import { errorMessage } from '@/lib/api';
import { usePatchPopup, usePopupList } from '../api/hooks';
import { mediaUrl, type AdminPopup } from '../api/schemas';
import { endOfKstDay, isDay, startOfKstDay, toKstDay } from '../lib/dates';
import { formatSize, POPUP_IMAGE_SPEC } from '../lib/image-rules';
import { dismissLabel, POPUP_PAGE_LABEL, POPUP_PAGES, togglePopupPage } from '../lib/popup-form';
import { displayCode, scheduleStatus, STATUS_PILL_LABEL, STATUS_TONE } from '../lib/status';
import styles from './ads.module.css';
import { PopupCard } from './PopupPreview';

/** The popup worth showing first: live → scheduled → anything. */
function featured(popups: readonly AdminPopup[]): AdminPopup | undefined {
  const by = (status: BannerStatus) => popups.find((p) => scheduleStatus(p) === status);
  return by(BannerStatus.ACTIVE) ?? by(BannerStatus.SCHEDULED) ?? popups[0];
}

/** 공지 팝업 quick settings on the banners tab (design `.pp`): period, pages and the dismiss option of the current popup. */
export function PopupQuickPanel() {
  const { toast } = useToast();
  const list = usePopupList();
  const patch = usePatchPopup();
  const popups = list.data?.items ?? [];
  const popup = featured(popups);
  const count = (status: BannerStatus) => popups.filter((p) => scheduleStatus(p) === status).length;

  const update = (change: Partial<AdminPopup>) => {
    if (!popup) return;
    patch.mutate(
      { id: popup.id, patch: change },
      { onError: (e) => toast({ message: errorMessage(e), tone: 'error' }) },
    );
  };

  return (
    <section className={styles.panel} aria-labelledby="ads-pp-h">
      <div className={styles.panelHd}>
        <div className={styles.panelHdText}>
          <h2 className={styles.panelT} id="ads-pp-h">
            공지 팝업
          </h2>
          {list.data && (
            <span className={styles.cap}>
              게시중 {count(BannerStatus.ACTIVE)} · 예약 {count(BannerStatus.SCHEDULED)}
            </span>
          )}
        </div>
        <Link className={styles.linkRow} href={ADMIN_ROUTES.popups}>
          팝업 탭에서 전체 관리
          <Icon name="chevron-right" size={16} />
        </Link>
      </div>
      {list.isPending ? (
        <div className={styles.pp} role="status" aria-label="팝업 불러오는 중">
          <Skeleton height={176} radius={14} />
          <div className={styles.ppSet}>
            <Skeleton width="50%" height={20} />
            <Skeleton height={36} style={{ marginTop: 10 }} />
            <Skeleton height={36} style={{ marginTop: 6 }} />
            <Skeleton height={36} style={{ marginTop: 6 }} />
          </div>
        </div>
      ) : list.isError ? (
        <ErrorState compact title="팝업을 불러오지 못했어요" onRetry={() => void list.refetch()} />
      ) : !popup ? (
        <EmptyState
          compact
          icon="megaphone"
          title="등록된 팝업이 없어요"
          description="공지나 이벤트를 팝업으로 알릴 수 있어요."
          action={
            <Button size="sm" href={`${ADMIN_ROUTES.popups}?new=1`} linkAs={Link}>
              새 팝업 등록
            </Button>
          }
        />
      ) : (
        <div className={styles.pp}>
          <PopupCard
            src={mediaUrl(popup.media)}
            title={popup.title}
            dismissDays={popup.dismissDays}
          />
          <div className={styles.ppSet}>
            <div className={styles.ppHd}>
              <div>
                <p className={styles.ppT}>{popup.title}</p>
                <p className={`${styles.cap} num`}>
                  {displayCode(popup)} · 운영사 · {formatSize(POPUP_IMAGE_SPEC)}
                </p>
              </div>
              <StatusPill tone={STATUS_TONE[scheduleStatus(popup)]}>
                {STATUS_PILL_LABEL[scheduleStatus(popup)]}
              </StatusPill>
            </div>
            <div className={styles.ppRow}>
              <span className={styles.ppL} id="ads-pp-per">
                기간
              </span>
              <span className={styles.ppV} role="group" aria-labelledby="ads-pp-per">
                <span className={styles.dateSmBox}>
                  <Icon name="calendar" size={16} />
                  <input
                    type="date"
                    className={styles.dateSm}
                    aria-label="시작일"
                    key={`s-${popup.id}-${popup.startAt}`}
                    defaultValue={toKstDay(popup.startAt)}
                    max={toKstDay(popup.endAt)}
                    onBlur={(e) => {
                      const day = e.target.value;
                      if (
                        isDay(day) &&
                        day !== toKstDay(popup.startAt) &&
                        day <= toKstDay(popup.endAt)
                      )
                        update({ startAt: startOfKstDay(day) });
                      else e.target.value = toKstDay(popup.startAt);
                    }}
                  />
                </span>
                <span className={styles.cap} aria-hidden="true">
                  –
                </span>
                <span className={styles.dateSmBox}>
                  <Icon name="calendar" size={16} />
                  <input
                    type="date"
                    className={styles.dateSm}
                    aria-label="종료일"
                    key={`e-${popup.id}-${popup.endAt}`}
                    defaultValue={toKstDay(popup.endAt)}
                    min={toKstDay(popup.startAt)}
                    onBlur={(e) => {
                      const day = e.target.value;
                      if (
                        isDay(day) &&
                        day !== toKstDay(popup.endAt) &&
                        day >= toKstDay(popup.startAt)
                      )
                        update({ endAt: endOfKstDay(day) });
                      else e.target.value = toKstDay(popup.endAt);
                    }}
                  />
                </span>
              </span>
            </div>
            <div className={styles.ppRow}>
              <span className={styles.ppL} id="ads-pp-pages">
                노출 페이지
              </span>
              <span className={styles.ppV} role="group" aria-labelledby="ads-pp-pages">
                {POPUP_PAGES.map((page: PopupPage) => {
                  const on = popup.targetPages.includes(page);
                  return (
                    <Chip
                      key={page}
                      selected={on}
                      onClick={() => {
                        const next = togglePopupPage(popup.targetPages, page);
                        if (next.length === 0)
                          toast({ message: '노출 페이지는 하나 이상 있어야 해요', tone: 'info' });
                        else update({ targetPages: next });
                      }}
                    >
                      {POPUP_PAGE_LABEL[page]}
                    </Chip>
                  );
                })}
              </span>
            </div>
            <div className={styles.ppRow}>
              <span className={styles.ppL}>닫기 옵션</span>
              <span className={styles.ppV}>
                <Checkbox
                  className={styles.checkSm}
                  checked={popup.dismissDays > 0}
                  onChange={(e) => update({ dismissDays: e.target.checked ? 7 : 0 })}
                >
                  ‘{dismissLabel(popup.dismissDays > 0 ? popup.dismissDays : 7)}’ 표시
                </Checkbox>
                <span className={styles.cap}>
                  {popup.dismissDays > 0
                    ? `누르면 ${popup.dismissDays}일 동안 다시 뜨지 않아요`
                    : '닫기 버튼만 보여요'}
                </span>
              </span>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
