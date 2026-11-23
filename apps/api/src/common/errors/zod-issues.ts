import type { z } from 'zod';

export interface ValidationIssue {
  path: string;
  code: string;
  message: string;
}

/** Cap on issues echoed back to the client, so a hostile payload cannot inflate the error response. */
export const MAX_REPORTED_ISSUES = 20;

export function formatZodIssues(error: z.ZodError): ValidationIssue[] {
  return error.issues.slice(0, MAX_REPORTED_ISSUES).map((i) => ({
    path: i.path.map(String).join('.'),
    code: i.code,
    message: i.message,
  }));
}
