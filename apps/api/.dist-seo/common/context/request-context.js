"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RequestContext = void 0;
exports.requestContextMiddleware = requestContextMiddleware;
const node_async_hooks_1 = require("node:async_hooks");
const node_crypto_1 = require("node:crypto");
const shared_1 = require("@house/shared");
const storage = new node_async_hooks_1.AsyncLocalStorage();
const REQUEST_ID_PATTERN = /^[A-Za-z0-9._-]{8,64}$/;
/** Per-request context (request id, ip, principal) available anywhere via AsyncLocalStorage. */
exports.RequestContext = {
    current() {
        return storage.getStore();
    },
    requestId() {
        return storage.getStore()?.requestId;
    },
    /** Record the pre-mutation state of the resource for the audit log of this request. */
    setAuditBefore(snapshot) {
        const store = storage.getStore();
        if (store)
            store.auditBefore = snapshot;
    },
    run(store, fn) {
        return storage.run(store, fn);
    },
};
function requestContextMiddleware(req, res, next) {
    const incoming = req.headers[shared_1.HEADER_NAMES.REQUEST_ID];
    const requestId = typeof incoming === 'string' && REQUEST_ID_PATTERN.test(incoming) ? incoming : (0, node_crypto_1.randomUUID)();
    req.id = requestId;
    res.setHeader(shared_1.HEADER_NAMES.REQUEST_ID, requestId);
    const ua = req.headers['user-agent'];
    storage.run({ requestId, ip: req.ip, userAgent: typeof ua === 'string' ? ua.slice(0, 500) : undefined }, () => next());
}
//# sourceMappingURL=request-context.js.map