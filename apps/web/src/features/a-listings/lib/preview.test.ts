import { FloorClass, FloorDisplay, ListingStatus } from '@house/shared';
import { describe, expect, it } from 'vitest';
import { seedListings } from '@/app/mock-api/v1/agency/listings/_fixtures';
import { toView } from '@/app/mock-api/v1/agency/listings/_store';
import { listingDetailSchema } from '@/features/w-listing/api/schemas';
import type { AgencyListing } from '../api/schemas';
import { draftOfListing } from './form';
import type { PhotoValue } from './photos';
import { buildPreviewDetail, missingAgencyDisclosure, type PreviewContext } from './preview';

const seeds = seedListings();
const view = (code: string): AgencyListing => {
  const found = seeds.find((s) => s.code === code);
  if (!found) throw new Error(`missing seed ${code}`);
  return toView(found);
};

const context = (listing: AgencyListing, patch: Partial<PreviewContext> = {}): PreviewContext => ({
  listing,
  agencies: listing.agencies,
  complex: null,
  photos: listing.photos.map(
    (p): PhotoValue => ({
      mediaId: p.mediaId,
      url: p.url,
      thumbUrl: p.thumbUrl ?? null,
      caption: p.caption ?? '',
      isCover: p.isCover,
    }),
  ),
  verifications: listing.verifications,
  today: '2026-11-24',
  ...patch,
});

describe('buildPreviewDetail', () => {
  it('produces a payload the PUBLIC listing schema accepts, for every seeded listing', () => {
    for (const seed of seeds) {
      const listing = toView(seed);
      const detail = buildPreviewDetail(draftOfListing(listing), context(listing));
      expect(listingDetailSchema.safeParse(detail).success, seed.code).toBe(true);
    }
  });

  it('never carries the private 호수', () => {
    const listing = view('L01');
    expect(listing.property.ho).toBeTruthy();
    const detail = buildPreviewDetail(draftOfListing(listing), context(listing));
    expect(detail.property).not.toHaveProperty('ho');
    expect(JSON.stringify(detail)).not.toContain(listing.property.ho as string);
  });

  it('hides the exact floor when the broker chose 저·중·고', () => {
    const listing = view('L01');
    const draft = draftOfListing(listing);
    const hidden = buildPreviewDetail(
      { ...draft, floorDisplay: FloorDisplay.CLASS },
      context(listing),
    );
    expect(hidden.property.floor).toBeNull();
    expect(hidden.property.totalFloors).toBe(listing.property.totalFloors);
    expect(hidden.floorClass).toBe(FloorClass.HIGH);

    const exact = buildPreviewDetail(
      { ...draft, floorDisplay: FloorDisplay.EXACT },
      context(listing),
    );
    expect(exact.property.floor).toBe(listing.property.floor);
  });

  it('previews a draft the way it will look once live', () => {
    const draft = view('D01');
    expect(draft.status).toBe(ListingStatus.DRAFT);
    const detail = buildPreviewDetail(draftOfListing(draft), context(draft));
    expect(detail.status).toBe(ListingStatus.ACTIVE);
    expect(detail.publishedAt).toBe('2026-11-24');
    expect(detail.listingNo).toBe('게시 후 부여');
  });

  it('keeps 계약중 for reserved listings', () => {
    const reserved = seeds.find((s) => s.status === ListingStatus.RESERVED);
    expect(reserved).toBeDefined();
    const listing = toView(reserved!);
    expect(buildPreviewDetail(draftOfListing(listing), context(listing)).status).toBe(
      ListingStatus.RESERVED,
    );
  });

  it('never publishes the office-internal 실매물 확인 메모', () => {
    const listing = view('L01');
    const memo = '임대인 12월 말 퇴거 예정';
    const detail = buildPreviewDetail(
      draftOfListing(listing),
      context(listing, {
        verifications: [{ id: 'v1', method: 'OWNER_CALL', verifiedAt: '2026-11-20', note: memo }],
      }),
    );
    expect(detail.verifications).toEqual([
      { method: 'OWNER_CALL', verifiedAt: '2026-11-20', note: null },
    ]);
    expect(JSON.stringify(detail)).not.toContain(memo);
  });

  it('uses the latest 실매물 확인 and the wizard’s photo order', () => {
    const listing = view('L01');
    const photos: PhotoValue[] = [
      { mediaId: 'm2', url: '/media/m2/file', caption: ' 주방 ', isCover: false },
      { mediaId: 'm1', url: '/media/m1/file', caption: '', isCover: false },
    ];
    const detail = buildPreviewDetail(
      draftOfListing(listing),
      context(listing, {
        photos,
        verifications: [
          { id: 'v1', method: 'OWNER_CALL', verifiedAt: '2026-11-01' },
          { id: 'v2', method: 'SITE_VISIT', verifiedAt: '2026-11-20' },
        ],
      }),
    );
    expect(detail.verifiedAt).toBe('2026-11-20');
    expect(detail.photos.map((p) => p.id)).toEqual(['m2', 'm1']);
    expect(detail.photos[0]).toMatchObject({ caption: '주방', isCover: true });
    expect(detail.photos[1]).toMatchObject({ caption: null, isCover: false });
  });

  it('lists every co-brokering office with its disclosure fields', () => {
    const shared = seeds.find((s) => s.offices.length > 1);
    expect(shared).toBeDefined();
    const listing = toView(shared!);
    const detail = buildPreviewDetail(draftOfListing(listing), context(listing));
    expect(detail.agencies).toHaveLength(shared!.offices.length);
    expect(detail.agencies.filter((a) => a.isPrimary)).toHaveLength(1);
    for (const agency of detail.agencies) {
      expect(agency.name).toBeTruthy();
      expect(agency.registrationNumber).toBeTruthy();
      expect(agency.representativeName).toBeTruthy();
      expect(agency.phone).toBeTruthy();
      expect(agency.roadAddress).toBeTruthy();
    }
  });
});

describe('missingAgencyDisclosure', () => {
  const office = view('L01').agencies[0]!;

  it('is empty for a complete office', () => {
    expect(missingAgencyDisclosure(office)).toEqual([]);
  });

  it('names the empty 명시사항 of the office', () => {
    expect(missingAgencyDisclosure({ ...office, registrationNumber: '', phone: '' })).toEqual([
      '연락처',
      '등록번호',
    ]);
    expect(missingAgencyDisclosure(undefined)).toEqual(['중개사무소 정보']);
  });
});
