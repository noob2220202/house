import { AdminPermission, AdminRole, AdminStatus, ErrorCode } from '@house/shared';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { AdminPrincipal } from '../../common/auth/principal';
import { ROLES_KEY } from '../../common/decorators/metadata-keys';
import { AppException } from '../../common/errors/app.exception';
import { resourceTypeFromPath, stripSecrets } from './audit/admin-mutation-audit.interceptor';
import { RequirePermission } from './permissions.decorator';
import type { PrismaTx } from '../../prisma/prisma.service';
import type { ListingsModerationService } from '../listings/services/listings-moderation.service';
import { reportSelect, toAdminReportView, type ReportRow } from './admin.mapper';
import { ListingModerationAdapter } from './ports/listing-moderation.port';
import { AdminAccountsService } from './services/admin-accounts.service';
import { startOfKstDay } from './services/dashboard.service';
import { countsAsVisit } from './visitors/visitor-counter.middleware';
import { visitorId } from './visitors/visitor-stats.service';

describe('RequirePermission', () => {
  class Probe {
    @RequirePermission(AdminPermission.ADMINS_MANAGE)
    superOnly(): void {}

    @RequirePermission(AdminPermission.REPORTS_MANAGE)
    anyAdmin(): void {}
  }

  it('expands to the admin roles holding the permission', () => {
    const reflector = new Reflector();
    expect(reflector.get(ROLES_KEY, Probe.prototype.superOnly)).toEqual([AdminRole.SUPER_ADMIN]);
    expect(reflector.get(ROLES_KEY, Probe.prototype.anyAdmin)).toEqual([
      AdminRole.OPERATOR,
      AdminRole.ADMIN,
      AdminRole.SUPER_ADMIN,
    ]);
  });
});

describe('admin audit fallback helpers', () => {
  it('derives the resource type from the controller path', () => {
    expect(resourceTypeFromPath('admin/agencies')).toBe('agencies');
    expect(resourceTypeFromPath(['admin/complexes/trade-sync'])).toBe('complexes.trade-sync');
    expect(resourceTypeFromPath('admin')).toBe('admin');
    expect(resourceTypeFromPath(undefined)).toBe('admin');
  });

  it('redacts tokens and TOTP material at any depth', () => {
    expect(
      stripSecrets({
        csrfToken: 'x',
        nested: { otpauthUrl: 'otpauth://…', recoveryCodes: ['A'], keep: 1 },
        list: [{ token: 't' }],
        empty: { secret: null },
      }),
    ).toEqual({
      csrfToken: '[redacted]',
      nested: { otpauthUrl: '[redacted]', recoveryCodes: '[redacted]', keep: 1 },
      list: [{ token: '[redacted]' }],
      empty: { secret: null },
    });
  });
});

describe('visitor counter', () => {
  const req = (method: string, url: string, ua?: string): Request =>
    ({ method, originalUrl: url, headers: ua ? { 'user-agent': ua } : {} }) as unknown as Request;
  const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 Safari/605.1.15';

  it('counts only public GETs from browsers', () => {
    expect(countsAsVisit(req('GET', '/api/v1/listings?page=1', UA))).toBe(true);
    expect(countsAsVisit(req('POST', '/api/v1/reports', UA))).toBe(false);
    expect(countsAsVisit(req('GET', '/api/v1/admin/dashboard', UA))).toBe(false);
    expect(countsAsVisit(req('GET', '/api/v1/health/ready', UA))).toBe(false);
    expect(countsAsVisit(req('GET', '/api/v1/listings', 'curl/8.5.0'))).toBe(false);
    expect(countsAsVisit(req('GET', '/api/v1/listings'))).toBe(false);
  });

  it('hashes visitor identity (no raw ip / token kept)', () => {
    const a = visitorId({ ip: '203.0.113.7', userAgent: UA });
    expect(a).toBe(visitorId({ ip: '203.0.113.7', userAgent: UA }));
    expect(a).not.toBe(visitorId({ ip: '203.0.113.8', userAgent: UA }));
    expect(a).not.toContain('203');
    expect(visitorId({ sessionToken: 'tok', ip: '1.1.1.1' })).toBe(
      visitorId({ sessionToken: 'tok', ip: '2.2.2.2' }),
    );
  });

  it('computes KST midnight', () => {
    expect(startOfKstDay(new Date('2026-03-01T14:59:59Z')).toISOString()).toBe(
      '2026-02-28T15:00:00.000Z',
    );
    expect(startOfKstDay(new Date('2026-03-01T15:00:00Z')).toISOString()).toBe(
      '2026-03-01T15:00:00.000Z',
    );
  });
});

describe('AdminAccountsService guards', () => {
  const actor: AdminPrincipal = {
    kind: 'ADMIN',
    adminId: 'self',
    role: AdminRole.SUPER_ADMIN,
    sessionId: 's',
    mfaVerified: true,
  };
  const row = (over: Record<string, unknown>) => ({
    id: 'target',
    role: AdminRole.SUPER_ADMIN,
    status: AdminStatus.ACTIVE,
    ipAllowlist: [],
    totpEnabledAt: null,
    lockedUntil: null,
    lastLoginAt: null,
    passwordChangedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...over,
  });

  function service(otherSupers: number, current = row({})) {
    const tx = {
      $executeRaw: jest.fn().mockResolvedValue(1),
      adminUser: {
        findUnique: jest.fn().mockResolvedValue(current),
        count: jest.fn().mockResolvedValue(otherSupers),
        update: jest
          .fn()
          .mockImplementation(({ data }) => Promise.resolve({ ...current, ...data })),
      },
      adminAccountDeletion: {
        findUnique: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockResolvedValue({}),
      },
    };
    const prisma = {
      ...tx,
      $transaction: jest.fn((fn: (t: typeof tx) => unknown) => fn(tx)),
    };
    const sessions = { destroyAllForSubject: jest.fn().mockResolvedValue(0) };
    const passwords = { hash: jest.fn().mockResolvedValue('hash') };
    const svc = new AdminAccountsService(prisma as never, passwords as never, sessions as never);
    return { svc, sessions, tx };
  }

  it('soft-deletes an account: DISABLED, e-mail released, credentials cleared, sessions ended', async () => {
    const { svc, sessions, tx } = service(1, row({ email: 'old@example.kr' }));
    await svc.remove(actor, 'target');
    expect(tx.adminAccountDeletion.create).toHaveBeenCalledWith({
      data: { adminUserId: 'target', originalEmail: 'old@example.kr', deletedByAdminId: 'self' },
    });
    expect(tx.adminUser.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'target' },
        data: expect.objectContaining({
          status: AdminStatus.DISABLED,
          email: 'deleted+target@deleted.invalid',
          totpSecretEnc: null,
          recoveryCodeHashes: [],
        }),
      }),
    );
    expect(sessions.destroyAllForSubject).toHaveBeenCalledWith('ADMIN', 'target');
  });

  it('refuses to delete oneself or the last active SUPER_ADMIN; deleted accounts are 404', async () => {
    const last = service(0);
    expect(await codeOf(last.svc.remove(actor, 'target'))).toBe(ErrorCode.ADMIN_LAST_SUPER_ADMIN);
    expect(last.tx.adminAccountDeletion.create).not.toHaveBeenCalled();
    const self = service(1, row({ id: 'self' }));
    expect(await codeOf(self.svc.remove(actor, 'self'))).toBe(ErrorCode.ADMIN_SELF_MODIFICATION);
    const gone = service(1);
    gone.tx.adminAccountDeletion.findUnique.mockResolvedValue({ adminUserId: 'target' });
    expect(await codeOf(gone.svc.detail('target'))).toBe(ErrorCode.ADMIN_ACCOUNT_NOT_FOUND);
  });

  async function codeOf(p: Promise<unknown>): Promise<string | undefined> {
    try {
      await p;
      return undefined;
    } catch (err) {
      return err instanceof AppException ? err.code : 'unexpected';
    }
  }

  it('refuses to demote the last active SUPER_ADMIN', async () => {
    const { svc, tx } = service(0);
    expect(await codeOf(svc.update(actor, 'target', { role: AdminRole.ADMIN }))).toBe(
      ErrorCode.ADMIN_LAST_SUPER_ADMIN,
    );
    expect(tx.adminUser.update).not.toHaveBeenCalled();
  });

  it('allows it when another SUPER_ADMIN stays, and ends the target sessions', async () => {
    const { svc, sessions } = service(1);
    const view = await svc.update(actor, 'target', { status: AdminStatus.DISABLED });
    expect(view.status).toBe(AdminStatus.DISABLED);
    expect(sessions.destroyAllForSubject).toHaveBeenCalledWith('ADMIN', 'target');
  });

  it('keeps sessions on a rename and refuses self role/status changes', async () => {
    const { svc, sessions } = service(1, row({ id: 'self' }));
    await svc.update(actor, 'self', { name: '이름만' });
    expect(sessions.destroyAllForSubject).not.toHaveBeenCalled();
    expect(await codeOf(svc.update(actor, 'self', { role: AdminRole.ADMIN }))).toBe(
      ErrorCode.ADMIN_SELF_MODIFICATION,
    );
    expect(await codeOf(svc.resetTotp(actor, 'self'))).toBe(ErrorCode.ADMIN_SELF_MODIFICATION);
  });
});

describe('ListingModerationAdapter', () => {
  function setup() {
    const moderation = {
      hide: jest.fn().mockResolvedValue('ACTIVE'),
      close: jest.fn().mockResolvedValue('ACTIVE'),
      unhide: jest.fn().mockResolvedValue(undefined),
      invalidateSearch: jest.fn().mockResolvedValue(undefined),
    };
    const adapter = new ListingModerationAdapter(
      moderation as unknown as ListingsModerationService,
    );
    return { adapter, moderation };
  }

  it('joins the caller transaction when hiding, and invalidates map tiles on request', async () => {
    const { adapter, moderation } = setup();
    const tx = {} as PrismaTx;
    await adapter.hide('l1', '허위', tx);
    expect(moderation.hide).toHaveBeenCalledWith('l1', '허위', tx);
    expect(moderation.invalidateSearch).not.toHaveBeenCalled();
    await adapter.invalidateSearch();
    expect(moderation.invalidateSearch).toHaveBeenCalledTimes(1);
  });

  it('force-closes in a single listings-module transaction', async () => {
    const { adapter, moderation } = setup();
    await adapter.forceClose('l1', '거래완료');
    expect(moderation.close).toHaveBeenCalledWith('l1', '거래완료');
    expect(moderation.hide).not.toHaveBeenCalled();
  });
});

describe('toAdminReportView', () => {
  const row = {
    id: 'r1',
    targetType: 'LISTING',
    reason: 'NOT_EXIST',
    detail: null,
    status: 'RECEIVED',
    action: null,
    resolutionNote: null,
    handledAt: null,
    reporterPhone: '01012345678',
    createdAt: new Date(0),
    updatedAt: new Date(0),
    listingId: null,
    agencyId: null,
    reporterUserId: null,
    listing: null,
    agency: null,
    reporter: null,
    handledBy: null,
  } as unknown as ReportRow;

  it('masks the reporter phone unless the caller reveals it (audited detail)', () => {
    expect(Object.keys(reportSelect)).toContain('reporterPhone');
    expect(toAdminReportView(row).reporterPhone).toBe('010-****-5678');
    expect(toAdminReportView(row, { revealContact: true }).reporterPhone).toBe('01012345678');
    expect(toAdminReportView({ ...row, reporterPhone: null }).reporterPhone).toBeNull();
  });
});
