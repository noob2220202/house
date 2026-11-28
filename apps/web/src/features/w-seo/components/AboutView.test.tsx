import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ReportEmpty } from '../report-page';
import { AboutView, filledFacts, type AboutNap } from './AboutView';

const EMPTY: AboutNap = {
  companyName: null,
  ceoName: null,
  businessNumber: null,
  mailOrderNumber: null,
  address: null,
  phone: null,
  email: null,
  hours: null,
};

describe('filledFacts', () => {
  it('drops blank and template values the operator has not replaced', () => {
    expect(
      filledFacts([
        ['상호', ' 순천맵 '],
        ['대표', '(대표자 입력)'],
        ['주소', '[주소]'],
        ['사업자등록번호', '  '],
        ['통신판매업 신고', null],
      ]),
    ).toEqual([['상호', '순천맵']]);
  });
});

describe('AboutView 운영자 정보', () => {
  it('lists the filled-in operator facts', () => {
    render(
      <AboutView
        nap={{ ...EMPTY, companyName: '순천맵', ceoName: '(대표자 입력)' }}
        coverage={null}
      />,
    );
    expect(screen.getByRole('heading', { name: '운영자 정보' })).toBeInTheDocument();
    expect(screen.getByText('순천맵')).toBeInTheDocument();
    expect(screen.queryByText('(대표자 입력)')).toBeNull();
    expect(screen.queryByText('운영자 정보는 준비 중이에요.')).toBeNull();
  });

  it('says "준비 중" only when the settings were read and hold nothing real', () => {
    const { unmount } = render(<AboutView nap={EMPTY} coverage={null} />);
    expect(screen.getByText('운영자 정보는 준비 중이에요.')).toBeInTheDocument();
    unmount();
    // Settings unavailable (API down): no claim about the operator, the section is left out.
    render(<AboutView nap={EMPTY} coverage={null} settingsLoaded={false} />);
    expect(screen.queryByRole('heading', { name: '운영자 정보' })).toBeNull();
    expect(screen.queryByText('운영자 정보는 준비 중이에요.')).toBeNull();
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
  });
});

describe('ReportEmpty', () => {
  it('keeps a breadcrumb and an h1 while no trade data is synced', () => {
    render(<ReportEmpty />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      '순천 아파트 실거래 리포트',
    );
    expect(screen.getByRole('navigation', { name: '현재 위치' })).toBeInTheDocument();
    expect(screen.getByText('아직 집계된 실거래 자료가 없어요')).toBeInTheDocument();
  });
});
