import { parseInline, parseRichText, plainExcerpt } from './rich-text';

describe('parseRichText', () => {
  it('splits paragraphs and keeps line breaks', () => {
    expect(parseRichText('첫 줄\n둘째 줄\n\n다음 문단')).toEqual([
      {
        type: 'paragraph',
        lines: [[{ type: 'text', text: '첫 줄' }], [{ type: 'text', text: '둘째 줄' }]],
      },
      { type: 'paragraph', lines: [[{ type: 'text', text: '다음 문단' }]] },
    ]);
  });

  it('parses headings, article headings and lists', () => {
    const blocks = parseRichText(
      [
        '## 포상 기준',
        '- 하나',
        '- 둘',
        '1. 첫째',
        '2. 둘째',
        '',
        '제1조 (목적)',
        '본문',
        '부칙',
      ].join('\n'),
    );
    expect(blocks.map((b) => b.type)).toEqual([
      'heading',
      'list',
      'list',
      'heading',
      'paragraph',
      'heading',
    ]);
    expect(blocks[0]).toEqual({ type: 'heading', level: 2, text: '포상 기준' });
    expect(blocks[1]).toMatchObject({
      ordered: false,
      items: [{ marker: null }, { marker: null }],
    });
    expect(blocks[2]).toMatchObject({ ordered: true, items: [{ marker: '1' }, { marker: '2' }] });
    expect(blocks[3]).toEqual({ type: 'heading', level: 2, text: '제1조 (목적)' });
  });

  it('does not treat ordinary sentences as headings or lists', () => {
    const blocks = parseRichText(
      '제안을 수락하면 연락처가 전달됩니다.\n2026년 11월 1일부터 적용합니다.',
    );
    expect(blocks).toHaveLength(1);
    expect(blocks[0]!.type).toBe('paragraph');
  });

  it('never emits markup for HTML-looking input', () => {
    const blocks = parseRichText('<script>alert(1)</script>');
    expect(blocks).toEqual([
      { type: 'paragraph', lines: [[{ type: 'text', text: '<script>alert(1)</script>' }]] },
    ]);
  });
});

describe('parseInline', () => {
  it('links http(s) URLs only and trims trailing punctuation', () => {
    expect(parseInline('자세한 내용은 https://example.kr/notice?id=1. 에서')).toEqual([
      { type: 'text', text: '자세한 내용은 ' },
      {
        type: 'link',
        text: 'https://example.kr/notice?id=1',
        href: 'https://example.kr/notice?id=1',
      },
      { type: 'text', text: '. 에서' },
    ]);
    expect(parseInline('javascript:alert(1)')).toEqual([
      { type: 'text', text: 'javascript:alert(1)' },
    ]);
  });
});

describe('plainExcerpt', () => {
  it('strips markup and truncates', () => {
    expect(plainExcerpt('## 제목\n- 하나\n본문')).toBe('제목 하나 본문');
    const long = plainExcerpt('가'.repeat(300), 50);
    expect(long).toHaveLength(50);
    expect(long.endsWith('…')).toBe(true);
  });
});
