import {
  ReportAction,
  ReportReason,
  ReportStatus,
  ReportTargetType,
  SiteSettingKey,
} from '../enums/admin';
import { AdminRole } from '../enums/user';
import {
  auditLogQuerySchema,
  faqOrderSchema,
  localVideoInputSchema,
  noticeUpdateSchema,
  reportCreateSchema,
  reportResolveSchema,
  siteSettingSchemas,
  termsDocumentUpdateSchema,
} from '../schemas/admin';
import {
  ADMIN_ROLE_PERMISSIONS,
  AdminPermission,
  adminRolesWith,
  hasAdminPermission,
} from './permissions';
import {
  isReportActionAllowed,
  isValidIpOrCidr,
  maskEmail,
  PUBLIC_SITE_SETTING_KEYS,
  youtubeThumbnailUrl,
} from './rules';
import {
  adminAccountCreateSchema,
  adminAccountUpdateSchema,
  memberListQuerySchema,
} from './schemas';

describe('admin permissions', () => {
  it('higher roles include every permission of the lower ones', () => {
    for (const p of ADMIN_ROLE_PERMISSIONS.OPERATOR) {
      expect(hasAdminPermission(AdminRole.ADMIN, p)).toBe(true);
    }
    for (const p of ADMIN_ROLE_PERMISSIONS.ADMIN) {
      expect(hasAdminPermission(AdminRole.SUPER_ADMIN, p)).toBe(true);
    }
  });

  it('admin account management is SUPER_ADMIN only', () => {
    expect(adminRolesWith(AdminPermission.ADMINS_MANAGE)).toEqual([AdminRole.SUPER_ADMIN]);
    expect(adminRolesWith(AdminPermission.SETTINGS_MANAGE)).toEqual([
      AdminRole.ADMIN,
      AdminRole.SUPER_ADMIN,
    ]);
    expect(adminRolesWith(AdminPermission.REPORTS_MANAGE)).toHaveLength(3);
  });
});

describe('admin rules', () => {
  it('validates IP allowlist entries', () => {
    for (const ok of ['203.0.113.7', '10.0.0.0/8', '2001:db8::/32', '::1', '::ffff:10.0.0.1']) {
      expect(isValidIpOrCidr(ok)).toBe(true);
    }
    for (const bad of [
      '256.1.1.1',
      '10.0.0.0/33',
      'example.com',
      '1.2.3',
      '2001:db8::/129',
      '1::2::3',
      '10.0.0.0/8/1',
    ]) {
      expect(isValidIpOrCidr(bad)).toBe(false);
    }
  });

  it('restricts report actions by target and decision', () => {
    expect(
      isReportActionAllowed(
        ReportTargetType.AGENCY,
        ReportStatus.RESOLVED,
        ReportAction.LISTING_HIDDEN,
      ),
    ).toBe(false);
    expect(
      isReportActionAllowed(
        ReportTargetType.AGENCY,
        ReportStatus.RESOLVED,
        ReportAction.AGENCY_WARNED,
      ),
    ).toBe(true);
    expect(
      isReportActionAllowed(
        ReportTargetType.LISTING,
        ReportStatus.RESOLVED,
        ReportAction.LISTING_HIDDEN_AGENCY_WARNED,
      ),
    ).toBe(true);
    expect(
      isReportActionAllowed(
        ReportTargetType.LISTING,
        ReportStatus.REJECTED,
        ReportAction.LISTING_HIDDEN,
      ),
    ).toBe(false);
  });

  it('builds youtube thumbnails and masks emails', () => {
    expect(youtubeThumbnailUrl('https://youtu.be/dQw4w9WgXcQ')).toBe(
      'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
    );
    expect(youtubeThumbnailUrl('https://vimeo.com/1')).toBeNull();
    expect(maskEmail('hong@example.com')).toBe('ho***@example.com');
    expect(maskEmail(null)).toBeNull();
  });

  it('exposes every site setting key that has a schema', () => {
    expect([...PUBLIC_SITE_SETTING_KEYS].sort()).toEqual(Object.keys(siteSettingSchemas).sort());
  });
});

describe('admin schemas', () => {
  const uuid = '01890a5d-ac96-774b-bcce-b302099a8057';

  it('requires a detail for OTHER reports and normalizes the phone', () => {
    expect(
      reportCreateSchema.safeParse({ targetType: 'LISTING', targetId: uuid, reason: 'OTHER' })
        .success,
    ).toBe(false);
    const ok = reportCreateSchema.parse({
      targetType: 'LISTING',
      targetId: uuid,
      reason: ReportReason.NOT_EXIST,
      reporterPhone: '010-1234-5678',
    });
    expect(ok.reporterPhone).toBe('01012345678');
  });

  it('rejects actions on a rejected report', () => {
    expect(
      reportResolveSchema.safeParse({ status: 'REJECTED', action: 'LISTING_HIDDEN' }).success,
    ).toBe(false);
    expect(reportResolveSchema.parse({ status: 'RESOLVED' }).action).toBe(ReportAction.NONE);
  });

  it('accepts only https youtube video URLs', () => {
    const base = { title: '순천만 습지' };
    expect(
      localVideoInputSchema.safeParse({
        ...base,
        youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      }).success,
    ).toBe(true);
    expect(
      localVideoInputSchema.safeParse({ ...base, youtubeUrl: 'http://youtu.be/dQw4w9WgXcQ' })
        .success,
    ).toBe(false);
    expect(
      localVideoInputSchema.safeParse({
        ...base,
        youtubeUrl: 'https://example.com/watch?v=dQw4w9WgXcQ',
      }).success,
    ).toBe(false);
  });

  it('rejects empty updates and duplicate orderings', () => {
    expect(noticeUpdateSchema.safeParse({}).success).toBe(false);
    expect(termsDocumentUpdateSchema.safeParse({ type: 'SERVICE' }).success).toBe(false);
    expect(faqOrderSchema.safeParse({ ids: [uuid, uuid] }).success).toBe(false);
    expect(adminAccountUpdateSchema.safeParse({}).success).toBe(false);
  });

  it('validates admin accounts and query strings', () => {
    const parsed = adminAccountCreateSchema.parse({
      email: 'Ops@Example.com',
      name: '운영자',
      role: 'OPERATOR',
      password: 'longpassword123',
    });
    expect(parsed.email).toBe('ops@example.com');
    expect(parsed.ipAllowlist).toEqual([]);
    expect(adminAccountCreateSchema.safeParse({ ...parsed, password: 'short1' }).success).toBe(
      false,
    );
    expect(memberListQuerySchema.parse({ page: '2' }).page).toBe(2);
    expect(auditLogQuerySchema.safeParse({ action: "x'; drop" }).success).toBe(false);
  });

  it('validates site settings per key', () => {
    expect(
      siteSettingSchemas[SiteSettingKey.FOOTER].parse({ links: [{ label: '약관', url: '/terms' }] })
        .links[0]?.newWindow,
    ).toBe(false);
    expect(
      siteSettingSchemas[SiteSettingKey.FOOTER].safeParse({
        links: [{ label: 'x', url: 'javascript:alert(1)' }],
      }).success,
    ).toBe(false);
  });
});
