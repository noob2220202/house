declare const IdParamDto_base: import("../../common/pipes/zod-validation.pipe").ZodDto<import("zod").ZodObject<{
    id: import("zod").ZodUUID;
}, import("zod/v4/core").$strip>>;
export declare class IdParamDto extends IdParamDto_base {
}
declare const AgencyRegisterDto_base: import("../../common/pipes/zod-validation.pipe").ZodDto<import("zod").ZodObject<{
    documents: import("zod").ZodArray<import("zod").ZodObject<{
        type: import("zod").ZodEnum<{
            readonly REGISTRATION_CERT: "REGISTRATION_CERT";
            readonly BUSINESS_REG_CERT: "BUSINESS_REG_CERT";
            readonly BROKER_LICENSE: "BROKER_LICENSE";
            readonly OTHER: "OTHER";
        }>;
        mediaId: import("zod").ZodUUID;
    }, import("zod/v4/core").$strip>>;
    consents: import("zod").ZodDefault<import("zod").ZodArray<import("zod").ZodObject<{
        type: import("zod").ZodEnum<{
            PRIVACY_AGENCY_APPLICATION: "PRIVACY_AGENCY_APPLICATION";
        }>;
        version: import("zod").ZodString;
    }, import("zod/v4/core").$strip>>>;
    phone: import("zod").ZodPipe<import("zod").ZodPipe<import("zod").ZodString, import("zod").ZodTransform<string, string>>, import("zod").ZodString>;
    mobile: import("zod").ZodOptional<import("zod").ZodNullable<import("zod").ZodPipe<import("zod").ZodPipe<import("zod").ZodString, import("zod").ZodTransform<string, string>>, import("zod").ZodString>>>;
    email: import("zod").ZodOptional<import("zod").ZodNullable<import("zod").ZodEmail>>;
    roadAddress: import("zod").ZodString;
    jibunAddress: import("zod").ZodOptional<import("zod").ZodNullable<import("zod").ZodString>>;
    addressDetail: import("zod").ZodOptional<import("zod").ZodNullable<import("zod").ZodString>>;
    zipCode: import("zod").ZodOptional<import("zod").ZodNullable<import("zod").ZodString>>;
    emdCode: import("zod").ZodOptional<import("zod").ZodNullable<import("zod").ZodPipe<import("zod").ZodString, import("zod").ZodTransform<string, string>>>>;
    lat: import("zod").ZodNumber;
    lng: import("zod").ZodNumber;
    intro: import("zod").ZodOptional<import("zod").ZodNullable<import("zod").ZodString>>;
    businessHours: import("zod").ZodOptional<import("zod").ZodNullable<import("zod").ZodObject<{
        mon: import("zod").ZodOptional<import("zod").ZodNullable<import("zod").ZodObject<{
            open: import("zod").ZodString;
            close: import("zod").ZodString;
        }, import("zod/v4/core").$strip>>>;
        tue: import("zod").ZodOptional<import("zod").ZodNullable<import("zod").ZodObject<{
            open: import("zod").ZodString;
            close: import("zod").ZodString;
        }, import("zod/v4/core").$strip>>>;
        wed: import("zod").ZodOptional<import("zod").ZodNullable<import("zod").ZodObject<{
            open: import("zod").ZodString;
            close: import("zod").ZodString;
        }, import("zod/v4/core").$strip>>>;
        thu: import("zod").ZodOptional<import("zod").ZodNullable<import("zod").ZodObject<{
            open: import("zod").ZodString;
            close: import("zod").ZodString;
        }, import("zod/v4/core").$strip>>>;
        fri: import("zod").ZodOptional<import("zod").ZodNullable<import("zod").ZodObject<{
            open: import("zod").ZodString;
            close: import("zod").ZodString;
        }, import("zod/v4/core").$strip>>>;
        sat: import("zod").ZodOptional<import("zod").ZodNullable<import("zod").ZodObject<{
            open: import("zod").ZodString;
            close: import("zod").ZodString;
        }, import("zod/v4/core").$strip>>>;
        sun: import("zod").ZodOptional<import("zod").ZodNullable<import("zod").ZodObject<{
            open: import("zod").ZodString;
            close: import("zod").ZodString;
        }, import("zod/v4/core").$strip>>>;
        note: import("zod").ZodOptional<import("zod").ZodString>;
    }, import("zod/v4/core").$strict>>>;
    specialties: import("zod").ZodOptional<import("zod").ZodPipe<import("zod").ZodArray<import("zod").ZodEnum<{
        readonly APT: "APT";
        readonly OFFICETEL: "OFFICETEL";
        readonly ONEROOM: "ONEROOM";
        readonly HOUSE: "HOUSE";
        readonly COMMERCIAL: "COMMERCIAL";
        readonly LAND: "LAND";
    }>>, import("zod").ZodTransform<("APT" | "OFFICETEL" | "ONEROOM" | "HOUSE" | "COMMERCIAL" | "LAND")[], ("APT" | "OFFICETEL" | "ONEROOM" | "HOUSE" | "COMMERCIAL" | "LAND")[]>>>;
    name: import("zod").ZodString;
    representativeName: import("zod").ZodString;
    registrationNumber: import("zod").ZodPipe<import("zod").ZodPipe<import("zod").ZodString, import("zod").ZodTransform<string, string>>, import("zod").ZodString>;
    businessNumber: import("zod").ZodPipe<import("zod").ZodPipe<import("zod").ZodString, import("zod").ZodTransform<string, string>>, import("zod").ZodString>;
}, import("zod/v4/core").$strip>>;
export declare class AgencyRegisterDto extends AgencyRegisterDto_base {
}
/**
 * Resubmission body: the shared schema plus optional D8 `consents` (local until the shared schema
 * has them). Sent → the current 개인정보 수집·이용 동의 version is required and recorded; omitted →
 * the application's consent still covers the resubmission.
 */
export declare const agencyResubmitWithConsentsSchema: import("zod").ZodObject<{
    phone: import("zod").ZodOptional<import("zod").ZodPipe<import("zod").ZodPipe<import("zod").ZodString, import("zod").ZodTransform<string, string>>, import("zod").ZodString>>;
    roadAddress: import("zod").ZodOptional<import("zod").ZodString>;
    lat: import("zod").ZodOptional<import("zod").ZodNumber>;
    lng: import("zod").ZodOptional<import("zod").ZodNumber>;
    documents: import("zod").ZodOptional<import("zod").ZodArray<import("zod").ZodObject<{
        type: import("zod").ZodEnum<{
            readonly REGISTRATION_CERT: "REGISTRATION_CERT";
            readonly BUSINESS_REG_CERT: "BUSINESS_REG_CERT";
            readonly BROKER_LICENSE: "BROKER_LICENSE";
            readonly OTHER: "OTHER";
        }>;
        mediaId: import("zod").ZodUUID;
    }, import("zod/v4/core").$strip>>>;
    message: import("zod").ZodOptional<import("zod").ZodString>;
    mobile: import("zod").ZodOptional<import("zod").ZodNullable<import("zod").ZodPipe<import("zod").ZodPipe<import("zod").ZodString, import("zod").ZodTransform<string, string>>, import("zod").ZodString>>>;
    email: import("zod").ZodOptional<import("zod").ZodNullable<import("zod").ZodEmail>>;
    jibunAddress: import("zod").ZodOptional<import("zod").ZodNullable<import("zod").ZodString>>;
    addressDetail: import("zod").ZodOptional<import("zod").ZodNullable<import("zod").ZodString>>;
    zipCode: import("zod").ZodOptional<import("zod").ZodNullable<import("zod").ZodString>>;
    emdCode: import("zod").ZodOptional<import("zod").ZodNullable<import("zod").ZodPipe<import("zod").ZodString, import("zod").ZodTransform<string, string>>>>;
    intro: import("zod").ZodOptional<import("zod").ZodNullable<import("zod").ZodString>>;
    businessHours: import("zod").ZodOptional<import("zod").ZodNullable<import("zod").ZodObject<{
        mon: import("zod").ZodOptional<import("zod").ZodNullable<import("zod").ZodObject<{
            open: import("zod").ZodString;
            close: import("zod").ZodString;
        }, import("zod/v4/core").$strip>>>;
        tue: import("zod").ZodOptional<import("zod").ZodNullable<import("zod").ZodObject<{
            open: import("zod").ZodString;
            close: import("zod").ZodString;
        }, import("zod/v4/core").$strip>>>;
        wed: import("zod").ZodOptional<import("zod").ZodNullable<import("zod").ZodObject<{
            open: import("zod").ZodString;
            close: import("zod").ZodString;
        }, import("zod/v4/core").$strip>>>;
        thu: import("zod").ZodOptional<import("zod").ZodNullable<import("zod").ZodObject<{
            open: import("zod").ZodString;
            close: import("zod").ZodString;
        }, import("zod/v4/core").$strip>>>;
        fri: import("zod").ZodOptional<import("zod").ZodNullable<import("zod").ZodObject<{
            open: import("zod").ZodString;
            close: import("zod").ZodString;
        }, import("zod/v4/core").$strip>>>;
        sat: import("zod").ZodOptional<import("zod").ZodNullable<import("zod").ZodObject<{
            open: import("zod").ZodString;
            close: import("zod").ZodString;
        }, import("zod/v4/core").$strip>>>;
        sun: import("zod").ZodOptional<import("zod").ZodNullable<import("zod").ZodObject<{
            open: import("zod").ZodString;
            close: import("zod").ZodString;
        }, import("zod/v4/core").$strip>>>;
        note: import("zod").ZodOptional<import("zod").ZodString>;
    }, import("zod/v4/core").$strict>>>;
    specialties: import("zod").ZodOptional<import("zod").ZodPipe<import("zod").ZodArray<import("zod").ZodEnum<{
        readonly APT: "APT";
        readonly OFFICETEL: "OFFICETEL";
        readonly ONEROOM: "ONEROOM";
        readonly HOUSE: "HOUSE";
        readonly COMMERCIAL: "COMMERCIAL";
        readonly LAND: "LAND";
    }>>, import("zod").ZodTransform<("APT" | "OFFICETEL" | "ONEROOM" | "HOUSE" | "COMMERCIAL" | "LAND")[], ("APT" | "OFFICETEL" | "ONEROOM" | "HOUSE" | "COMMERCIAL" | "LAND")[]>>>;
    name: import("zod").ZodOptional<import("zod").ZodString>;
    representativeName: import("zod").ZodOptional<import("zod").ZodString>;
    registrationNumber: import("zod").ZodOptional<import("zod").ZodPipe<import("zod").ZodPipe<import("zod").ZodString, import("zod").ZodTransform<string, string>>, import("zod").ZodString>>;
    businessNumber: import("zod").ZodOptional<import("zod").ZodPipe<import("zod").ZodPipe<import("zod").ZodString, import("zod").ZodTransform<string, string>>, import("zod").ZodString>>;
    consents: import("zod").ZodDefault<import("zod").ZodArray<import("zod").ZodObject<{
        type: import("zod").ZodEnum<{
            PRIVACY_AGENCY_APPLICATION: "PRIVACY_AGENCY_APPLICATION";
        }>;
        version: import("zod").ZodString;
    }, import("zod/v4/core").$strip>>>;
}, import("zod/v4/core").$strip>;
declare const AgencyResubmitDto_base: import("../../common/pipes/zod-validation.pipe").ZodDto<import("zod").ZodObject<{
    phone: import("zod").ZodOptional<import("zod").ZodPipe<import("zod").ZodPipe<import("zod").ZodString, import("zod").ZodTransform<string, string>>, import("zod").ZodString>>;
    roadAddress: import("zod").ZodOptional<import("zod").ZodString>;
    lat: import("zod").ZodOptional<import("zod").ZodNumber>;
    lng: import("zod").ZodOptional<import("zod").ZodNumber>;
    documents: import("zod").ZodOptional<import("zod").ZodArray<import("zod").ZodObject<{
        type: import("zod").ZodEnum<{
            readonly REGISTRATION_CERT: "REGISTRATION_CERT";
            readonly BUSINESS_REG_CERT: "BUSINESS_REG_CERT";
            readonly BROKER_LICENSE: "BROKER_LICENSE";
            readonly OTHER: "OTHER";
        }>;
        mediaId: import("zod").ZodUUID;
    }, import("zod/v4/core").$strip>>>;
    message: import("zod").ZodOptional<import("zod").ZodString>;
    mobile: import("zod").ZodOptional<import("zod").ZodNullable<import("zod").ZodPipe<import("zod").ZodPipe<import("zod").ZodString, import("zod").ZodTransform<string, string>>, import("zod").ZodString>>>;
    email: import("zod").ZodOptional<import("zod").ZodNullable<import("zod").ZodEmail>>;
    jibunAddress: import("zod").ZodOptional<import("zod").ZodNullable<import("zod").ZodString>>;
    addressDetail: import("zod").ZodOptional<import("zod").ZodNullable<import("zod").ZodString>>;
    zipCode: import("zod").ZodOptional<import("zod").ZodNullable<import("zod").ZodString>>;
    emdCode: import("zod").ZodOptional<import("zod").ZodNullable<import("zod").ZodPipe<import("zod").ZodString, import("zod").ZodTransform<string, string>>>>;
    intro: import("zod").ZodOptional<import("zod").ZodNullable<import("zod").ZodString>>;
    businessHours: import("zod").ZodOptional<import("zod").ZodNullable<import("zod").ZodObject<{
        mon: import("zod").ZodOptional<import("zod").ZodNullable<import("zod").ZodObject<{
            open: import("zod").ZodString;
            close: import("zod").ZodString;
        }, import("zod/v4/core").$strip>>>;
        tue: import("zod").ZodOptional<import("zod").ZodNullable<import("zod").ZodObject<{
            open: import("zod").ZodString;
            close: import("zod").ZodString;
        }, import("zod/v4/core").$strip>>>;
        wed: import("zod").ZodOptional<import("zod").ZodNullable<import("zod").ZodObject<{
            open: import("zod").ZodString;
            close: import("zod").ZodString;
        }, import("zod/v4/core").$strip>>>;
        thu: import("zod").ZodOptional<import("zod").ZodNullable<import("zod").ZodObject<{
            open: import("zod").ZodString;
            close: import("zod").ZodString;
        }, import("zod/v4/core").$strip>>>;
        fri: import("zod").ZodOptional<import("zod").ZodNullable<import("zod").ZodObject<{
            open: import("zod").ZodString;
            close: import("zod").ZodString;
        }, import("zod/v4/core").$strip>>>;
        sat: import("zod").ZodOptional<import("zod").ZodNullable<import("zod").ZodObject<{
            open: import("zod").ZodString;
            close: import("zod").ZodString;
        }, import("zod/v4/core").$strip>>>;
        sun: import("zod").ZodOptional<import("zod").ZodNullable<import("zod").ZodObject<{
            open: import("zod").ZodString;
            close: import("zod").ZodString;
        }, import("zod/v4/core").$strip>>>;
        note: import("zod").ZodOptional<import("zod").ZodString>;
    }, import("zod/v4/core").$strict>>>;
    specialties: import("zod").ZodOptional<import("zod").ZodPipe<import("zod").ZodArray<import("zod").ZodEnum<{
        readonly APT: "APT";
        readonly OFFICETEL: "OFFICETEL";
        readonly ONEROOM: "ONEROOM";
        readonly HOUSE: "HOUSE";
        readonly COMMERCIAL: "COMMERCIAL";
        readonly LAND: "LAND";
    }>>, import("zod").ZodTransform<("APT" | "OFFICETEL" | "ONEROOM" | "HOUSE" | "COMMERCIAL" | "LAND")[], ("APT" | "OFFICETEL" | "ONEROOM" | "HOUSE" | "COMMERCIAL" | "LAND")[]>>>;
    name: import("zod").ZodOptional<import("zod").ZodString>;
    representativeName: import("zod").ZodOptional<import("zod").ZodString>;
    registrationNumber: import("zod").ZodOptional<import("zod").ZodPipe<import("zod").ZodPipe<import("zod").ZodString, import("zod").ZodTransform<string, string>>, import("zod").ZodString>>;
    businessNumber: import("zod").ZodOptional<import("zod").ZodPipe<import("zod").ZodPipe<import("zod").ZodString, import("zod").ZodTransform<string, string>>, import("zod").ZodString>>;
    consents: import("zod").ZodDefault<import("zod").ZodArray<import("zod").ZodObject<{
        type: import("zod").ZodEnum<{
            PRIVACY_AGENCY_APPLICATION: "PRIVACY_AGENCY_APPLICATION";
        }>;
        version: import("zod").ZodString;
    }, import("zod/v4/core").$strip>>>;
}, import("zod/v4/core").$strip>>;
export declare class AgencyResubmitDto extends AgencyResubmitDto_base {
}
declare const AgencyUpdateDto_base: import("../../common/pipes/zod-validation.pipe").ZodDto<import("zod").ZodObject<{
    phone: import("zod").ZodOptional<import("zod").ZodPipe<import("zod").ZodPipe<import("zod").ZodString, import("zod").ZodTransform<string, string>>, import("zod").ZodString>>;
    roadAddress: import("zod").ZodOptional<import("zod").ZodString>;
    lat: import("zod").ZodOptional<import("zod").ZodNumber>;
    lng: import("zod").ZodOptional<import("zod").ZodNumber>;
    logoMediaId: import("zod").ZodOptional<import("zod").ZodNullable<import("zod").ZodUUID>>;
    coverMediaId: import("zod").ZodOptional<import("zod").ZodNullable<import("zod").ZodUUID>>;
    mobile: import("zod").ZodOptional<import("zod").ZodNullable<import("zod").ZodPipe<import("zod").ZodPipe<import("zod").ZodString, import("zod").ZodTransform<string, string>>, import("zod").ZodString>>>;
    email: import("zod").ZodOptional<import("zod").ZodNullable<import("zod").ZodEmail>>;
    jibunAddress: import("zod").ZodOptional<import("zod").ZodNullable<import("zod").ZodString>>;
    addressDetail: import("zod").ZodOptional<import("zod").ZodNullable<import("zod").ZodString>>;
    zipCode: import("zod").ZodOptional<import("zod").ZodNullable<import("zod").ZodString>>;
    emdCode: import("zod").ZodOptional<import("zod").ZodNullable<import("zod").ZodPipe<import("zod").ZodString, import("zod").ZodTransform<string, string>>>>;
    intro: import("zod").ZodOptional<import("zod").ZodNullable<import("zod").ZodString>>;
    businessHours: import("zod").ZodOptional<import("zod").ZodNullable<import("zod").ZodObject<{
        mon: import("zod").ZodOptional<import("zod").ZodNullable<import("zod").ZodObject<{
            open: import("zod").ZodString;
            close: import("zod").ZodString;
        }, import("zod/v4/core").$strip>>>;
        tue: import("zod").ZodOptional<import("zod").ZodNullable<import("zod").ZodObject<{
            open: import("zod").ZodString;
            close: import("zod").ZodString;
        }, import("zod/v4/core").$strip>>>;
        wed: import("zod").ZodOptional<import("zod").ZodNullable<import("zod").ZodObject<{
            open: import("zod").ZodString;
            close: import("zod").ZodString;
        }, import("zod/v4/core").$strip>>>;
        thu: import("zod").ZodOptional<import("zod").ZodNullable<import("zod").ZodObject<{
            open: import("zod").ZodString;
            close: import("zod").ZodString;
        }, import("zod/v4/core").$strip>>>;
        fri: import("zod").ZodOptional<import("zod").ZodNullable<import("zod").ZodObject<{
            open: import("zod").ZodString;
            close: import("zod").ZodString;
        }, import("zod/v4/core").$strip>>>;
        sat: import("zod").ZodOptional<import("zod").ZodNullable<import("zod").ZodObject<{
            open: import("zod").ZodString;
            close: import("zod").ZodString;
        }, import("zod/v4/core").$strip>>>;
        sun: import("zod").ZodOptional<import("zod").ZodNullable<import("zod").ZodObject<{
            open: import("zod").ZodString;
            close: import("zod").ZodString;
        }, import("zod/v4/core").$strip>>>;
        note: import("zod").ZodOptional<import("zod").ZodString>;
    }, import("zod/v4/core").$strict>>>;
    specialties: import("zod").ZodOptional<import("zod").ZodPipe<import("zod").ZodArray<import("zod").ZodEnum<{
        readonly APT: "APT";
        readonly OFFICETEL: "OFFICETEL";
        readonly ONEROOM: "ONEROOM";
        readonly HOUSE: "HOUSE";
        readonly COMMERCIAL: "COMMERCIAL";
        readonly LAND: "LAND";
    }>>, import("zod").ZodTransform<("APT" | "OFFICETEL" | "ONEROOM" | "HOUSE" | "COMMERCIAL" | "LAND")[], ("APT" | "OFFICETEL" | "ONEROOM" | "HOUSE" | "COMMERCIAL" | "LAND")[]>>>;
}, import("zod/v4/core").$strip>>;
export declare class AgencyUpdateDto extends AgencyUpdateDto_base {
}
declare const AgencySearchQueryDto_base: import("../../common/pipes/zod-validation.pipe").ZodDto<import("zod").ZodObject<{
    page: import("zod").ZodDefault<import("zod").ZodCoercedNumber<unknown>>;
    pageSize: import("zod").ZodDefault<import("zod").ZodCoercedNumber<unknown>>;
    q: import("zod").ZodOptional<import("zod").ZodString>;
    emdCode: import("zod").ZodOptional<import("zod").ZodPipe<import("zod").ZodString, import("zod").ZodTransform<string, string>>>;
    bbox: import("zod").ZodOptional<import("zod").ZodPipe<import("zod").ZodString, import("zod").ZodTransform<{
        swLng: number;
        swLat: number;
        neLng: number;
        neLat: number;
    }, string>>>;
    specialties: import("zod").ZodPreprocess<import("zod").ZodOptional<import("zod").ZodArray<import("zod").ZodEnum<{
        readonly APT: "APT";
        readonly OFFICETEL: "OFFICETEL";
        readonly ONEROOM: "ONEROOM";
        readonly HOUSE: "HOUSE";
        readonly COMMERCIAL: "COMMERCIAL";
        readonly LAND: "LAND";
    }>>>, unknown>;
    openNow: import("zod").ZodPreprocess<import("zod").ZodOptional<import("zod").ZodBoolean>, unknown>;
    handlesPresale: import("zod").ZodPreprocess<import("zod").ZodOptional<import("zod").ZodBoolean>, unknown>;
    sort: import("zod").ZodDefault<import("zod").ZodEnum<{
        readonly RELEVANCE: "RELEVANCE";
        readonly LISTINGS: "LISTINGS";
        readonly NEWEST: "NEWEST";
        readonly NAME: "NAME";
    }>>;
}, import("zod/v4/core").$strip>>;
export declare class AgencySearchQueryDto extends AgencySearchQueryDto_base {
}
declare const AgencyMapQueryDto_base: import("../../common/pipes/zod-validation.pipe").ZodDto<import("zod").ZodObject<{
    bbox: import("zod").ZodPipe<import("zod").ZodString, import("zod").ZodTransform<{
        swLng: number;
        swLat: number;
        neLng: number;
        neLat: number;
    }, string>>;
    zoom: import("zod").ZodCoercedNumber<unknown>;
    q: import("zod").ZodOptional<import("zod").ZodString>;
    specialties: import("zod").ZodPreprocess<import("zod").ZodOptional<import("zod").ZodArray<import("zod").ZodEnum<{
        readonly APT: "APT";
        readonly OFFICETEL: "OFFICETEL";
        readonly ONEROOM: "ONEROOM";
        readonly HOUSE: "HOUSE";
        readonly COMMERCIAL: "COMMERCIAL";
        readonly LAND: "LAND";
    }>>>, unknown>;
}, import("zod/v4/core").$strip>>;
export declare class AgencyMapQueryDto extends AgencyMapQueryDto_base {
}
declare const AgencyDocumentDto_base: import("../../common/pipes/zod-validation.pipe").ZodDto<import("zod").ZodObject<{
    type: import("zod").ZodEnum<{
        readonly REGISTRATION_CERT: "REGISTRATION_CERT";
        readonly BUSINESS_REG_CERT: "BUSINESS_REG_CERT";
        readonly BROKER_LICENSE: "BROKER_LICENSE";
        readonly OTHER: "OTHER";
    }>;
    mediaId: import("zod").ZodUUID;
}, import("zod/v4/core").$strip>>;
export declare class AgencyDocumentDto extends AgencyDocumentDto_base {
}
declare const AgencyDocumentParamDto_base: import("../../common/pipes/zod-validation.pipe").ZodDto<import("zod").ZodObject<{
    docId: import("zod").ZodUUID;
}, import("zod/v4/core").$strip>>;
export declare class AgencyDocumentParamDto extends AgencyDocumentParamDto_base {
}
declare const AgencyAdminDocumentParamDto_base: import("../../common/pipes/zod-validation.pipe").ZodDto<import("zod").ZodObject<{
    id: import("zod").ZodUUID;
    docId: import("zod").ZodUUID;
}, import("zod/v4/core").$strip>>;
export declare class AgencyAdminDocumentParamDto extends AgencyAdminDocumentParamDto_base {
}
declare const AgencyMemberParamDto_base: import("../../common/pipes/zod-validation.pipe").ZodDto<import("zod").ZodObject<{
    memberId: import("zod").ZodUUID;
}, import("zod/v4/core").$strip>>;
export declare class AgencyMemberParamDto extends AgencyMemberParamDto_base {
}
declare const AgencyMemberListQueryDto_base: import("../../common/pipes/zod-validation.pipe").ZodDto<import("zod").ZodObject<{
    page: import("zod").ZodDefault<import("zod").ZodCoercedNumber<unknown>>;
    pageSize: import("zod").ZodDefault<import("zod").ZodCoercedNumber<unknown>>;
    includeRemoved: import("zod").ZodPipe<import("zod").ZodPreprocess<import("zod").ZodOptional<import("zod").ZodBoolean>, unknown>, import("zod").ZodTransform<boolean, boolean | undefined>>;
}, import("zod/v4/core").$strip>>;
export declare class AgencyMemberListQueryDto extends AgencyMemberListQueryDto_base {
}
declare const AgencyMemberUpdateDto_base: import("../../common/pipes/zod-validation.pipe").ZodDto<import("zod").ZodObject<{
    displayName: import("zod").ZodOptional<import("zod").ZodString>;
    title: import("zod").ZodOptional<import("zod").ZodNullable<import("zod").ZodString>>;
    phone: import("zod").ZodOptional<import("zod").ZodNullable<import("zod").ZodPipe<import("zod").ZodPipe<import("zod").ZodString, import("zod").ZodTransform<string, string>>, import("zod").ZodString>>>;
    isLicensed: import("zod").ZodOptional<import("zod").ZodBoolean>;
    licenseNumber: import("zod").ZodOptional<import("zod").ZodNullable<import("zod").ZodPipe<import("zod").ZodPipe<import("zod").ZodString, import("zod").ZodTransform<string, string>>, import("zod").ZodString>>>;
}, import("zod/v4/core").$strip>>;
export declare class AgencyMemberUpdateDto extends AgencyMemberUpdateDto_base {
}
declare const AgencyInviteCreateDto_base: import("../../common/pipes/zod-validation.pipe").ZodDto<import("zod").ZodPreprocess<import("zod").ZodObject<{
    label: import("zod").ZodOptional<import("zod").ZodString>;
    expiresInHours: import("zod").ZodDefault<import("zod").ZodInt>;
}, import("zod/v4/core").$strip>, unknown>>;
export declare class AgencyInviteCreateDto extends AgencyInviteCreateDto_base {
}
declare const AgencyInviteParamDto_base: import("../../common/pipes/zod-validation.pipe").ZodDto<import("zod").ZodObject<{
    inviteId: import("zod").ZodString;
}, import("zod/v4/core").$strip>>;
export declare class AgencyInviteParamDto extends AgencyInviteParamDto_base {
}
declare const AgencyJoinDto_base: import("../../common/pipes/zod-validation.pipe").ZodDto<import("zod").ZodObject<{
    consents: import("zod").ZodDefault<import("zod").ZodArray<import("zod").ZodObject<{
        type: import("zod").ZodEnum<{
            PRIVACY_AGENCY_JOIN: "PRIVACY_AGENCY_JOIN";
        }>;
        version: import("zod").ZodString;
    }, import("zod/v4/core").$strip>>>;
    displayName: import("zod").ZodString;
    title: import("zod").ZodOptional<import("zod").ZodNullable<import("zod").ZodString>>;
    phone: import("zod").ZodOptional<import("zod").ZodNullable<import("zod").ZodPipe<import("zod").ZodPipe<import("zod").ZodString, import("zod").ZodTransform<string, string>>, import("zod").ZodString>>>;
    code: import("zod").ZodPipe<import("zod").ZodPipe<import("zod").ZodString, import("zod").ZodTransform<string, string>>, import("zod").ZodString>;
}, import("zod/v4/core").$strip>>;
export declare class AgencyJoinDto extends AgencyJoinDto_base {
}
declare const AdminAgencyListQueryDto_base: import("../../common/pipes/zod-validation.pipe").ZodDto<import("zod").ZodObject<{
    page: import("zod").ZodDefault<import("zod").ZodCoercedNumber<unknown>>;
    pageSize: import("zod").ZodDefault<import("zod").ZodCoercedNumber<unknown>>;
    status: import("zod").ZodPreprocess<import("zod").ZodOptional<import("zod").ZodArray<import("zod").ZodEnum<{
        readonly PENDING: "PENDING";
        readonly APPROVED: "APPROVED";
        readonly REJECTED: "REJECTED";
        readonly SUSPENDED: "SUSPENDED";
    }>>>, unknown>;
    q: import("zod").ZodOptional<import("zod").ZodString>;
    sort: import("zod").ZodDefault<import("zod").ZodEnum<{
        readonly OLDEST: "OLDEST";
        readonly NEWEST: "NEWEST";
        readonly NAME: "NAME";
    }>>;
}, import("zod/v4/core").$strip>>;
export declare class AdminAgencyListQueryDto extends AdminAgencyListQueryDto_base {
}
declare const AgencyDecisionDto_base: import("../../common/pipes/zod-validation.pipe").ZodDto<import("zod").ZodObject<{
    status: import("zod").ZodEnum<{
        SUSPENDED: "SUSPENDED";
        APPROVED: "APPROVED";
        REJECTED: "REJECTED";
    }>;
    reason: import("zod").ZodOptional<import("zod").ZodString>;
}, import("zod/v4/core").$strip>>;
export declare class AgencyDecisionDto extends AgencyDecisionDto_base {
}
declare const AgencyAdminDeleteDto_base: import("../../common/pipes/zod-validation.pipe").ZodDto<import("zod").ZodObject<{
    reason: import("zod").ZodString;
}, import("zod/v4/core").$strip>>;
export declare class AgencyAdminDeleteDto extends AgencyAdminDeleteDto_base {
}
declare const AdminAgencyDetailQueryDto_base: import("../../common/pipes/zod-validation.pipe").ZodDto<import("zod").ZodObject<{
    includeRemoved: import("zod").ZodPipe<import("zod").ZodPreprocess<import("zod").ZodOptional<import("zod").ZodBoolean>, unknown>, import("zod").ZodTransform<boolean, boolean | undefined>>;
}, import("zod/v4/core").$strip>>;
export declare class AdminAgencyDetailQueryDto extends AdminAgencyDetailQueryDto_base {
}
declare const AgencyLocationUpdateDto_base: import("../../common/pipes/zod-validation.pipe").ZodDto<import("zod").ZodObject<{
    roadAddress: import("zod").ZodOptional<import("zod").ZodString>;
    jibunAddress: import("zod").ZodOptional<import("zod").ZodNullable<import("zod").ZodString>>;
    addressDetail: import("zod").ZodOptional<import("zod").ZodNullable<import("zod").ZodString>>;
    zipCode: import("zod").ZodOptional<import("zod").ZodNullable<import("zod").ZodString>>;
    emdCode: import("zod").ZodOptional<import("zod").ZodNullable<import("zod").ZodPipe<import("zod").ZodString, import("zod").ZodTransform<string, string>>>>;
    lat: import("zod").ZodOptional<import("zod").ZodNumber>;
    lng: import("zod").ZodOptional<import("zod").ZodNumber>;
    reason: import("zod").ZodString;
}, import("zod/v4/core").$strip>>;
export declare class AgencyLocationUpdateDto extends AgencyLocationUpdateDto_base {
}
declare const AgencyRegistryCheckQueryDto_base: import("../../common/pipes/zod-validation.pipe").ZodDto<import("zod").ZodObject<{
    refresh: import("zod").ZodPipe<import("zod").ZodPreprocess<import("zod").ZodOptional<import("zod").ZodBoolean>, unknown>, import("zod").ZodTransform<boolean, boolean | undefined>>;
}, import("zod/v4/core").$strip>>;
export declare class AgencyRegistryCheckQueryDto extends AgencyRegistryCheckQueryDto_base {
}
export {};
