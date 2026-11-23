import { randomBytes, randomUUID } from 'node:crypto';
import {
  AdminRole,
  AgencyMemberRole,
  AgencyStatus,
  AssetType,
  DealType,
  DEFAULT_MAP_CENTER,
  DEFAULT_SGG_CODE,
  ListingStatus,
  MediaPurpose,
  UserRole,
} from '@house/shared';
import type { Agency, AdminUser, Complex, Listing, Media, Property, User } from '@prisma/client';
import type { Prisma } from '@prisma/client';
import type { PrismaService } from '../../src/prisma/prisma.service';

/**
 * Minimal valid rows for e2e tests. Every factory takes overrides; module teams add their own
 * domain-specific factories next to their specs (test/e2e/<module>/factories.ts).
 */
let seq = 0;
const next = (): number => ++seq;
const suffix = (): string => randomBytes(4).toString('hex');

export async function createUser(
  prisma: PrismaService,
  data: Partial<Prisma.UserUncheckedCreateInput> = {},
): Promise<User> {
  const n = next();
  return prisma.user.create({
    data: {
      name: `테스트회원${n}`,
      nickname: `user${n}`,
      email: `user${n}-${suffix()}@example.test`,
      role: UserRole.USER,
      ...data,
    },
  });
}

/** Admin with a dummy password hash (log in via loginAdmin(), not the password endpoint). */
export async function createAdmin(
  prisma: PrismaService,
  data: Partial<Prisma.AdminUserUncheckedCreateInput> = {},
): Promise<AdminUser> {
  const n = next();
  return prisma.adminUser.create({
    data: {
      email: `admin${n}-${suffix()}@example.test`,
      name: `관리자${n}`,
      passwordHash: '$argon2id$v=19$m=19456,t=2,p=1$dGVzdA$dGVzdA',
      role: AdminRole.ADMIN,
      ...data,
    },
  });
}

/** Approved agency with its owner (AGENCY_OWNER user) as an OWNER member. */
export async function createAgency(
  prisma: PrismaService,
  data: Partial<Prisma.AgencyUncheckedCreateInput> = {},
): Promise<{ agency: Agency; owner: User }> {
  const owner = data.ownerUserId
    ? await prisma.user.findUniqueOrThrow({ where: { id: data.ownerUserId } })
    : await createUser(prisma, { role: UserRole.AGENCY_OWNER });
  const n = next();
  const agency = await prisma.agency.create({
    data: {
      name: `테스트공인중개사사무소${n}`,
      representativeName: `대표${n}`,
      registrationNumber: `${DEFAULT_SGG_CODE}-2026-${String(n).padStart(5, '0')}-${suffix()}`,
      phone: '0617491234',
      roadAddress: `전라남도 순천시 테스트로 ${n}`,
      sggCode: DEFAULT_SGG_CODE,
      lat: DEFAULT_MAP_CENTER.lat,
      lng: DEFAULT_MAP_CENTER.lng,
      status: AgencyStatus.APPROVED,
      approvedAt: new Date(),
      ...data,
      ownerUserId: owner.id,
    },
  });
  await prisma.agencyMember.create({
    data: {
      agencyId: agency.id,
      userId: owner.id,
      role: AgencyMemberRole.OWNER,
      displayName: agency.representativeName,
      isLicensed: true,
    },
  });
  return { agency, owner };
}

export async function createComplex(
  prisma: PrismaService,
  data: Partial<Prisma.ComplexUncheckedCreateInput> = {},
): Promise<Complex> {
  const n = next();
  return prisma.complex.create({
    data: {
      name: `테스트아파트${n}`,
      roadAddress: `전라남도 순천시 단지로 ${n}`,
      sggCode: DEFAULT_SGG_CODE,
      lat: DEFAULT_MAP_CENTER.lat,
      lng: DEFAULT_MAP_CENTER.lng,
      ...data,
    },
  });
}

/** Property + listing + primary ListingAgency row, in one transaction. */
export async function createListing(
  prisma: PrismaService,
  opts: {
    agencyId: string;
    property?: Partial<Prisma.PropertyUncheckedCreateInput>;
    listing?: Partial<Prisma.ListingUncheckedCreateInput>;
  },
): Promise<{ property: Property; listing: Listing }> {
  const n = next();
  return prisma.$transaction(async (tx) => {
    const property = await tx.property.create({
      data: {
        assetType: AssetType.APT,
        roadAddress: `전라남도 순천시 매물로 ${n}`,
        sggCode: DEFAULT_SGG_CODE,
        lat: DEFAULT_MAP_CENTER.lat,
        lng: DEFAULT_MAP_CENTER.lng,
        floor: 5,
        totalFloors: 15,
        exclusiveArea: '84.97',
        rooms: 3,
        baths: 2,
        ...opts.property,
      },
    });
    const listing = await tx.listing.create({
      data: {
        propertyId: property.id,
        dealType: DealType.SALE,
        status: ListingStatus.ACTIVE,
        salePrice: 30000,
        priceSort: 30000,
        primaryAgencyId: opts.agencyId,
        assetType: property.assetType,
        complexId: property.complexId,
        sggCode: property.sggCode,
        emdCode: property.emdCode,
        lat: property.lat,
        lng: property.lng,
        exclusiveArea: property.exclusiveArea,
        rooms: property.rooms,
        baths: property.baths,
        publishedAt: new Date(),
        ...opts.listing,
      },
    });
    await tx.listingAgency.create({
      data: { listingId: listing.id, agencyId: opts.agencyId, isPrimary: true },
    });
    return { property, listing };
  });
}

/** A READY media row (no file on disk; media e2e writes real files itself). */
export async function createMedia(
  prisma: PrismaService,
  data: Partial<Prisma.MediaUncheckedCreateInput> = {},
): Promise<Media> {
  return prisma.media.create({
    data: {
      purpose: MediaPurpose.LISTING_PHOTO,
      status: 'READY',
      mimeType: 'image/webp',
      sizeBytes: 1024,
      width: 800,
      height: 600,
      sha256: randomBytes(32).toString('hex'),
      storageKey: `test/${randomUUID()}.webp`,
      ...data,
    },
  });
}
