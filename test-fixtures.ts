import { test as base } from '@playwright/test';
import path from 'path';

export const test = base.extend<{
  storageState: string;
}>({
  storageState: async ({ browser }, use) => {
    // This fixture logs in once and reuses the session for all tests.
    const page = await browser.newPage();
    await page.goto('/login');
    await page.getByLabel('Email').fill('admin@example.com');
    await page.getByLabel('Password').fill('adminpassword');
    await page.getByRole('button', { name: 'Kirish' }).click();
    await page.waitForURL('/');

    const storageStatePath = path.join(__dirname, 'playwright/.auth/admin.json');
    await page.context().storageState({ path: storageStatePath });
    await page.close();
    await use(storageStatePath);
  },
});

export { expect } from '@playwright/test';