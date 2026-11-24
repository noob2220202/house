import { agencyUpdateSchema } from '@house/shared';
import { describe, expect, it } from 'vitest';
import type { Media } from '../api/schemas';
import { buildProfilePatch, PROFILE_IMAGE_PURPOSE, unpersistedProfileFields } from './profile';

const media = (id: string): Media => ({
  id,
  purpose: 'AGENCY_LOGO',
  mimeType: 'image/png',
  width: 400,
  height: 400,
  variants: {},
});

const saved = {
  intro: '신대지구 전문',
  phone: '0617200000',
  mobile: '01000000000',
  specialties: ['APT' as const],
  businessHours: { mon: { open: '09:00', close: '18:00' } },
  logo: media('logo-1'),
  cover: null,
};

const unchanged = {
  values: {
    intro: '신대지구 전문',
    phone: '061-720-0000',
    mobile: '010-0000-0000',
    specialties: ['APT' as const],
  },
  hours: { mon: { open: '09:00', close: '18:00' }, sun: null },
  logo: media('logo-1'),
  cover: null,
};

describe('buildProfilePatch', () => {
  it('sends only specialties when nothing changed (formatting differences are not changes)', () => {
    const patch = buildProfilePatch(saved, unchanged);
    expect(patch).toEqual({ specialties: ['APT'] });
    expect(agencyUpdateSchema.safeParse(patch).success).toBe(true);
  });

  it('never sends null for an empty intro and sends only dirty fields', () => {
    const patch = buildProfilePatch(saved, {
      ...unchanged,
      values: { ...unchanged.values, intro: '' },
    });
    expect(patch).toEqual({ specialties: ['APT'], intro: '' });
    expect(agencyUpdateSchema.safeParse(patch).success).toBe(true);
  });

  it('clears the mobile number with null only when the owner emptied it', () => {
    expect(
      buildProfilePatch(saved, { ...unchanged, values: { ...unchanged.values, mobile: '' } }),
    ).toEqual({ specialties: ['APT'], mobile: null });
    expect(
      buildProfilePatch(
        { ...saved, mobile: null },
        { ...unchanged, values: { ...unchanged.values, mobile: '' } },
      ),
    ).toEqual({ specialties: ['APT'] });
  });

  it('includes hours, logo and cover only when they changed', () => {
    const patch = buildProfilePatch(saved, {
      ...unchanged,
      hours: { mon: { open: '10:00', close: '18:00' } },
      logo: null,
      cover: media('cover-1'),
    });
    expect(patch).toMatchObject({
      businessHours: { mon: { open: '10:00', close: '18:00' } },
      logoMediaId: null,
      coverMediaId: 'cover-1',
    });
  });
});

describe('unpersistedProfileFields', () => {
  it('reports fields the response did not keep', () => {
    const patch = {
      specialties: [],
      businessHours: { mon: { open: '10:00', close: '18:00' } },
      logoMediaId: 'logo-2',
    };
    expect(unpersistedProfileFields(patch, saved)).toEqual(['영업시간', '로고']);
    expect(
      unpersistedProfileFields(patch, {
        ...saved,
        businessHours: { mon: { open: '10:00', close: '18:00' } },
        logo: media('logo-2'),
      }),
    ).toEqual([]);
  });
});

describe('PROFILE_IMAGE_PURPOSE', () => {
  it('uploads the cover as AGENCY_COVER and the logo as AGENCY_LOGO (the API rejects a logo as cover)', () => {
    expect(PROFILE_IMAGE_PURPOSE).toEqual({ logo: 'AGENCY_LOGO', cover: 'AGENCY_COVER' });
  });
});
