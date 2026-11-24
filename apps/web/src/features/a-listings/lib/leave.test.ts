import { describe, expect, it } from 'vitest';
import { isLeaveTarget } from './leave';

const HERE = 'http://localhost:3000/agent/listings/abc/edit?step=deal';

describe('isLeaveTarget (unsaved-changes guard)', () => {
  it('returns the in-app page a link would open', () => {
    expect(isLeaveTarget({ href: 'http://localhost:3000/agent/listings' }, HERE)).toBe(
      '/agent/listings',
    );
    expect(isLeaveTarget({ href: '/agent/listings/co-broker?complexId=1#top' }, HERE)).toBe(
      '/agent/listings/co-broker?complexId=1#top',
    );
  });

  it('ignores links that do not leave this page', () => {
    expect(isLeaveTarget({ href: '/agent/listings/abc/edit?step=photos' }, HERE)).toBeNull();
    expect(isLeaveTarget({ href: '#section' }, HERE)).toBeNull();
  });

  it('ignores new tabs, downloads, other origins and non-http schemes', () => {
    expect(isLeaveTarget({ href: '/listing/abc', target: '_blank' }, HERE)).toBeNull();
    expect(isLeaveTarget({ href: '/file.pdf', download: true }, HERE)).toBeNull();
    expect(isLeaveTarget({ href: 'https://example.com/x' }, HERE)).toBeNull();
    expect(isLeaveTarget({ href: 'tel:0610000000' }, HERE)).toBeNull();
    expect(isLeaveTarget({ href: 'mailto:a@b.c' }, HERE)).toBeNull();
  });

  it('treats target=_self like no target', () => {
    expect(isLeaveTarget({ href: '/agent', target: '_self' }, HERE)).toBe('/agent');
  });
});
