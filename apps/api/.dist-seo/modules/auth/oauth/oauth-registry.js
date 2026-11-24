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
exports.OAuthProviderRegistry = void 0;
const common_1 = require("@nestjs/common");
const shared_1 = require("@house/shared");
const app_exception_1 = require("../../../common/errors/app.exception");
const oauth_provider_1 = require("./oauth-provider");
/** Looks up provider implementations registered under OAUTH_PROVIDERS. */
let OAuthProviderRegistry = class OAuthProviderRegistry {
    constructor(providers) {
        this.byName = new Map(providers.map((p) => [p.provider, p]));
    }
    /** The enabled provider, or 404 AUTH_PROVIDER_DISABLED (unknown slugs fail validation earlier). */
    get(provider) {
        const impl = this.byName.get(provider);
        if (!impl || !impl.isEnabled()) {
            throw new app_exception_1.AppException(shared_1.ErrorCode.AUTH_PROVIDER_DISABLED, { status: 404 });
        }
        return impl;
    }
    enabled() {
        return [...this.byName.values()].filter((p) => p.isEnabled()).map((p) => p.provider);
    }
};
exports.OAuthProviderRegistry = OAuthProviderRegistry;
exports.OAuthProviderRegistry = OAuthProviderRegistry = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(oauth_provider_1.OAUTH_PROVIDERS)),
    __metadata("design:paramtypes", [Array])
], OAuthProviderRegistry);
//# sourceMappingURL=oauth-registry.js.map