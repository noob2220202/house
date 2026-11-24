import { API_PREFIX, AuthProvider, UserStatus } from '@house/shared';
import { Injectable } from '@nestjs/common';
import { AppConfig } from '../../../config/app-config.service';
import { PrismaService } from '../../../prisma/prisma.service';
import type { SocialLoginProviderStatus, SocialLoginStatus } from '../schemas';

const DAY_MS = 86_400_000;

/** 카카오 · 네이버 · Google only (no Apple). Same "configured" rule as the auth module's providers. */
const PROVIDERS = [
  {
    provider: AuthProvider.KAKAO,
    slug: 'kakao',
    id: 'KAKAO_CLIENT_ID',
    secret: 'KAKAO_CLIENT_SECRET',
    redirect: 'KAKAO_REDIRECT_URI',
    secretRequired: false,
  },
  {
    provider: AuthProvider.NAVER,
    slug: 'naver',
    id: 'NAVER_CLIENT_ID',
    secret: 'NAVER_CLIENT_SECRET',
    redirect: 'NAVER_REDIRECT_URI',
    secretRequired: true,
  },
  {
    provider: AuthProvider.GOOGLE,
    slug: 'google',
    id: 'GOOGLE_CLIENT_ID',
    secret: 'GOOGLE_CLIENT_SECRET',
    redirect: 'GOOGLE_REDIRECT_URI',
    secretRequired: true,
  },
] as const;

/**
 * "7f3c1234567890a91e" → "7f3c••••••••••a91e"; a Google id keeps its public suffix
 * (".apps.googleusercontent.com"). Short ids are fully masked.
 */
export function maskClientId(clientId: string | undefined | null): string | null {
  if (!clientId) return null;
  const suffix = clientId.endsWith('.apps.googleusercontent.com')
    ? '.apps.googleusercontent.com'
    : '';
  const core = suffix ? clientId.slice(0, -suffix.length) : clientId;
  if (core.length <= 8) return `${'•'.repeat(Math.max(4, core.length))}${suffix}`;
  const tail = suffix ? '' : core.slice(-4);
  return `${core.slice(0, 4)}${'•'.repeat(core.length - 4 - tail.length)}${tail}${suffix}`;
}

/**
 * GET /admin/social-login — read-only status of the OAuth providers. Configuration comes from the
 * API environment (client secrets are never returned, client ids only masked); activity from the
 * identities table: `lastSuccessAt` / `last24h.success` count sign-ins (Identity.lastUsedAt) and
 * `userShare` the share of non-withdrawn members linked to the provider. Failed callbacks are not
 * recorded, so `last24h.failure` is 0 and `healthy` means "configured".
 */
@Injectable()
export class SocialLoginStatusService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfig,
  ) {}

  async status(now = new Date()): Promise<SocialLoginStatus> {
    const since = new Date(now.getTime() - DAY_MS);
    const live = { status: { not: UserStatus.WITHDRAWN } } as const;
    const [members, linked, lastUsed, recent] = await Promise.all([
      this.prisma.user.count({ where: live }),
      this.prisma.identity.groupBy({
        by: ['provider'],
        where: { user: live },
        _count: { _all: true },
      }),
      this.prisma.identity.groupBy({ by: ['provider'], _max: { lastUsedAt: true } }),
      this.prisma.identity.groupBy({
        by: ['provider'],
        where: { lastUsedAt: { gte: since } },
        _count: { _all: true },
      }),
    ]);
    const linkedBy = new Map(linked.map((g) => [g.provider, g._count._all]));
    const lastBy = new Map(lastUsed.map((g) => [g.provider, g._max.lastUsedAt]));
    const recentBy = new Map(recent.map((g) => [g.provider, g._count._all]));
    const base = this.config.get('API_BASE_URL').replace(/\/+$/, '');

    const items = PROVIDERS.map((p): SocialLoginProviderStatus => {
      const clientId = this.config.get(p.id);
      const enabled = Boolean(clientId && (!p.secretRequired || this.config.get(p.secret)));
      const last = lastBy.get(p.provider) ?? null;
      return {
        provider: p.provider,
        enabled,
        healthy: enabled,
        clientIdMasked: maskClientId(clientId),
        callbackUrl:
          this.config.get(p.redirect) ?? `${base}/${API_PREFIX}/auth/oauth/${p.slug}/callback`,
        lastSuccessAt: last ? last.toISOString() : null,
        last24h: { success: recentBy.get(p.provider) ?? 0, failure: 0 },
        userShare:
          members > 0
            ? Math.min(1, Math.round(((linkedBy.get(p.provider) ?? 0) / members) * 1000) / 1000)
            : null,
        message: enabled
          ? null
          : clientId
            ? '클라이언트 시크릿이 설정되지 않아 로그인 버튼이 표시되지 않습니다.'
            : '클라이언트 ID가 설정되지 않아 로그인 버튼이 표시되지 않습니다.',
      };
    });
    return { items };
  }
}
