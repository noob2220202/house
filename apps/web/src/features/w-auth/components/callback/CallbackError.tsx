import { AUTH_PROVIDER_LABEL, type AuthProvider } from '@house/shared';
import { Button, Icon, ProviderTile } from '@house/ui';
import Link from 'next/link';
import { ROUTES } from '@/config/nav';
import type { OAuthErrorInfo } from '../../lib/oauth-errors';
import styles from './callback.module.css';

export interface CallbackErrorProps {
  info: OAuthErrorInfo;
  provider?: AuthProvider;
  /** /login?returnTo=… to try again (계정 설정 when the failed round trip was a link). */
  retryHref: string;
}

/** Failure branch of the OAuth landing: what happened (in Korean), how to recover, support code. */
export function CallbackError({ info, provider, retryHref }: CallbackErrorProps) {
  const notice = info.tone === 'notice';
  return (
    <div className={styles.wrap}>
      <div className={styles.card} role="alert">
        <span className={`${styles.icon} ${notice ? styles.iconNotice : ''}`}>
          <Icon name={notice ? 'info' : 'siren'} size={30} />
        </span>
        {provider && (
          <p className={styles.provider}>
            <ProviderTile provider={provider} size="sm" />
            {AUTH_PROVIDER_LABEL[provider]} {info.linking ? '계정 연결' : '로그인'}
          </p>
        )}
        <h1 className={styles.title}>{info.title}</h1>
        <p className={styles.desc}>{info.description}</p>
        <div className={styles.actions}>
          {info.canRetry && (
            <Button href={retryHref} linkAs={Link} size="lg">
              {info.linking ? '계정 설정으로' : '다시 로그인'}
            </Button>
          )}
          <Button
            href={ROUTES.home}
            linkAs={Link}
            size="lg"
            variant={info.canRetry ? 'secondary' : 'primary'}
          >
            홈으로
          </Button>
        </div>
        {info.support && (
          <p className={styles.help}>
            문제가 계속되면{' '}
            <Link className="link" href={ROUTES.support}>
              고객센터
            </Link>
            로 알려 주세요.
          </p>
        )}
        <p className={styles.code}>오류 코드 {info.code}</p>
      </div>
    </div>
  );
}
