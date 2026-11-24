import path from 'node:path';
import fs from 'node:fs';
import { expect, test } from 'playwright/test';
import { Api, apiSessionAs, bodyOf, findListings, loginAs, termsVersion } from '../../lib/api';
import { ADMIN_URL, FIXTURES_DIR, SEED, uniq, WEB_URL } from '../../lib/env';

/** Valid 사업자등록번호 (check digit as in @house/shared isValidBusinessNumber). */
function businessNumber(): string {
  const d = Array.from({ length: 9 }, () => Math.floor(Math.random() * 10));
  const w = [1, 3, 7, 1, 3, 7, 1, 3, 5];
  let sum = d.reduce((acc, n, i) => acc + n * w[i]!, 0);
  sum += Math.floor((d[8]! * 5) / 10);
  return [...d, (10 - (sum % 10)) % 10].join('');
}

test.describe('admin moderation', () => {
  test('agency application → admin approves → AGENCY_OWNER opens the console', async ({
    page,
    context,
    browser,
    playwright,
  }) => {
    // A fresh member applies through the real API (documents + PRIVACY_AGENCY_APPLICATION consent).
    const applicantEmail = `${uniq('apply')}@e2e.example.invalid`;
    const applicant = await apiSessionAs(playwright, applicantEmail, {
      nickname: '신청대표',
    });
    const doc = await applicant.api.upload<{ id: string }>('/media?purpose=AGENCY_DOCUMENT', {
      name: 'registration-cert.pdf',
      mimeType: 'application/pdf',
      buffer: fs.readFileSync(path.join(FIXTURES_DIR, 'registration-cert.pdf')),
    });
    const regions =
      await applicant.api.get<{ code: string; level: string; lat: number; lng: number }[]>(
        '/regions',
      );
    const emd = regions.find((r) => r.level === 'EMD')!;
    const name = uniq('e2e공인중개사사무소');
    const serial = String(Math.floor(Math.random() * 90000) + 10000);
    const agency = await applicant.api.post<{ id: string; status: string }>('/agencies', {
      name,
      representativeName: '신청대표',
      registrationNumber: `12150-2026-${serial}`,
      businessNumber: businessNumber(),
      phone: '061-750-0000',
      roadAddress: '전남광주통합특별시 순천시 e2e중앙로 1',
      emdCode: emd.code,
      lat: emd.lat,
      lng: emd.lng,
      documents: [{ type: 'REGISTRATION_CERT', mediaId: doc.id }],
      consents: [
        {
          type: 'PRIVACY_AGENCY_APPLICATION',
          version: await termsVersion(applicant.api, 'PRIVACY_AGENCY_APPLICATION'),
        },
      ],
    });
    expect(agency.status).toBe('PENDING');

    // Admin reviews and approves in the console.
    await page.goto(`/agencies/${agency.id}`);
    await expect(page.getByText(name).first()).toBeVisible();
    // Without a 브이월드 key the 등록 조회 is not MATCHED (and no 사업자등록증 was uploaded), so the
    // admin approves through "확인 후 승인" and records how the documents were checked.
    await page.getByRole('button', { name: /^(확인 후 )?승인$/ }).click();
    const dialog = page.getByRole('dialog', {
      name: /^(확인 후 승인|이 중개사무소를 승인할까요\?)$/,
    });
    await expect(dialog).toBeVisible();
    const method = dialog.getByLabel(/^확인한 방법/);
    if (await method.count()) {
      await method.fill('e2e: 중개사무소 등록증 원본과 사업자등록증을 직접 확인했습니다.');
    }
    const decided = page.waitForResponse(
      (r) =>
        r.url().endsWith(`/api/v1/admin/agencies/${agency.id}/decision`) &&
        r.request().method() === 'POST',
    );
    await dialog.getByRole('button', { name: '승인', exact: true }).click();
    const decision = await decided;
    expect(decision.ok(), await bodyOf(decision)).toBe(true);

    const admin = Api.of(context, ADMIN_URL);
    const after = await admin.get<{ status: string }>(`/admin/agencies/${agency.id}`);
    expect(after.status).toBe('APPROVED');
    const me = await applicant.api.get<{ role: string }>('/auth/me');
    expect(me.role).toBe('AGENCY_OWNER');

    // The new 대표 signs in again and gets into the broker console of the approved office.
    const owner = await browser.newContext({ baseURL: WEB_URL });
    await loginAs(owner, applicantEmail);
    const consolePage = await owner.newPage();
    const res = await consolePage.goto('/agent');
    expect(res?.status()).toBe(200);
    await expect(consolePage).toHaveURL(/\/agent\/?$/);
    await expect(consolePage.getByText(name).first()).toBeVisible();
    await owner.close();
    await applicant.dispose();
  });

  test('허위매물 report → admin resolves with 매물 숨김 → listing hidden publicly', async ({
    page,
    context,
    playwright,
  }) => {
    // Report a listing of an agency the other suites do not use (not a1 / a2).
    const a1 = await apiSessionAs(playwright, SEED.ownerA1);
    const a2 = await apiSessionAs(playwright, SEED.ownerA2);
    const skip = new Set([a1.login.agencyId, a2.login.agencyId]);
    await a1.dispose();
    await a2.dispose();
    const reporter = await apiSessionAs(playwright, `${uniq('report')}@e2e.example.invalid`, {
      nickname: '신고자',
    });
    const listings = await findListings(reporter.api, { assetTypes: 'APT' });
    const target = listings.find((l) => !skip.has(l.primaryAgency.id))!;
    expect(target, 'a listing of another seeded agency').toBeTruthy();
    const report = await reporter.api.post<{ id: string }>('/reports', {
      targetType: 'LISTING',
      targetId: target.id,
      reason: 'ALREADY_DEALT',
      detail: 'e2e: 이미 거래가 끝난 매물입니다.',
    });
    await reporter.dispose();

    await page.goto(`/reports/${report.id}`);
    await page.getByRole('button', { name: '조치하기' }).click();
    const dialog = page.getByRole('dialog', { name: '신고 조치' });
    await expect(dialog).toBeVisible();
    await dialog.getByText('매물 숨김', { exact: true }).click();
    await dialog
      .getByLabel('처리 내용')
      .fill('e2e: 중개사무소 확인 결과 거래 완료된 매물이라 숨김 처리');
    const resolved = page.waitForResponse(
      (r) =>
        r.url().includes(`/api/v1/admin/reports/${report.id}`) && r.request().method() !== 'GET',
    );
    await dialog.getByRole('button', { name: '조치 완료' }).click();
    expect((await resolved).ok()).toBe(true);

    const admin = Api.of(context, ADMIN_URL);
    const after = await admin.get<{ status: string }>(`/admin/reports/${report.id}`);
    expect(after.status).toBe('RESOLVED');
    // Hidden listings are gone from the public site.
    const anon = await playwright.request.newContext();
    const r = await anon.get(`${WEB_URL}/api/v1/listings/${target.id}`);
    const publicRes = {
      status: r.status(),
      body: r.status() === 200 ? ((await r.json()) as { status: string }) : null,
    };
    await anon.dispose();
    expect(publicRes.status === 404 || publicRes.body?.status === 'HIDDEN').toBe(true);
  });
});
