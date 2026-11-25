import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AppBand } from './app/AppBand';
import { DealBand } from './deal/DealBand';

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

/** Invented names / counts of the design drafts that must never reach the production UI. */
const INVENTED =
  /레이크파크|하이츠|신대중앙|신대·선월|12곳|제안 3건|2건을|\+9|4억 4,500|4억 5,000|4억 1,900|3분|방금|분 전|시간 전/;

describe('<DealBand>', () => {
  it('shows the real approved office count, marked as an example request', () => {
    const { container } = render(<DealBand agencyCount={37} />);
    expect(container.textContent).not.toMatch(INVENTED);
    expect(container.textContent).toContain('요청 예시');
    expect(container.textContent).toContain('순천 중개사무소 37곳');
    expect(screen.getByRole('img').getAttribute('aria-label')).toContain('순천 중개사무소 37곳');
  });

  it('leaves the reach line out without a count', () => {
    const { container } = render(<DealBand agencyCount={null} />);
    expect(container.textContent).not.toMatch(INVENTED);
    expect(container.textContent).not.toContain('중개사무소 0곳');
    expect(container.textContent).not.toMatch(/중개사무소 \d+곳/);
    expect(screen.getByRole('img').getAttribute('aria-label')).not.toMatch(/\d+곳/);
  });
});

describe('<AppBand>', () => {
  it('illustrates notice kinds only — no listing, office, price or time', () => {
    const { container } = render(
      <AppBand iosUrl="https://apps.apple.com/app/id1" androidUrl={null} />,
    );
    expect(container.textContent).not.toMatch(INVENTED);
    expect(container.textContent).not.toMatch(/\d억|\d+평|\d+동 /);
  });
});
