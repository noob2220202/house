import { describe, expect, it } from 'vitest';
import { siteRootDomainOf } from './env';

describe('siteRootDomainOf (same rule as the web app and the API)', () => {
  it('defaults to the plain hostname of the user-site URL, www. included', () => {
    expect(siteRootDomainOf('https://suncheonmap.kr')).toBe('suncheonmap.kr');
    // The API builds https://<slug>.www.suncheonmap.kr here and the web routes only that host.
    expect(siteRootDomainOf('https://www.suncheonmap.kr')).toBe('www.suncheonmap.kr');
    expect(siteRootDomainOf('http://localhost:3000')).toBe('localhost');
  });

  it('prefers the explicit root domain, normalised', () => {
    expect(siteRootDomainOf('https://www.suncheonmap.kr', ' SuncheonMap.kr. ')).toBe(
      'suncheonmap.kr',
    );
    expect(siteRootDomainOf('https://www.suncheonmap.kr', '')).toBe('www.suncheonmap.kr');
    expect(siteRootDomainOf('not a url')).toBe('localhost');
  });
});
