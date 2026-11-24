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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SearchController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const decorators_1 = require("../../../common/decorators");
const dto_1 = require("../dto");
const search_suggest_service_1 = require("../services/search-suggest.service");
let SearchController = class SearchController {
    constructor(suggestions) {
        this.suggestions = suggestions;
    }
    /** 지역 · 단지 · 중개사무소 autocomplete; an empty `q` answers only `popular`. */
    suggest(q) {
        return this.suggestions.suggest(q);
    }
};
exports.SearchController = SearchController;
__decorate([
    (0, decorators_1.Public)(),
    (0, common_1.Get)('suggest'),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.SearchSuggestQueryDto]),
    __metadata("design:returntype", Promise)
], SearchController.prototype, "suggest", null);
exports.SearchController = SearchController = __decorate([
    (0, swagger_1.ApiTags)('home'),
    (0, common_1.Controller)('search'),
    __metadata("design:paramtypes", [search_suggest_service_1.SearchSuggestService])
], SearchController);
//# sourceMappingURL=search.controller.js.map