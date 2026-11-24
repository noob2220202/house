"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SkipCsrf = void 0;
const common_1 = require("@nestjs/common");
const metadata_keys_1 = require("./metadata-keys");
/**
 * Only for cross-site POSTs that cannot carry a CSRF token (e.g. a future server-to-server webhook).
 * Every use must be justified in code review; OAuth callbacks are GET and don't need it.
 */
const SkipCsrf = () => (0, common_1.SetMetadata)(metadata_keys_1.SKIP_CSRF_KEY, true);
exports.SkipCsrf = SkipCsrf;
//# sourceMappingURL=skip-csrf.decorator.js.map