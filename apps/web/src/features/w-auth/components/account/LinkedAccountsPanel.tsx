'use client';
import { AUTH_PROVIDER_LABEL, type AuthProvider } from '@house/shared';
import {
  Badge,
  Button,
  Callout,
  ConfirmDialog,
  ErrorState,
  ProviderTile,
  Skeleton,
  useToast,
} from '@house/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { errorMessage } from '@/lib/api';
import { formatDate, formatRelativeTime } from '@/lib/format';
import { authKeys, fetchIdentities, unlinkIdentity, type Identity } from '../../api';
import { PROVIDERS, oauthLinkUrl, parseProvider } from '../../lib/flow';
import { maskEmail } from '../../lib/mask';
import styles from './account.module.css';

/** Facts shown under a linked provider; each one wraps as a unit on narrow screens. */
function identityMeta(identity: Identity): string[] {
  const parts = [
    maskEmail(identity.email),
    identity.createdAt ? `${formatDate(identity.createdAt)} 연결` : '',
    identity.lastUsedAt ? `최근 로그인 ${formatRelativeTime(identity.lastUsedAt)}` : '',
  ].filter(Boolean);
  return parts.length > 0 ? parts : ['연결됨'];
}

/**
 * 로그인 계정 관리 (카카오 / 네이버 / Google): link another provider with a full-page OAuth round trip,
 * unlink with confirmation. The last remaining login method can never be removed.
 * Self-contained — other groups can drop it into their pages.
 */
export function LinkedAccountsPanel() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [target, setTarget] = useState<AuthProvider | null>(null);

  const query = useQuery({
    queryKey: authKeys.identities(),
    queryFn: ({ signal }) => fetchIdentities(signal),
  });
  const unlink = useMutation({
    mutationFn: (provider: AuthProvider) => unlinkIdentity(provider),
    onSuccess: (_data, provider) => {
      queryClient.setQueryData<Identity[]>(authKeys.identities(), (prev) =>
        prev?.filter((i) => i.provider !== provider),
      );
      void queryClient.invalidateQueries({ queryKey: authKeys.identities() });
      toast(`${AUTH_PROVIDER_LABEL[provider]} 계정 연결을 해제했어요.`);
    },
    onError: (error) => toast({ message: errorMessage(error), tone: 'error' }),
    onSettled: () => setTarget(null),
  });

  // Back from the provider after linking (?linked=kakao): clean the URL, then confirm once — but
  // only when the fetched list really has that provider (the query string alone proves nothing).
  const linkedRef = useRef<AuthProvider | null | undefined>(undefined);
  useEffect(() => {
    if (linkedRef.current === undefined) {
      const url = new URL(window.location.href);
      linkedRef.current = parseProvider(url.searchParams.get('linked')) ?? null;
      if (url.searchParams.has('linked')) {
        url.searchParams.delete('linked');
        window.history.replaceState(
          window.history.state,
          '',
          `${url.pathname}${url.search}${url.hash}`,
        );
      }
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
