"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TotpService = void 0;
const common_1 = require("@nestjs/common");
const otplib_1 = require("otplib");
const auth_constants_1 = require("../auth.constants");
const STEP_SECONDS = 30;
/** Accept the previous and next 30s window (clock drift on phones). */
const WINDOW = 1;
/** RFC 6238 TOTP (Google Authenticator compatible: SHA-1, 6 digits, 30s) via otplib. */
let TotpService = class TotpService {
    generateSecret() {
        return otplib_1.authenticator.generateSecret(20);
    }
    keyUri(accountName, secret) {
        return otplib_1.authenticator.keyuri(accountName, auth_constants_1.TOTP_ISSUER, secret);
    }
    /**
     * Returns the absolute time-step the code matched (for replay protection), or null.
     * `now` is epoch ms (tests pass a fixed clock).
     */
    verify(secret, code, now = Date.now()) {
        if (!/^\d{6}$/.test(code))
            return null;
        const instance = otplib_1.authenticator.clone({ epoch: now, window: WINDOW, step: STEP_SECONDS });
        let delta;
        try {
            delta = instance.checkDelta(code, secret);
        }
        catch {
            return null;
        }
        return delta === null ? null : Math.floor(now / 1000 / STEP_SECONDS) + delta;
    }
    /** Current code (tests and tooling only). */
    generate(secret, now = Date.now()) {
        return otplib_1.authenticator.clone({ epoch: now, step: STEP_SECONDS }).generate(secret);
    }
};
exports.TotpService = TotpService;
exports.TotpService = TotpService = __decorate([
    (0, common_1.Injectable)()
], TotpService);
//# sourceMappingURL=totp.service.js.map