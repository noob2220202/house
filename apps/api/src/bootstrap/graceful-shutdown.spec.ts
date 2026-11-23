import { Agent, createServer, request, type IncomingMessage, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { createShutdownHandler, HttpDrainer, type ShutdownSignal } from './graceful-shutdown';

const delay = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

interface Harness {
  server: Server;
  drainer: HttpDrainer;
  port: number;
}

/** A real http.Server whose handlers run behind the drainer middleware, like main.ts. */
async function startServer(
  graceMs: number,
  handler: (req: IncomingMessage, res: import('node:http').ServerResponse) => void,
): Promise<Harness> {
  const drainer = new HttpDrainer({ graceMs, idleCloseDelayMs: Math.min(200, graceMs) });
  const server = createServer((req, res) => drainer.middleware(req, res, () => handler(req, res)));
  server.keepAliveTimeout = 60_000;
  drainer.attach(server);
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  return { server, drainer, port: (server.address() as AddressInfo).port };
}

interface Reply {
  status: number;
  connection: string | undefined;
  body: string;
}

function get(port: number, agent: Agent, path = '/'): Promise<Reply> {
  return new Promise((resolve, reject) => {
    const req = request({ host: '127.0.0.1', port, path, agent }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (c: string) => (body += c));
      res.on('end', () =>
        resolve({ status: res.statusCode ?? 0, connection: res.headers.connection, body }),
      );
      res.on('error', reject);
    });
    req.on('error', reject);
    req.end();
  });
}

afterEach(() => {
  jest.useRealTimers();
});

describe('HttpDrainer', () => {
  it('only marks responses Connection: close once draining has started', async () => {
    const h = await startServer(5_000, (_req, res) => res.end('ok'));
    const agent = new Agent({ keepAlive: true });
    try {
      const before = await get(h.port, agent);
      expect(before.connection).toBe('keep-alive');
      expect(h.drainer.isDraining).toBe(false);
    } finally {
      agent.destroy();
      await h.drainer.drain();
    }
  });

  it('drains busy keep-alive sockets under load without errors and without the grace timeout', async () => {
    // Reproduces the PM2 reload: clients keep their keep-alive sockets permanently busy.
    const h = await startServer(10_000, (_req, res) => {
      setTimeout(() => res.end('ok'), 5);
    });
    const CLIENTS = 20;
    const errors: unknown[] = [];
    const replies: Reply[] = [];
    let stop = false;
    const agents = Array.from(
      { length: CLIENTS },
      () => new Agent({ keepAlive: true, maxSockets: 1 }),
    );
    // Each client behaves like nginx: once the upstream says Connection: close it moves on.
    const loops = agents.map(async (agent) => {
      while (!stop) {
        try {
          const reply = await get(h.port, agent);
          replies.push(reply);
          if (reply.connection === 'close') return;
        } catch (err) {
          errors.push(err);
          return;
        }
      }
    });
    await delay(150);
    const result = await h.drainer.drain();
    stop = true;
    await Promise.all(loops);
    agents.forEach((a) => a.destroy());

    expect(errors).toEqual([]);
    expect(result.forced).toBe(false);
    expect(result.durationMs).toBeLessThan(2_000);
    expect(h.server.listening).toBe(false);
    expect(replies.every((r) => r.status === 200 && r.body === 'ok')).toBe(true);
    // Every client's last response told it to drop the socket.
    expect(replies.filter((r) => r.connection === 'close')).toHaveLength(CLIENTS);
  });

  it('marks a request that is in flight when draining starts', async () => {
    let release: () => void = () => undefined;
    const h = await startServer(10_000, (_req, res) => {
      release = () => res.end('slow');
    });
    const agent = new Agent({ keepAlive: true });
    const pending = get(h.port, agent);
    await delay(50);
    const drained = h.drainer.drain();
    release();
    const reply = await pending;
    const result = await drained;
    agent.destroy();
    expect(reply).toEqual({ status: 200, connection: 'close', body: 'slow' });
    expect(result.forced).toBe(false);
  });

  it('ends the socket of a response whose headers were already sent before draining', async () => {
    let finish: () => void = () => undefined;
    const h = await startServer(10_000, (_req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.write('part1-');
      finish = () => res.end('part2');
    });
    const agent = new Agent({ keepAlive: true });
    const pending = get(h.port, agent);
    await delay(50);
    const drained = h.drainer.drain();
    finish();
    const reply = await pending;
    const result = await drained;
    agent.destroy();
    expect(reply.body).toBe('part1-part2');
    expect(reply.connection).toBe('keep-alive');
    expect(result.forced).toBe(false);
    expect(result.durationMs).toBeLessThan(2_000);
  });

  it('closes sockets left idle after the idle delay', async () => {
    const h = await startServer(10_000, (_req, res) => res.end('ok'));
    const agent = new Agent({ keepAlive: true });
    await get(h.port, agent);
    const result = await h.drainer.drain();
    agent.destroy();
    expect(result.forced).toBe(false);
    expect(result.durationMs).toBeGreaterThanOrEqual(150);
    expect(result.durationMs).toBeLessThan(1_000);
  });

  it('does not reset an idle pooled socket that is reused right after draining starts', async () => {
    // Node's http.Server.close() destroys idle sockets at once, so a client sending its next
    // request on one at that moment gets ECONNRESET. The drainer lets it be served instead.
    const h = await startServer(10_000, (_req, res) => res.end('ok'));
    const agent = new Agent({ keepAlive: true, maxSockets: 1 });
    await get(h.port, agent);
    const drained = h.drainer.drain();
    await delay(20);
    const reply = await get(h.port, agent);
    const result = await drained;
    agent.destroy();
    expect(reply).toEqual({ status: 200, connection: 'close', body: 'ok' });
    expect(result.forced).toBe(false);
  });

  it('destroys a stuck request after the grace period', async () => {
    const h = await startServer(300, () => {
      // never responds
    });
    const agent = new Agent({ keepAlive: true });
    const pending = get(h.port, agent).then(
      () => 'answered',
      (err: NodeJS.ErrnoException) => err.code,
    );
    await delay(50);
    const result = await h.drainer.drain();
    agent.destroy();
    expect(result.forced).toBe(true);
    expect(result.durationMs).toBeGreaterThanOrEqual(250);
    expect(await pending).toBe('ECONNRESET');
  });

  it('is idempotent and safe before a server is attached', async () => {
    const drainer = new HttpDrainer({ graceMs: 1_000 });
    const first = drainer.drain();
    expect(drainer.drain()).toBe(first);
    await expect(first).resolves.toEqual({ forced: false, durationMs: 0 });
    // Requests that arrive after draining started are marked too.
    const res = { setHeader: jest.fn() };
    const next = jest.fn();
    drainer.middleware({} as never, res as never, next);
    expect(res.setHeader).toHaveBeenCalledWith('Connection', 'close');
    expect(next).toHaveBeenCalled();
  });

  it('rejects anything but the http.Server from listen()', () => {
    expect(() => new HttpDrainer({ graceMs: 1_000 }).attach({})).toThrow(/http\.Server/);
  });
});

describe('createShutdownHandler', () => {
  function deps(overrides: Partial<Parameters<typeof createShutdownHandler>[0]> = {}) {
    const calls: string[] = [];
    const finish = jest.fn((signal: ShutdownSignal, code: 0 | 1) => {
      calls.push(`finish:${signal}:${code}`);
    });
    const base = {
      drainer: {
        drain: jest.fn(async () => {
          calls.push('drain');
          return { forced: false, durationMs: 1 };
        }),
      },
      closeApp: jest.fn(async () => {
        calls.push('closeApp');
      }),
      hardTimeoutMs: 1_000,
      log: jest.fn(),
      logError: jest.fn(),
      finish,
      ...overrides,
    };
    return { base, calls, finish };
  }

  it('drains HTTP before closing the app (Prisma/Redis), then re-raises the signal', async () => {
    const { base, calls } = deps();
    await createShutdownHandler(base)('SIGINT');
    expect(calls).toEqual(['drain', 'closeApp', 'finish:SIGINT:0']);
  });

  it('ignores a second signal while shutting down', async () => {
    const { base, calls } = deps();
    const handler = createShutdownHandler(base);
    await Promise.all([handler('SIGINT'), handler('SIGTERM')]);
    expect(calls).toEqual(['drain', 'closeApp', 'finish:SIGINT:0']);
  });

  it('exits with code 1 when closing the app fails', async () => {
    const { base, finish } = deps({
      closeApp: jest.fn(async () => {
        throw new Error('boom');
      }),
    });
    await createShutdownHandler(base)('SIGTERM');
    expect(finish).toHaveBeenCalledTimes(1);
    expect(finish).toHaveBeenCalledWith('SIGTERM', 1);
    expect(base.logError).toHaveBeenCalledWith(expect.stringContaining('boom'));
  });

  it('exits with code 1 at the hard deadline when shutdown hangs, before PM2 would SIGKILL', async () => {
    jest.useFakeTimers();
    const { base, finish } = deps({ closeApp: jest.fn(() => new Promise<void>(() => undefined)) });
    void createShutdownHandler(base)('SIGINT');
    await jest.advanceTimersByTimeAsync(999);
    expect(finish).not.toHaveBeenCalled();
    await jest.advanceTimersByTimeAsync(1);
    expect(finish).toHaveBeenCalledTimes(1);
    expect(finish).toHaveBeenCalledWith('SIGINT', 1);
  });
});
