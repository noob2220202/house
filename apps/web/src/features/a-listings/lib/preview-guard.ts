/**
 * The preview step renders the public listing page's own components, which come with live actions
 * (관심 매물, 문의하기, 신고, 공유) and links that would leave the wizard. Only controls that change
 * what the preview shows stay usable: gallery / lightbox, ㎡ ↔ 평, map zoom and in-page anchors.
 */
const SAFE_LABEL = /크게 보기|모두 보기|사진으로 이동|^확대$|^축소$/;

/** The clickable element (link / button) a click inside the preview landed on, if any. */
export function previewControlOf(target: EventTarget | null): Element | null {
  return target instanceof Element ? target.closest('a[href], button, [role="button"]') : null;
}

/** Whether a link / button inside the preview may run (otherwise the click is swallowed). */
export function previewAllows(control: Element): boolean {
  if (control.getAttribute('role') === 'radio') return true;
  if (control.tagName === 'A') return (control.getAttribute('href') ?? '').startsWith('#');
  return SAFE_LABEL.test(control.getAttribute('aria-label') ?? '');
}
