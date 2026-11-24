"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeOfficeName = normalizeOfficeName;
exports.compareWithRegistry = compareWithRegistry;
const shared_1 = require("@house/shared");
/** Whitespace, punctuation and the generic "공인중개사(사무소)" suffix do not distinguish offices. */
function normalizeOfficeName(name) {
    return name
        .normalize('NFC')
        .replace(/\(주\)|㈜|주식회사/g, '')
        .replace(/[\s\p{P}\p{S}]/gu, '')
        .replace(/공인중개사사무소$|부동산중개사무소$|공인중개사$|중개사무소$|부동산$/u, '')
        .toLowerCase();
}
function normalizePersonName(name) {
    return name.normalize('NFC').replace(/\s/g, '');
}
function compareWithRegistry(agency, record) {
    if (!record)
        return { status: shared_1.RegistryCheckStatus.NOT_FOUND, mismatches: [] };
    const mismatches = [];
    if (normalizeOfficeName(agency.name) !== normalizeOfficeName(record.officeName)) {
        mismatches.push('officeName');
    }
    if (record.representativeName &&
        normalizePersonName(agency.representativeName) !==
            normalizePersonName(record.representativeName)) {
        mismatches.push('representativeName');
    }
    if (!record.operating)
        mismatches.push('operating');
    return {
        status: mismatches.length ? shared_1.RegistryCheckStatus.MISMATCH : shared_1.RegistryCheckStatus.MATCH,
        mismatches,
    };
}
//# sourceMappingURL=registry-compare.js.map