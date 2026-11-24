"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ListingSummariesService = void 0;
const common_1 = require("@nestjs/common");
const listing_search_repository_1 = require("../listing-search.repository");
const listing_mapper_1 = require("../listing.mapper");
const listing_region_names_service_1 = require("./listing-region-names.service");
/**
 * Maps LISTING_SUMMARY_SELECT rows to API summaries, adding the page-scoped co-broker counts and
 * 법정동 names.
 */
let ListingSummariesService = class ListingSummariesService {
    constructor(search, mapper, regionNames) {
        this.search = search;
        this.mapper = mapper;
        this.regionNames = regionNames;
    }
    async map(rows) {
        const { counts, names } = await this.lookups(rows);
        return rows.map((r) => this.mapper.summary(r, counts.get(r.id) ?? 0, (r.emdCode && names.get(r.emdCode)) ?? null));
    }
    /** Console rows of the acting agency; `missingCounts` holds the drafts' missing 명시사항. */
    async mapForAgency(rows, actingAgencyId, missingCounts) {
        const { counts, names } = await this.lookups(rows);
        return rows.map((r) => this.mapper.agencyRow(r, actingAgencyId, counts.get(r.id) ?? 0, (r.emdCode && names.get(r.emdCode)) ?? null, missingCounts.get(r.id) ?? null));
    }
    async lookups(rows) {
        const [counts, names] = await Promise.all([
            this.search.agencyCounts(rows.map((r) => r.id)),
            this.regionNames.namesOf(rows.map((r) => r.emdCode)),
        ]);
        return { counts, names };
    }
};
exports.ListingSummariesService = ListingSummariesService;
exports.ListingSummariesService = ListingSummariesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [listing_search_repository_1.ListingSearchRepository,
        listing_mapper_1.ListingMapper,
        listing_region_names_service_1.ListingRegionNamesService])
], ListingSummariesService);
//# sourceMappingURL=listing-summaries.service.js.map