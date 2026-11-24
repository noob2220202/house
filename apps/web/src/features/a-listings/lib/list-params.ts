import { AssetType, DealType, ListingStatus } from '@house/shared';

/** URL state of /agent/listings (shareable, back-button friendly). */
export type StatusTab = ListingStatus | 'ALL';
export const LIST_SORTS = [
  'UPDATED',
  'LATEST',
  'VERIFY_DUE',
  'PRICE_DESC',
  'PRICE_ASC',
  'VIEWS',
] as const;
export type ListSort = (typeof LIST_SORTS)[number];
export const LIST_SORT_LABEL: Record<ListSort, string> = {
  UPDATED: '최근 수정순',
  LATEST: '최근 등록순',
  VERIFY_DUE: '확인 만료 임박순',
  PRICE_DESC: '높은 가격순',
  PRICE_ASC: '낮은 가격순',
  VIEWS: '조회 많은순',
};

export interface ListParams {
  status: StatusTab;
  q: string;
  deal: DealType | '';
  asset: AssetType | '';
  /** 실매물 확인 필요만. */
  due: boolean;
  /** 공동중개 참여 매물만. */
  co: boolean;
  sort: ListSort;
  page: number;
}

export const LIST_DEFAULTS: ListParams = {
  status: 'ALL',
  q: '',
  deal: '',
  asset: '',
  due: false,
  co: false,
  sort: 'UPDATED',
  page: 1,
};
export const LIST_PAGE_SIZE = 10;

const oneOf = <T extends string>(values: readonly T[], v: string | null): T | undefined =>
  values.includes(v as T) ? (v as T) : undefined;

type Readable = { get(key: string): string | null };

export function parseListParams(sp: Readable): ListParams {
  const page = Number(sp.get('page'));
  return {
    status: oneOf(Object.values(ListingStatus), sp.get('status')) ?? 'ALL',
    q: (sp.get('q') ?? '').trim().slice(0, 60),
    deal: oneOf(Object.values(DealType), sp.get('deal')) ?? '',
    asset: oneOf(Object.values(AssetType), sp.get('asset')) ?? '',
    due: sp.get('due') === '1',
    co: sp.get('co') === '1',
    sort: oneOf(LIST_SORTS, sp.get('sort')) ?? 'UPDATED',
    page: Number.isInteger(page) && page > 0 ? page : 1,
  };
}

/** Query string without defaults ("" when everything is default). */
export function buildListQuery(p: ListParams): string {
  const sp = new URLSearchParams();
  if (p.status !== 'ALL') sp.set('status', p.status);
  if (p.q) sp.set('q', p.q);
  if (p.deal) sp.set('deal', p.deal);
  if (p.asset) sp.set('asset', p.asset);
  if (p.due) sp.set('due', '1');
  if (p.co) sp.set('co', '1');
  if (p.sort !== 'UPDATED') sp.set('sort', p.sort);
  if (p.page > 1) sp.set('page', String(p.page));
  const s = sp.toString();
  return s ? `?${s}` : '';
}

/** Number of narrowing filters besides the status tab (for the "초기화" affordance). */
export function activeFilterCount(p: ListParams): number {
  return [p.q !== '', p.deal !== '', p.asset !== '', p.due, p.co].filter(Boolean).length;
}

/** Query of GET /agency/listings. */
export function toApiQuery(p: ListParams) {
  return {
    status: p.status === 'ALL' ? undefined : [p.status],
    q: p.q || undefined,
    dealTypes: p.deal ? [p.deal] : undefined,
    assetTypes: p.asset ? [p.asset] : undefined,
    verificationDue: p.due ? true : undefined,
    coBrokered: p.co ? true : undefined,
    sort: p.sort,
    page: p.page,
    pageSize: LIST_PAGE_SIZE,
  };
}
