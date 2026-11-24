'use client';
import { Button, Icon } from '@house/ui';
import Link from 'next/link';
import { useEffect } from 'react';
import { Logo } from '@/components/brand/Logo';
import { ROUTES } from '@/config/nav';
import { ApiError } from '@/lib/api/errors';
import { StatusHeader, StatusPage } from './StatusPage';

export interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
  /** Render a minimal logo bar (root boundary: the site chrome is not available). */
  standalone?: boolean;
}

/**
 * "500" page — body of the route error boundaries. Distinguishes connection problems from server
 * errors, offers retry + home, and shows the request id / digest for support.
 */
export function ErrorPage({ error, reset, standalone }: ErrorPageProps) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const api = error instanceof ApiError ? error : null;
  const network = api?.isNetwork === true;
  const supportCode = api?.requestId ?? error.digest;

  const body = (
    <StatusPage
      alert
      fullHeight={standalone}
      code={network ? undefined : '500'}
      icon={network ? 'alert' : undefined}
      title={network ? '연결이 원활하지 않아요' : '잠시 문제가 생겼어요'}
      description={
        network
          ? '네트워크 상태를 확인한 뒤 다시 시도해 주세요.'
          : '일시적인 오류로 페이지를 보여 드리지 못했어요. 다시 시도해도 같은 화면이 보이면 고객센터로 알려 주세요.'
      }
      actions={
        <>
          <Button onClick={reset} iconLeft={<Icon name="refresh" size={18} />}>
            다시 시도
          </Button>
          <Button href={ROUTES.home} linkAs={Link} variant="secondary">
            홈으로
          </Button>
        </>
      }
      footnote={
        supportCode ? (
          <>
            문의할 때 이 코드를 알려 주시면 더 빨리 확인할 수 있어요 · <code>{supportCode}</code>
          </>
        ) : undefined
      }
    />
  );

  if (!standalone) return body;
  return (
    <>
      <StatusHeader>
        <Logo />
      </StatusHeader>
      <main>{body}</main>
    </>
  );
}
