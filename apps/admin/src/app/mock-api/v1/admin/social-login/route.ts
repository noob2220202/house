import type { NextRequest } from 'next/server';
import { isResponse, mockAdmin } from '@/features/m-content/mock/http';
import { mockJson } from '@/lib/mock';

// GET /api/v1/admin/social-login — ASSUMED read-only status of the three OAuth providers
// (카카오 · 네이버 · Google only). Client secrets live in the API's env and are never returned.
export async function GET(req: NextRequest) {
  const ctx = await mockAdmin(req, { min: 'ADMIN' });
  if (isResponse(ctx)) return ctx;
  const origin = 'https://www.example.kr';
  // Healthy by default (matches the shell's status card); `?_degraded=1` shows the alert state.
  const degraded = ctx.sp.get('_degraded') === '1';
  const ago = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();
  return mockJson({
    items: [
      {
        provider: 'KAKAO',
        enabled: true,
        healthy: true,
        clientIdMasked: '7f3c••••••••••••••••••••a91e',
        callbackUrl: `${origin}/api/v1/auth/oauth/kakao/callback`,
        lastSuccessAt: ago(2),
        last24h: { success: 412, failure: 3 },
        userShare: 0.62,
        message: null,
      },
      {
        provider: 'NAVER',
        enabled: true,
        healthy: true,
        clientIdMasked: 'Qw9x••••••••••••Lk2',
        callbackUrl: `${origin}/api/v1/auth/oauth/naver/callback`,
        lastSuccessAt: ago(9),
        last24h: { success: 171, failure: 1 },
        userShare: 0.27,
        message: null,
      },
      {
        provider: 'GOOGLE',
        enabled: true,
        healthy: !degraded,
        clientIdMasked: '4821••••••••.apps.googleusercontent.com',
        callbackUrl: `${origin}/api/v1/auth/oauth/google/callback`,
        lastSuccessAt: ago(degraded ? 278 : 21),
        last24h: degraded ? { success: 58, failure: 14 } : { success: 72, failure: 0 },
        userShare: 0.11,
        message: degraded
          ? '최근 1시간 동안 redirect_uri_mismatch 오류가 14건 발생했습니다.'
          : null,
      },
    ],
  });
}
