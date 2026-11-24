import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api';
import { fetchStaffAgency } from './queries';
import { myAgencySchema } from './schemas';

const MEMBERSHIP = {
  memberId: 'm1',
  role: 'AGENT',
  displayName: '오세린',
  agency: {
    id: 'ag1',
    name: '신대중앙 공인중개사사무소',
    phone: '0617220000',
    roadAddress: '신대1로 18',
    status: 'APPROVED',
  },
};
const PROFILE = {
  id: 'ag1',
  name: '신대중앙 공인중개사사무소',
  representativeName: '김서진',
  registrationNumber: '46150-2020-00012',
  phone: '0617220000',
  roadAddress: '전남광주통합특별시 순천시 해룡면 신대1로 18',
  addressDetail: null,
  emdCode: '12150330',
  lat: 34.93,
  lng: 127.55,
  specialties: ['APT'],
  logoUrl: '/media/logo.webp',
  activeListingCount: 12,
  members: [],
};

describe('B2 — staff console without /agencies/mine', () => {
  it('builds the staff view from the membership + the public profile', async () => {
    const get = vi.fn(async (path: string) =>
      path === '/agencies/membership' ? MEMBERSHIP : PROFILE,
    );
    const agency = await fetchStaffAgency(get);
    expect(get).toHaveBeenNthCalledWith(2, '/agencies/ag1', expect.anything());
    expect(agency).toMatchObject({
      id: 'ag1',
      myRole: 'AGENT',
      status: 'APPROVED',
      businessNumber: null,
      documents: [],
      registrationNumber: '46150-2020-00012',
    });
    expect(agency?.logo?.variants.thumb?.url).toBe('/media/logo.webp');
  });

  it('is null for owners and for users without a membership', async () => {
    expect(await fetchStaffAgency(async () => ({ ...MEMBERSHIP, role: 'OWNER' }))).toBeNull();
    const missing = async () => {
      throw new ApiError(404, { code: 'AGENCY_NOT_FOUND', message: '없음' });
    };
    expect(await fetchStaffAgency(missing)).toBeNull();
  });
});

describe('myAgencySchema (API MyAgency → console view)', () => {
  it('maps logoUrl/logoMediaId to the logo media and originalFilename to fileName', () => {
    const agency = myAgencySchema.parse({
      ...PROFILE,
      status: 'APPROVED',
      myRole: 'OWNER',
      logoMediaId: 'media-1',
      createdAt: '2025-03-10T05:05:00Z',
      updatedAt: '2025-03-10T05:05:00Z',
      documents: [
        {
          id: 'd1',
          type: 'REGISTRATION_CERT',
          mediaId: 'media-doc',
          mimeType: 'application/pdf',
          sizeBytes: 1200,
          originalFilename: '등록증.pdf',
          createdAt: '2025-03-10T05:00:00Z',
        },
      ],
    });
    expect(agency.logo).toMatchObject({
      id: 'media-1',
      variants: { thumb: { url: '/media/logo.webp' } },
    });
    expect(agency.documents[0]?.fileName).toBe('등록증.pdf');
  });
});
