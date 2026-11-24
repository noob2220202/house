import { COOKIE_NAMES } from '@house/shared';
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// The mock routes 404 unless mock mode is on; the flag is read when the modules load.
vi.hoisted(() => {
  process.env.NEXT_PUBLIC_API_MOCK = '1';
});

import { mockSessionValue, type MockRole } from '@/lib/mock';
import { agencyState, resetAgencyState } from '../../mine/_store';
import { POST as leave } from './route';

const CSRF = 'csrf-test';
function req(role: MockRole, csrf = CSRF) {
  const r = new NextRequest('http://localhost/mock-api/v1/agencies/membership/leave?_delay=1', {
    method: 'POST',
    headers: { 'x-csrf-token': csrf },
  });
  r.cookies.set(COOKIE_NAMES.SESSION, mockSessionValue(role));
  r.cookies.set(COOKIE_NAMES.CSRF, CSRF);
  return r;
}

beforeEach(() => {
  resetAgencyState();
});

describe('POST /agencies/membership/leave (mock)', () => {
  it('lets a 소속 중개사 leave: 204, the member is gone and the session is a plain member', async () => {
    const before = resetAgencyState().members.filter(
      (m) => m.status === 'ACTIVE' && m.role === 'AGENT',
    ).length;
    const res = await leave(req('AGENT'));
    expect(res.status).toBe(204);
    expect(res.headers.get('set-cookie')).toContain(
      `${COOKIE_NAMES.SESSION}=${mockSessionValue('USER')}`,
    );
    expect(
      agencyState().members.filter((m) => m.status === 'ACTIVE' && m.role === 'AGENT'),
    ).toHaveLength(before - 1);
  });

  it('refuses the owner and callers without a membership, like the API', async () => {
    const owner = await leave(req('AGENCY_OWNER'));
    expect(owner.status).toBe(400);
    expect(await owner.json()).toMatchObject({ code: 'AGENCY_OWNER_NOT_REMOVABLE' });

    const user = await leave(req('USER'));
    expect(user.status).toBe(404);
    expect(await user.json()).toMatchObject({ code: 'AGENCY_MEMBER_NOT_FOUND' });
  });

  it('checks the CSRF header with the backend error code', async () => {
    const res = await leave(req('AGENT', 'wrong'));
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ code: 'CSRF_FAILED' });
  });
});
