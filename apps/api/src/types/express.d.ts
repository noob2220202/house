// `req.id` (request id) is typed by pino-http and set by requestContextMiddleware.
import type { Principal } from '../common/auth/principal';
import type { ResolvedSession } from '../common/auth/session-resolver';

declare global {
  namespace Express {
    interface Request {
      /** Authenticated principal, set by AuthGuard. */
      principal?: Principal;
      /** Resolved session (principal + csrf token), set by AuthGuard. */
      authSession?: ResolvedSession;
    }
  }
}

export {};
