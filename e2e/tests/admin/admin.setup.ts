import { test as setup } from 'playwright/test';
import { adminLogin } from '../../lib/admin';
import { ADMIN_STORAGE_STATE } from '../../lib/env';

/** Admin login with TOTP through the real UI, once; the admin project reuses the session. */
setup('admin logs in with email, password and TOTP', async ({ page }) => {
  await adminLogin(page);
  await page.context().storageState({ path: ADMIN_STORAGE_STATE });
});
