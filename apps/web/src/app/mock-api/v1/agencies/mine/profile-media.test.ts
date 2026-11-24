import { COOKIE_NAMES } from '@house/shared';
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// The mock routes 404 unless mock mode is on; the flag is read when the modules load.
vi.hoisted(() => {
  process.env.NEXT_PUBLIC_API_MOCK = '1';
});

import { mockSessionValue, mockUuid } from '@/lib/mock';
import { mediaStore } from '../../media/_store';
import { PATCH } from './route';
import { resetAgencyState } from './_store';

const CSRF = 'csrf-test';
function patch(body: unknown) {
  const r = new NextRequest('http://localhost/mock-api/v1/agencies/mine?_delay=1', {
    method: 'PATCH',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json', 'x-csrf-token': CSRF },
  });
  r.cookies.set(COOKIE_NAMES.SESSION, mockSessionValue('AGENCY_OWNER'));
  r.cookies.set(COOKIE_NAMES.CSRF, CSRF);
  return r;
}
function upload(id: string, purpose: string) {
  mediaStore().set(id, {
    id,
    purpose,
    mimeType: 'image/png',
    fileName: `${id}.png`,
    bytes: new Uint8Array(),
    createdAt: Date.now(),
  });
}

const LOGO = mockUuid('LOGO-UP');
const COVER = mockUuid('COVER-UP');

beforeEach(() => {
  resetAgencyState();
  upload(LOGO, 'AGENCY_LOGO');
  upload(COVER, 'AGENCY_COVER');
});

describe('agencies mock — PATCH /agencies/mine images (API purpose rules)', () => {
  it('attaches an AGENCY_LOGO upload as logo and an AGENCY_COVER upload as cover', async () => {
    const res = await PATCH(patch({ specialties: [], logoMediaId: LOGO, coverMediaId: COVER }));
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, { id: string } | null>;
    expect(body.logo?.id).toBe(LOGO);
    expect(body.cover?.id).toBe(COVER);
  });

  it('rejects a logo upload as cover (AGENCY_COVER_INVALID) and a cover upload as logo', async () => {
    const cover = await PATCH(patch({ specialties: [], coverMediaId: LOGO }));
    expect(cover.status).toBe(400);
    expect(((await cover.json()) as { code: string }).code).toBe('AGENCY_COVER_INVALID');
    const logo = await PATCH(patch({ specialties: [], logoMediaId: COVER }));
    expect(logo.status).toBe(400);
    expect(((await logo.json()) as { code: string }).code).toBe('AGENCY_LOGO_INVALID');
  });
});
