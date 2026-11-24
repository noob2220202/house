import { ListingStatus } from '@house/shared';
import type { StatusTone } from '@house/ui';

/** StatusPill tone per listing status. */
export const STATUS_TONE: Record<ListingStatus, StatusTone> = {
  ACTIVE: 'live',
  RESERVED: 'scheduled',
  DRAFT: 'review',
  CLOSED: 'ended',
  HIDDEN: 'rejected',
};

/** Action shown on the transition buttons (row menu, bulk bar, confirm button). */
export const STATUS_ACTION_LABEL: Record<ListingStatus, string> = {
  ACTIVE: '다시 광고하기',
  RESERVED: '계약중으로 변경',
  CLOSED: '거래완료 처리',
  HIDDEN: '숨기기',
  DRAFT: '작성중으로 변경',
};

/** Title of the confirm dialog. */
export const STATUS_CONFIRM_TITLE: Record<ListingStatus, string> = {
  ACTIVE: '다시 광고할까요?',
  RESERVED: '계약중으로 바꿀까요?',
  CLOSED: '거래완료 처리할까요?',
  HIDDEN: '매물을 숨길까요?',
  DRAFT: '작성중으로 바꿀까요?',
};

/** Toast after the change (`n` = number of listings changed). */
export function statusDoneText(to: ListingStatus, n: number): string {
  const subject = n === 1 ? '' : `${n}건을 `;
  switch (to) {
    case ListingStatus.ACTIVE:
      return `${subject}다시 광고하기 시작했어요.`;
    case ListingStatus.RESERVED:
      return `${subject}계약중으로 바꿨어요.`;
    case ListingStatus.CLOSED:
      return `${subject}거래완료 처리했어요.`;
    case ListingStatus.HIDDEN:
      return n === 1 ? '매물을 숨겼어요.' : `${n}건을 숨겼어요.`;
    default:
      return `${subject}작성중으로 바꿨어요.`;
  }
}

/** What happens on the public site, shown in the confirm dialog. */
export const STATUS_EFFECT: Record<ListingStatus, string> = {
  ACTIVE: '지도와 목록에 다시 노출돼요.',
  RESERVED: '‘계약중’ 표시와 함께 계속 노출돼요. 계약이 깨지면 다시 광고중으로 돌릴 수 있어요.',
  CLOSED:
    '사이트에서 바로 내려가고, 다시 광고할 수 없어요. 거래가 끝난 매물은 지체 없이 내려야 해요.',
  HIDDEN: '사이트에서 내려가요. 언제든 다시 광고중으로 돌릴 수 있어요.',
  DRAFT: '',
};

export interface TransitionContext {
  /** Only the primary (최초 등록) office changes the status. */
  isPrimary: boolean;
  /** Hidden by the operator (report / policy) — cannot be re-opened by the broker. */
  hiddenByOperator?: boolean;
}

/**
 * Status lifecycle (listings README): DRAFT → ACTIVE (through publish only) ↔ RESERVED → CLOSED,
 * plus ACTIVE ↔ HIDDEN by the broker. CLOSED is final.
 */
export function allowedTransitions(
  status: ListingStatus,
  { isPrimary, hiddenByOperator }: TransitionContext,
): ListingStatus[] {
  if (!isPrimary) return [];
  switch (status) {
    case ListingStatus.ACTIVE:
      return [ListingStatus.RESERVED, ListingStatus.CLOSED, ListingStatus.HIDDEN];
    case ListingStatus.RESERVED:
      return [ListingStatus.ACTIVE, ListingStatus.CLOSED];
    case ListingStatus.HIDDEN:
      return hiddenByOperator ? [] : [ListingStatus.ACTIVE];
    default:
      return [];
  }
}

export const canTransition = (from: ListingStatus, to: ListingStatus, ctx: TransitionContext) =>
  allowedTransitions(from, ctx).includes(to);

/** Targets every selected row can move to (bulk bar). */
export function commonTransitions(
  rows: readonly { status: ListingStatus; isPrimary: boolean; hiddenReason?: string | null }[],
): ListingStatus[] {
  if (rows.length === 0) return [];
  const order: ListingStatus[] = [
    ListingStatus.ACTIVE,
    ListingStatus.RESERVED,
    ListingStatus.CLOSED,
    ListingStatus.HIDDEN,
  ];
  return order.filter((to) =>
    rows.every((r) =>
      canTransition(r.status, to, { isPrimary: r.isPrimary, hiddenByOperator: !!r.hiddenReason }),
    ),
  );
}

// ---- 실매물 확인 ------------------------------------------------------------------------------------

/** A 실매물 확인 is valid for this many days (ASSUMED policy — the API sends `verificationDueAt`). */
export const VERIFICATION_VALID_DAYS = 30;
/** "곧 만료" window. */
export const VERIFICATION_SOON_DAYS = 7;

const DAY = 86_400_000;
const KST_OFFSET = 9 * 3_600_000;
/** Day number in Asia/Seoul (so D-day math does not depend on the viewer's timezone). */
const kstDay = (t: number) => Math.floor((t + KST_OFFSET) / DAY);

function toTime(input: string | null | undefined): number | null {
  if (!input) return null;
  // Date-only strings are KST calendar days.
  const t = Date.parse(/^\d{4}-\d{2}-\d{2}$/.test(input) ? `${input}T00:00:00+09:00` : input);
  return Number.isNaN(t) ? null : t;
}

export type VerificationKind = 'none' | 'ok' | 'soon' | 'overdue';
export interface VerificationState {
  kind: VerificationKind;
  /** Days until the due date (negative = overdue); null when never verified. */
  daysLeft: number | null;
  /** "D-3" · "오늘 만료" · "2일 지남" · "확인 전" */
  label: string;
}

/** Whether a listing's 실매물 확인 is fine, expiring within a week, overdue or missing. */
export function verificationState(
  item: { verifiedAt?: string | null; verificationDueAt?: string | null },
  now: Date | number = Date.now(),
): VerificationState {
  const verified = toTime(item.verifiedAt);
  if (verified === null) return { kind: 'none', daysLeft: null, label: '확인 전' };
  const due = toTime(item.verificationDueAt) ?? verified + VERIFICATION_VALID_DAYS * DAY;
  const daysLeft = kstDay(due) - kstDay(typeof now === 'number' ? now : now.getTime());
  if (daysLeft < 0) return { kind: 'overdue', daysLeft, label: `${-daysLeft}일 지남` };
  if (daysLeft === 0) return { kind: 'soon', daysLeft, label: '오늘 만료' };
  if (daysLeft <= VERIFICATION_SOON_DAYS) return { kind: 'soon', daysLeft, label: `D-${daysLeft}` };
  return { kind: 'ok', daysLeft, label: `D-${daysLeft}` };
}

/** Listings that are public and need a (re-)verification now or within a week. */
export function isVerificationDue(
  item: { status: ListingStatus; verifiedAt?: string | null; verificationDueAt?: string | null },
  now: Date | number = Date.now(),
): boolean {
  if (item.status !== ListingStatus.ACTIVE && item.status !== ListingStatus.RESERVED) return false;
  return verificationState(item, now).kind !== 'ok';
}
