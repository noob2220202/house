import { AdminRole, MediaPurpose, RegionLevel, type BannerSlot } from '@house/shared';
import type { Banner, Popup, Prisma } from '@prisma/client';
import type { PrismaService } from '../../../src/prisma/prisma.service';
import { createAdmin, createMedia, loginAdmin, type TestApp, type TestSession } from '../../utils';

export const CHROME_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36';

const HOUR = 3_600_000;
export const inHours = (h: number): Date => new Date(Date.now() + h * HOUR);
export const isoIn = (h: number): string => inHours(h).toISOString();

export async function adminSession(
  t: TestApp,
  role: AdminRole = AdminRole.OPERATOR,
  opts: { mfaVerified?: boolean } = {},
): Promise<TestSession & { adminId: string }> {
  const admin = await createAdmin(t.prisma, { role });
  return { ...(await loginAdmin(t.app, { id: admin.id, role }, opts)), adminId: admin.id };
}

export const bannerMedia = (prisma: PrismaService) =>
  createMedia(prisma, { purpose: MediaPurpose.BANNER });
export const popupMedia = (prisma: PrismaService) =>
  createMedia(prisma, { purpose: MediaPurpose.POPUP });

export async function createRegion(
  prisma: PrismaService,
  code: string,
  name = `지역${code}`,
): Promise<void> {
  const level =
    code.length === 5 ? RegionLevel.SGG : code.length === 8 ? RegionLevel.EMD : RegionLevel.RI;
  await prisma.region.create({ data: { code, name, fullName: `전라남도 순천시 ${name}`, level } });
}

/** A banner row inserted directly (bypasses slot limits; for serve/tracking setups). */
export async function seedBanner(
  prisma: PrismaService,
  data: Partial<Prisma.BannerUncheckedCreateInput> & { slot?: BannerSlot } = {},
): Promise<Banner> {
  const media = data.pcMediaId ? null : await bannerMedia(prisma);
  return prisma.banner.create({
    data: {
      slot: 'MAIN_HERO',
      title: '테스트 배너',
      linkUrl: 'https://ad.example.com/landing',
      startAt: inHours(-1),
      endAt: inHours(24),
      ...data,
      pcMediaId: data.pcMediaId ?? media!.id,
    },
  });
}

export async function seedPopup(
  prisma: PrismaService,
  data: Partial<Prisma.PopupUncheckedCreateInput> = {},
): Promise<Popup> {
  const media = data.mediaId ? null : await popupMedia(prisma);
  return prisma.popup.create({
    data: {
      title: '테스트 팝업',
      targetPages: ['MAIN'],
      startAt: inHours(-1),
      endAt: inHours(24),
      ...data,
      mediaId: data.mediaId ?? media!.id,
    },
  });
}

/** `field` of every item of a paginated / `{ items }` response body. */
export function pluck<T = string>(res: { body: unknown }, field = 'id'): T[] {
  return (res.body as { items: Record<string, T>[] }).items.map((x) => x[field] as T);
}
