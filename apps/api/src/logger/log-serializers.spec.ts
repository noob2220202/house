import { EventEmitter } from 'node:events';
import { Writable } from 'node:stream';
import pino from 'pino';
import { pinoHttp } from 'pino-http';
import { logSerializers } from './log-serializers';
import { REDACTED } from './redact-url';

/** Drives a real pino-http logger with our serializers and returns the emitted log line. */
function logRequest(originalUrl: string): Record<string, unknown> {
  const lines: string[] = [];
  const sink = new Writable({
    write(chunk: Buffer, _enc, cb) {
      lines.push(chunk.toString());
      cb();
    },
  });
  const middleware = pinoHttp({ logger: pino(sink), serializers: logSerializers });

  // Express rewrites req.url when routing; pino-std-serializers logs originalUrl instead.
  const req = Object.assign(new EventEmitter(), {
    method: 'GET',
    url: '/callback',
    originalUrl,
    headers: {},
    socket: { remoteAddress: '203.0.113.7' },
    id: 'req-1',
  });
  const res = Object.assign(new EventEmitter(), {
    statusCode: 200,
    getHeaders: () => ({}),
  });
  middleware(req as never, res as never);
  res.emit('finish');
  const line = lines[0];
  if (!line) throw new Error('no log line written');
  return JSON.parse(line) as Record<string, unknown>;
}

describe('logSerializers (via pino-http)', () => {
  it('logs the OAuth callback without code/state values', () => {
    const entry = logRequest('/api/v1/auth/oauth/naver/callback?code=SECRETCODE&state=S');
    const req = entry.req as { url: string; method: string };
    expect(req.method).toBe('GET');
    expect(req.url).toBe(`/api/v1/auth/oauth/naver/callback?code=${REDACTED}&state=${REDACTED}`);
    expect(JSON.stringify(entry)).not.toContain('SECRETCODE');
  });

  it('logs map searches without the bbox', () => {
    const entry = logRequest('/api/v1/map/search?bbox=127.4,34.9,127.5,35.0&zoom=13');
    expect((entry.req as { url: string }).url).toBe(`/api/v1/map/search?bbox=${REDACTED}&zoom=13`);
    expect(JSON.stringify(entry)).not.toContain('34.9');
  });
});
