import { z } from 'zod';
declare const IdParamDto_base: import("../../common/pipes/zod-validation.pipe").ZodDto<z.ZodObject<{
    id: z.ZodUUID;
}, z.core.$strip>>;
export declare class IdParamDto extends IdParamDto_base {
}
declare const CoBrokerParamDto_base: import("../../common/pipes/zod-validation.pipe").ZodDto<z.ZodObject<{
    id: z.ZodUUID;
    agencyId: z.ZodUUID;
}, z.core.$strip>>;
export declare class CoBrokerParamDto extends CoBrokerParamDto_base {
}
declare const MapSearchQueryDto_base: import("../../common/pipes/zod-validation.pipe").ZodDto<z.ZodObject<{
    assetTypes: z.ZodPreprocess<z.ZodOptional<z.ZodArray<z.ZodEnum<{
        readonly APT: "APT";
        readonly OFFICETEL: "OFFICETEL";
        readonly ONEROOM: "ONEROOM";
        readonly HOUSE: "HOUSE";
        readonly COMMERCIAL: "COMMERCIAL";
        readonly LAND: "LAND";
    }>>>, unknown>;
    dealTypes: z.ZodPreprocess<z.ZodOptional<z.ZodArray<z.ZodEnum<{
        readonly SALE: "SALE";
        readonly JEONSE: "JEONSE";
        readonly MONTHLY: "MONTHLY";
        readonly PRESALE: "PRESALE";
    }>>>, unknown>;
    priceMin: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
    priceMax: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
    depositMin: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
    depositMax: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
    rentMin: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
    rentMax: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
    areaMin: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
    areaMax: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
    roomsMin: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
    bathsMin: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
    directions: z.ZodPreprocess<z.ZodOptional<z.ZodArray<z.ZodEnum<{
        readonly EAST: "EAST";
        readonly WEST: "WEST";
        readonly SOUTH: "SOUTH";
        readonly NORTH: "NORTH";
        readonly SOUTH_EAST: "SOUTH_EAST";
        readonly SOUTH_WEST: "SOUTH_WEST";
        readonly NORTH_EAST: "NORTH_EAST";
        readonly NORTH_WEST: "NORTH_WEST";
    }>>>, unknown>;
    floorClasses: z.ZodPreprocess<z.ZodOptional<z.ZodArray<z.ZodEnum<{
        readonly LOW: "LOW";
        readonly MID: "MID";
        readonly HIGH: "HIGH";
    }>>>, unknown>;
    builtYearMin: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
    builtYearMax: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
    options: z.ZodPreprocess<z.ZodOptional<z.ZodArray<z.ZodEnum<{
        readonly AIR_CONDITIONER: "AIR_CONDITIONER";
        readonly REFRIGERATOR: "REFRIGERATOR";
        readonly WASHER: "WASHER";
        readonly DRYER: "DRYER";
        readonly BED: "BED";
        readonly DESK: "DESK";
        readonly CLOSET: "CLOSET";
        readonly BUILT_IN_WARDROBE: "BUILT_IN_WARDROBE";
        readonly SHOE_RACK: "SHOE_RACK";
        readonly INDUCTION: "INDUCTION";
        readonly GAS_RANGE: "GAS_RANGE";
        readonly MICROWAVE: "MICROWAVE";
        readonly DISHWASHER: "DISHWASHER";
        readonly TV: "TV";
        readonly WIFI: "WIFI";
        readonly ELEVATOR: "ELEVATOR";
        readonly PARKING: "PARKING";
        readonly PET_ALLOWED: "PET_ALLOWED";
        readonly SECURITY: "SECURITY";
        readonly CCTV: "CCTV";
        readonly VERANDA: "VERANDA";
        readonly BALCONY: "BALCONY";
    }>>>, unknown>;
    verifiedOnly: z.ZodPreprocess<z.ZodOptional<z.ZodBoolean>, unknown>;
    roomTypes: z.ZodPreprocess<z.ZodOptional<z.ZodArray<z.ZodEnum<{
        readonly ONE_ROOM: "ONE_ROOM";
        readonly ONE_HALF_ROOM: "ONE_HALF_ROOM";
        readonly TWO_ROOM: "TWO_ROOM";
        readonly THREE_ROOM_PLUS: "THREE_ROOM_PLUS";
    }>>>, unknown>;
    landZones: z.ZodPreprocess<z.ZodOptional<z.ZodArray<z.ZodEnum<{
        readonly RESIDENTIAL: "RESIDENTIAL";
        readonly COMMERCIAL: "COMMERCIAL";
        readonly INDUSTRIAL: "INDUSTRIAL";
        readonly GREEN: "GREEN";
        readonly MANAGEMENT: "MANAGEMENT";
        readonly AGRICULTURAL: "AGRICULTURAL";
        readonly CONSERVATION: "CONSERVATION";
    }>>>, unknown>;
    landCategories: z.ZodPreprocess<z.ZodOptional<z.ZodArray<z.ZodEnum<{
        readonly DAE: "DAE";
        readonly JEON: "JEON";
        readonly DAP: "DAP";
        readonly GWASUWON: "GWASUWON";
        readonly IMYA: "IMYA";
        readonly JAPJONGJI: "JAPJONGJI";
        readonly ETC: "ETC";
    }>>>, unknown>;
    complexId: z.ZodOptional<z.ZodUUID>;
    agencyId: z.ZodOptional<z.ZodUUID>;
    emdCode: z.ZodOptional<z.ZodPipe<z.ZodString, z.ZodTransform<string, string>>>;
    bbox: z.ZodPipe<z.ZodString, z.ZodTransform<{
        swLng: number;
        swLat: number;
        neLng: number;
        neLat: number;
    }, string>>;
    zoom: z.ZodCoercedNumber<unknown>;
}, z.core.$strip>>;
export declare class MapSearchQueryDto extends MapSearchQueryDto_base {
}
declare const ListingListQueryDto_base: import("../../common/pipes/zod-validation.pipe").ZodDto<z.ZodObject<{
    assetTypes: z.ZodPreprocess<z.ZodOptional<z.ZodArray<z.ZodEnum<{
        readonly APT: "APT";
        readonly OFFICETEL: "OFFICETEL";
        readonly ONEROOM: "ONEROOM";
        readonly HOUSE: "HOUSE";
        readonly COMMERCIAL: "COMMERCIAL";
        readonly LAND: "LAND";
    }>>>, unknown>;
    dealTypes: z.ZodPreprocess<z.ZodOptional<z.ZodArray<z.ZodEnum<{
        readonly SALE: "SALE";
        readonly JEONSE: "JEONSE";
        readonly MONTHLY: "MONTHLY";
        readonly PRESALE: "PRESALE";
    }>>>, unknown>;
    priceMin: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
    priceMax: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
    depositMin: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
    depositMax: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
    rentMin: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
    rentMax: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
    areaMin: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
    areaMax: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
    roomsMin: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
    bathsMin: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
    directions: z.ZodPreprocess<z.ZodOptional<z.ZodArray<z.ZodEnum<{
        readonly EAST: "EAST";
        readonly WEST: "WEST";
        readonly SOUTH: "SOUTH";
        readonly NORTH: "NORTH";
        readonly SOUTH_EAST: "SOUTH_EAST";
        readonly SOUTH_WEST: "SOUTH_WEST";
        readonly NORTH_EAST: "NORTH_EAST";
        readonly NORTH_WEST: "NORTH_WEST";
    }>>>, unknown>;
    floorClasses: z.ZodPreprocess<z.ZodOptional<z.ZodArray<z.ZodEnum<{
        readonly LOW: "LOW";
        readonly MID: "MID";
        readonly HIGH: "HIGH";
    }>>>, unknown>;
    builtYearMin: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
    builtYearMax: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
    options: z.ZodPreprocess<z.ZodOptional<z.ZodArray<z.ZodEnum<{
        readonly AIR_CONDITIONER: "AIR_CONDITIONER";
        readonly REFRIGERATOR: "REFRIGERATOR";
        readonly WASHER: "WASHER";
        readonly DRYER: "DRYER";
        readonly BED: "BED";
        readonly DESK: "DESK";
        readonly CLOSET: "CLOSET";
        readonly BUILT_IN_WARDROBE: "BUILT_IN_WARDROBE";
        readonly SHOE_RACK: "SHOE_RACK";
        readonly INDUCTION: "INDUCTION";
        readonly GAS_RANGE: "GAS_RANGE";
        readonly MICROWAVE: "MICROWAVE";
        readonly DISHWASHER: "DISHWASHER";
        readonly TV: "TV";
        readonly WIFI: "WIFI";
        readonly ELEVATOR: "ELEVATOR";
        readonly PARKING: "PARKING";
        readonly PET_ALLOWED: "PET_ALLOWED";
        readonly SECURITY: "SECURITY";
        readonly CCTV: "CCTV";
        readonly VERANDA: "VERANDA";
        readonly BALCONY: "BALCONY";
    }>>>, unknown>;
    verifiedOnly: z.ZodPreprocess<z.ZodOptional<z.ZodBoolean>, unknown>;
    roomTypes: z.ZodPreprocess<z.ZodOptional<z.ZodArray<z.ZodEnum<{
        readonly ONE_ROOM: "ONE_ROOM";
        readonly ONE_HALF_ROOM: "ONE_HALF_ROOM";
        readonly TWO_ROOM: "TWO_ROOM";
        readonly THREE_ROOM_PLUS: "THREE_ROOM_PLUS";
    }>>>, unknown>;
    landZones: z.ZodPreprocess<z.ZodOptional<z.ZodArray<z.ZodEnum<{
        readonly RESIDENTIAL: "RESIDENTIAL";
        readonly COMMERCIAL: "COMMERCIAL";
        readonly INDUSTRIAL: "INDUSTRIAL";
        readonly GREEN: "GREEN";
        readonly MANAGEMENT: "MANAGEMENT";
        readonly AGRICULTURAL: "AGRICULTURAL";
        readonly CONSERVATION: "CONSERVATION";
    }>>>, unknown>;
    landCategories: z.ZodPreprocess<z.ZodOptional<z.ZodArray<z.ZodEnum<{
        readonly DAE: "DAE";
        readonly JEON: "JEON";
        readonly DAP: "DAP";
        readonly GWASUWON: "GWASUWON";
        readonly IMYA: "IMYA";
        readonly JAPJONGJI: "JAPJONGJI";
        readonly ETC: "ETC";
    }>>>, unknown>;
    complexId: z.ZodOptional<z.ZodUUID>;
    agencyId: z.ZodOptional<z.ZodUUID>;
    emdCode: z.ZodOptional<z.ZodPipe<z.ZodString, z.ZodTransform<string, string>>>;
    bbox: z.ZodOptional<z.ZodPipe<z.ZodString, z.ZodTransform<{
        swLng: number;
        swLat: number;
        neLng: number;
        neLat: number;
    }, string>>>;
    sort: z.ZodDefault<z.ZodEnum<{
        readonly LATEST: "LATEST";
        readonly VERIFIED: "VERIFIED";
        readonly PRICE_ASC: "PRICE_ASC";
        readonly PRICE_DESC: "PRICE_DESC";
        readonly AREA_ASC: "AREA_ASC";
        readonly AREA_DESC: "AREA_DESC";
        readonly BUILT_YEAR_DESC: "BUILT_YEAR_DESC";
        readonly PHOTO: "PHOTO";
    }>>;
    page: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
    pageSize: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
}, z.core.$strip>>;
export declare class ListingListQueryDto extends ListingListQueryDto_base {
}
declare const AgencyListingListQueryDto_base: import("../../common/pipes/zod-validation.pipe").ZodDto<z.ZodObject<{
    statuses: z.ZodPreprocess<z.ZodOptional<z.ZodArray<z.ZodEnum<{
        readonly DRAFT: "DRAFT";
        readonly ACTIVE: "ACTIVE";
        readonly RESERVED: "RESERVED";
        readonly CLOSED: "CLOSED";
        readonly HIDDEN: "HIDDEN";
    }>>>, unknown>;
    dealTypes: z.ZodPreprocess<z.ZodOptional<z.ZodArray<z.ZodEnum<{
        readonly SALE: "SALE";
        readonly JEONSE: "JEONSE";
        readonly MONTHLY: "MONTHLY";
        readonly PRESALE: "PRESALE";
    }>>>, unknown>;
    assetTypes: z.ZodPreprocess<z.ZodOptional<z.ZodArray<z.ZodEnum<{
        readonly APT: "APT";
        readonly OFFICETEL: "OFFICETEL";
        readonly ONEROOM: "ONEROOM";
        readonly HOUSE: "HOUSE";
        readonly COMMERCIAL: "COMMERCIAL";
        readonly LAND: "LAND";
    }>>>, unknown>;
    q: z.ZodOptional<z.ZodPipe<z.ZodString, z.ZodTransform<string | undefined, string>>>;
    verificationDue: z.ZodPreprocess<z.ZodOptional<z.ZodBoolean>, unknown>;
    coBrokered: z.ZodPreprocess<z.ZodOptional<z.ZodBoolean>, unknown>;
    primaryOnly: z.ZodPreprocess<z.ZodOptional<z.ZodBoolean>, unknown>;
    sort: z.ZodDefault<z.ZodEnum<{
        readonly UPDATED: "UPDATED";
        readonly LATEST: "LATEST";
        readonly VERIFY_DUE: "VERIFY_DUE";
        readonly PRICE_DESC: "PRICE_DESC";
        readonly PRICE_ASC: "PRICE_ASC";
        readonly VIEWS: "VIEWS";
    }>>;
    page: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
    pageSize: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
}, z.core.$strip>>;
export declare class AgencyListingListQueryDto extends AgencyListingListQueryDto_base {
}
declare const CreateListingDto_base: import("../../common/pipes/zod-validation.pipe").ZodDto<z.ZodObject<{
    dealType: z.ZodEnum<{
        readonly SALE: "SALE";
        readonly JEONSE: "JEONSE";
        readonly MONTHLY: "MONTHLY";
        readonly PRESALE: "PRESALE";
    }>;
    floorDisplay: z.ZodDefault<z.ZodEnum<{
        readonly EXACT: "EXACT";
        readonly CLASS: "CLASS";
    }>>;
    options: z.ZodDefault<z.ZodArray<z.ZodEnum<{
        readonly AIR_CONDITIONER: "AIR_CONDITIONER";
        readonly REFRIGERATOR: "REFRIGERATOR";
        readonly WASHER: "WASHER";
        readonly DRYER: "DRYER";
        readonly BED: "BED";
        readonly DESK: "DESK";
        readonly CLOSET: "CLOSET";
        readonly BUILT_IN_WARDROBE: "BUILT_IN_WARDROBE";
        readonly SHOE_RACK: "SHOE_RACK";
        readonly INDUCTION: "INDUCTION";
        readonly GAS_RANGE: "GAS_RANGE";
        readonly MICROWAVE: "MICROWAVE";
        readonly DISHWASHER: "DISHWASHER";
        readonly TV: "TV";
        readonly WIFI: "WIFI";
        readonly ELEVATOR: "ELEVATOR";
        readonly PARKING: "PARKING";
        readonly PET_ALLOWED: "PET_ALLOWED";
        readonly SECURITY: "SECURITY";
        readonly CCTV: "CCTV";
        readonly VERANDA: "VERANDA";
        readonly BALCONY: "BALCONY";
    }>>>;
    property: z.ZodObject<{
        lat: z.ZodNumber;
        lng: z.ZodNumber;
        complexId: z.ZodOptional<z.ZodUUID>;
        emdCode: z.ZodOptional<z.ZodPipe<z.ZodString, z.ZodTransform<string, string>>>;
        assetType: z.ZodEnum<{
            readonly APT: "APT";
            readonly OFFICETEL: "OFFICETEL";
            readonly ONEROOM: "ONEROOM";
            readonly HOUSE: "HOUSE";
            readonly COMMERCIAL: "COMMERCIAL";
            readonly LAND: "LAND";
        }>;
        roadAddress: z.ZodString;
        areaTypeId: z.ZodOptional<z.ZodUUID>;
        jibunAddress: z.ZodOptional<z.ZodString>;
        buildingName: z.ZodOptional<z.ZodString>;
        dong: z.ZodOptional<z.ZodString>;
        ho: z.ZodOptional<z.ZodString>;
        floor: z.ZodOptional<z.ZodInt>;
        totalFloors: z.ZodOptional<z.ZodInt>;
        exclusiveArea: z.ZodOptional<z.ZodNumber>;
        supplyArea: z.ZodOptional<z.ZodNumber>;
        landArea: z.ZodOptional<z.ZodNumber>;
        totalFloorArea: z.ZodOptional<z.ZodNumber>;
        rooms: z.ZodOptional<z.ZodInt>;
        roomType: z.ZodOptional<z.ZodEnum<{
            readonly ONE_ROOM: "ONE_ROOM";
            readonly ONE_HALF_ROOM: "ONE_HALF_ROOM";
            readonly TWO_ROOM: "TWO_ROOM";
            readonly THREE_ROOM_PLUS: "THREE_ROOM_PLUS";
        }>>;
        baths: z.ZodOptional<z.ZodInt>;
        direction: z.ZodOptional<z.ZodEnum<{
            readonly EAST: "EAST";
            readonly WEST: "WEST";
            readonly SOUTH: "SOUTH";
            readonly NORTH: "NORTH";
            readonly SOUTH_EAST: "SOUTH_EAST";
            readonly SOUTH_WEST: "SOUTH_WEST";
            readonly NORTH_EAST: "NORTH_EAST";
            readonly NORTH_WEST: "NORTH_WEST";
        }>>;
        directionBasis: z.ZodOptional<z.ZodEnum<{
            readonly LIVING_ROOM: "LIVING_ROOM";
            readonly MAIN_ROOM: "MAIN_ROOM";
            readonly ENTRANCE: "ENTRANCE";
            readonly OTHER: "OTHER";
        }>>;
        approvalDate: z.ZodOptional<z.ZodISODate>;
        parkingSpaces: z.ZodOptional<z.ZodInt>;
        heatingType: z.ZodOptional<z.ZodString>;
        zoning: z.ZodOptional<z.ZodString>;
        landCategory: z.ZodOptional<z.ZodString>;
        buildingUse: z.ZodOptional<z.ZodEnum<{
            readonly DETACHED_HOUSE: "DETACHED_HOUSE";
            readonly MULTI_UNIT_HOUSE: "MULTI_UNIT_HOUSE";
            readonly MULTI_FAMILY_HOUSE: "MULTI_FAMILY_HOUSE";
            readonly OFFICIAL_RESIDENCE: "OFFICIAL_RESIDENCE";
            readonly APARTMENT: "APARTMENT";
            readonly ROW_HOUSE: "ROW_HOUSE";
            readonly MULTIPLEX_HOUSE: "MULTIPLEX_HOUSE";
            readonly DORMITORY: "DORMITORY";
            readonly NEIGHBORHOOD_FACILITY_1: "NEIGHBORHOOD_FACILITY_1";
            readonly NEIGHBORHOOD_FACILITY_2: "NEIGHBORHOOD_FACILITY_2";
            readonly CULTURE_ASSEMBLY: "CULTURE_ASSEMBLY";
            readonly RELIGIOUS: "RELIGIOUS";
            readonly SALES: "SALES";
            readonly TRANSPORTATION: "TRANSPORTATION";
            readonly MEDICAL: "MEDICAL";
            readonly EDUCATION_RESEARCH: "EDUCATION_RESEARCH";
            readonly ELDERLY_CHILD: "ELDERLY_CHILD";
            readonly TRAINING: "TRAINING";
            readonly SPORTS: "SPORTS";
            readonly OFFICE: "OFFICE";
            readonly OFFICETEL: "OFFICETEL";
            readonly LODGING: "LODGING";
            readonly AMUSEMENT: "AMUSEMENT";
            readonly FACTORY: "FACTORY";
            readonly WAREHOUSE: "WAREHOUSE";
            readonly HAZARDOUS_MATERIAL: "HAZARDOUS_MATERIAL";
            readonly AUTOMOBILE: "AUTOMOBILE";
            readonly ANIMAL_PLANT: "ANIMAL_PLANT";
            readonly RESOURCE_RECYCLING: "RESOURCE_RECYCLING";
            readonly CORRECTIONAL_MILITARY: "CORRECTIONAL_MILITARY";
            readonly BROADCASTING: "BROADCASTING";
            readonly POWER_PLANT: "POWER_PLANT";
            readonly CEMETERY: "CEMETERY";
            readonly TOURIST_REST: "TOURIST_REST";
            readonly FUNERAL: "FUNERAL";
            readonly CAMPING: "CAMPING";
        }>>;
    }, z.core.$strip>;
    contact: z.ZodOptional<z.ZodObject<{
        contactMemberId: z.ZodOptional<z.ZodUUID>;
        contactPhone: z.ZodOptional<z.ZodPipe<z.ZodPipe<z.ZodString, z.ZodTransform<string, string>>, z.ZodString>>;
    }, z.core.$strip>>;
    salePrice: z.ZodOptional<z.ZodInt>;
    deposit: z.ZodOptional<z.ZodInt>;
    monthlyRent: z.ZodOptional<z.ZodInt>;
    presalePrice: z.ZodOptional<z.ZodInt>;
    premium: z.ZodOptional<z.ZodInt>;
    title: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodString>;
    moveInDate: z.ZodOptional<z.ZodISODate>;
    maintenanceFeeWon: z.ZodOptional<z.ZodInt>;
    maintenanceFee: z.ZodOptional<z.ZodObject<{
        billingType: z.ZodEnum<{
            readonly FIXED: "FIXED";
            readonly ACTUAL: "ACTUAL";
            readonly UNKNOWN: "UNKNOWN";
        }>;
        items: z.ZodDefault<z.ZodArray<z.ZodObject<{
            kind: z.ZodEnum<{
                readonly GENERAL: "GENERAL";
                readonly ELECTRICITY: "ELECTRICITY";
                readonly WATER: "WATER";
                readonly GAS: "GAS";
                readonly HEATING: "HEATING";
                readonly INTERNET: "INTERNET";
                readonly TV: "TV";
                readonly OTHER: "OTHER";
            }>;
            included: z.ZodBoolean;
            amountWon: z.ZodOptional<z.ZodNullable<z.ZodInt>>;
        }, z.core.$strip>>>;
        unavailableReason: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, z.core.$strip>>;
    moveInType: z.ZodOptional<z.ZodEnum<{
        readonly IMMEDIATE: "IMMEDIATE";
        readonly NEGOTIABLE: "NEGOTIABLE";
        readonly DATE: "DATE";
    }>>;
}, z.core.$strip>>;
export declare class CreateListingDto extends CreateListingDto_base {
}
declare const UpdateListingDto_base: import("../../common/pipes/zod-validation.pipe").ZodDto<z.ZodObject<{
    property: z.ZodOptional<z.ZodObject<{
        lat: z.ZodOptional<z.ZodNumber>;
        lng: z.ZodOptional<z.ZodNumber>;
        complexId: z.ZodOptional<z.ZodNullable<z.ZodUUID>>;
        emdCode: z.ZodOptional<z.ZodNullable<z.ZodPipe<z.ZodString, z.ZodTransform<string, string>>>>;
        assetType: z.ZodOptional<z.ZodEnum<{
            readonly APT: "APT";
            readonly OFFICETEL: "OFFICETEL";
            readonly ONEROOM: "ONEROOM";
            readonly HOUSE: "HOUSE";
            readonly COMMERCIAL: "COMMERCIAL";
            readonly LAND: "LAND";
        }>>;
        roadAddress: z.ZodOptional<z.ZodString>;
        areaTypeId: z.ZodOptional<z.ZodNullable<z.ZodUUID>>;
        jibunAddress: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        buildingName: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        dong: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        ho: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        floor: z.ZodOptional<z.ZodNullable<z.ZodInt>>;
        totalFloors: z.ZodOptional<z.ZodNullable<z.ZodInt>>;
        exclusiveArea: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        supplyArea: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        landArea: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        totalFloorArea: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        rooms: z.ZodOptional<z.ZodNullable<z.ZodInt>>;
        roomType: z.ZodOptional<z.ZodNullable<z.ZodEnum<{
            readonly ONE_ROOM: "ONE_ROOM";
            readonly ONE_HALF_ROOM: "ONE_HALF_ROOM";
            readonly TWO_ROOM: "TWO_ROOM";
            readonly THREE_ROOM_PLUS: "THREE_ROOM_PLUS";
        }>>>;
        baths: z.ZodOptional<z.ZodNullable<z.ZodInt>>;
        direction: z.ZodOptional<z.ZodNullable<z.ZodEnum<{
            readonly EAST: "EAST";
            readonly WEST: "WEST";
            readonly SOUTH: "SOUTH";
            readonly NORTH: "NORTH";
            readonly SOUTH_EAST: "SOUTH_EAST";
            readonly SOUTH_WEST: "SOUTH_WEST";
            readonly NORTH_EAST: "NORTH_EAST";
            readonly NORTH_WEST: "NORTH_WEST";
        }>>>;
        directionBasis: z.ZodOptional<z.ZodNullable<z.ZodEnum<{
            readonly LIVING_ROOM: "LIVING_ROOM";
            readonly MAIN_ROOM: "MAIN_ROOM";
            readonly ENTRANCE: "ENTRANCE";
            readonly OTHER: "OTHER";
        }>>>;
        approvalDate: z.ZodOptional<z.ZodNullable<z.ZodISODate>>;
        parkingSpaces: z.ZodOptional<z.ZodNullable<z.ZodInt>>;
        heatingType: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        zoning: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        landCategory: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        buildingUse: z.ZodOptional<z.ZodNullable<z.ZodEnum<{
            readonly DETACHED_HOUSE: "DETACHED_HOUSE";
            readonly MULTI_UNIT_HOUSE: "MULTI_UNIT_HOUSE";
            readonly MULTI_FAMILY_HOUSE: "MULTI_FAMILY_HOUSE";
            readonly OFFICIAL_RESIDENCE: "OFFICIAL_RESIDENCE";
            readonly APARTMENT: "APARTMENT";
            readonly ROW_HOUSE: "ROW_HOUSE";
            readonly MULTIPLEX_HOUSE: "MULTIPLEX_HOUSE";
            readonly DORMITORY: "DORMITORY";
            readonly NEIGHBORHOOD_FACILITY_1: "NEIGHBORHOOD_FACILITY_1";
            readonly NEIGHBORHOOD_FACILITY_2: "NEIGHBORHOOD_FACILITY_2";
            readonly CULTURE_ASSEMBLY: "CULTURE_ASSEMBLY";
            readonly RELIGIOUS: "RELIGIOUS";
            readonly SALES: "SALES";
            readonly TRANSPORTATION: "TRANSPORTATION";
            readonly MEDICAL: "MEDICAL";
            readonly EDUCATION_RESEARCH: "EDUCATION_RESEARCH";
            readonly ELDERLY_CHILD: "ELDERLY_CHILD";
            readonly TRAINING: "TRAINING";
            readonly SPORTS: "SPORTS";
            readonly OFFICE: "OFFICE";
            readonly OFFICETEL: "OFFICETEL";
            readonly LODGING: "LODGING";
            readonly AMUSEMENT: "AMUSEMENT";
            readonly FACTORY: "FACTORY";
            readonly WAREHOUSE: "WAREHOUSE";
            readonly HAZARDOUS_MATERIAL: "HAZARDOUS_MATERIAL";
            readonly AUTOMOBILE: "AUTOMOBILE";
            readonly ANIMAL_PLANT: "ANIMAL_PLANT";
            readonly RESOURCE_RECYCLING: "RESOURCE_RECYCLING";
            readonly CORRECTIONAL_MILITARY: "CORRECTIONAL_MILITARY";
            readonly BROADCASTING: "BROADCASTING";
            readonly POWER_PLANT: "POWER_PLANT";
            readonly CEMETERY: "CEMETERY";
            readonly TOURIST_REST: "TOURIST_REST";
            readonly FUNERAL: "FUNERAL";
            readonly CAMPING: "CAMPING";
        }>>>;
    }, z.core.$strip>>;
    contact: z.ZodOptional<z.ZodObject<{
        contactMemberId: z.ZodOptional<z.ZodUUID>;
        contactPhone: z.ZodOptional<z.ZodPipe<z.ZodPipe<z.ZodString, z.ZodTransform<string, string>>, z.ZodString>>;
    }, z.core.$strip>>;
    version: z.ZodOptional<z.ZodInt>;
    options: z.ZodOptional<z.ZodArray<z.ZodEnum<{
        readonly AIR_CONDITIONER: "AIR_CONDITIONER";
        readonly REFRIGERATOR: "REFRIGERATOR";
        readonly WASHER: "WASHER";
        readonly DRYER: "DRYER";
        readonly BED: "BED";
        readonly DESK: "DESK";
        readonly CLOSET: "CLOSET";
        readonly BUILT_IN_WARDROBE: "BUILT_IN_WARDROBE";
        readonly SHOE_RACK: "SHOE_RACK";
        readonly INDUCTION: "INDUCTION";
        readonly GAS_RANGE: "GAS_RANGE";
        readonly MICROWAVE: "MICROWAVE";
        readonly DISHWASHER: "DISHWASHER";
        readonly TV: "TV";
        readonly WIFI: "WIFI";
        readonly ELEVATOR: "ELEVATOR";
        readonly PARKING: "PARKING";
        readonly PET_ALLOWED: "PET_ALLOWED";
        readonly SECURITY: "SECURITY";
        readonly CCTV: "CCTV";
        readonly VERANDA: "VERANDA";
        readonly BALCONY: "BALCONY";
    }>>>;
    salePrice: z.ZodOptional<z.ZodNullable<z.ZodInt>>;
    deposit: z.ZodOptional<z.ZodNullable<z.ZodInt>>;
    monthlyRent: z.ZodOptional<z.ZodNullable<z.ZodInt>>;
    presalePrice: z.ZodOptional<z.ZodNullable<z.ZodInt>>;
    premium: z.ZodOptional<z.ZodNullable<z.ZodInt>>;
    title: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    description: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    moveInDate: z.ZodOptional<z.ZodNullable<z.ZodISODate>>;
    dealType: z.ZodOptional<z.ZodEnum<{
        readonly SALE: "SALE";
        readonly JEONSE: "JEONSE";
        readonly MONTHLY: "MONTHLY";
        readonly PRESALE: "PRESALE";
    }>>;
    maintenanceFeeWon: z.ZodOptional<z.ZodNullable<z.ZodInt>>;
    maintenanceFee: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        billingType: z.ZodEnum<{
            readonly FIXED: "FIXED";
            readonly ACTUAL: "ACTUAL";
            readonly UNKNOWN: "UNKNOWN";
        }>;
        items: z.ZodDefault<z.ZodArray<z.ZodObject<{
            kind: z.ZodEnum<{
                readonly GENERAL: "GENERAL";
                readonly ELECTRICITY: "ELECTRICITY";
                readonly WATER: "WATER";
                readonly GAS: "GAS";
                readonly HEATING: "HEATING";
                readonly INTERNET: "INTERNET";
                readonly TV: "TV";
                readonly OTHER: "OTHER";
            }>;
            included: z.ZodBoolean;
            amountWon: z.ZodOptional<z.ZodNullable<z.ZodInt>>;
        }, z.core.$strip>>>;
        unavailableReason: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, z.core.$strip>>>;
    moveInType: z.ZodOptional<z.ZodNullable<z.ZodEnum<{
        readonly IMMEDIATE: "IMMEDIATE";
        readonly NEGOTIABLE: "NEGOTIABLE";
        readonly DATE: "DATE";
    }>>>;
    floorDisplay: z.ZodOptional<z.ZodEnum<{
        readonly EXACT: "EXACT";
        readonly CLASS: "CLASS";
    }>>;
}, z.core.$strip>>;
export declare class UpdateListingDto extends UpdateListingDto_base {
}
declare const ListingStatusChangeDto_base: import("../../common/pipes/zod-validation.pipe").ZodDto<z.ZodObject<{
    status: z.ZodEnum<{
        ACTIVE: "ACTIVE";
        DRAFT: "DRAFT";
        RESERVED: "RESERVED";
        CLOSED: "CLOSED";
    }>;
}, z.core.$strip>>;
export declare class ListingStatusChangeDto extends ListingStatusChangeDto_base {
}
declare const ListingVerificationDto_base: import("../../common/pipes/zod-validation.pipe").ZodDto<z.ZodObject<{
    method: z.ZodEnum<{
        readonly OWNER_CONFIRMED: "OWNER_CONFIRMED";
        readonly DOCUMENT: "DOCUMENT";
        readonly SITE_VISIT: "SITE_VISIT";
        readonly OWNER_CALL: "OWNER_CALL";
        readonly REGISTRY: "REGISTRY";
    }>;
    verifiedAt: z.ZodISODate;
    note: z.ZodOptional<z.ZodString>;
}, z.core.$strip>>;
export declare class ListingVerificationDto extends ListingVerificationDto_base {
}
declare const ListingPhotosDto_base: import("../../common/pipes/zod-validation.pipe").ZodDto<z.ZodObject<{
    photos: z.ZodArray<z.ZodObject<{
        mediaId: z.ZodUUID;
        caption: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    coverMediaId: z.ZodOptional<z.ZodUUID>;
}, z.core.$strip>>;
export declare class ListingPhotosDto extends ListingPhotosDto_base {
}
declare const CoBrokerJoinDto_base: import("../../common/pipes/zod-validation.pipe").ZodDto<z.ZodObject<{
    contactMemberId: z.ZodOptional<z.ZodUUID>;
    contactPhone: z.ZodOptional<z.ZodPipe<z.ZodPipe<z.ZodString, z.ZodTransform<string, string>>, z.ZodString>>;
}, z.core.$strip>>;
export declare class CoBrokerJoinDto extends CoBrokerJoinDto_base {
}
declare const PaginationQueryDto_base: import("../../common/pipes/zod-validation.pipe").ZodDto<z.ZodObject<{
    page: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
    pageSize: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
}, z.core.$strip>>;
export declare class PaginationQueryDto extends PaginationQueryDto_base {
}
declare const RecentViewsQueryDto_base: import("../../common/pipes/zod-validation.pipe").ZodDto<z.ZodObject<{
    targetType: z.ZodDefault<z.ZodEnum<{
        readonly LISTING: "LISTING";
        readonly COMPLEX: "COMPLEX";
        readonly AGENCY: "AGENCY";
    }>>;
    page: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
    pageSize: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
}, z.core.$strip>>;
export declare class RecentViewsQueryDto extends RecentViewsQueryDto_base {
}
declare const RecentViewsClearQueryDto_base: import("../../common/pipes/zod-validation.pipe").ZodDto<z.ZodObject<{
    targetType: z.ZodOptional<z.ZodEnum<{
        readonly LISTING: "LISTING";
        readonly COMPLEX: "COMPLEX";
        readonly AGENCY: "AGENCY";
    }>>;
}, z.core.$strip>>;
export declare class RecentViewsClearQueryDto extends RecentViewsClearQueryDto_base {
}
/**
 * GET /agency/listings/co-broker-candidates?complexId&dong&q&page&pageSize. Defined here, not in
 * @house/shared, while the broker console contract settles (web a-listings `CandidateParams`).
 */
export declare const coBrokerCandidatesQuerySchema: z.ZodObject<{
    page: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
    pageSize: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
    complexId: z.ZodUUID;
    dong: z.ZodPreprocess<z.ZodOptional<z.ZodString>, unknown>;
    q: z.ZodPreprocess<z.ZodOptional<z.ZodString>, unknown>;
}, z.core.$strip>;
export type CoBrokerCandidatesQuery = z.infer<typeof coBrokerCandidatesQuerySchema>;
declare const CoBrokerCandidatesQueryDto_base: import("../../common/pipes/zod-validation.pipe").ZodDto<z.ZodObject<{
    page: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
    pageSize: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
    complexId: z.ZodUUID;
    dong: z.ZodPreprocess<z.ZodOptional<z.ZodString>, unknown>;
    q: z.ZodPreprocess<z.ZodOptional<z.ZodString>, unknown>;
}, z.core.$strip>>;
export declare class CoBrokerCandidatesQueryDto extends CoBrokerCandidatesQueryDto_base {
}
export {};
