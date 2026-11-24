import { Button, Chip, Icon } from '@house/ui';
import Link from 'next/link';
import { ROUTES } from '@/config/nav';
import { regionByKey } from '../../lib/regions';
import type { LoginIntent } from '../../lib/flow';
import { AgentNextCard } from './AgentNextCard';
import styles from './signup.module.css';

export interface SignupDoneProps {
  nickname: string;
  regionKeys: readonly string[];
  notify: boolean;
  intent: LoginIntent;
  /** Where "계속하기" goes (validated site-relative path). */
  target: string;
}

/** Step 3 — 가입 완료. */
export function SignupDone({ nickname, regionKeys, notify, intent, target }: SignupDoneProps) {
  const regions = regionKeys.flatMap((key) => regionByKey(key) ?? []);
  const agent = intent === 'agent';
  const home = target === ROUTES.home || target === ROUTES.agentApply;
  return (
    <>
      <div className={styles.doneCard}>
        <span className={styles.doneIc}>
          <Icon name="check" size={36} strokeWidth={2.5} />
        </span>
        <h2 className="t-h1">가입이 완료됐어요</h2>
        <p className={styles.doneDesc}>
          <b>{nickname}</b>님, 환영해요.{' '}
          {regions.length > 0
            ? notify
              ? `관심 지역 ${regions.length}곳에 새 매물이 오르면 바로 알려 드릴게요.`
              : `관심 지역 ${regions.length}곳을 저장했어요. 알림은 마이페이지에서 켤 수 있어요.`
            : '관심 지역은 마이페이지에서 언제든 고를 수 있어요.'}
        </p>
        {regions.length > 0 && (
          <ul className={styles.doneChips} aria-label="선택한 관심 지역">
            {regions.map((region) => (
              <li key={region.key}>
                <Chip selected iconLeft={<Icon name="map-pin" size={16} />}>
                  {region.name}
                </Chip>
              </li>
            ))}
          </ul>
        )}
        {!agent && (
          <div className={styles.doneActions}>
            <Button
              href={target}
              linkAs={Link}
              size="lg"
              iconRight={<Icon name="chevron-right" size={18} />}
            >
              {home ? '홈으로 가기' : '보던 화면으로 돌아가기'}
            </Button>
            <Button href={ROUTES.map('apt')} linkAs={Link} size="lg" variant="secondary">
              지도에서 매물 보기
            </Button>
          </div>
        )}
      </div>
      {agent && <AgentNextCard ready />}
    </>
  );
}
