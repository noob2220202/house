import { SUBSCRIPTION_REQUIRED_FEATURE } from '@house/shared';
import { describe, expect, it } from 'vitest';
import { normalizeFlags } from './features';
import {
  FEATURE_META,
  auditActionLabel,
  auditActionTone,
  auditResourceLabel,
  fieldLabel,
} from './labels';

describe('사무소 홈페이지 · 이용 기간 in settings and the audit log', () => {
  it('labels both subscription switches (off unless stored)', () => {
    expect(FEATURE_META[SUBSCRIPTION_REQUIRED_FEATURE.SITE]?.label).toBe(
      '사무소 홈페이지 유료 적용',
    );
    expect(FEATURE_META[SUBSCRIPTION_REQUIRED_FEATURE.PLATFORM]?.label).toBe(
      '메인 입점 유료 적용 (준비 중 — 아직 적용되지 않아요)',
    );
    for (const meta of Object.values(FEATURE_META)) expect(meta.description).not.toContain('구독');
    const flags = normalizeFlags({ dealRequests: true });
    expect(flags.siteSubscriptionRequired).toBe(false);
    expect(flags.platformSubscriptionRequired).toBe(false);
  });

  it('names the site and subscription actions', () => {
    expect(auditActionLabel('agency_site.approve')).toBe('사무소 홈페이지 승인');
    expect(auditActionLabel('agency_site.request')).toBe('사무소 홈페이지 신청');
    expect(auditActionLabel('agency_site.resume')).toBe('사무소 홈페이지 정지 해제');
    expect(auditActionLabel('agency.site.suspend')).toBe('중개사무소 홈페이지 이용 정지');
    // One term in the admin: 이용 기간 (not 구독).
    expect(auditActionLabel('subscription.create')).toBe('이용 기간 등록');
    expect(auditActionLabel('agency_subscription.cancel')).toBe('이용 기간 취소');
    expect(auditActionTone('agency_site.reject')).toBe('danger');
    expect(auditActionTone('agency_site.resume')).toBe('success');
    expect(auditActionTone('subscription.cancel')).toBe('danger');
    expect(auditActionTone('agency_site.request')).toBe('brand');
  });

  it('labels the resources and fields', () => {
    expect(auditResourceLabel('AgencySite')).toBe('사무소 홈페이지');
    expect(auditResourceLabel('AgencySubscription')).toBe('이용 기간');
    expect(fieldLabel('requestedSlug')).toBe('신청 주소');
    expect(fieldLabel('amountWon')).toBe('금액(원)');
    expect(fieldLabel('endsOn')).toBe('이용 종료일');
  });
});
