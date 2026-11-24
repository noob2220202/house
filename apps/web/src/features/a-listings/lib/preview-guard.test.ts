import { describe, expect, it } from 'vitest';
import { previewAllows, previewControlOf } from './preview-guard';

const el = (html: string): Element => {
  const box = document.createElement('div');
  box.innerHTML = html;
  const first = box.firstElementChild;
  if (!first) throw new Error('no element');
  return first;
};

describe('preview guard', () => {
  it('finds the link / button a click landed on', () => {
    const button = el('<button type="button"><svg></svg><span>문의하기</span></button>');
    const inner = button.querySelector('span');
    expect(previewControlOf(inner)).toBe(button);
    expect(previewControlOf(el('<p>text</p>'))).toBeNull();
    expect(previewControlOf(null)).toBeNull();
  });

  it('keeps the controls that only change what the preview shows', () => {
    expect(previewAllows(el('<button aria-label="사진 1 / 14. 외관 크게 보기"></button>'))).toBe(
      true,
    );
    expect(previewAllows(el('<button aria-label="사진 14장 모두 보기"></button>'))).toBe(true);
    expect(previewAllows(el('<button aria-label="거실 사진으로 이동"></button>'))).toBe(true);
    expect(previewAllows(el('<button role="radio">평</button>'))).toBe(true);
    expect(previewAllows(el('<button aria-label="확대"></button>'))).toBe(true);
    expect(previewAllows(el('<a href="#s-opt">옵션</a>'))).toBe(true);
  });

  it('blocks live actions and links that leave the wizard', () => {
    expect(previewAllows(el('<button aria-label="관심 매물에 추가"></button>'))).toBe(false);
    expect(previewAllows(el('<button aria-label="신대중앙에 문의하기">문의하기</button>'))).toBe(
      false,
    );
    expect(previewAllows(el('<button aria-label="공유하기"></button>'))).toBe(false);
    expect(previewAllows(el('<button>허위매물 신고</button>'))).toBe(false);
    expect(previewAllows(el('<a href="/agency/1">사무소</a>'))).toBe(false);
    expect(previewAllows(el('<a href="tel:0610000000">전화</a>'))).toBe(false);
    expect(previewAllows(el('<a href="/map/apt?c=1,2" aria-label="지도에서 크게 보기"></a>'))).toBe(
      false,
    );
  });
});
