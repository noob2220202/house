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
  faqInputSchema,
  faqOrderSchema,
  isSafeMarkdownLink,
  localVideoInputSchema,
  markdownContentIssues,
  noticeInputSchema,
  noticeUpdateSchema,
  reportCreateSchema,
  reportResolveSchema,
  siteSettingSchemas,
  termsDocumentInputSchema,
  termsDocumentUpdateSchema,
  termsPublishSchema,
} from '../schemas/admin';
import {
  ADMIN_ROLE_PERMISSIONS,
  AdminPermission,
  adminRolesWith,
  hasAdminPermission,
} from './permissions';
import {
  canTermsTypeBeRequired,
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

describe('admin content format (Markdown without raw HTML)', () => {
  const attacks = [
    '<script>alert(1)</script>',
    '공지 <img src=x onerror=alert(document.cookie)>',
    '<IMG SRC=x OnError=alert(1)>',
    '</p><svg/onload=alert(1)>',
    '<!-- --><iframe src=//evil>',
    '<?xml version="1.0"?>',
    '<a href="https://ok">x</a>',
    '[클릭](javascript:alert(1))',
    '[클릭]( JavaScript:alert(1) )',
    '[클릭](java&#115;cript&colon;alert(1))',
    '[클릭](&#x6A;avascript:alert(1))',
    '![img](data:text/html;base64,PHNjcmlwdD4=)',
    '[ref]: vbscript:msgbox',
    '[클릭](<javascript:alert(1)>)',
  ];

  it.each(attacks)('refuses %s', (content) => {
    expect(markdownContentIssues(content).length).toBeGreaterThan(0);
    expect(noticeInputSchema.safeParse({ title: 't', content }).success).toBe(false);
    expect(
      faqInputSchema.safeParse({ category: 'GENERAL', question: 'q', answer: content }).success,
    ).toBe(false);
    expect(
      termsDocumentInputSchema.safeParse({
        type: 'SERVICE',
        version: '1.0',
        title: 't',
        content,
        isRequired: true,
        effectiveAt: '2027-01-01T00:00:00.000Z',
      }).success,
    ).toBe(false);
  });

  it('accepts ordinary Markdown, comparison signs and Korean 꺾쇠 titles', () => {
    const ok = [
      '## 제1조 (목적)\n\n본 약관은 <개인정보 처리방침>과 함께 적용됩니다.',
      '- 보증금 < 1억, 월세 > 50만원\n- **중요** _강조_',
      '[문의](https://example.com/help) · [FAQ](/faqs) · [메일](mailto:help@example.com) · [전화](tel:0612345678)',
      '[상세](#section-2) [상대](./a) [ref]\n\n[ref]: https://example.com',
      '수식 1<2 그리고 3 <= 4',
    ];
    for (const content of ok) expect(markdownContentIssues(content)).toEqual([]);
    expect(
      faqInputSchema.safeParse({ category: 'GENERAL', question: 'q', answer: ok[1] }).success,
    ).toBe(true);
  });

  it('classifies link destinations by scheme', () => {
    expect(isSafeMarkdownLink('https://a.b')).toBe(true);
    expect(isSafeMarkdownLink('/notices/1')).toBe(true);
    expect(isSafeMarkdownLink('a/b:c')).toBe(true);
    expect(isSafeMarkdownLink('ftp://a.b')).toBe(false);
    expect(isSafeMarkdownLink('java\tscript:x')).toBe(false);
    expect(isSafeMarkdownLink('&#99999999;')).toBe(true);
  });
});

describe('termsPublishSchema', () => {
  it('defaults to a normal publish when there is no body', () => {
    expect(termsPublishSchema.parse(undefined)).toEqual({ urgent: false });
    expect(termsPublishSchema.parse({})).toEqual({ urgent: false });
  });

  it('requires a reason for an urgent publish', () => {
    expect(termsPublishSchema.safeParse({ urgent: true }).success).toBe(false);
    expect(termsPublishSchema.safeParse({ urgent: true, reason: '짧음' }).success).toBe(false);
    expect(termsPublishSchema.parse({ urgent: true, reason: '법령 개정 반영' })).toEqual({
      urgent: true,
      reason: '법령 개정 반영',
    });
  });
});

describe('terms that must stay optional (marketing, location)', () => {
  const doc = (type: string, isRequired: boolean) => ({
    type,
    version: '2.0',
    title: '약관',
    content: '제1조 (목적)',
    isRequired,
    effectiveAt: '2027-01-01T00:00:00.000Z',
  });

  it.each(['MARKETING', 'LOCATION'])('refuses a required %s document', (type) => {
    const res = termsDocumentInputSchema.safeParse(doc(type, true));
    expect(res.success).toBe(false);
    expect(res.error?.issues[0]).toMatchObject({ path: ['isRequired'] });
    expect(res.error?.issues[0]?.message).toContain('선택 항목');
    expect(termsDocumentInputSchema.safeParse(doc(type, false)).success).toBe(true);
  });

  it('allows required service/privacy terms', () => {
    expect(termsDocumentInputSchema.safeParse(doc('SERVICE', true)).success).toBe(true);
    expect(termsDocumentInputSchema.safeParse(doc('PRIVACY', true)).success).toBe(true);
  });

  it('exposes the rule for checks against a stored type', () => {
    expect(canTermsTypeBeRequired('SERVICE')).toBe(true);
    expect(canTermsTypeBeRequired('PRIVACY')).toBe(true);
    expect(canTermsTypeBeRequired('MARKETING')).toBe(false);
    expect(canTermsTypeBeRequired('LOCATION')).toBe(false);
  });
});
