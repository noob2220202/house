'use client';
import { useEffect } from 'react';

/** Last-resort boundary (root layout failed). Must render its own <html>; no providers or tokens are guaranteed here. */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <html lang="ko">
      <body
        style={{
          margin: 0,
          fontFamily: 'system-ui, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif',
          color: '#0A1222',
        }}
      >
        <main
          style={{
            display: 'grid',
            placeItems: 'center',
            minHeight: '100dvh',
            padding: 24,
            textAlign: 'center',
          }}
        >
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.03em', margin: 0 }}>
              일시적인 오류가 발생했어요
            </h1>
            <p style={{ margin: '12px 0 24px', color: '#4E5968', fontSize: 15, lineHeight: 1.6 }}>
              잠시 후 다시 시도해 주세요.
            </p>
            <button
              type="button"
              onClick={reset}
              style={{
                height: 44,
                padding: '0 18px',
                borderRadius: 12,
                border: 0,
                background: '#1D4FF2',
                color: '#fff',
                fontSize: 15,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              다시 시도
            </button>
            {error.digest && (
              <p style={{ marginTop: 16, fontSize: 12, color: '#646F7C' }}>
                오류 코드 {error.digest}
              </p>
            )}
          </div>
        </main>
      </body>
    </html>
  );
}
