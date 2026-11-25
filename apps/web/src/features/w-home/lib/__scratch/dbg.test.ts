import { it } from 'vitest';
import { REGIONS } from '@/app/mock-api/v1/home/_fixtures';
import { kakaoHeroLayout, staticHeroLayout } from '../hero-map';
it('dbg', () => {
  const regs = REGIONS.map(({ code, name, emdName, lat, lng, listingCount, avgPricePerPyeong }) => ({ code, name, emdName, lat, lng, listingCount, avgPricePerPyeong }));
  for (const hasCard of [true,false]) console.log('static', hasCard, JSON.stringify(staticHeroLayout(regs, { hasCard, featuredEmdName: '해룡면 신대리' }).chips.map(c=>[c.name,c.x,c.y,c.wideOnly])));
  for (const w of [640, 600, 560, 520, 460]) {
    const size = { width: w, height: w*0.9 };
    const r = kakaoHeroLayout(regs, { size, insets: { top: 110, right: 64, bottom: 30, left: 64 }, card: {x:0,y:size.height-190,width:348,height:190}, obstacles: [{x:0,y:0,width:w,height:84},{x:0,y:size.height-190,width:348,height:190}], featuredEmdName: '해룡면 신대리' });
    console.log('kakao', w, r?.level, r?.onCode, JSON.stringify(r?.chips.map(c=>[c.name,Math.round(c.x),Math.round(c.y)])));
  }
});
