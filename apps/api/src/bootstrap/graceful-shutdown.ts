import { Server, type IncomingMessage, type ServerResponse } from 'node:http';
import { Server as NetServer } from 'node:net';

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
export class HttpDrainer {
  private server: Server | null = null;
  private draining: Promise<DrainResult> | null = null;
  private readonly inFlight = new Set<ServerResponse>();
  private readonly graceMs: number;
  private readonly idleCloseDelayMs: number;

  constructor(options: HttpDrainerOptions) {
    this.graceMs = options.graceMs;
    this.idleCloseDelayMs = Math.min(options.idleCloseDelayMs ?? 1_000, options.graceMs);
  }

  get isDraining(): boolean {
    return this.draining !== null;
  }

  readonly middleware = (_req: IncomingMessage, res: ServerResponse, next: Next): void => {
    if (this.isDraining) {
      res.setHeader('Connection', 'close');
    } else {
      this.inFlight.add(res);
      res.once('close', () => this.inFlight.delete(res));
    }
    next();
  };

  /** Takes what `app.listen()` resolved to (typed `any` by Nest). */
  attach(server: unknown): void {
    if (!(server instanceof Server))
      throw new Error('HttpDrainer needs the http.Server from listen()');
    this.server = server;
  }

  /** Idempotent: a second call returns the drain already in progress. */
  drain(): Promise<DrainResult> {
    this.draining ??= this.startDrain();
    return this.draining;
  }

  private startDrain(): Promise<DrainResult> {
    const server = this.server;
    const startedAt = Date.now();

    for (const res of this.inFlight) {
      if (!res.headersSent) {
        res.setHeader('Connection', 'close');
      } else if (res.writableFinished) {
        res.socket?.end();
      } else {
        // Already on the wire as keep-alive: close the socket once this response is complete.
        // Captured now: Node detaches res.socket in its own 'finish' listener, which runs first.
        const socket = res.socket;
        res.once('finish', () => socket?.end());
      }
    }
    this.inFlight.clear();

    if (!server?.listening) return Promise.resolve({ forced: false, durationMs: 0 });

    return new Promise<DrainResult>((resolve) => {
      let forced = false;
      let sweep: NodeJS.Timeout | undefined;
      const idleTimer = setTimeout(() => {
        server.closeIdleConnections();
        // Picks up sockets that turn idle later without a Connection: close response.
        sweep = setInterval(() => server.closeIdleConnections(), 250);
        sweep.unref();
      }, this.idleCloseDelayMs);
      const graceTimer = setTimeout(() => {
        forced = true;
        server.closeAllConnections();
      }, this.graceMs);
      idleTimer.unref();
      graceTimer.unref();
      // Stop accepting (in cluster mode the primary stops routing here) WITHOUT http.Server's
      // immediate closeIdleConnections(); the callback fires once every connection has ended.
      NetServer.prototype.close.call(server, () => {
        clearTimeout(idleTimer);
        clearTimeout(graceTimer);
        clearInterval(sweep);
        resolve({ forced, durationMs: Date.now() - startedAt });
      });
    });
  }
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
export function createShutdownHandler(
  deps: ShutdownDeps,
): (signal: ShutdownSignal) => Promise<void> {
  let started = false;
  return async (signal) => {
    if (started) return;
    started = true;
    deps.log(`${signal} received: draining HTTP connections`);
    let done = false;
    const deadline = setTimeout(() => {
      if (done) return;
      done = true;
      deps.logError(`shutdown did not finish within ${deps.hardTimeoutMs}ms; exiting`);
      deps.finish(signal, 1);
    }, deps.hardTimeoutMs);
    deadline.unref();
    try {
      const { forced, durationMs } = await deps.drainer.drain();
      deps.log(
        forced
          ? `HTTP drain grace period ran out after ${durationMs}ms; remaining sockets destroyed`
          : `HTTP connections drained in ${durationMs}ms`,
      );
      await deps.closeApp();
      if (done) return;
      done = true;
      clearTimeout(deadline);
      deps.finish(signal, 0);
    } catch (err) {
      if (done) return;
      done = true;
      clearTimeout(deadline);
      deps.logError(
        `error during shutdown: ${err instanceof Error ? (err.stack ?? err.message) : String(err)}`,
      );
      deps.finish(signal, 1);
    }
  };
}

const SIGNALS: readonly ShutdownSignal[] = ['SIGINT', 'SIGTERM'];

/** Registers the handler for SIGINT/SIGTERM (PM2 sends SIGINT on reload/stop). */
export function installShutdownSignals(handler: (signal: ShutdownSignal) => Promise<void>): void {
  const onSignal = (signal: ShutdownSignal): void => {
    void handler(signal);
  };
  for (const signal of SIGNALS) process.on(signal, onSignal);
}

/** Default `finish`: drop our listeners and re-raise the signal so the exit status reflects it. */
export function finishProcess(signal: ShutdownSignal, exitCode: 0 | 1): void {
  if (exitCode !== 0) {
    process.exit(exitCode);
  }
  process.removeAllListeners('SIGINT');
  process.removeAllListeners('SIGTERM');
  process.kill(process.pid, signal);
}
