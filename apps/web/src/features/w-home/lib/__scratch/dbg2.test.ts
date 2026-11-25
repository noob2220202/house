import { it } from 'vitest';
import { REGIONS } from '@/app/mock-api/v1/home/_fixtures';
import { fitCenter, fitKakaoLevel, geoBox, projectToFrame, chipWidth } from '../hero-map';
import { kakaoMetresPerPx } from '@/lib/map/kakao-level';
it('dbg2', () => {
  for (const w of [600, 520]) {
  const size = { width: w, height: w*0.9 };
  const insets = { top: 110, right: 64, bottom: 30, left: 64 };
  const box = geoBox(REGIONS)!;
  const level = fitKakaoLevel(box, size, insets);
  const c = fitCenter(box, insets, kakaoMetresPerPx(level));
  console.log('L', level, JSON.stringify(REGIONS.map(r => { const p = projectToFrame(r, c, kakaoMetresPerPx(level), size); return [r.name, Math.round(p.x), Math.round(p.y), Math.round(chipWidth(r.name, r.listingCount, null))]; })));
  }
});
