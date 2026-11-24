/** "Chrome 141 · macOS" from a User-Agent string (audit log detail); the raw string when unknown. */
export function describeUserAgent(ua: string | null | undefined): string {
  if (!ua) return '기록 없음';
  const browser =
    match(ua, /Edg\/(\d+)/, 'Edge') ??
    match(ua, /Whale\/(\d+)/, 'Whale') ??
    match(ua, /SamsungBrowser\/(\d+)/, 'Samsung Internet') ??
    match(ua, /Firefox\/(\d+)/, 'Firefox') ??
    match(ua, /Chrome\/(\d+)/, 'Chrome') ??
    (/Safari\//.test(ua) ? match(ua, /Version\/(\d+)/, 'Safari') : null);
  const os = /Windows NT/.test(ua)
    ? 'Windows'
    : /Android/.test(ua)
      ? 'Android'
      : /iPhone|iPad|iPod/.test(ua)
        ? 'iOS'
        : /Mac OS X/.test(ua)
          ? 'macOS'
          : /Linux/.test(ua)
            ? 'Linux'
            : null;
  if (!browser && !os) return ua.length > 60 ? `${ua.slice(0, 59)}…` : ua;
  return [browser, os].filter(Boolean).join(' · ');
}

function match(ua: string, re: RegExp, name: string): string | null {
  const m = re.exec(ua);
  return m ? `${name} ${m[1]}` : null;
}
