"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logSerializers = void 0;
const redact_url_1 = require("./redact-url");
/** pino-http serializers: minimal request/response shapes, with query values scrubbed. */
exports.logSerializers = {
    // pino-http hands us req.originalUrl as `url`; query values may carry OAuth codes,
    // phone numbers or map coordinates, so they are scrubbed before logging.
    req: (req) => ({
        id: req.id,
        method: req.method,
        url: (0, redact_url_1.redactUrl)(req.url),
        ip: req.remoteAddress,
    }),
    res: (res) => ({ statusCode: res.statusCode }),
};
//# sourceMappingURL=log-serializers.js.map