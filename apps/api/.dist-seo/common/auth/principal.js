"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isUserPrincipal = isUserPrincipal;
exports.isAdminPrincipal = isAdminPrincipal;
function isUserPrincipal(p) {
    return p?.kind === 'USER';
}
function isAdminPrincipal(p) {
    return p?.kind === 'ADMIN';
}
//# sourceMappingURL=principal.js.map