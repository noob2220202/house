'use client';
import { AUTH_PROVIDER_LABEL, AuthProvider } from '@house/shared';
import {
  Callout,
  Icon,
  IconButton,
  ProviderTile,
  Skeleton,
  StatusPill,
  cx,
  useToast,
} from '@house/ui';
import { useQuery } from '@tanstack/react-query';
import { qk } from '@/lib/api';
import { formatCount, formatPercent, formatRelativeTime } from '@/lib/format';
import { socialLogin } from '../api';
import { useDevQuery } from '../api/dev';
import type { SocialLoginStatus } from '../api/schemas';
import { LoadError } from '../components/LoadError';
import s from '../components/shared.module.css';
import { ratio } from '../lib/stats';
import styles from './settings.module.css';

type Provider = SocialLoginStatus['items'][number];
/** 카카오 · 네이버 · Google only — the product has no other sign-in method. */
const ORDER: readonly AuthProvider[] = [
  AuthProvider.KAKAO,
  AuthProvider.NAVER,
  AuthProvider.GOOGLE,
];

function ProviderCard({ item }: { item: Provider }) {
  const { toast } = useToast();
  const name = AUTH_PROVIDER_LABEL[item.provider];
  const total = item.last24h.success + item.last24h.failure;
  const failRate = ratio(item.last24h.failure, total);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(item.callbackUrl);
      toast('Redirect URI를 복사했어요.');
    } catch {
      toast({ message: '복사하지 못했어요. 주소를 직접 선택해 복사해 주세요.', tone: 'error' });
    }
  };
  return (
    <li className={styles.provider}>
      <div className={styles.providerHd}>
        <ProviderTile provider={item.provider} size="lg" />
        <span className={styles.providerName}>{name}</span>
        <StatusPill tone={!item.enabled ? 'ended' : item.healthy ? 'live' : 'rejected'}>
          {!item.enabled ? '사용 안 함' : item.healthy ? '정상' : '점검 필요'}
        </StatusPill>
      </div>

      {item.message && (
        <Callout size="sm" tone="danger">
          {item.message}
        </Callout>
      )}

      <div className={styles.providerStats}>
        <div className={styles.pStat}>
          <span className={styles.pStatLabel}>24시간 로그인</span>
          <span className={styles.pStatValue}>{formatCount(item.last24h.success)}</span>
        </div>
        <div className={styles.pStat}>
          <span className={styles.pStatLabel}>실패</span>
          <span className={cx(styles.pStatValue, failRate >= 0.1 && styles.pStatBad)}>
            {formatCount(item.last24h.failure)}
          </span>
        </div>
        <div className={styles.pStat}>
          <span className={styles.pStatLabel}>회원 비중</span>
          <span className={styles.pStatValue}>
            {item.userShare === null ? '–' : formatPercent(item.userShare, 0)}
          </span>
        </div>
      </div>

      <div>
        <span className={styles.fieldLabel}>Client ID</span>
        <div className={styles.codeRow}>
          <code className={styles.code}>{item.clientIdMasked ?? '설정되지 않음'}</code>
        </div>
      </div>
      <div>
        <span className={styles.fieldLabel}>Redirect URI (개발자 콘솔에 등록할 주소)</span>
        <div className={styles.codeRow}>
          <code className={styles.code} title={item.callbackUrl}>
            {item.callbackUrl}
          </code>
          <IconButton
            label={`${name} Redirect URI 복사`}
            size={36}
            variant="plain"
            onClick={() => void copy()}
          >
            <Icon name="copy" size={18} />
          </IconButton>
        </div>
      </div>
      <p className={`${s.muted} ${s.small}`}>
        {item.lastSuccessAt
          ? `마지막 로그인 성공 ${formatRelativeTime(item.lastSuccessAt)}`
          : '아직 로그인 성공 기록이 없어요'}
      </p>
    </li>
  );
}

/** 간편로그인 연동: read-only health of the three OAuth providers (keys live in the API's env). */
export function SocialLoginView() {
  const dev = useDevQuery();
  const status = useQuery({
    queryKey: qk('admin-social-login', 'status', dev),
    queryFn: ({ signal }) => socialLogin.status(dev, { signal }),
    refetchInterval: 60_000,
  });
  const items = ORDER.map((p) => status.data?.items.find((i) => i.provider === p)).filter(
    (i): i is Provider => !!i,
  );
  const broken = items.filter((i) => i.enabled && !i.healthy);

  return (
    <>
      {broken.length > 0 ? (
        <Callout size="sm" tone="warn">
          <strong>{broken.map((i) => AUTH_PROVIDER_LABEL[i.provider]).join(', ')}</strong> 로그인에
          오류가 늘고 있어요. 개발자 콘솔의 Redirect URI와 앱 상태를 확인해 주세요.
        </Callout>
      ) : (
        <Callout size="sm" tone="muted" icon="shield">
          회원 로그인은 카카오 · 네이버 · Google 간편로그인만 써요. Client ID와 Secret은 서버 환경
          변수로 관리하고, 이 화면에서는 연결 상태만 확인해요.
        </Callout>
      )}

      {status.isError ? (
        <LoadError error={status.error} onRetry={() => void status.refetch()} compact={false} />
      ) : status.isPending ? (
        <ul className={styles.providers} aria-busy="true">
          {ORDER.map((p) => (
            <li key={p} className={styles.provider}>
              <Skeleton height={44} width="60%" />
              <Skeleton height={64} radius={12} />
              <Skeleton height={36} radius={8} />
              <Skeleton height={36} radius={8} />
            </li>
          ))}
        </ul>
      ) : (
        <ul className={styles.providers}>
          {items.map((item) => (
            <ProviderCard key={item.provider} item={item} />
          ))}
        </ul>
      )}
    </>
  );
}
