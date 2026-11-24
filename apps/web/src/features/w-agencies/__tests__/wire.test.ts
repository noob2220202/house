import { describe, expect, it } from 'vitest';
import { agencyDetailSchema, agencyPageSchema } from '../api/schemas';
import { withEmdNames } from '../lib/agency';

const summary = {
  id: 'b01',
  name: '신대중앙 공인중개사사무소',
  representativeName: '김서진',
  registrationNumber: '46150-2019-00012',
  phone: '0610000000',
  roadAddress: '순천시 해룡면 신대1로 10',
  addressDetail: null,
  emdCode: '1215033028',
  lat: 34.93,
  lng: 127.55,
  specialties: ['APT'],
  logoUrl: null,
  activeListingCount: 46,
};

describe('agencies wire shapes', () => {
  it('parses the backend AgencySummary page', () => {
    const page = agencyPageSchema.parse({
      items: [summary],
      page: 1,
      pageSize: 20,
      total: 1,
      totalPages: 1,
    });
    expect(page.items[0]).toMatchObject({ id: 'b01', topComplexes: [] });
    expect(page.items[0]?.emdName ?? null).toBeNull();
  });

  it('maps the AgencyProfile counts and 대표 매물', () => {
    const d = agencyDetailSchema.parse({
      ...summary,
      mobile: null,
      email: null,
      jibunAddress: null,
      intro: '신대지구 전문',
      businessHours: { mon: { open: '09:00', close: '18:00' }, note: '점심 12–13시' },
      approvedAt: '2020-03-02T00:00:00.000Z',
      warningCount: 0,
      members: [
        { id: 'm1', displayName: '김서진', title: '대표', role: 'OWNER', isLicensed: true },
      ],
      listingCounts: {
        total: 5,
        byAssetType: { APT: 4, ONEROOM: 1 },
        byDealType: { SALE: 3, MONTHLY: 2 },
      },
      representativeListings: [
        {
          id: 'L1',
          assetType: 'APT',
          dealType: 'SALE',
          title: null,
          complexName: '레이크파크',
          salePrice: 44500,
          deposit: null,
          monthlyRent: null,
          presalePrice: null,
          premium: null,
          exclusiveArea: 84.98,
          rooms: 3,
          thumbnailUrl: '/t.webp',
          verifiedAt: null,
          publishedAt: null,
        },
      ],
      disclosure: {
        agencyId: 'b01',
        name: summary.name,
        address: summary.roadAddress,
        roadAddress: summary.roadAddress,
        phone: summary.phone,
        registrationNumber: summary.registrationNumber,
        representativeName: '김서진',
      },
    });
    expect(d.listingCounts).toEqual({ presale: 0, sale: 3, jeonse: 0, monthly: 2 });
    expect(d.listingCountsByAsset).toEqual({ APT: 4, ONEROOM: 1 });
    expect(d.featuredListings[0]).toMatchObject({
      id: 'L1',
      complexName: '레이크파크',
      coverPhotoUrl: '/t.webp',
    });
    expect(d.members[0]).toMatchObject({ displayName: '김서진', role: 'OWNER' });
    expect(d.stats ?? null).toBeNull();
  });

  it('fills 읍면동 names from the regions facet', () => {
    const [named] = withEmdNames(
      [{ ...summary, emdName: null as string | null }],
      [
        { emdCode: '12150330', name: '해룡면' },
        { emdCode: '1215033028', name: '신대리' },
      ],
    );
    expect(named?.emdName).toBe('신대리');
    expect(
      withEmdNames([{ emdCode: null, emdName: null }], [{ emdCode: '1', name: 'x' }])[0]?.emdName,
    ).toBeNull();
  });
});
