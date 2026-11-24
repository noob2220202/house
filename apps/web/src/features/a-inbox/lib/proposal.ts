import { DealRequestType, DealType } from '@house/shared';
import { z } from 'zod';
import { formatManwon, formatMonthly, parsePriceInput } from '@/lib/format';
import type { AgencyDealRequest } from '../api/schemas';

/** Limits of `proposalCreateSchema` (@house/shared). */
export const PROPOSAL_MESSAGE_MAX = 2000;
export const PROPOSAL_LISTINGS_MAX = 10;
/** Shortest message we let an agent send — a proposal should say something. */
export const PROPOSAL_MESSAGE_MIN = 10;
/** Room kept for the price line(s) prepended to the message. */
const OFFER_RESERVE = 80;
export const PROPOSAL_TEXT_MAX = PROPOSAL_MESSAGE_MAX - OFFER_RESERVE;

/** Which price inputs a 내놓기 request asks for. 구하기 requests have none (listings carry prices). */
export type OfferKind = 'sale' | 'jeonse' | 'monthly' | null;

export function offerKindOf(r: Pick<AgencyDealRequest, 'type' | 'dealTypes'>): OfferKind {
  if (r.type !== DealRequestType.SELL_OR_LEASE) return null;
  const deal = r.dealTypes[0];
  if (deal === DealType.MONTHLY) return 'monthly';
  if (deal === DealType.JEONSE) return 'jeonse';
  return 'sale';
}

export const OFFER_LABEL: Record<Exclude<OfferKind, null>, string> = {
  sale: '예상 매매가',
  jeonse: '예상 전세가',
  monthly: '예상 보증금/월세',
};

const priceField = z
  .string()
  .trim()
  .refine((v) => v === '' || parsePriceInput(v) !== null, {
    message: '금액을 확인해 주세요. 예: 4억 4,000 또는 44000',
  });

export const proposalFormSchema = z
  .object({
    message: z
      .string()
      .trim()
      .min(PROPOSAL_MESSAGE_MIN, `제안 내용을 ${PROPOSAL_MESSAGE_MIN}자 이상 적어 주세요.`)
      .max(
        PROPOSAL_TEXT_MAX,
        `제안 내용은 ${PROPOSAL_TEXT_MAX.toLocaleString('ko-KR')}자까지 쓸 수 있어요.`,
      ),
    /** 매매가 / 전세가 / 월세 보증금 — free text ("4억 4,000"). */
    offerPrice: priceField,
    /** 월세 (만원). */
    offerRent: priceField,
    listingIds: z
      .array(z.string())
      .max(PROPOSAL_LISTINGS_MAX, `매물은 ${PROPOSAL_LISTINGS_MAX}건까지 첨부할 수 있어요.`),
  })
  .refine((v) => v.offerRent === '' || v.offerPrice !== '', {
    message: '보증금을 함께 적어 주세요.',
    path: ['offerPrice'],
  });
export type ProposalFormValues = z.infer<typeof proposalFormSchema>;

export const EMPTY_PROPOSAL_FORM: ProposalFormValues = {
  message: '',
  offerPrice: '',
  offerRent: '',
  listingIds: [],
};

/** "예상 매매가 4억 4,000" — null when the agent left the price empty. */
export function offerLine(
  kind: OfferKind,
  values: Pick<ProposalFormValues, 'offerPrice' | 'offerRent'>,
): string | null {
  if (!kind) return null;
  const price = parsePriceInput(values.offerPrice);
  if (price === null) return null;
  if (kind === 'monthly') {
    const rent = parsePriceInput(values.offerRent);
    return rent === null
      ? `예상 보증금 ${formatManwon(price)}`
      : `${OFFER_LABEL.monthly} ${formatMonthly(price, rent)}`;
  }
  return `${OFFER_LABEL[kind]} ${formatManwon(price)}`;
}

/**
 * The API has no price column on a proposal (`{ message, listingIds }`), so the suggested price is
 * sent as a leading "· …" line of the message — the same convention w-deal uses for request flags.
 * `splitProposalMessage` reverses it for display.
 */
export function composeProposalMessage(text: string, offer: string | null): string {
  const body = text.trim();
  return offer ? `· ${offer}\n\n${body}` : body;
}

/**
 * A leading line written by `composeProposalMessage` ("· 예상 매매가 4억 4,000"). Only these labels
 * count: agents often start their own text with "· " bullets, which must stay part of the message.
 */
const OFFER_LINE = /^·\s+예상 (?:매매가|전세가|보증금(?:\/월세)?)\s+\S/;

export function splitProposalMessage(message: string | null | undefined): {
  offers: string[];
  text: string;
} {
  if (!message) return { offers: [], text: '' };
  const lines = message.split('\n');
  const offers: string[] = [];
  let i = 0;
  while (i < lines.length && OFFER_LINE.test(lines[i] ?? '')) {
    offers.push((lines[i] ?? '').replace(/^·\s*/, '').trim());
    i += 1;
  }
  return { offers, text: lines.slice(i).join('\n').trim() };
}

/** Body for POST /agency/deal-requests/:id/proposals (= proposalCreateSchema). */
export function toProposalBody(
  values: ProposalFormValues,
  kind: OfferKind,
): { message: string; listingIds: string[] } {
  return {
    message: composeProposalMessage(values.message, offerLine(kind, values)),
    listingIds: values.listingIds,
  };
}

export interface ProposalTemplate {
  label: string;
  text: string;
}

/** Starter sentences an agent can drop into the message and then edit. */
export function proposalTemplates(
  r: Pick<AgencyDealRequest, 'type'>,
  ctx: { agencyName?: string | null; memberName?: string | null },
): ProposalTemplate[] {
  const who = [ctx.agencyName, ctx.memberName].filter(Boolean).join(' ');
  const hello = who ? `안녕하세요, ${who}입니다.` : '안녕하세요.';
  if (r.type === DealRequestType.SELL_OR_LEASE) {
    return [
      { label: '인사', text: hello },
      {
        label: '거래 경험',
        text: '같은 단지·인근에서 최근 거래를 여러 건 중개했습니다. 현재 시세와 대기 손님 상황을 자세히 안내해 드리겠습니다.',
      },
      {
        label: '광고·촬영',
        text: '사진 촬영과 매물 광고는 저희가 무료로 진행하고, 실매물 확인 후 바로 노출하겠습니다.',
      },
      {
        label: '중개보수',
        text: '중개보수는 법정 상한 요율 이내에서 협의 가능합니다.',
      },
    ];
  }
  return [
    { label: '인사', text: hello },
    {
      label: '매물 추천',
      text: '말씀하신 조건에 맞는 매물을 골라 첨부했습니다. 직접 확인한 실매물이며, 방문 일정은 편하신 시간으로 맞춰 드리겠습니다.',
    },
    {
      label: '추가 매물',
      text: '광고에 올리지 않은 매물도 있으니 조건을 조금 더 알려 주시면 함께 찾아 드리겠습니다.',
    },
    {
      label: '중개보수',
      text: '중개보수는 법정 상한 요율 이내에서 협의 가능합니다.',
    },
  ];
}

/** Appends a template sentence to the message (blank line between paragraphs). */
export function appendTemplate(current: string, addition: string): string {
  const base = current.trimEnd();
  if (base.includes(addition)) return current;
  return base ? `${base}\n${addition}` : addition;
}
