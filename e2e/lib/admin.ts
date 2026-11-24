import { expect, type Page } from 'playwright/test';
import { freshTotp } from './totp.mjs';
import { readAdminState, recordTotpStep } from './env';

/**
 * Real back-office login: email + password → 2단계 인증 with a TOTP code computed from the
 * secret scripts/e2e-stack.sh enrolled (RFC 6238, e2e/lib/totp.mjs). The API refuses a replayed
 * time step, so the code is always from a step after the last one used.
 */
export async function adminLogin(page: Page): Promise<void> {
  const admin = readAdminState();
  await page.goto('/login');
  await page.getByLabel('이메일').fill(admin.email);
  await page.getByLabel('비밀번호', { exact: true }).fill(admin.password);
  await page.getByRole('button', { name: '다음', exact: true }).click();

  const otp = page.locator('input[autocomplete="one-time-code"]');
  await expect(otp).toBeVisible();
  const { code, step } = await freshTotp(admin.totpSecret, admin.lastUsedStep);
  const verified = page.waitForResponse(
    (r) => r.url().endsWith('/api/v1/admin/auth/totp/verify') && r.request().method() === 'POST',
  );
  await otp.fill(code); // 6 digits → the form submits itself (onComplete)
  const res = await verified;
  recordTotpStep(step);
  expect(res.status(), await res.text()).toBe(200);
  await expect(page).not.toHaveURL(/\/login/);
}
