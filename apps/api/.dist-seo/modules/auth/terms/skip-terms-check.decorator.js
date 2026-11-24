"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SkipTermsCheck = exports.SKIP_TERMS_CHECK_KEY = void 0;
const common_1 = require("@nestjs/common");
exports.SKIP_TERMS_CHECK_KEY = 'house:skipTermsCheck';
/**
 * Exempts a route (or controller) from TermsConsentGuard. Only for what a member must be able to
 * do while a new required terms version is pending: log in/out, agree (POST /me/consents),
 * manage or delete their own account (정보주체 권리: 열람·정정·삭제·처리정지).
 */
const SkipTermsCheck = () => (0, common_1.SetMetadata)(exports.SKIP_TERMS_CHECK_KEY, true);
exports.SkipTermsCheck = SkipTermsCheck;
//# sourceMappingURL=skip-terms-check.decorator.js.map