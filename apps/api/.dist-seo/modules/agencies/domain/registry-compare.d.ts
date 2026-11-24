import { RegistryCheckStatus, type BrokerRegistryRecord, type RegistryMismatchField } from '@house/shared';
/** Whitespace, punctuation and the generic "공인중개사(사무소)" suffix do not distinguish offices. */
export declare function normalizeOfficeName(name: string): string;
export declare function compareWithRegistry(agency: {
    name: string;
    representativeName: string;
}, record: BrokerRegistryRecord | null): {
    status: RegistryCheckStatus;
    mismatches: RegistryMismatchField[];
};
