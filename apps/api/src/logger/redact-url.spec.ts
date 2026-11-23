import { REDACTED, redactUrl } from './redact-url';

describe('redactUrl', () => {
  it('returns paths without a query unchanged', () => {
    expect(redactUrl('/api/v1/complexes/abc')).toBe('/api/v1/complexes/abc');
    expect(redactUrl('')).toBe('');
    expect(redactUrl(undefined)).toBe('');
  });

  it('redacts OAuth callback code and state', () => {
    const out = redactUrl('/api/v1/auth/oauth/kakao/callback?code=AUTHCODE123&state=st4te');
    expect(out).toBe(`/api/v1/auth/oauth/kakao/callback?code=${REDACTED}&state=${REDACTED}`);
    expect(out).not.toContain('AUTHCODE123');
    expect(out).not.toContain('st4te');
  });

  it('redacts admin search text (may be a phone number) but keeps paging params', () => {
    const out = redactUrl('/api/v1/admin/users?q=01012345678&page=2&pageSize=20');
    expect(out).toBe(`/api/v1/admin/users?q=${REDACTED}&page=2&pageSize=20`);
    expect(out).not.toContain('01012345678');
  });

  it('redacts map bbox and coordinates', () => {
    const out = redactUrl(
      '/api/v1/map/search?bbox=127.4,34.9,127.5,35.0&zoom=14&lat=34.95&lng=127.48&dealTypes=SALE',
    );
    expect(out).toBe(
      `/api/v1/map/search?bbox=${REDACTED}&zoom=14&lat=${REDACTED}&lng=${REDACTED}&dealTypes=SALE`,
    );
    expect(out).not.toMatch(/127\.4|34\.9/);
  });

  it('redacts returnTo, keyed variants and is case-insensitive', () => {
    const out = redactUrl(
      '/x?returnTo=%2Fmy%3Fa%3D1&RETURNTO=y&contactPhone=010&accessToken=t&roadAddress=r&swLat=1',
    );
    expect(out).toBe(
      `/x?returnTo=${REDACTED}&RETURNTO=${REDACTED}&contactPhone=${REDACTED}` +
        `&accessToken=${REDACTED}&roadAddress=${REDACTED}&swLat=${REDACTED}`,
    );
  });

  it('redacts repeated keys every time', () => {
    expect(redactUrl('/x?q=a&q=b')).toBe(`/x?q=${REDACTED}&q=${REDACTED}`);
  });

  it('drops keys that are not plain identifiers (bare data in the query)', () => {
    const out = redactUrl('/x?01012345678&page=1&%ED%99%8D=1');
    expect(out).toBe(`/x?${REDACTED}&page=1&${REDACTED}`);
  });

  it('re-encodes safe values and strips the fragment', () => {
    expect(redactUrl('/x?sort=price asc&status=ACTIVE#frag')).toBe(
      '/x?sort=price%20asc&status=ACTIVE',
    );
  });

  it('keeps the path when only an empty query is present', () => {
    expect(redactUrl('/x?')).toBe('/x');
  });
});
