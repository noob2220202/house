/**
 * Runs `run` once `el` is on screen (not `display: none` — the hero map is hidden on phones), the
 * page has finished loading and the browser is idle. Keeps third-party scripts (the Kakao Maps
 * SDK) out of the LCP window. Returns a cancel function.
 */
export function whenVisibleAndIdle(
  el: Element,
  run: () => void,
  { idleTimeoutMs = 2_000 }: { idleTimeoutMs?: number } = {},
): () => void {
  let done = false;
  let observer: IntersectionObserver | null = null;
  let idleId: number | null = null;
  let timerId: ReturnType<typeof setTimeout> | null = null;
  let onLoad: (() => void) | null = null;

  const go = () => {
    if (done) return;
    done = true;
    run();
  };
  const whenIdle = () => {
    if (done) return;
    if (typeof window.requestIdleCallback === 'function')
      idleId = window.requestIdleCallback(go, { timeout: idleTimeoutMs });
    else timerId = setTimeout(go, 200);
  };
  const afterLoad = () => {
    if (document.readyState === 'complete') whenIdle();
    else {
      onLoad = whenIdle;
      window.addEventListener('load', onLoad, { once: true });
    }
  };

  if (typeof IntersectionObserver === 'undefined') afterLoad();
  else {
    observer = new IntersectionObserver((entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      observer?.disconnect();
      observer = null;
      afterLoad();
    });
    observer.observe(el);
  }

  return () => {
    done = true;
    observer?.disconnect();
    if (idleId !== null && typeof window.cancelIdleCallback === 'function')
      window.cancelIdleCallback(idleId);
    if (timerId) clearTimeout(timerId);
    if (onLoad) window.removeEventListener('load', onLoad);
  };
}
