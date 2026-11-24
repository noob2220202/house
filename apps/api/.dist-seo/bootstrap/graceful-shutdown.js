"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HttpDrainer = void 0;
exports.createShutdownHandler = createShutdownHandler;
exports.installShutdownSignals = installShutdownSignals;
exports.finishProcess = finishProcess;
const node_http_1 = require("node:http");
const node_net_1 = require("node:net");
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
class HttpDrainer {
    constructor(options) {
        this.server = null;
        this.draining = null;
        this.inFlight = new Set();
        this.middleware = (_req, res, next) => {
            if (this.isDraining) {
                res.setHeader('Connection', 'close');
            }
            else {
                this.inFlight.add(res);
                res.once('close', () => this.inFlight.delete(res));
            }
            next();
        };
        this.graceMs = options.graceMs;
        this.idleCloseDelayMs = Math.min(options.idleCloseDelayMs ?? 1_000, options.graceMs);
    }
    get isDraining() {
        return this.draining !== null;
    }
    /** Takes what `app.listen()` resolved to (typed `any` by Nest). */
    attach(server) {
        if (!(server instanceof node_http_1.Server))
            throw new Error('HttpDrainer needs the http.Server from listen()');
        this.server = server;
    }
    /** Idempotent: a second call returns the drain already in progress. */
    drain() {
        this.draining ??= this.startDrain();
        return this.draining;
    }
    startDrain() {
        const server = this.server;
        const startedAt = Date.now();
        for (const res of this.inFlight) {
            if (!res.headersSent) {
                res.setHeader('Connection', 'close');
            }
            else if (res.writableFinished) {
                res.socket?.end();
            }
            else {
                // Already on the wire as keep-alive: close the socket once this response is complete.
                // Captured now: Node detaches res.socket in its own 'finish' listener, which runs first.
                const socket = res.socket;
                res.once('finish', () => socket?.end());
            }
        }
        this.inFlight.clear();
        if (!server?.listening)
            return Promise.resolve({ forced: false, durationMs: 0 });
        return new Promise((resolve) => {
            let forced = false;
            let sweep;
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
            node_net_1.Server.prototype.close.call(server, () => {
                clearTimeout(idleTimer);
                clearTimeout(graceTimer);
                clearInterval(sweep);
                resolve({ forced, durationMs: Date.now() - startedAt });
            });
        });
    }
}
exports.HttpDrainer = HttpDrainer;
/**
 * Returns the signal handler for the HTTP process. HTTP drains first, so in-flight requests
 * still have Prisma/Redis; only then does Nest close the app (Nest's own enableShutdownHooks
 * would disconnect Prisma before the server even stops listening).
 */
function createShutdownHandler(deps) {
    let started = false;
    return async (signal) => {
        if (started)
            return;
        started = true;
        deps.log(`${signal} received: draining HTTP connections`);
        let done = false;
        const deadline = setTimeout(() => {
            if (done)
                return;
            done = true;
            deps.logError(`shutdown did not finish within ${deps.hardTimeoutMs}ms; exiting`);
            deps.finish(signal, 1);
        }, deps.hardTimeoutMs);
        deadline.unref();
        try {
            const { forced, durationMs } = await deps.drainer.drain();
            deps.log(forced
                ? `HTTP drain grace period ran out after ${durationMs}ms; remaining sockets destroyed`
                : `HTTP connections drained in ${durationMs}ms`);
            await deps.closeApp();
            if (done)
                return;
            done = true;
            clearTimeout(deadline);
            deps.finish(signal, 0);
        }
        catch (err) {
            if (done)
                return;
            done = true;
            clearTimeout(deadline);
            deps.logError(`error during shutdown: ${err instanceof Error ? (err.stack ?? err.message) : String(err)}`);
            deps.finish(signal, 1);
        }
    };
}
const SIGNALS = ['SIGINT', 'SIGTERM'];
/** Registers the handler for SIGINT/SIGTERM (PM2 sends SIGINT on reload/stop). */
function installShutdownSignals(handler) {
    const onSignal = (signal) => {
        void handler(signal);
    };
    for (const signal of SIGNALS)
        process.on(signal, onSignal);
}
/** Default `finish`: drop our listeners and re-raise the signal so the exit status reflects it. */
function finishProcess(signal, exitCode) {
    if (exitCode !== 0) {
        process.exit(exitCode);
    }
    process.removeAllListeners('SIGINT');
    process.removeAllListeners('SIGTERM');
    process.kill(process.pid, signal);
}
//# sourceMappingURL=graceful-shutdown.js.map