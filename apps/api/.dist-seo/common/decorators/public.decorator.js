"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Public = void 0;
const common_1 = require("@nestjs/common");
const metadata_keys_1 = require("./metadata-keys");
/** Route needs no session. (Default is authenticated.) A session is still resolved if present. */
const Public = () => (0, common_1.SetMetadata)(metadata_keys_1.IS_PUBLIC_KEY, true);
exports.Public = Public;
//# sourceMappingURL=public.decorator.js.map