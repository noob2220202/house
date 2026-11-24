/**
 * "전남 순천시 해룡면 신대2로 40 (신대리)" → "신대2로40": the road name + building number, which
 * identify a building whatever the 시도 / 시군구 spelling (전남 / 전라남도 / 전남광주통합특별시,
 * 46150 → 12150) or trailing extras (동, 참고항목). Null when no "…로|길 <번호>" part is found.
 */
export function roadKey(address: string | null | undefined): string | null {
  const last = lastRoadMatch(address);
  return last ? `${last[1]}${last[2]}` : null;
}

/** "왕지로 12번길 3" is written both with and without the space before "12번길". */
function lastRoadMatch(address: string | null | undefined): RegExpExecArray | null {
  if (!address) return null;
  const text = address.replace(/(로|길)\s+(\d+번?길)/g, '$1$2');
  const re = /([0-9A-Za-z가-힣.·]+(?:로|길))\s*(\d+(?:-\d+)?)(?![0-9]*번?길)/g;
  let last: RegExpExecArray | null = null;
  for (let m = re.exec(text); m; m = re.exec(text)) last = m;
  return last;
}

/** Road name of a road key ("신대2로40" → "신대2로"), used to narrow the DB lookup. */
export function roadNameOf(address: string | null | undefined): string | null {
  return lastRoadMatch(address)?.[1] ?? null;
}

/** "레이크파크 1단지" → "레이크파크1단지": building names compared without spaces / punctuation. */
export function nameKey(name: string | null | undefined): string {
  return (name ?? '').replace(/[\s()·.,-]/g, '').toLowerCase();
}
