import { AdminRole, AdminStatus, AuthProvider, ErrorCode, UserStatus } from '@house/shared';
import { SessionService } from '../../../src/modules/auth/session/session.service';
import {
  createAdmin,
  createAgency,
  createTestApp,
  createUser,
  loginAdmin,
  loginUser,
  resetAll,
  type TestApp,
  type TestSession,
  withSession,
} from '../../utils';
import { adminActor, api, as, auditRows, expectAdminAuthz, expectCode, pluck } from './helpers';

const MISSING_ID = '01890a5d-ac96-774b-bcce-b302099a8057';

describe('admin members & accounts (e2e)', () => {
  let t: TestApp;
  let userSession: TestSession;

  beforeAll(async () => {
    t = await createTestApp();
  });
  beforeEach(async () => {
    await resetAll(t);
    userSession = await loginUser(t.app, await createUser(t.prisma));
  });
  afterAll(() => t?.close());

  describe('members (/admin/users)', () => {
    it('lists with search + masking; detail shows full contact, identities and memberships', async () => {
      const member = await createUser(t.prisma, {
        nickname: '순천사랑',
        email: 'love@example.com',
        phone: '01098765432',
      });
      await t.prisma.identity.create({
        data: {
          userId: member.id,
          provider: AuthProvider.KAKAO,
          providerUserId: 'k-1',
          email: 'love.kakao@example.com',
          emailVerified: true,
        },
      });
      const terms = await t.prisma.termsDocument.create({
        data: {
          type: 'SERVICE',
          version: '1.0',
          title: '서비스 이용약관',
          content: '본문',
          isRequired: true,
          effectiveAt: new Date(),
        },
      });
      await t.prisma.userConsent.create({
        data: { userId: member.id, termsDocumentId: terms.id, agreed: true },
      });
      const { agency } = await createAgency(t.prisma, { ownerUserId: member.id });
      await loginUser(t.app, member);

      const { admin, session } = await adminActor(t, AdminRole.OPERATOR);
      const byName = await as(t, session, 'get', '/admin/users?q=순천').expect(200);
      expect(byName.body.items).toEqual([
        expect.objectContaining({
          id: member.id,
          email: 'lo***@example.com',
          phone: '010-****-5432',
          providers: [AuthProvider.KAKAO],
          agency: { id: agency.id, name: agency.name },
          suspendedAt: null,
          withdrawnAt: null,
        }),
      ]);
      const byPhone = await as(t, session, 'get', '/admin/users?q=9876-5432').expect(200);
      expect(pluck(byPhone.body.items, 'id')).toEqual([member.id]);
      expect(
        (await as(t, session, 'get', '/admin/users?status=SUSPENDED').expect(200)).body.total,
      ).toBe(0);

      const detail = await as(t, session, 'get', `/admin/users/${member.id}`).expect(200);
      expect(detail.body).toMatchObject({
        phone: '01098765432',
        email: 'love@example.com',
        identities: [
          expect.objectContaining({
            provider: AuthProvider.KAKAO,
            email: 'love.kakao@example.com',
            emailVerified: true,
          }),
        ],
        consents: [
          expect.objectContaining({
            termsType: 'SERVICE',
            termsTitle: '서비스 이용약관',
            version: '1.0',
            isRequired: true,
            agreed: true,
          }),
        ],
        sanctions: [],
        piiScrubAfter: null,
        memberships: [expect.objectContaining({ agencyId: agency.id, role: 'OWNER' })],
        activeSessions: 1,
      });
      // 개인정보 접속기록: who viewed whose contacts, when — without the values themselves.
      const views = await auditRows(t, 'member.pii-view');
      expect(views).toEqual([
        expect.objectContaining({
          adminUserId: admin.id,
          resourceType: 'User',
          resourceId: member.id,
          ip: expect.any(String),
        }),
      ]);
      expect(JSON.stringify(views)).not.toMatch(/love@example\.com|98765432/);
      expectCode(
        await as(t, session, 'get', `/admin/users/${MISSING_ID}`).expect(404),
        ErrorCode.MEMBER_NOT_FOUND,
      );
      expect(await t.prisma.auditLog.count({ where: { action: 'member.pii-view' } })).toBe(1);
    });

    it('suspend logs the member out everywhere; unsuspend restores', async () => {
      const member = await createUser(t.prisma, {
        name: '홍길동',
        email: 'hong@example.com',
        phone: '01011112222',
      });
      const memberSession = await loginUser(t.app, member);
      await withSession(t.http().get(api('/auth/me')), memberSession).expect(200);

      const { session } = await adminActor(t, AdminRole.ADMIN);
      const res = await as(t, session, 'post', `/admin/users/${member.id}/suspend`)
        .send({ reason: '허위매물 반복 등록' })
        .expect(200);
      expect(res.body).toMatchObject({
        status: UserStatus.SUSPENDED,
        suspendedReason: '허위매물 반복 등록',
        activeSessions: 0,
        email: 'ho***@example.com',
        phone: '010-****-2222',
        sanctions: [
          {
            id: expect.any(String),
            action: 'SUSPENDED',
            reason: '허위매물 반복 등록',
            adminName: expect.any(String),
            createdAt: expect.any(String),
          },
        ],
      });
      await withSession(t.http().get(api('/auth/me')), memberSession).expect(401);
      const audits = await t.prisma.auditLog.findMany({ where: { resourceId: member.id } });
      expect(audits.map((a) => a.action)).toEqual(['member.suspend']);
      const [audit] = audits;
      expect(audit).toMatchObject({ resourceId: member.id });
      // Minimal projection only: audit_logs is append-only and never scrubbed.
      expect(audit?.before).toEqual({
        id: member.id,
        status: UserStatus.ACTIVE,
        suspendedAt: null,
        suspendedReason: null,
      });
      expect(audit?.after).toMatchObject({
        status: UserStatus.SUSPENDED,
        suspendedReason: '허위매물 반복 등록',
      });
      expect(JSON.stringify(audits)).not.toMatch(/홍길동|hong@|11112222/);

      expectCode(
        await as(t, session, 'post', `/admin/users/${member.id}/suspend`)
          .send({ reason: '다시' })
          .expect(400),
        ErrorCode.MEMBER_INVALID_STATUS,
      );
      const back = await as(t, session, 'post', `/admin/users/${member.id}/unsuspend`).expect(200);
      expect(back.body).toMatchObject({ status: UserStatus.ACTIVE, suspendedAt: null });
      expect(pluck(back.body.sanctions, 'action')).toEqual(['UNSUSPENDED', 'SUSPENDED']);
      expect((await auditRows(t, 'member.unsuspend'))[0]?.after).toMatchObject({
        status: UserStatus.ACTIVE,
      });
      await as(t, session, 'post', `/admin/users/${member.id}/unsuspend`).expect(400);
      await as(t, session, 'post', `/admin/users/${MISSING_ID}/unsuspend`).expect(404);
    });

    it('validation failures (400)', async () => {
      const member = await createUser(t.prisma);
      const { session } = await adminActor(t, AdminRole.ADMIN);
      await as(t, session, 'post', `/admin/users/${member.id}/suspend`).send({}).expect(400);
      await as(t, session, 'post', `/admin/users/${member.id}/suspend`)
        .send({ reason: 'x' })
        .expect(400);
      await as(t, session, 'get', '/admin/users?role=SUPER_ADMIN').expect(400);
      await as(t, session, 'get', '/admin/users/123').expect(400);
    });

    it('authz: reading is OPERATOR+, suspension ADMIN+', async () => {
      const member = await createUser(t.prisma);
      await expectAdminAuthz(t, 'get', '/admin/users', { userSession });
      await expectAdminAuthz(t, 'get', `/admin/users/${member.id}`, { userSession });
      await expectAdminAuthz(t, 'post', `/admin/users/${member.id}/suspend`, {
        userSession,
        lowRole: AdminRole.OPERATOR,
        body: { reason: '정책 위반' },
      });
      await expectAdminAuthz(t, 'post', `/admin/users/${member.id}/unsuspend`, {
        userSession,
        lowRole: AdminRole.OPERATOR,
      });
    });
  });

  describe('admin accounts (/admin/admins, SUPER_ADMIN)', () => {
    const newAdmin = {
      email: 'New.Operator@Example.com',
      name: '신규 운영자',
      role: AdminRole.OPERATOR,
      password: 'correct-horse-42-battery',
      ipAllowlist: ['203.0.113.0/24'],
    };

    it('creates, lists and reads accounts without secrets', async () => {
      const { session } = await adminActor(t, AdminRole.SUPER_ADMIN);
      const created = await as(t, session, 'post', '/admin/admins').send(newAdmin).expect(201);
      expect(created.body).toMatchObject({
        email: 'new.operator@example.com',
        role: AdminRole.OPERATOR,
        status: AdminStatus.ACTIVE,
        totpEnabled: false,
        ipAllowlist: ['203.0.113.0/24'],
      });
      expect(created.body).not.toHaveProperty('passwordHash');
      const row = await t.prisma.adminUser.findUniqueOrThrow({ where: { id: created.body.id } });
      expect(row.passwordHash).toMatch(/^\$argon2id\$/);
      const audit = (await auditRows(t, 'admin-account.create'))[0];
      expect(JSON.stringify(audit?.after)).not.toContain('correct-horse');

      expectCode(
        await as(t, session, 'post', '/admin/admins').send(newAdmin).expect(409),
        ErrorCode.ADMIN_ACCOUNT_DUPLICATE,
      );
      const list = await as(t, session, 'get', '/admin/admins?role=OPERATOR&q=신규').expect(200);
      expect(pluck(list.body.items, 'id')).toEqual([created.body.id]);
      await as(t, session, 'get', `/admin/admins/${created.body.id}`).expect(200);
      expectCode(
        await as(t, session, 'get', `/admin/admins/${MISSING_ID}`).expect(404),
        ErrorCode.ADMIN_ACCOUNT_NOT_FOUND,
      );
    });

    it('role/status changes end the target sessions; self changes are refused', async () => {
      const { admin: actor, session } = await adminActor(t, AdminRole.SUPER_ADMIN);
      const target = await createAdmin(t.prisma, { role: AdminRole.OPERATOR });
      const targetSession = await loginAdmin(t.app, { id: target.id, role: AdminRole.OPERATOR });
      await as(t, targetSession, 'get', '/admin/permissions').expect(200);

      const res = await as(t, session, 'patch', `/admin/admins/${target.id}`)
        .send({ role: AdminRole.ADMIN, name: '승격' })
        .expect(200);
      expect(res.body).toMatchObject({ role: AdminRole.ADMIN, name: '승격' });
      await as(t, targetSession, 'get', '/admin/permissions').expect(401);
      expect((await auditRows(t, 'admin-account.update'))[0]?.before).toMatchObject({
        role: AdminRole.OPERATOR,
      });

      expectCode(
        await as(t, session, 'patch', `/admin/admins/${actor.id}`)
          .send({ status: AdminStatus.DISABLED })
          .expect(403),
        ErrorCode.ADMIN_SELF_MODIFICATION,
      );
      // Renaming yourself is fine.
      await as(t, session, 'patch', `/admin/admins/${actor.id}`).send({ name: '나' }).expect(200);
    });

    it('never leaves the site without an active SUPER_ADMIN', async () => {
      // Session claims SUPER_ADMIN while the stored role was already lowered (stale session).
      const actor = await createAdmin(t.prisma, { role: AdminRole.ADMIN });
      const session = await loginAdmin(t.app, { id: actor.id, role: AdminRole.SUPER_ADMIN });
      const onlySuper = await createAdmin(t.prisma, { role: AdminRole.SUPER_ADMIN });
      expectCode(
        await as(t, session, 'patch', `/admin/admins/${onlySuper.id}`)
          .send({ role: AdminRole.ADMIN })
          .expect(409),
        ErrorCode.ADMIN_LAST_SUPER_ADMIN,
      );
    });

    it('resets password / TOTP and unlocks other accounts', async () => {
      const { admin: actor, session } = await adminActor(t, AdminRole.SUPER_ADMIN);
      const target = await createAdmin(t.prisma, {
        role: AdminRole.OPERATOR,
        totpSecretEnc: 'enc',
        totpEnabledAt: new Date(),
        recoveryCodeHashes: ['h1'],
        failedLoginCount: 7,
        lockedUntil: new Date(Date.now() + 60_000),
      });
      const sessions = t.app.get(SessionService);
      await loginAdmin(t.app, { id: target.id, role: AdminRole.OPERATOR });

      const unlocked = await as(t, session, 'post', `/admin/admins/${target.id}/unlock`).expect(
        200,
      );
      expect(unlocked.body.locked).toBe(false);
      const totp = await as(t, session, 'post', `/admin/admins/${target.id}/reset-totp`).expect(
        200,
      );
      expect(totp.body.totpEnabled).toBe(false);
      const pw = await as(t, session, 'post', `/admin/admins/${target.id}/reset-password`)
        .send({ password: 'another-secret-99' })
        .expect(200);
      expect(pw.body.passwordChangedAt).not.toBeNull();
      expect(await sessions.listForSubject('ADMIN', target.id)).toHaveLength(0);
      const row = await t.prisma.adminUser.findUniqueOrThrow({ where: { id: target.id } });
      expect(row).toMatchObject({
        totpSecretEnc: null,
        recoveryCodeHashes: [],
        failedLoginCount: 0,
      });

      for (const path of ['reset-totp', 'reset-password']) {
        expectCode(
          await as(t, session, 'post', `/admin/admins/${actor.id}/${path}`)
            .send({ password: 'another-secret-99' })
            .expect(403),
          ErrorCode.ADMIN_SELF_MODIFICATION,
        );
      }
      const audits = await t.prisma.auditLog.findMany({ where: { resourceId: target.id } });
      expect(audits.map((a) => a.action).sort()).toEqual([
        'admin-account.reset-password',
        'admin-account.reset-totp',
        'admin-account.unlock',
      ]);
    });

    it('validation failures (400)', async () => {
      const { session } = await adminActor(t, AdminRole.SUPER_ADMIN);
      await as(t, session, 'post', '/admin/admins')
        .send({ ...newAdmin, password: 'short1' })
        .expect(400);
      await as(t, session, 'post', '/admin/admins')
        .send({ ...newAdmin, ipAllowlist: ['10.0.0.0/40'] })
        .expect(400);
      await as(t, session, 'post', '/admin/admins')
        .send({ ...newAdmin, role: 'USER' })
        .expect(400);
      const target = await createAdmin(t.prisma);
      await as(t, session, 'patch', `/admin/admins/${target.id}`).send({}).expect(400);
      await as(t, session, 'post', `/admin/admins/${target.id}/reset-password`)
        .send({ password: 'abc' })
        .expect(400);
      await as(t, session, 'get', '/admin/admins?status=GONE').expect(400);
    });

    it('authz: SUPER_ADMIN only (ADMIN gets 403)', async () => {
      const target = await createAdmin(t.prisma);
      const opts = { userSession, lowRole: AdminRole.ADMIN };
      await expectAdminAuthz(t, 'get', '/admin/admins', opts);
      await expectAdminAuthz(t, 'get', `/admin/admins/${target.id}`, opts);
      await expectAdminAuthz(t, 'post', '/admin/admins', { ...opts, body: newAdmin });
      await expectAdminAuthz(t, 'patch', `/admin/admins/${target.id}`, {
        ...opts,
        body: { name: 'x' },
      });
      await expectAdminAuthz(t, 'post', `/admin/admins/${target.id}/reset-password`, {
        ...opts,
        body: { password: 'another-secret-99' },
      });
      await expectAdminAuthz(t, 'post', `/admin/admins/${target.id}/reset-totp`, opts);
      await expectAdminAuthz(t, 'post', `/admin/admins/${target.id}/unlock`, opts);
    });
  });
});
