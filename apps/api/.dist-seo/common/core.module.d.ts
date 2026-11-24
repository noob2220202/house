/**
 * Cross-cutting wiring. Guard order matters: Throttler (per user, else per IP) → Auth (reuses the
 * memoized session) → CSRF.
 * Nothing here should need editing by module teams.
 */
export declare class CoreModule {
}
