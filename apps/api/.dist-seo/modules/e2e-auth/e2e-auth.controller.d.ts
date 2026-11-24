import type { Request, Response } from 'express';
import { E2eLoginDto, type E2eLoginResponse } from './e2e-auth.dto';
import { E2eAuthService } from './e2e-auth.service';
/**
 * TEST-ONLY login for the browser e2e harness (`POST /api/v1/e2e/login`). Registered only when
 * NODE_ENV=test and E2E_FAKE_OAUTH=1 (see e2e-auth.enabled.ts); 404 otherwise.
 * CSRF is skipped because the test runner calls it from a fresh API request context (no page,
 * no Origin); it can only ever exist on a NODE_ENV=test server.
 */
export declare class E2eAuthController {
    private readonly service;
    constructor(service: E2eAuthService);
    login(dto: E2eLoginDto, req: Request, res: Response): Promise<E2eLoginResponse>;
}
