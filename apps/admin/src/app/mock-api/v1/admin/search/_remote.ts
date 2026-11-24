import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { selfGet } from '../dashboard/_remote';

/**
 * MOCK ONLY. The real `GET /admin/search` queries listings, offices and members. The mock builds
 * its corpus from the sibling mock resources (m-moderation) so every hit opens a record that exists
 * there; each group falls back to the local fixtures when its sibling mock is unavailable.
 */
export interface CorpusRow<T> {
  /** Text the query is matched against (may include values that are masked in `item`). */
  match: (string | null | undefined)[];
  item: T;
}

const opt = z.string().nullish();
const num = z.number().nullish();

const listingPage = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      title: opt,
      dealType: z.string(),
      status: z.string(),
      salePrice: num,
      presalePrice: num,
      deposit: num,
      monthlyRent: num,
      complexName: opt,
      buildingName: opt,
      dong: opt,
      emdName: opt,
      supplyArea: num,
      primaryAgency: z.object({ name: z.string() }).nullish(),
    }),
  ),
});

/**
 * ASSUMED field: a short human-facing 매물번호 (the draft's search promises one, the backend has no
 * such column yet). The mock derives a stable 8-digit number from the id.
 */
export function mockListingNo(id: string): string {
  const tail = Number((id.split('-').pop() ?? '').replace(/\D/g, '')) || 0;
  // Plain sequential 6-digit numbers like the API's (shared formatListingNo).
  return String(100_000 + (tail % 900_000));
}

const pyeong = (sqm: number) => `${Math.round(sqm / 3.305785)}평`;
const int = (v: number | null | undefined) => (typeof v === 'number' ? Math.round(v) : null);

export async function remoteListings(req: NextRequest) {
  const parsed = listingPage.safeParse(await selfGet(req, '/admin/listings?pageSize=100'));
  if (!parsed.success) return null;
  return parsed.data.items.map((l) => {
    const listingNo = mockListingNo(l.id);
    const title = l.complexName
      ? [l.complexName, l.dong, l.supplyArea ? pyeong(l.supplyArea) : null]
          .filter(Boolean)
          .join(' ')
      : (l.title ?? l.buildingName ?? '매물');
    return {
      match: [listingNo, title, l.title, l.buildingName, l.primaryAgency?.name, l.emdName],
      item: {
        id: l.id,
        listingNo,
        title,
        dealType: l.dealType,
        price: int(l.salePrice ?? l.presalePrice),
        deposit: int(l.deposit),
        monthlyRent: int(l.monthlyRent),
        status: l.status,
        agencyName: l.primaryAgency?.name ?? null,
        areaName: l.emdName ?? null,
      },
    };
  });
}

const agencyPage = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      representativeName: z.string(),
      registrationNumber: opt,
      status: z.string(),
      emdName: opt,
      activeListingCount: z.number().default(0),
    }),
  ),
});

export async function remoteAgencies(req: NextRequest) {
  const parsed = agencyPage.safeParse(await selfGet(req, '/admin/agencies?pageSize=100'));
  if (!parsed.success) return null;
  return parsed.data.items.map((a) => ({
    match: [a.name, a.representativeName, a.registrationNumber, a.emdName],
    item: {
      id: a.id,
      name: a.name,
      representativeName: a.representativeName,
      registrationNumber: a.registrationNumber ?? null,
      status: a.status,
      areaName: a.emdName ?? null,
      listingCount: a.activeListingCount,
    },
  }));
}

const userPage = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      name: opt,
      nickname: opt,
      email: opt,
      phone: opt,
      role: z.string(),
      status: z.string(),
      providers: z.array(z.string()).default([]),
      createdAt: opt,
    }),
  ),
});

/** "kim.seojin@example.com" → "ki***@example.com" */
export function maskEmail(email: string): string {
  const at = email.indexOf('@');
  if (at < 1) return '***';
  return `${email.slice(0, Math.min(2, at))}***${email.slice(at)}`;
}
/** "01012345678" / "010-1234-5678" → "010-****-5678" */
export function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 7) return '***';
  return `${digits.slice(0, 3)}-****-${digits.slice(-4)}`;
}
/** "김서진" → "김*진", "한결" → "한*" */
export function maskName(name: string): string {
  const chars = [...name.trim()];
  if (chars.length <= 1) return name;
  return chars.length === 2
    ? `${chars[0]}*`
    : `${chars[0]}${'*'.repeat(chars.length - 2)}${chars.at(-1)}`;
}

export async function remoteUsers(req: NextRequest) {
  const parsed = userPage.safeParse(await selfGet(req, '/admin/users?pageSize=100'));
  if (!parsed.success) return null;
  return parsed.data.items.map((u) => ({
    // matched on the full values, shown masked (the real API is expected to mask as well)
    match: [u.nickname, u.name, u.email, u.phone],
    item: {
      id: u.id,
      nickname: u.nickname ?? (u.name ? maskName(u.name) : '(닉네임 없음)'),
      name: u.name ? maskName(u.name) : null,
      email: u.email ? maskEmail(u.email) : null,
      phone: u.phone ? maskPhone(u.phone) : null,
      role: u.role,
      status: u.status,
      provider: u.providers[0] ?? null,
      joinedAt: u.createdAt ?? null,
    },
  }));
}
