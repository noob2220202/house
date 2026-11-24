import { DEFAULT_SGG_CODE, maskEmail, maskPhone, normalizePhone } from '@house/shared';
import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  type AdminSearchAgency,
  type AdminSearchListing,
  type AdminSearchQuery,
  type AdminSearchResult,
  type AdminSearchUser,
} from '../schemas';
import { listingHeadline, maskName, priceFields, regionNames } from './admin-format';

const ci = (value: string) => ({ contains: value, mode: 'insensitive' as const });

/** The query as typed and without spaces / hyphens ("신대 레이크-파크" also finds "신대레이크파크"). */
export function searchVariants(q: string): string[] {
  const compact = q.replace(/[\s-]+/g, '');
  return [...new Set([q, compact].filter((v) => v.length > 0))];
}

/** Registration-number search key, the way `agencies.registration_key` is generated. */
export function registrationKeyOf(q: string): string {
  return q.replace(/[^0-9A-Za-z가-힣]/g, '').toUpperCase();
}

const listingSelect = {
  id: true,
  title: true,
  dealType: true,
  status: true,
  salePrice: true,
  presalePrice: true,
  deposit: true,
  monthlyRent: true,
  exclusiveArea: true,
  emdCode: true,
  complex: { select: { name: true } },
  property: { select: { buildingName: true, roadAddress: true } },
  primaryAgency: { select: { name: true } },
} satisfies Prisma.ListingSelect;

const agencySelect = {
  id: true,
  name: true,
  representativeName: true,
  registrationNumber: true,
  status: true,
  emdCode: true,
  activeListingCount: true,
} satisfies Prisma.AgencySelect;

const userSelect = {
  id: true,
  nickname: true,
  name: true,
  email: true,
  phone: true,
  role: true,
  status: true,
  createdAt: true,
  identities: { select: { provider: true }, orderBy: { createdAt: 'asc' }, take: 1 },
} satisfies Prisma.UserSelect;

/**
 * Topbar search of the back office: listings (title, complex, building, address, office, 읍면동),
 * agencies (name, 대표, 등록번호, address, 읍면동) and members (nickname, name, e-mail, phone).
 * Members are matched on full values but returned masked. Read-only, never cached (free text).
 */
@Injectable()
export class AdminSearchService {
  constructor(private readonly prisma: PrismaService) {}

  async search(q: AdminSearchQuery): Promise<AdminSearchResult> {
    const query = q.q.trim();
    const variants = searchVariants(query);
    const emdCodes = await this.matchingRegionCodes(variants);
    const [listings, agencies, users] = await Promise.all([
      this.listings(variants, emdCodes, q.limit),
      this.agencies(query, variants, emdCodes, q.limit),
      this.users(query, variants, q.limit),
    ]);
    return { query, listings, agencies, users };
  }

  /** 읍면동 / 리 of the service area whose name matches ("조례" → 조례동). */
  private async matchingRegionCodes(variants: string[]): Promise<string[]> {
    const rows = await this.prisma.region.findMany({
      where: {
        code: { startsWith: DEFAULT_SGG_CODE },
        level: { in: ['EMD', 'RI'] },
        OR: variants.map((v) => ({ name: ci(v) })),
      },
      select: { code: true },
      take: 50,
    });
    return rows.map((r) => r.code);
  }

  private async listings(variants: string[], emdCodes: string[], limit: number) {
    const or: Prisma.ListingWhereInput[] = variants.flatMap((v) => [
      { title: ci(v) },
      { complex: { name: ci(v) } },
      { property: { buildingName: ci(v) } },
      { property: { roadAddress: ci(v) } },
      { primaryAgency: { name: ci(v) } },
    ]);
    if (emdCodes.length) or.push({ emdCode: { in: emdCodes } });
    const where: Prisma.ListingWhereInput = { deletedAt: null, OR: or };
    const [rows, total] = await Promise.all([
      this.prisma.listing.findMany({
        where,
        select: listingSelect,
        orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
        take: limit,
      }),
      this.prisma.listing.count({ where }),
    ]);
    const names = await regionNames(
      this.prisma,
      rows.map((r) => r.emdCode),
    );
    const items: AdminSearchListing[] = rows.map((l) => ({
      id: l.id,
      listingNo: null,
      title: listingHeadline(l),
      dealType: l.dealType,
      ...priceFields(l.dealType, l),
      status: l.status,
      agencyName: l.primaryAgency.name,
      areaName: (l.emdCode && names.get(l.emdCode)) || null,
    }));
    return { total, items };
  }

  private async agencies(query: string, variants: string[], emdCodes: string[], limit: number) {
    const or: Prisma.AgencyWhereInput[] = variants.flatMap((v) => [
      { name: ci(v) },
      { representativeName: ci(v) },
      { roadAddress: ci(v) },
    ]);
    const key = registrationKeyOf(query);
    if (key.length >= 2) or.push({ registrationKey: { contains: key } });
    if (emdCodes.length) or.push({ emdCode: { in: emdCodes } });
    const where: Prisma.AgencyWhereInput = { deletedAt: null, OR: or };
    const [rows, total] = await Promise.all([
      this.prisma.agency.findMany({
        where,
        select: agencySelect,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: limit,
      }),
      this.prisma.agency.count({ where }),
    ]);
    const names = await regionNames(
      this.prisma,
      rows.map((r) => r.emdCode),
    );
    const items: AdminSearchAgency[] = rows.map((a) => ({
      id: a.id,
      name: a.name,
      representativeName: a.representativeName,
      registrationNumber: a.registrationNumber,
      status: a.status,
      areaName: (a.emdCode && names.get(a.emdCode)) || null,
      listingCount: a.activeListingCount,
    }));
    return { total, items };
  }

  private async users(query: string, variants: string[], limit: number) {
    const or: Prisma.UserWhereInput[] = variants.flatMap((v) => [
      { nickname: ci(v) },
      { name: ci(v) },
      { email: ci(v) },
    ]);
    const digits = normalizePhone(query);
    if (/^[\d\s+()-]+$/.test(query) && digits.length >= 4) or.push({ phone: { contains: digits } });
    const where: Prisma.UserWhereInput = { OR: or };
    const [rows, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: userSelect,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: limit,
      }),
      this.prisma.user.count({ where }),
    ]);
    const items: AdminSearchUser[] = rows.map((u) => ({
      id: u.id,
      nickname: u.nickname ?? maskName(u.name) ?? '(닉네임 없음)',
      name: maskName(u.name),
      email: maskEmail(u.email),
      phone: u.phone ? maskPhone(u.phone) : null,
      role: u.role,
      status: u.status,
      provider: u.identities[0]?.provider ?? null,
      joinedAt: u.createdAt.toISOString(),
    }));
    return { total, items };
  }
}
