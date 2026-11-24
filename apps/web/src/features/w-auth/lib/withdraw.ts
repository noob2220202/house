import { z } from 'zod';

/** Reasons offered on the withdrawal form (optional). The label is what is sent to the API. */
export const WITHDRAW_REASONS = [
  { value: 'no-listing', label: '원하는 매물이 없어요' },
  { value: 'found-home', label: '이미 집을 구했어요' },
  { value: 'inconvenient', label: '이용하기 불편해요' },
  { value: 'too-many-alerts', label: '알림이나 연락이 너무 많아요' },
  { value: 'privacy', label: '개인정보가 걱정돼요' },
  { value: 'other', label: '기타' },
] as const;
export type WithdrawReasonValue = (typeof WITHDRAW_REASONS)[number]['value'];

export const WITHDRAW_DETAIL_MAX = 300;
/** Backend limit of `withdrawSchema.reason`. */
export const WITHDRAW_REASON_MAX = 500;

export const withdrawFormSchema = z.object({
  reason: z.enum(WITHDRAW_REASONS.map((r) => r.value)).optional(),
  detail: z
    .string()
    .trim()
    .max(WITHDRAW_DETAIL_MAX, `${WITHDRAW_DETAIL_MAX}자까지 쓸 수 있어요.`)
    .optional(),
  confirmed: z.boolean().refine((v) => v, '안내 사항을 확인하고 동의해 주세요.'),
});
export type WithdrawFormValues = z.infer<typeof withdrawFormSchema>;

/**
 * `reason` string for POST /me/withdraw: "선택한 사유 — 자세한 내용", or undefined when nothing was
 * given. Clamped to the backend's 500 characters.
 */
export function buildWithdrawReason(
  reason: WithdrawReasonValue | undefined,
  detail: string | undefined,
): string | undefined {
  const label = WITHDRAW_REASONS.find((r) => r.value === reason)?.label;
  const text = [label, detail?.trim()].filter(Boolean).join(' — ');
  return text ? text.slice(0, WITHDRAW_REASON_MAX) : undefined;
}
