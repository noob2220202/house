import { type IncomingMessage, type ServerResponse } from 'node:http';
type Next = (err?: unknown) => void;
export interface DrainResult {
    /** True when the grace period ran out and the remaining sockets were destroyed. */
    forced: boolean;
    durationMs: number;
}
export interface HttpDrainerOptions {
    /** After this long, whatever is still open (a stuck request) is destroyed. */
    graceMs: number;
    /**
     * How long sockets that were idle when draining started may stay open before they are closed.
     * Closing an idle keep-alive socket races with a client that is sending its next request on it
     * (that request gets ECONNRESET; nginx does not retry a POST). Any socket that serves a request
     * during this window closes itself via `Connection: close`, so only sockets that stayed unused
     * this long are closed, which is when a pooled client is least likely to pick them.
     */
    idleCloseDelayMs?: number;
}
/**
 * Drains an http.Server so a PM2 cluster reload never cuts a request.
 *
 * `server.close()` alone only stops listening and destroys the sockets that are idle at that
 * instant; a keep-alive socket that keeps receiving requests (nginx `keepalive` upstream pool)
 * is never closed, the process outlives PM2's kill_timeout and gets SIGKILLed mid-request.
 * Once draining:
 *  - every response that has not sent its headers yet carries `Connection: close`, so Node ends
 *    the socket right after that response and nginx sends its next request to another worker;
 *  - responses whose headers were already sent end their socket once they finish;
 *  - sockets left idle are closed after `idleCloseDelayMs`, and after `graceMs` whatever is left
 *    is destroyed.
 * The middleware must be the first one registered so it sees every request.
 */
export declare class HttpDrainer {
    private server;
    private draining;
    private readonly inFlight;
    private readonly graceMs;
    private readonly idleCloseDelayMs;
    constructor(options: HttpDrainerOptions);
    get isDraining(): boolean;
    readonly middleware: (_req: IncomingMessage, res: ServerResponse, next: Next) => void;
    /** Takes what `app.listen()` resolved to (typed `any` by Nest). */
    attach(server: unknown): void;
    /** Idempotent: a second call returns the drain already in progress. */
    drain(): Promise<DrainResult>;
    private startDrain;
}
export type ShutdownSignal = 'SIGINT' | 'SIGTERM';
export interface ShutdownDeps {
    drainer: Pick<HttpDrainer, 'drain'>;
    /** Runs Nest's shutdown: onModuleDestroy (Prisma), beforeShutdown, dispose, onApplicationShutdown (Redis). */
    closeApp: () => Promise<void>;
    /** Hard deadline for drain + closeApp; keep it below PM2's kill_timeout. */
    hardTimeoutMs: number;
    log: (message: string) => void;
    logError: (message: string) => void;
    /** Called once shutdown completed: re-raise the signal (default action) or exit with a code. */
    finish: (signal: ShutdownSignal, exitCode: 0 | 1) => void;
}
/**
 * Returns the signal handler for the HTTP process. HTTP drains first, so in-flight requests
 * still have Prisma/Redis; only then does Nest close the app (Nest's own enableShutdownHooks
 * would disconnect Prisma before the server even stops listening).
 */
export declare function createShutdownHandler(deps: ShutdownDeps): (signal: ShutdownSignal) => Promise<void>;
/** Registers the handler for SIGINT/SIGTERM (PM2 sends SIGINT on reload/stop). */
export declare function installShutdownSignals(handler: (signal: ShutdownSignal) => Promise<void>): void;
/** Default `finish`: drop our listeners and re-raise the signal so the exit status reflects it. */
export declare function finishProcess(signal: ShutdownSignal, exitCode: 0 | 1): void;
export {};
