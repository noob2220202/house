import { ASSET_TYPE_LABEL, DEFAULT_REGION_NAME, enumValues, AssetType } from '@house/shared';

export default function HomePage() {
  return (
    <main style={{ padding: 24, fontFamily: 'system-ui, sans-serif' }}>
      <h1>{DEFAULT_REGION_NAME} 부동산</h1>
      <p>사용자 사이트는 디자인 확정 후 구현됩니다.</p>
      <ul>
        {enumValues(AssetType).map((t) => (
          <li key={t}>{ASSET_TYPE_LABEL[t]}</li>
        ))}
      </ul>
    </main>
  );
}
