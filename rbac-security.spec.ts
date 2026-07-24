import { test, expect } from './fixtures/test-fixtures';

test.describe('RBAC - Role Based Access Control', () => {
  
  test('a MASTER role should be forbidden from accessing admin user settings', async ({ masterPage }) => {
    await masterPage.goto('/admin/users');

    // The user should either see a 403 Forbidden page or be redirected to the dashboard.
    const isForbidden = await masterPage.getByText('Ushbu sahifaga kirish uchun huquqingiz yetarli emas (403)').isVisible();
    const isOnDashboard = (await masterPage.url()).endsWith('/dashboard');

    expect(isForbidden || isOnDashboard).toBeTruthy();
  });

  test('a GSM role should not see the admin user settings page', async ({ gsmPage }) => {
    await gsmPage.goto('/admin/users');
    await expect(gsmPage.getByText('Ushbu sahifaga kirish uchun huquqingiz yetarli emas (403)')).toBeVisible();
  });
});