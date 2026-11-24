import { describe, expect, it } from 'vitest';
import { dealRequestDetailSchema, dealRequestPageSchema, proposalSchema } from './schemas';

const view = {
  id: 'r1',
  type: 'SELL_OR_LEASE',
  status: 'OPEN',
  assetType: 'APT',
  dealTypes: ['SALE'],
  visibility: 'ALL_AGENCIES_IN_REGION',
  sggCode: '12150',
  emdCode: '1215033028',
  roadAddress: '순천시 해룡면 신대2로 40',
  complex: { id: 'C01', name: '신대 레이크파크' },
  lat: null,
  lng: null,
  exclusiveArea: 84.98,
  floor: null,
  desiredSalePrice: 44500,
  desiredDeposit: null,
  desiredMonthlyRent: null,
  regionCodes: [],
  complexIds: [],
  priceMin: null,
  priceMax: null,
  depositMin: null,
  depositMax: null,
  rentMin: null,
  rentMax: null,
  areaMin: null,
  areaMax: null,
  roomsMin: null,
  moveInDate: null,
  description: null,
  photos: [{ mediaId: 'p1', url: '/m.webp', thumbUrl: '/t.webp' }],
  proposalCount: 2,
  expiresAt: '2026-12-20T00:00:00.000Z',
  closedAt: null,
  createdAt: '2026-11-20T00:00:00.000Z',
  contactName: '김하늘',
  contactPhone: '01000001234',
  addressDetail: '103동 1502호',
  targetAgencyIds: ['a', 'b', 'c'],
  closeReason: null,
  extensionCount: 0,
  contactGrants: [],
};

const proposal = {
  id: 'p1',
  dealRequestId: 'r1',
  status: 'SENT',
  message: '안녕하세요',
  suggestedPrice: null,
  suggestedDeposit: null,
  suggestedMonthlyRent: null,
  agencyId: 'b01',
  agency: {
    agencyId: 'b01',
    name: '신대중앙',
    address: '순천시',
    roadAddress: '순천시',
    phone: '0610000000',
    registrationNumber: '46150-1',
    representativeName: '김서진',
  },
  agent: { displayName: '박민지', phone: null },
  listings: [
    {
      id: 'L1',
      title: null,
      assetType: 'APT',
      dealType: 'PRESALE',
      status: 'ACTIVE',
      salePrice: null,
      deposit: null,
      monthlyRent: null,
      presalePrice: 40000,
      premium: 1900,
      exclusiveArea: 84.9,
    },
  ],
  contactShared: true,
  viewedAt: null,
  respondedAt: null,
  createdAt: '2026-11-21T00:00:00.000Z',
};

describe('deal-request wire shapes', () => {
  it('maps MyDealRequestView', () => {
    const page = dealRequestPageSchema.parse({
      items: [view],
      page: 1,
      pageSize: 20,
      total: 1,
      totalPages: 1,
    });
    const r = page.items[0]!;
    expect(r).toMatchObject({
      complexId: 'C01',
      complexName: '신대 레이크파크',
      targetAgencyCount: 3,
      updatedAt: '2026-11-20T00:00:00.000Z',
      pendingProposalCount: 0,
    });
    expect(r.photos[0]?.variants.thumb?.url).toBe('/t.webp');
  });

  it('maps ProposalView and counts the unanswered proposals of a detail', () => {
    const p = proposalSchema.parse(proposal);
    expect(p).toMatchObject({
      agency: { id: 'b01', name: '신대중앙', representativeName: '김서진' },
      memberName: '박민지',
      contactGranted: true,
    });
    expect(p.listings[0]).toMatchObject({ title: '', price: 41900 });
    const deleted = proposalSchema.parse({
      ...proposal,
      agency: null,
      agent: null,
      contactShared: false,
    });
    expect(deleted.agency).toMatchObject({ id: 'b01', name: '탈퇴한 중개사무소' });
    const d = dealRequestDetailSchema.parse({
      ...view,
      proposals: [proposal, { ...proposal, id: 'p2', status: 'ACCEPTED' }],
    });
    expect(d.pendingProposalCount).toBe(1);
    expect(d.proposals).toHaveLength(2);
  });
});
