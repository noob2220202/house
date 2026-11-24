import type { Prisma } from '@prisma/client';
/**
 * Explicit Prisma selects. PUBLIC selects never include Property.ho, Listing.hiddenReason
 * or member ids; only AGENCY_* selects do (served to agency members only).
 */
/** An agency that may appear in public listing data (approved, not deleted). */
export declare const DISCLOSABLE_AGENCY_WHERE: {
    readonly status: "APPROVED";
    readonly deletedAt: null;
};
/**
 * Publicly visible listings also need a disclosable primary agency: without it the 명시사항
 * (명칭·등록번호·대표 성명) could not be shown. Mirrors the SQL rule in listing-search.repository.
 */
export declare const PUBLIC_PRIMARY_AGENCY_WHERE: {
    readonly primaryAgency: {
        readonly status: "APPROVED";
        readonly deletedAt: null;
    };
};
export declare const LISTING_SUMMARY_SELECT: {
    readonly id: true;
    readonly listingNo: true;
    readonly dealType: true;
    readonly assetType: true;
    readonly status: true;
    readonly title: true;
    readonly salePrice: true;
    readonly deposit: true;
    readonly monthlyRent: true;
    readonly presalePrice: true;
    readonly premium: true;
    readonly priceSort: true;
    readonly maintenanceFeeWon: true;
    readonly exclusiveArea: true;
    readonly rooms: true;
    readonly roomType: true;
    readonly landZone: true;
    readonly landCategory: true;
    readonly baths: true;
    readonly direction: true;
    readonly floorClass: true;
    readonly floorDisplay: true;
    readonly builtYear: true;
    readonly emdCode: true;
    readonly lat: true;
    readonly lng: true;
    readonly photoCount: true;
    readonly options: true;
    readonly verifiedAt: true;
    readonly publishedAt: true;
    readonly viewCount: true;
    readonly favoriteCount: true;
    readonly primaryAgencyId: true;
    readonly property: {
        readonly select: {
            readonly roadAddress: true;
            readonly buildingName: true;
            readonly dong: true;
            readonly floor: true;
            readonly totalFloors: true;
            readonly supplyArea: true;
        };
    };
    readonly complex: {
        readonly select: {
            readonly id: true;
            readonly name: true;
        };
    };
    readonly primaryAgency: {
        readonly select: {
            readonly id: true;
            readonly name: true;
        };
    };
    readonly photos: {
        readonly where: {
            readonly isCover: true;
        };
        readonly take: 1;
        readonly select: {
            readonly mediaId: true;
            readonly caption: true;
            readonly isCover: true;
            readonly media: {
                readonly select: {
                    readonly storageKey: true;
                    readonly variants: true;
                };
            };
        };
    };
};
/**
 * No co-broker `_count` here on purpose: Prisma computes a relation count as a GROUP BY over the
 * whole listing_agencies table. Summaries get it from ListingSummariesService (page-scoped).
 */
export type ListingSummaryRow = Prisma.ListingGetPayload<{
    select: typeof LISTING_SUMMARY_SELECT;
}>;
export declare const LISTING_PUBLIC_DETAIL_SELECT: {
    readonly agencies: {
        readonly where: {
            readonly status: "ACTIVE";
        };
        readonly orderBy: [{
            readonly isPrimary: "desc";
        }, {
            readonly joinedAt: "asc";
        }];
        readonly select: {
            readonly agencyId: true;
            readonly isPrimary: true;
            readonly status: true;
            readonly contactName: true;
            readonly contactPhone: true;
            readonly agency: {
                readonly select: {
                    readonly id: true;
                    readonly name: true;
                    readonly roadAddress: true;
                    readonly addressDetail: true;
                    readonly phone: true;
                    readonly registrationNumber: true;
                    readonly representativeName: true;
                    readonly status: true;
                    readonly deletedAt: true;
                    readonly logo: {
                        readonly select: {
                            readonly storageKey: true;
                            readonly variants: true;
                        };
                    };
                };
            };
        };
    };
    readonly description: true;
    readonly maintenanceFee: true;
    readonly moveInType: true;
    readonly moveInDate: true;
    readonly property: {
        readonly select: {
            readonly assetType: true;
            readonly roadAddress: true;
            readonly jibunAddress: true;
            readonly buildingName: true;
            readonly dong: true;
            readonly floor: true;
            readonly totalFloors: true;
            readonly exclusiveArea: true;
            readonly supplyArea: true;
            readonly landArea: true;
            readonly totalFloorArea: true;
            readonly rooms: true;
            readonly roomType: true;
            readonly baths: true;
            readonly direction: true;
            readonly directionBasis: true;
            readonly approvalDate: true;
            readonly parkingSpaces: true;
            readonly heatingType: true;
            readonly zoning: true;
            readonly landCategory: true;
            readonly buildingUse: true;
        };
    };
    readonly complex: {
        readonly select: {
            readonly id: true;
            readonly name: true;
            readonly households: true;
            readonly builtYear: true;
        };
    };
    readonly photos: {
        readonly orderBy: {
            readonly sortOrder: "asc";
        };
        readonly select: {
            readonly mediaId: true;
            readonly caption: true;
            readonly isCover: true;
            readonly media: {
                readonly select: {
                    readonly storageKey: true;
                    readonly variants: true;
                };
            };
        };
    };
    readonly verifications: {
        readonly orderBy: {
            readonly verifiedAt: "desc";
        };
        readonly take: 1;
        readonly select: {
            readonly method: true;
            readonly verifiedAt: true;
        };
    };
    readonly id: true;
    readonly listingNo: true;
    readonly dealType: true;
    readonly assetType: true;
    readonly status: true;
    readonly title: true;
    readonly salePrice: true;
    readonly deposit: true;
    readonly monthlyRent: true;
    readonly presalePrice: true;
    readonly premium: true;
    readonly priceSort: true;
    readonly maintenanceFeeWon: true;
    readonly exclusiveArea: true;
    readonly rooms: true;
    readonly roomType: true;
    readonly landZone: true;
    readonly landCategory: true;
    readonly baths: true;
    readonly direction: true;
    readonly floorClass: true;
    readonly floorDisplay: true;
    readonly builtYear: true;
    readonly emdCode: true;
    readonly lat: true;
    readonly lng: true;
    readonly photoCount: true;
    readonly options: true;
    readonly verifiedAt: true;
    readonly publishedAt: true;
    readonly viewCount: true;
    readonly favoriteCount: true;
    readonly primaryAgencyId: true;
    readonly primaryAgency: {
        readonly select: {
            readonly id: true;
            readonly name: true;
        };
    };
};
export type ListingPublicDetailRow = Prisma.ListingGetPayload<{
    select: typeof LISTING_PUBLIC_DETAIL_SELECT;
}>;
export declare const LISTING_AGENCY_DETAIL_SELECT: {
    readonly hiddenReason: true;
    readonly closedAt: true;
    readonly expiresAt: true;
    readonly createdAt: true;
    readonly updatedAt: true;
    readonly version: true;
    readonly property: {
        readonly select: {
            readonly id: true;
            readonly ho: true;
            readonly emdCode: true;
            readonly complexId: true;
            readonly areaTypeId: true;
            readonly assetType: true;
            readonly roadAddress: true;
            readonly jibunAddress: true;
            readonly buildingName: true;
            readonly dong: true;
            readonly floor: true;
            readonly totalFloors: true;
            readonly exclusiveArea: true;
            readonly supplyArea: true;
            readonly landArea: true;
            readonly totalFloorArea: true;
            readonly rooms: true;
            readonly roomType: true;
            readonly baths: true;
            readonly direction: true;
            readonly directionBasis: true;
            readonly approvalDate: true;
            readonly parkingSpaces: true;
            readonly heatingType: true;
            readonly zoning: true;
            readonly landCategory: true;
            readonly buildingUse: true;
        };
    };
    readonly verifications: {
        readonly orderBy: {
            readonly verifiedAt: "desc";
        };
        readonly select: {
            readonly id: true;
            readonly method: true;
            readonly verifiedAt: true;
            readonly note: true;
            readonly verifiedByAdminId: true;
        };
    };
    readonly agencies: {
        readonly orderBy: [{
            readonly isPrimary: "desc";
        }, {
            readonly joinedAt: "asc";
        }];
        readonly select: {
            readonly agencyId: true;
            readonly isPrimary: true;
            readonly status: true;
            readonly contactMemberId: true;
            readonly contactName: true;
            readonly contactPhone: true;
            readonly joinedAt: true;
            readonly agency: {
                readonly select: {
                    readonly id: true;
                    readonly name: true;
                    readonly roadAddress: true;
                    readonly addressDetail: true;
                    readonly phone: true;
                    readonly registrationNumber: true;
                    readonly representativeName: true;
                    readonly status: true;
                    readonly deletedAt: true;
                    readonly logo: {
                        readonly select: {
                            readonly storageKey: true;
                            readonly variants: true;
                        };
                    };
                };
            };
        };
    };
    readonly description: true;
    readonly maintenanceFee: true;
    readonly moveInType: true;
    readonly moveInDate: true;
    readonly complex: {
        readonly select: {
            readonly id: true;
            readonly name: true;
            readonly households: true;
            readonly builtYear: true;
        };
    };
    readonly photos: {
        readonly orderBy: {
            readonly sortOrder: "asc";
        };
        readonly select: {
            readonly mediaId: true;
            readonly caption: true;
            readonly isCover: true;
            readonly media: {
                readonly select: {
                    readonly storageKey: true;
                    readonly variants: true;
                };
            };
        };
    };
    readonly id: true;
    readonly listingNo: true;
    readonly dealType: true;
    readonly assetType: true;
    readonly status: true;
    readonly title: true;
    readonly salePrice: true;
    readonly deposit: true;
    readonly monthlyRent: true;
    readonly presalePrice: true;
    readonly premium: true;
    readonly priceSort: true;
    readonly maintenanceFeeWon: true;
    readonly exclusiveArea: true;
    readonly rooms: true;
    readonly roomType: true;
    readonly landZone: true;
    readonly landCategory: true;
    readonly baths: true;
    readonly direction: true;
    readonly floorClass: true;
    readonly floorDisplay: true;
    readonly builtYear: true;
    readonly emdCode: true;
    readonly lat: true;
    readonly lng: true;
    readonly photoCount: true;
    readonly options: true;
    readonly verifiedAt: true;
    readonly publishedAt: true;
    readonly viewCount: true;
    readonly favoriteCount: true;
    readonly primaryAgencyId: true;
    readonly primaryAgency: {
        readonly select: {
            readonly id: true;
            readonly name: true;
        };
    };
};
/**
 * Rows of the console list (GET /agency/listings): the summary plus the agency-private columns.
 * Served to members of a participating agency only (ho / hiddenReason are blanked for co-brokers
 * by the mapper).
 */
export declare const LISTING_AGENCY_ROW_SELECT: {
    readonly hiddenReason: true;
    readonly expiresAt: true;
    readonly updatedAt: true;
    readonly property: {
        readonly select: {
            readonly ho: true;
            readonly landArea: true;
            readonly roadAddress: true;
            readonly buildingName: true;
            readonly dong: true;
            readonly floor: true;
            readonly totalFloors: true;
            readonly supplyArea: true;
        };
    };
    readonly id: true;
    readonly listingNo: true;
    readonly dealType: true;
    readonly assetType: true;
    readonly status: true;
    readonly title: true;
    readonly salePrice: true;
    readonly deposit: true;
    readonly monthlyRent: true;
    readonly presalePrice: true;
    readonly premium: true;
    readonly priceSort: true;
    readonly maintenanceFeeWon: true;
    readonly exclusiveArea: true;
    readonly rooms: true;
    readonly roomType: true;
    readonly landZone: true;
    readonly landCategory: true;
    readonly baths: true;
    readonly direction: true;
    readonly floorClass: true;
    readonly floorDisplay: true;
    readonly builtYear: true;
    readonly emdCode: true;
    readonly lat: true;
    readonly lng: true;
    readonly photoCount: true;
    readonly options: true;
    readonly verifiedAt: true;
    readonly publishedAt: true;
    readonly viewCount: true;
    readonly favoriteCount: true;
    readonly primaryAgencyId: true;
    readonly complex: {
        readonly select: {
            readonly id: true;
            readonly name: true;
        };
    };
    readonly primaryAgency: {
        readonly select: {
            readonly id: true;
            readonly name: true;
        };
    };
    readonly photos: {
        readonly where: {
            readonly isCover: true;
        };
        readonly take: 1;
        readonly select: {
            readonly mediaId: true;
            readonly caption: true;
            readonly isCover: true;
            readonly media: {
                readonly select: {
                    readonly storageKey: true;
                    readonly variants: true;
                };
            };
        };
    };
};
export type ListingAgencyRow = Prisma.ListingGetPayload<{
    select: typeof LISTING_AGENCY_ROW_SELECT;
}>;
export type ListingAgencyDetailRow = Prisma.ListingGetPayload<{
    select: typeof LISTING_AGENCY_DETAIL_SELECT;
}>;
