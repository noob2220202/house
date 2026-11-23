import { kstDateKey, secondsUntilKstMidnight } from './daily-cap.service';

describe('daily cap date helpers', () => {
  it('uses the Asia/Seoul calendar day', () => {
    // 2026-01-01 15:30 UTC = 2026-01-02 00:30 KST
    expect(kstDateKey(new Date('2026-01-01T15:30:00Z'))).toBe('20260102');
    expect(kstDateKey(new Date('2026-01-01T14:59:59Z'))).toBe('20260101');
  });

  it('counts seconds to the next KST midnight', () => {
    expect(secondsUntilKstMidnight(new Date('2026-01-01T14:59:00Z'))).toBe(60);
    expect(secondsUntilKstMidnight(new Date('2026-01-01T15:00:00Z'))).toBe(86_400);
  });
});
