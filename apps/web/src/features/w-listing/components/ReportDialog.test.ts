import { describe, expect, it, vi } from 'vitest';

vi.mock('../api/client', () => ({ createListingReport: vi.fn() }));

const { reportFormSchema } = await import('./ReportDialog');

describe('reportFormSchema', () => {
  it('requires a reason', () => {
    const r = reportFormSchema.safeParse({ detail: '', reporterPhone: '' });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]).toMatchObject({
      path: ['reason'],
      message: '신고 사유를 선택해 주세요.',
    });
  });

  it('accepts a reason alone and normalises the optional phone', () => {
    expect(
      reportFormSchema.parse({ reason: 'ALREADY_DEALT', detail: '  ', reporterPhone: '' }),
    ).toEqual({
      reason: 'ALREADY_DEALT',
      detail: '',
      reporterPhone: '',
    });
    expect(
      reportFormSchema.parse({
        reason: 'WRONG_PRICE',
        detail: '가격이 달라요',
        reporterPhone: '010-1234-5678',
      }).reporterPhone,
    ).toBe('01012345678');
  });

  it('needs an explanation for 기타 and validates the phone format', () => {
    const other = reportFormSchema.safeParse({ reason: 'OTHER', detail: '음', reporterPhone: '' });
    expect(other.error?.issues[0]).toMatchObject({ path: ['detail'] });
    const phone = reportFormSchema.safeParse({
      reason: 'DUPLICATE',
      detail: '',
      reporterPhone: '1234',
    });
    expect(phone.error?.issues.some((i) => i.path[0] === 'reporterPhone')).toBe(true);
    expect(
      reportFormSchema.safeParse({ reason: 'OTHER', detail: 'x'.repeat(2001), reporterPhone: '' })
        .success,
    ).toBe(false);
  });
});
