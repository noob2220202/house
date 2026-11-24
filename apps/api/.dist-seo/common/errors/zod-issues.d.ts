import type { z } from 'zod';
export interface ValidationIssue {
    path: string;
    code: string;
    message: string;
}
/** Cap on issues echoed back to the client, so a hostile payload cannot inflate the error response. */
export declare const MAX_REPORTED_ISSUES = 20;
export declare function formatZodIssues(error: z.ZodError): ValidationIssue[];
