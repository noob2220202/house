"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Audit = void 0;
const common_1 = require("@nestjs/common");
const metadata_keys_1 = require("./metadata-keys");
/** Records an AuditLog row after the handler succeeds (see AuditInterceptor). */
const Audit = (options) => (0, common_1.SetMetadata)(metadata_keys_1.AUDIT_KEY, options);
exports.Audit = Audit;
//# sourceMappingURL=audit.decorator.js.map