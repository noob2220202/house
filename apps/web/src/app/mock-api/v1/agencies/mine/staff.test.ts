import { COOKIE_NAMES } from '@house/shared';
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// The mock routes 404 unless mock mode is on; the flag is read when the modules load.
vi.hoisted(() => {
  process.env.NEXT_PUBLIC_API_MOCK = '1';
});

import {
  agencyInviteSchema,
  agencyInvitesSchema,
  agencyMemberSchema,
  agencyMembersSchema,
  agencyMembershipSchema,
} from '@/features/a-agency/api/schemas';
import { mockSessionValue, type MockRole } from '@/lib/mock';
import { mediaStore } from '../../media/_store';
import { GET as getMembership } from '../membership/route';
import { POST as join } from '../join/route';
import { GET as listInvites, POST as createInvite } from './invites/route';
import { DELETE as revokeInvite } from './invites/[inviteId]/route';
import { PATCH as patchMember } from './members/[memberId]/route';
import { GET as listMembers } from './members/route';
import { resetAgencyState } from './_store';

const CSRF = 'csrf-test';
function req(path: string, role: MockRole, init: { method?: string; body?: unknown } = {}) {
  const r = new NextRequest(
    `http://localhost/mock-api/v1${path}${path.includes('?') ? '&' : '?'}_delay=1`,
    {
      method: init.method ?? 'GET',
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      headers: { 'content-type': 'application/json', 'x-csrf-token': CSRF },
    },
  );
  r.cookies.set(COOKIE_NAMES.SESSION, mockSessionValue(role));
  r.cookies.set(COOKIE_NAMES.CSRF, CSRF);
  return r;
}
const params = <T extends Record<string, string>>(p: T) => ({ params: Promise.resolve(p) });

beforeEach(() => {
  resetAgencyState();
});

describe('agencies mock — staff & invites (B3 contract)', () => {
  it('members are Paginated without INVITED rows; invites list has no codes', async () => {
    const members = await listMembers(req('/agencies/mine/members', 'AGENCY_OWNER'));
    const body = (await members.json()) as { items: unknown[]; total: number };
    expect(body.total).toBe(body.items.length);
    const rows = agencyMembersSchema.parse(body);
    expect(rows.every((m) => m.status === 'ACTIVE')).toBe(true);

    const invites = agencyInvitesSchema.parse(
      await (await listInvites(req('/agencies/mine/invites', 'AGENCY_OWNER'))).json(),
    );
    expect(invites.length).toBeGreaterThan(0);
    expect(invites.every((i) => i.code == null && i.codeHint.length === 4)).toBe(true);
  });

  it('shows the code once on creation, then a staff member joins with it as 중개보조원', async () => {
    const created = await createInvite(
      req('/agencies/mine/invites', 'AGENCY_OWNER', {
        method: 'POST',
        body: { label: '김실장', expiresInHours: 24 },
      }),
    );
    expect(created.status).toBe(201);
    const invite = agencyInviteSchema.parse(await created.json());
    expect(invite.code).toMatch(/^[A-HJ-NP-Z2-9]{10}$/);
    expect(invite.codeHint).toBe(invite.code?.slice(-4));

    // A join without the display name is refused like the API (agencyJoinSchema).
    const consents = [{ type: 'PRIVACY_AGENCY_JOIN', version: '1.0' }];
    expect(
      (
        await join(
          req('/agencies/join', 'USER', { method: 'POST', body: { code: invite.code, consents } }),
        )
      ).status,
    ).toBe(400);

    const joined = await join(
      req('/agencies/join', 'USER', {
        method: 'POST',
        body: { code: invite.code, displayName: '김실장', consents, isLicensed: true },
      }),
    );
    expect(joined.status).toBe(200);
    const membership = agencyMembershipSchema.parse(await joined.json());
    expect(membership).toMatchObject({ role: 'AGENT', displayName: '김실장' });

    // Single use: the code is gone, the new member is an assistant until the owner records a license.
    const again = await join(
      req('/agencies/join', 'USER', {
        method: 'POST',
        body: { code: invite.code, displayName: '다른 사람', consents },
      }),
    );
    expect(again.status).toBe(404);
    const rows = agencyMembersSchema.parse(
      await (await listMembers(req('/agencies/mine/members', 'AGENCY_OWNER'))).json(),
    );
    expect(rows.find((m) => m.displayName === '김실장')).toMatchObject({ isLicensed: false });
  });

  it('revokes an invite (DELETE) and sets the license flag via PATCH', async () => {
    const [first] = agencyInvitesSchema.parse(
      await (await listInvites(req('/agencies/mine/invites', 'AGENCY_OWNER'))).json(),
    );
    const res = await revokeInvite(
      req(`/agencies/mine/invites/${first!.id}`, 'AGENCY_OWNER', { method: 'DELETE' }),
      params({ inviteId: first!.id }),
    );
    expect(res.status).toBe(204);

    const rows = agencyMembersSchema.parse(
      await (await listMembers(req('/agencies/mine/members', 'AGENCY_OWNER'))).json(),
    );
    const assistant = rows.find((m) => m.role === 'AGENT' && !m.isLicensed)!;
    const noNumber = await patchMember(
      req(`/agencies/mine/members/${assistant.id}`, 'AGENCY_OWNER', {
        method: 'PATCH',
        body: { isLicensed: true },
      }),
      params({ memberId: assistant.id }),
    );
    expect(noNumber.status).toBe(400);
    const licensed = await patchMember(
      req(`/agencies/mine/members/${assistant.id}`, 'AGENCY_OWNER', {
        method: 'PATCH',
        body: { isLicensed: true, licenseNumber: '2021-전남-00123' },
      }),
      params({ memberId: assistant.id }),
    );
    expect(agencyMemberSchema.parse(await licensed.json())).toMatchObject({
      isLicensed: true,
      licenseNumber: '2021-전남-00123',
    });
  });

  it('staff read their membership; owner-only routes stay closed to them', async () => {
    const res = await getMembership(req('/agencies/membership', 'AGENT'));
    expect(agencyMembershipSchema.parse(await res.json()).role).toBe('AGENT');
    expect((await listInvites(req('/agencies/mine/invites', 'AGENT'))).status).toBe(403);
    expect((await getMembership(req('/agencies/membership', 'USER'))).status).toBe(404);
  });

  it('serves placeholder files for the seeded documents (review fix: no 404 in mock)', () => {
    const file = mediaStore().get('seed-office-registration');
    expect(file?.mimeType).toBe('application/pdf');
    expect(new TextDecoder().decode(file?.bytes.slice(0, 8))).toBe('%PDF-1.4');
  });
});
