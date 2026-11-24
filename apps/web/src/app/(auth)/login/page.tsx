import { redirect } from 'next/navigation';
import { BRAND } from '@/config/brand';
import { env } from '@/config/env';
import { BrandPanel } from '@/features/w-auth/components/login/BrandPanel';
import { LoginPanel, type LoginNotice } from '@/features/w-auth/components/login/LoginPanel';
import styles from '@/features/w-auth/components/login/login.module.css';
import { parseIntent, resolveCallbackTarget, safeNext } from '@/features/w-auth/lib/flow';
import { getServerSession } from '@/lib/auth/server';
import { buildMetadata } from '@/lib/seo';

export const metadata = buildMetadata({
  title: '로그인',
  description: `카카오·네이버·Google 계정으로 3초 만에 ${BRAND.name} 서비스를 시작하세요. 관심 단지 새 매물 알림, 내놓기·구하기 요청을 한곳에서.`,
  path: '/login',
});

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const NOTICES = {
  expired: { tone: 'info', message: '로그인이 만료됐어요. 다시 로그인해 주세요.' },
  logout: { tone: 'info', message: '안전하게 로그아웃했어요.' },
  required: { tone: 'info', message: '로그인이 필요한 서비스예요.' },
} satisfies Record<string, LoginNotice>;

export default async function LoginPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const returnTo = safeNext(sp.returnTo, '');
  const intent = parseIntent(sp.as ?? sp.intent, returnTo);

  // Already signed in → straight to the destination (or to the unfinished signup).
  const user = await getServerSession();
  if (user) redirect(resolveCallbackTarget({ next: returnTo, intent, user }));

  const reason = typeof sp.reason === 'string' ? sp.reason : undefined;
  const notice: LoginNotice | undefined =
    reason && reason in NOTICES
      ? NOTICES[reason as keyof typeof NOTICES]
      : returnTo
        ? NOTICES.required
        : undefined;

  return (
    <section className={styles.auth} aria-label="로그인">
      <BrandPanel />
      <LoginPanel
        returnTo={returnTo || undefined}
        initialIntent={intent}
        notice={notice}
        mock={env.apiMock}
      />
    </section>
  );
}
