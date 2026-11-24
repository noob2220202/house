import type { IconName } from '@house/ui';

/** Calculators on /tools in page order. Ids are the anchors the footer links to (config/nav.ts). */
export const TOOLS: readonly { id: string; label: string; icon: IconName }[] = [
  { id: 'fee', label: '중개보수', icon: 'calc' },
  { id: 'acquisition-tax', label: '취득세', icon: 'document' },
  { id: 'transfer-tax', label: '양도소득세', icon: 'chart' },
  { id: 'loan', label: '대출 이자', icon: 'calendar' },
  { id: 'area', label: '평 · ㎡ 환산', icon: 'ruler' },
];
