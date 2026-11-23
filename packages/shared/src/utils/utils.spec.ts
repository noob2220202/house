import {
  formatManwon,
  formatPhone,
  maskPhone,
  normalizePhone,
  parseYoutubeVideoId,
  pyeongToSqm,
  sqmToPyeong,
  toE164Kr,
} from './index';
import { isSafeLinkUrl } from './url';

describe('area', () => {
  it('converts ㎡ ↔ 평', () => {
    expect(sqmToPyeong(84.97)).toBe(25.7);
    expect(pyeongToSqm(1)).toBe(3.31);
    expect(pyeongToSqm(32, 4)).toBe(105.7851);
  });
});

describe('money', () => {
  it('formats 만원', () => {
    expect(formatManwon(125000)).toBe('12억 5,000');
    expect(formatManwon(30000)).toBe('3억');
    expect(formatManwon(9500)).toBe('9,500');
  });
});

describe('phone', () => {
  it('normalizes national and +82 forms to digits', () => {
    expect(normalizePhone('010-1234-5678')).toBe('01012345678');
    expect(normalizePhone('+82 10-1234-5678')).toBe('01012345678');
    expect(normalizePhone('+82 (0)61-123-4567')).toBe('0611234567');
  });
  it('converts to E.164', () => {
    expect(toE164Kr('010-1234-5678')).toBe('+821012345678');
    expect(toE164Kr('1588-1234')).toBeNull();
  });
  it('masks and formats', () => {
    expect(maskPhone('010-1234-5678')).toBe('010-****-5678');
    expect(formatPhone('0212345678')).toBe('02-1234-5678');
    expect(formatPhone('0617491234')).toBe('061-749-1234');
    expect(formatPhone('15881234')).toBe('1588-1234');
  });
});

describe('url', () => {
  it('validates links', () => {
    expect(isSafeLinkUrl('https://example.com/a')).toBe(true);
    expect(isSafeLinkUrl('/listings/1')).toBe(true);
    expect(isSafeLinkUrl('//evil.com')).toBe(false);
    expect(isSafeLinkUrl('javascript:alert(1)')).toBe(false);
  });
  it('parses youtube ids', () => {
    expect(parseYoutubeVideoId('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    expect(parseYoutubeVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    expect(parseYoutubeVideoId('https://example.com/watch?v=dQw4w9WgXcQ')).toBeNull();
  });
});
