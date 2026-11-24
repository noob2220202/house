import { describe, expect, it } from 'vitest';
import {
  activeBlock,
  applyBlock,
  continueList,
  insertLink,
  insertText,
  textStats,
  type EditState,
} from './markup';
import { parseInline, parseRichText, plainExcerpt } from './rich-text';

const at = (value: string, start: number, end = start): EditState => ({ value, start, end });

describe('markup commands', () => {
  it('turns the current line into a heading and back', () => {
    const h2 = applyBlock(at('점검 안내\n본문', 2), 'h2');
    expect(h2.value).toBe('## 점검 안내\n본문');
    expect(h2.start).toBe(h2.end);
    expect(activeBlock(h2)).toBe('h2');
    expect(applyBlock(h2, 'h2').value).toBe('점검 안내\n본문');
  });

  it('replaces one block type with another', () => {
    const state = applyBlock(at('## 제목', 3), 'h3');
    expect(state.value).toBe('### 제목');
    expect(activeBlock(state)).toBe('h3');
    expect(applyBlock(state, 'bullet').value).toBe('- 제목');
  });

  it('numbers every selected line and skips blank ones', () => {
    const value = '첫째\n\n둘째\n셋째';
    const state = applyBlock(at(value, 0, value.length), 'ordered');
    expect(state.value).toBe('1. 첫째\n\n2. 둘째\n3. 셋째');
    expect(state.start).toBe(0);
    expect(state.end).toBe(state.value.length);
    expect(activeBlock(state)).toBe('ordered');
  });

  it('does not include the next line when the selection ends at a line break', () => {
    const state = applyBlock(at('가\n나', 0, 2), 'bullet');
    expect(state.value).toBe('- 가\n나');
  });

  it('removes markup with the plain command', () => {
    expect(applyBlock(at('- 항목', 1), 'plain').value).toBe('항목');
    expect(activeBlock(at('그냥 문장', 0))).toBe('plain');
    expect(activeBlock(at('', 0))).toBe('plain');
  });

  it('inserts text and links at the caret', () => {
    expect(insertText(at('ab', 1), 'X')).toEqual({ value: 'aXb', start: 2, end: 2 });
    expect(insertLink(at('문의', 2)).value).toBe('문의 https://');
    expect(insertLink(at('문의 ', 3)).value).toBe('문의 https://');
    expect(insertLink(at('', 0)).value).toBe('https://');
  });

  it('continues a list on Enter and ends it on an empty item', () => {
    expect(continueList(at('- 하나', 4))?.value).toBe('- 하나\n- ');
    expect(continueList(at('3. 셋', 5))?.value).toBe('3. 셋\n4. ');
    expect(continueList(at('2) 둘', 5))?.value).toBe('2) 둘\n3) ');
    expect(continueList(at('가\n- ', 4))).toEqual({ value: '가\n', start: 2, end: 2 });
    expect(continueList(at('보통 문장', 5))).toBeNull();
    expect(continueList(at('- 선택', 0, 3))).toBeNull();
  });

  it('counts characters and lines', () => {
    expect(textStats('')).toEqual({ chars: 0, lines: 0 });
    expect(textStats('가\n나')).toEqual({ chars: 3, lines: 2 });
  });
});

describe('rich text parser', () => {
  it('parses headings, lists and paragraphs', () => {
    const blocks = parseRichText(
      '## 제목\n첫 줄\n둘째 줄\n\n- 가\n- 나\n\n1. 하나\n2) 둘\n\n### 소제목',
    );
    expect(blocks.map((b) => b.type)).toEqual(['heading', 'paragraph', 'list', 'list', 'heading']);
    expect(blocks[0]).toMatchObject({ level: 2, text: '제목' });
    expect(blocks[1]).toMatchObject({ lines: [[{ text: '첫 줄' }], [{ text: '둘째 줄' }]] });
    expect(blocks[2]).toMatchObject({ ordered: false });
    expect(blocks[3]).toMatchObject({ ordered: true, items: [{ marker: '1' }, { marker: '2' }] });
    expect(blocks[4]).toMatchObject({ level: 3 });
  });

  it('treats article lines of terms as headings', () => {
    const blocks = parseRichText('제1조 (목적)\n이 약관은…\n\n제 2 조의 2 [정의]\n부칙');
    expect(blocks.filter((b) => b.type === 'heading')).toHaveLength(3);
  });

  it('auto-links only http(s) URLs and trims trailing punctuation', () => {
    expect(parseInline('문의: https://example.com/a?b=1. 감사합니다')).toEqual([
      { type: 'text', text: '문의: ' },
      { type: 'link', text: 'https://example.com/a?b=1', href: 'https://example.com/a?b=1' },
      { type: 'text', text: '. 감사합니다' },
    ]);
    expect(parseInline('javascript:alert(1) ftp://x.y')).toEqual([
      { type: 'text', text: 'javascript:alert(1) ftp://x.y' },
    ]);
  });

  it('keeps markup characters as plain text (nothing is interpreted as HTML)', () => {
    const blocks = parseRichText('<script>alert(1)</script>\n<b>굵게</b>');
    expect(blocks).toEqual([
      {
        type: 'paragraph',
        lines: [
          [{ type: 'text', text: '<script>alert(1)</script>' }],
          [{ type: 'text', text: '<b>굵게</b>' }],
        ],
      },
    ]);
  });

  it('builds a plain excerpt', () => {
    expect(plainExcerpt('## 제목\n- 항목 하나\n\n본문')).toBe('제목 항목 하나 본문');
    expect(plainExcerpt('가'.repeat(200), 10)).toBe(`${'가'.repeat(9)}…`);
  });
});
