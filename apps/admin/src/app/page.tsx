import { BANNER_SLOT_SPECS, BannerSlot, enumValues } from '@house/shared';

export default function AdminHomePage() {
  return (
    <main style={{ padding: 24, fontFamily: 'system-ui, sans-serif' }}>
      <h1>관리자</h1>
      <p>관리자 화면은 디자인 확정 후 구현됩니다.</p>
      <h2>배너 영역</h2>
      <ul>
        {enumValues(BannerSlot).map((slot) => (
          <li key={slot}>
            {BANNER_SLOT_SPECS[slot].label} (최대 {BANNER_SLOT_SPECS[slot].maxActive}개)
          </li>
        ))}
      </ul>
    </main>
  );
}
