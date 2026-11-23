import { UserRole } from '@house/shared';
import {
  hashSessionToken,
  SessionService,
} from '../../../src/modules/auth/session/session.service';
import type { SessionRecord } from '../../../src/modules/auth/session/session.types';
import { createUser, resetAll, type TestApp } from '../../utils';
import { createAuthTestApp } from './helpers';

/**
 * Read-modify-write races in SessionService against real Redis. Interleavings are forced by
 * running the competing operation right before the service's conditional write (the EVAL call).
 */
describe('auth: session store races (e2e)', () => {
  let t: TestApp;
  let sessions: SessionService;

  beforeAll(async () => {
    ({ t } = await createAuthTestApp());
    sessions = t.app.get(SessionService);
  });
  beforeEach(() => resetAll(t));
  afterEach(() => jest.restoreAllMocks());
  afterAll(() => t?.close());

  async function newSession(userId: string) {
    return sessions.create({ kind: 'USER', userId, role: UserRole.USER });
  }

  /** Makes the next lookup slide the expiry (lastSeenAt older than the touch interval). */
  async function ageSession(id: string): Promise<void> {
    const key = `session:${id}`;
    const record = JSON.parse((await t.redis.get(key)) ?? '{}') as SessionRecord;
    await t.redis.set(
      key,
      JSON.stringify({ ...record, lastSeenAt: Date.now() - 120_000 }),
      'KEEPTTL',
    );
  }

  /** Runs `between` once, just before the next EVAL (the service's compare-and-set). */
  function beforeNextWrite(between: () => Promise<unknown>): void {
    const original = t.redis.eval.bind(t.redis) as (...args: unknown[]) => Promise<unknown>;
    jest.spyOn(t.redis, 'eval').mockImplementationOnce(async (...args: unknown[]) => {
      await between();
      return original(...args);
    });
  }

  it('logout-all racing a sliding touch: the session stays revoked and cannot come back', async () => {
    const user = await createUser(t.prisma);
    const { token, record } = await newSession(user.id);
    await ageSession(record.id);
    beforeNextWrite(() => sessions.destroyAllForSubject('USER', user.id));

    expect(await sessions.findByToken(token)).toBeNull();
    expect(await t.redis.get(`session:${record.id}`)).toBeNull();
    expect(await sessions.findByToken(token)).toBeNull();
    expect(await sessions.listForSubject('USER', user.id)).toEqual([]);
  });

  it('a touch never undoes a concurrent patch (role / agency after approval)', async () => {
    const user = await createUser(t.prisma);
    const { token, record } = await newSession(user.id);
    await ageSession(record.id);
    beforeNextWrite(() =>
      sessions.updateById(record.id, { role: UserRole.AGENCY_OWNER, agencyId: user.id }),
    );

    await sessions.findByToken(token);
    const stored = JSON.parse((await t.redis.get(`session:${record.id}`)) ?? '{}') as SessionRecord;
    expect(stored).toMatchObject({ role: UserRole.AGENCY_OWNER, agencyId: user.id });
  });

  it('a patch racing a touch is retried and applied', async () => {
    const user = await createUser(t.prisma);
    const { token, record } = await newSession(user.id);
    await ageSession(record.id);
    // the touch lands between the patch's read and its write
    beforeNextWrite(async () => {
      await ageSession(record.id);
      await sessions.findByToken(token);
    });
    await sessions.updateById(record.id, { role: UserRole.AGENT });
    const stored = JSON.parse((await t.redis.get(`session:${record.id}`)) ?? '{}') as SessionRecord;
    expect(stored.role).toBe(UserRole.AGENT);
    expect(Date.now() - stored.lastSeenAt).toBeLessThan(60_000);
  });

  it('a patch racing logout-all does not recreate the session', async () => {
    const user = await createUser(t.prisma);
    const { token, record } = await newSession(user.id);
    beforeNextWrite(() => sessions.destroyAllForSubject('USER', user.id));
    await sessions.updateById(record.id, { role: UserRole.AGENT });
    expect(await t.redis.get(`session:${record.id}`)).toBeNull();
    expect(await sessions.findByToken(token)).toBeNull();
  });

  it('a record missing from its subject index (create racing logout-all) is not a session', async () => {
    const user = await createUser(t.prisma);
    const { token, record } = await newSession(user.id);
    await t.redis.srem(`session-index:USER:${user.id}`, record.id);
    expect(await sessions.findByToken(token)).toBeNull();
    expect(hashSessionToken(token)).toBe(record.id);
  });
});
