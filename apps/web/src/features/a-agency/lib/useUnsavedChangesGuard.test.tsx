import { describe, expect, it } from 'vitest';
import { guardedHref } from './useUnsavedChangesGuard';

function clickOn(html: string, init: MouseEventInit = {}): string | null {
  document.body.innerHTML = html;
  const anchor = document.querySelector('a')!;
  const event = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0, ...init });
  Object.defineProperty(event, 'target', { value: anchor.firstElementChild ?? anchor });
  return guardedHref(event, window.location);
}

describe('guardedHref', () => {
  it('intercepts same-origin in-app links (also when the click lands on a child)', () => {
    expect(clickOn('<a href="/agent/staff"><span>직원 관리</span></a>')).toBe('/agent/staff');
    expect(clickOn('<a href="/agent/listings?due=1">x</a>')).toBe('/agent/listings?due=1');
  });

  it('lets new tabs, downloads, modified clicks and other origins through', () => {
    expect(clickOn('<a href="/agency/1" target="_blank">x</a>')).toBeNull();
    expect(clickOn('<a href="/file.pdf" download>x</a>')).toBeNull();
    expect(clickOn('<a href="/agent/staff">x</a>', { ctrlKey: true })).toBeNull();
    expect(clickOn('<a href="https://example.com/">x</a>')).toBeNull();
  });

  it('ignores links to the current page (hash anchors)', () => {
    const here = `${window.location.pathname}${window.location.search}`;
    expect(clickOn(`<a href="${here}#main">x</a>`)).toBeNull();
  });
});
