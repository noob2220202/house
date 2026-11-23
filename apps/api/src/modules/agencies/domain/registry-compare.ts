import {
  RegistryCheckStatus,
  type BrokerRegistryRecord,
  type RegistryMismatchField,
} from '@house/shared';

/** Whitespace, punctuation and the generic "공인중개사(사무소)" suffix do not distinguish offices. */
export function normalizeOfficeName(name: string): string {
  return name
    .normalize('NFC')
    .replace(/\(주\)|㈜|주식회사/g, '')
    .replace(/[\s\p{P}\p{S}]/gu, '')
    .replace(/공인중개사사무소$|부동산중개사무소$|공인중개사$|중개사무소$|부동산$/u, '')
    .toLowerCase();
}

function normalizePersonName(name: string): string {
  return name.normalize('NFC').replace(/\s/g, '');
}

export function compareWithRegistry(
  agency: { name: string; representativeName: string },
  record: BrokerRegistryRecord | null,
): { status: RegistryCheckStatus; mismatches: RegistryMismatchField[] } {
  if (!record) return { status: RegistryCheckStatus.NOT_FOUND, mismatches: [] };
  const mismatches: RegistryMismatchField[] = [];
  if (normalizeOfficeName(agency.name) !== normalizeOfficeName(record.officeName)) {
    mismatches.push('officeName');
  }
  if (
    record.representativeName &&
    normalizePersonName(agency.representativeName) !==
      normalizePersonName(record.representativeName)
  ) {
    mismatches.push('representativeName');
  }
  if (!record.operating) mismatches.push('operating');
  return {
    status: mismatches.length ? RegistryCheckStatus.MISMATCH : RegistryCheckStatus.MATCH,
    mismatches,
  };
}
