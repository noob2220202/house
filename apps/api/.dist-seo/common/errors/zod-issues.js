"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MAX_REPORTED_ISSUES = void 0;
exports.formatZodIssues = formatZodIssues;
/** Cap on issues echoed back to the client, so a hostile payload cannot inflate the error response. */
exports.MAX_REPORTED_ISSUES = 20;
function formatZodIssues(error) {
    return error.issues.slice(0, exports.MAX_REPORTED_ISSUES).map((i) => ({
        path: i.path.map(String).join('.'),
        code: i.code,
        message: i.message,
    }));
}
//# sourceMappingURL=zod-issues.js.map