import { Chip, Icon } from '@house/ui';
import { PageHead } from '@/features/w-content/components/PageHead';
import layout from '@/features/w-content/components/layout.module.css';
import { AcquisitionTaxCalculator } from '@/features/w-content/tools/AcquisitionTaxCalculator';
import { AreaConverter } from '@/features/w-content/tools/AreaConverter';
import { FeeCalculator } from '@/features/w-content/tools/FeeCalculator';
import { LoanCalculator } from '@/features/w-content/tools/LoanCalculator';
import { TransferTaxCalculator } from '@/features/w-content/tools/TransferTaxCalculator';
import { TOOLS } from '@/features/w-content/tools/tools-nav';
import styles from '@/features/w-content/tools/tools.module.css';
import { ROUTES } from '@/config/nav';
import { JsonLd, breadcrumbJsonLd, buildMetadata } from '@/lib/seo';

const DESCRIPTION =
  '중개보수, 취득세, 양도소득세, 대출 이자, 평·㎡ 환산까지. 집을 사고팔 때 드는 비용을 미리 계산해 보세요.';

export const metadata = buildMetadata({
  title: '부동산 계산기',
  description: DESCRIPTION,
  path: ROUTES.tools,
});

export default function ToolsPage() {
  return (
    <div className={`container ${layout.page}`}>
      <JsonLd data={breadcrumbJsonLd([{ name: '부동산 계산기', path: ROUTES.tools }])} />
      <PageHead
        title="부동산 계산기"
        description="집을 사고팔 때 드는 비용을 미리 계산해 보세요. 숫자를 넣으면 바로 결과가 나와요."
        crumbs={[{ label: '부동산 계산기' }]}
      />
      <nav className={styles.nav} aria-label="계산기 바로가기">
        {TOOLS.map((tool) => (
          <Chip key={tool.id} href={`#${tool.id}`} iconLeft={<Icon name={tool.icon} size={16} />}>
            {tool.label}
          </Chip>
        ))}
      </nav>
      <div className={styles.stack}>
        <FeeCalculator />
        <AcquisitionTaxCalculator />
        <TransferTaxCalculator />
        <LoanCalculator />
        <AreaConverter />
      </div>
      <p className={styles.disclaimer}>
        <Icon name="info" size={18} />
        <span>
          계산 결과는 참고용이에요. 실제 중개보수는 중개사무소와 협의해 정하고, 세금과 대출 상환액은
          개인 사정과 법령 개정에 따라 달라질 수 있으니 계약 전에 세무 전문가 또는 금융기관에 꼭
          확인해 주세요.
        </span>
      </p>
    </div>
  );
}
