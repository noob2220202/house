'use client';
import { AUTH_PROVIDER_LABEL, type AuthProvider } from '@house/shared';
import {
  Badge,
  Button,
  Callout,
  ConfirmDialog,
  ErrorState,
  Icon,
  ProviderTile,
  Skeleton,
  cx,
  useToast,
} from '@house/ui';
import { useMutation, useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { errorMessage } from '@/lib/api';
import { formatDate, formatRelativeTime } from '@/lib/format';
import { authKeys, fetchIdentities, unlinkIdentity, type Identity } from '../../api';
import { PROVIDERS, oauthLinkUrl, parseProvider } from '../../lib/flow';
import { maskEmail } from '../../lib/mask';
import { oauthErrorInfo, type OAuthErrorInfo } from '../../lib/oauth-errors';
import { AUTH_ROUTES } from '../../routes';
import styles from './account.module.css';

/** Facts shown under a linked provider; each one wraps as a unit on narrow screens. */
function identityMeta(identity: Identity): string[] {
  const parts = [
    maskEmail(identity.email),
    identity.linkedAt ? `${formatDate(identity.linkedAt)} 연결` : '',
    identity.lastUsedAt ? `최근 로그인 ${formatRelativeTime(identity.lastUsedAt)}` : '',
  ].filter(Boolean);
  return parts.length > 0 ? parts : ['연결됨'];
}

/** Removes the given query params from the address bar (no navigation, history entry kept). */
function dropParams(...keys: string[]): void {
  const url = new URL(window.location.href);
  if (!keys.some((k) => url.searchParams.has(k))) return;
  for (const k of keys) url.searchParams.delete(k);
  window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
}

export interface LinkedAccountsPanelProps {
  /**
   * Full management (계정 설정): link / unlink, and the result of a link round trip. Without it the
   * panel is a read-only summary that points to 계정 설정 (내 정보), so the controls live in one place.
   */
  manage?: boolean;
}

/**
 * 로그인 계정 (카카오 / 네이버 / Google). `manage`: link another provider with a full-page OAuth
 * round trip (`intent=link`), unlink with confirmation — the last remaining login method can never
 * be removed. Both variants share the identities cache entry with the /me/profile prefetch.
 */
export function LinkedAccountsPanel({ manage = false }: LinkedAccountsPanelProps) {
  const query = useQuery({
    queryKey: authKeys.identities(),
    queryFn: ({ signal }) => fetchIdentities(signal),
  });
  return manage ? <ManagePanel query={query} /> : <SummaryPanel query={query} />;
}

type IdentitiesQuery = UseQueryResult<Identity[]>;

function SummaryPanel({ query }: { query: IdentitiesQuery }) {
  const identities = query.data ?? [];
  return (
    <section className={styles.card} aria-labelledby="auth-linked-h">
      <header className={styles.cardHead}>
        <div>
          <h2 id="auth-linked-h" className={styles.cardTitle}>
            로그인 계정
          </h2>
          <p className={styles.cardDesc}>연결한 소셜 계정 중 어느 것으로든 로그인할 수 있어요.</p>
        </div>
        <Link className={styles.manageLink} href={AUTH_ROUTES.account}>
          계정 설정에서 관리
          <Icon name="chevron-right" size={16} />
        </Link>
      </header>
      {query.isError ? (
        <ErrorState
          compact
          title="연결된 계정을 불러오지 못했어요"
          description={errorMessage(query.error)}
          onRetry={() => void query.refetch()}
        />
      ) : (
        <ul className={styles.summary} aria-busy={query.isPending}>
          {PROVIDERS.map((provider) => {
            const linked = identities.some((i) => i.provider === provider);
            return (
              <li
                key={provider}
                className={cx(styles.summaryItem, !query.isPending && !linked && styles.summaryOff)}
              >
                <ProviderTile provider={provider} size="sm" />
                {AUTH_PROVIDER_LABEL[provider]}
                {query.isPending ? (
                  <Skeleton width={44} height={22} radius={999} />
                ) : linked ? (
                  <Badge tone="success">연결됨</Badge>
                ) : (
                  <Badge>미연결</Badge>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function ManagePanel({ query }: { query: IdentitiesQuery }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [target, setTarget] = useState<AuthProvider | null>(null);
  const [linkError, setLinkError] = useState<OAuthErrorInfo | null>(null);

  const unlink = useMutation({
    mutationFn: (provider: AuthProvider) => unlinkIdentity(provider),
    onSuccess: (remaining, provider) => {
      queryClient.setQueryData<Identity[]>(authKeys.identities(), remaining);
      toast(`${AUTH_PROVIDER_LABEL[provider]} 계정 연결을 해제했어요.`);
    },
    onError: (error) => toast({ message: errorMessage(error), tone: 'error' }),
    onSettled: () => setTarget(null),
  });

  // Back from the provider after linking: `?linked=kakao` on success, `?error=<code>` on failure.
  // Clean the URL, then confirm a success once — only when the fetched list really has that
  // provider (the query string alone proves nothing).
  const linkedRef = useRef<AuthProvider | null | undefined>(undefined);
  useEffect(() => {
    if (linkedRef.current === undefined) {
      const sp = new URL(window.location.href).searchParams;
      linkedRef.current = parseProvider(sp.get('linked')) ?? null;
      const error = sp.get('error');
      if (error) setLinkError(oauthErrorInfo(error, { linking: true }));
      dropParams('linked', 'error');
    }
    const linked = linkedRef.current;
    if (!linked || !query.data) return;
    linkedRef.current = null;
    if (query.data.some((i) => i.provider === linked))
      toast(`${AUTH_PROVIDER_LABEL[linked]} 계정을 연결했어요.`);
  }, [query.data, toast]);

  const identities = query.data ?? [];
  const onlyOne = identities.length <= 1;

  return (
    <section className={styles.card} aria-labelledby="auth-linked-h">
      <header className={styles.cardHead}>
        <div>
          <h2 id="auth-linked-h" className={styles.cardTitle}>
            로그인 계정
          </h2>
          <p className={styles.cardDesc}>
            연결한 소셜 계정 중 어느 것으로든 같은 회원 정보로 로그인할 수 있어요.
          </p>
        </div>
      </header>

      {linkError && (
        <Callout
          tone={linkError.tone === 'notice' ? 'info' : 'danger'}
          title={linkError.title}
          size="sm"
          live
          className={styles.linkResult}
        >
          {linkError.description} <span className="num">({linkError.code})</span>
        </Callout>
      )}

      {query.isError ? (
        <ErrorState
          compact
          title="연결된 계정을 불러오지 못했어요"
          description={errorMessage(query.error)}
          onRetry={() => void query.refetch()}
        />
      ) : (
        <ul className={styles.providers} aria-busy={query.isPending}>
          {PROVIDERS.map((provider) => {
            const identity = identities.find((i) => i.provider === provider);
            const name = AUTH_PROVIDER_LABEL[provider];
            return (
              <li key={provider} className={styles.provider}>
                <ProviderTile provider={provider} size="lg" />
                <span className={styles.providerText}>
                  <span className={styles.providerName}>
                    {name}
                    {!query.isPending &&
                      (identity ? <Badge tone="success">연결됨</Badge> : <Badge>미연결</Badge>)}
                  </span>
                  {query.isPending ? (
                    <Skeleton width={180} height={13} />
                  ) : (
                    <span className={styles.providerMeta}>
                      {identity
                        ? identityMeta(identity).map((part) => <span key={part}>{part}</span>)
                        : '연결하면 이 계정으로도 로그인할 수 있어요'}
                    </span>
                  )}
                </span>
                <span className={styles.providerAction}>
                  {query.isPending ? (
                    <Skeleton width={84} height={36} radius={10} />
                  ) : identity ? (
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={onlyOne}
                      aria-label={`${name} 계정 연결 해제`}
                      title={onlyOne ? '마지막 로그인 수단은 해제할 수 없어요' : undefined}
                      onClick={() => setTarget(provider)}
                    >
                      연결 해제
                    </Button>
                  ) : (
                    // Full-page navigation to the provider (never fetch).
                    <Button
                      variant="soft"
                      size="sm"
                      href={oauthLinkUrl(provider)}
                      aria-label={`${name} 계정 연결하기`}
                    >
                      연결하기
                    </Button>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      <Callout tone="muted" size="sm" className={styles.hint}>
        {onlyOne && !query.isPending && !query.isError
          ? '지금 연결된 계정이 유일한 로그인 수단이에요. 다른 계정을 먼저 연결해야 해제할 수 있어요.'
          : '로그인 수단이 하나만 남으면 연결을 해제할 수 없어요. 이메일이 같아도 계정은 자동으로 합쳐지지 않아요.'}
      </Callout>

      <ConfirmDialog
        open={target !== null}
        onClose={() => setTarget(null)}
        onConfirm={() => target && unlink.mutate(target)}
        title={target ? `${AUTH_PROVIDER_LABEL[target]} 계정 연결을 해제할까요?` : ''}
        description={
          target
            ? `해제하면 ${AUTH_PROVIDER_LABEL[target]}로는 이 회원 정보에 로그인할 수 없어요. 필요하면 언제든 다시 연결할 수 있어요.`
            : undefined
        }
        confirmLabel="연결 해제"
        danger
        loading={unlink.isPending}
      />
    </section>
  );
}
