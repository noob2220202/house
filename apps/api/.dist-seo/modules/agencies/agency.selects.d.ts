import { Prisma } from '@prisma/client';
export declare const agencySummarySelect: {
    id: true;
    name: true;
    representativeName: true;
    registrationNumber: true;
    phone: true;
    roadAddress: true;
    addressDetail: true;
    emdCode: true;
    lat: true;
    lng: true;
    specialties: true;
    activeListingCount: true;
    logo: {
        readonly select: {
            readonly storageKey: true;
            readonly variants: true;
            readonly deletedAt: true;
        };
    };
};
export type AgencySummaryRow = Prisma.AgencyGetPayload<{
    select: typeof agencySummarySelect;
}>;
export declare const agencyProfileSelect: {
    cover: {
        readonly select: {
            readonly storageKey: true;
            readonly variants: true;
            readonly deletedAt: true;
        };
    };
    mobile: true;
    email: true;
    jibunAddress: true;
    intro: true;
    businessHours: true;
    approvedAt: true;
    warningCount: true;
    id: true;
    name: true;
    representativeName: true;
    registrationNumber: true;
    phone: true;
    roadAddress: true;
    addressDetail: true;
    emdCode: true;
    lat: true;
    lng: true;
    specialties: true;
    activeListingCount: true;
    logo: {
        readonly select: {
            readonly storageKey: true;
            readonly variants: true;
            readonly deletedAt: true;
        };
    };
};
export type AgencyProfileRow = Prisma.AgencyGetPayload<{
    select: typeof agencyProfileSelect;
}>;
export declare const agencyDocumentSelect: {
    id: true;
    type: true;
    mediaId: true;
    createdAt: true;
    media: {
        select: {
            mimeType: true;
            sizeBytes: true;
            originalFilename: true;
        };
    };
};
export type AgencyDocumentRow = Prisma.AgencyDocumentGetPayload<{
    select: typeof agencyDocumentSelect;
}>;
export declare const agencyStatusHistorySelect: {
    id: true;
    fromStatus: true;
    toStatus: true;
    reason: true;
    createdAt: true;
    decidedBy: {
        select: {
            id: true;
            name: true;
        };
    };
};
export declare const myAgencySelect: {
    businessNumber: true;
    mobile: true;
    email: true;
    jibunAddress: true;
    zipCode: true;
    intro: true;
    businessHours: true;
    logoMediaId: true;
    coverMediaId: true;
    cover: {
        readonly select: {
            readonly storageKey: true;
            readonly variants: true;
            readonly deletedAt: true;
        };
    };
    status: true;
    statusReason: true;
    approvedAt: true;
    suspendedAt: true;
    createdAt: true;
    updatedAt: true;
    documents: {
        select: {
            id: true;
            type: true;
            mediaId: true;
            createdAt: true;
            media: {
                select: {
                    mimeType: true;
                    sizeBytes: true;
                    originalFilename: true;
                };
            };
        };
        orderBy: ({
            createdAt: "asc";
            id?: undefined;
        } | {
            id: "asc";
            createdAt?: undefined;
        })[];
    };
    statusHistory: {
        select: {
            id: true;
            fromStatus: true;
            toStatus: true;
            reason: true;
            createdAt: true;
            decidedBy: {
                select: {
                    id: true;
                    name: true;
                };
            };
        };
        orderBy: ({
            createdAt: "desc";
            id?: undefined;
        } | {
            id: "desc";
            createdAt?: undefined;
        })[];
        take: number;
    };
    _count: {
        select: {
            members: {
                where: {
                    status: "ACTIVE";
                };
            };
        };
    };
    id: true;
    name: true;
    representativeName: true;
    registrationNumber: true;
    phone: true;
    roadAddress: true;
    addressDetail: true;
    emdCode: true;
    lat: true;
    lng: true;
    specialties: true;
    activeListingCount: true;
    logo: {
        readonly select: {
            readonly storageKey: true;
            readonly variants: true;
            readonly deletedAt: true;
        };
    };
};
export type MyAgencyRow = Prisma.AgencyGetPayload<{
    select: typeof myAgencySelect;
}>;
export declare const agencyMemberSelect: {
    id: true;
    userId: true;
    role: true;
    status: true;
    displayName: true;
    title: true;
    phone: true;
    isLicensed: true;
    licenseNumber: true;
    joinedAt: true;
    removedAt: true;
};
export type AgencyMemberRow = Prisma.AgencyMemberGetPayload<{
    select: typeof agencyMemberSelect;
}>;
export declare const disclosureSelect: {
    id: true;
    name: true;
    roadAddress: true;
    addressDetail: true;
    phone: true;
    registrationNumber: true;
    representativeName: true;
};
