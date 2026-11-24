"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.applyProcessRole = applyProcessRole;
function applyProcessRole(role) {
    process.env.JOBS_ENABLED = role === 'worker' ? 'true' : 'false';
}
//# sourceMappingURL=process-role.js.map