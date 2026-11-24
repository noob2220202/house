import { FaqCategory } from '@house/shared';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Faq } from '../api/schemas';
import { FaqBrowser } from './FaqBrowser';
import { countByCategory, filterFaqs, isFaqCategory, splitHighlight } from './faq-utils';

const FAQS: Faq[] = [
  {
    id: 'a',
    category: FaqCategory.GENERAL,
    question: '공동중개 매물이 뭔가요?',
    answer: '한 집을 여러 중개사무소가 함께 중개하는 매물이에요.',
  },
  {
    id: 'b',
    category: FaqCategory.ACCOUNT,
    question: '탈퇴하면 내 정보는 어떻게 되나요?',
    answer: '- 개인정보는 30일 뒤 지워집니다.',
  },
  {
    id: 'c',
    category: FaqCategory.LISTING,
    question: '허위매물을 발견하면 어떻게 하나요?',
    answer: '매물 상세 화면 아래의 신고를 눌러 주세요.',
  },
];

describe('faq utils', () => {
  it('filters by category and text (question or answer, whitespace-insensitive)', () => {
    expect(filterFaqs(FAQS, 'ALL', '').map((f) => f.id)).toEqual(['a', 'b', 'c']);
    expect(filterFaqs(FAQS, FaqCategory.ACCOUNT, '').map((f) => f.id)).toEqual(['b']);
    expect(filterFaqs(FAQS, 'ALL', '허위 매물').map((f) => f.id)).toEqual(['c']);
    expect(filterFaqs(FAQS, 'ALL', '30일').map((f) => f.id)).toEqual(['b']);
    expect(filterFaqs(FAQS, FaqCategory.GENERAL, '탈퇴')).toEqual([]);
  });
  it('counts categories and validates category values', () => {
    expect(countByCategory(FAQS)).toEqual({ GENERAL: 1, ACCOUNT: 1, LISTING: 1 });
    expect(isFaqCategory('LISTING')).toBe(true);
    expect(isFaqCategory('NOPE')).toBe(false);
  });
  it('splits text for highlighting', () => {
    expect(splitHighlight('허위매물 신고', '매물')).toEqual([
      { text: '허위', hit: false },
      { text: '매물', hit: true },
      { text: ' 신고', hit: false },
    ]);
    expect(splitHighlight('abc', '')).toEqual([{ text: 'abc', hit: false }]);
  });
});

describe('<FaqBrowser>', () => {
  it('opens and closes answers with aria-expanded', async () => {
    const user = userEvent.setup();
    render(<FaqBrowser faqs={FAQS} />);
    const question = screen.getByRole('button', { name: /공동중개 매물이 뭔가요/ });
    expect(question).toHaveAttribute('aria-expanded', 'false');
    await user.click(question);
    expect(question).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('region', { name: /공동중개 매물이 뭔가요/ })).toHaveTextContent(
      '함께 중개하는 매물',
    );
    await user.click(question);
    expect(question).toHaveAttribute('aria-expanded', 'false');
  });

  it('filters by category chip and by search, and recovers from an empty result', async () => {
    const user = userEvent.setup();
    render(<FaqBrowser faqs={FAQS} />);
    const chips = screen.getByRole('group', { name: '질문 분류' });
    await user.click(within(chips).getByRole('button', { name: /회원/ }));
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
    expect(screen.getByRole('button', { name: /탈퇴하면/ })).toBeInTheDocument();

    await user.type(screen.getByRole('searchbox', { name: '자주 묻는 질문 검색' }), '없는말');
    expect(screen.getByText('조건에 맞는 질문이 없어요')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '전체 질문 보기' }));
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
  });
});
