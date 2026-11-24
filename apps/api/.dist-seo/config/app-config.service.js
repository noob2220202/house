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
exports.AppConfig = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
/** Typed access to validated env. Inject this, never read process.env in app code. */
let AppConfig = class AppConfig {
    constructor(config) {
        this.config = config;
    }
    get(key) {
        return this.config.get(key, { infer: true });
    }
    get isProduction() {
        return this.get('NODE_ENV') === 'production';
    }
    get isTest() {
        return this.get('NODE_ENV') === 'test';
    }
    get cookieSecure() {
        return this.get('COOKIE_SECURE') ?? this.isProduction;
    }
    /** Origins allowed for CORS and the CSRF Origin/Referer check. */
    get allowedOrigins() {
        const origins = new Set(this.get('CORS_ORIGINS'));
        origins.add(new URL(this.get('PUBLIC_BASE_URL')).origin);
        origins.add(new URL(this.get('ADMIN_BASE_URL')).origin);
        return [...origins];
    }
};
exports.AppConfig = AppConfig;
exports.AppConfig = AppConfig = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], AppConfig);
//# sourceMappingURL=app-config.service.js.map