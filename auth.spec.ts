import { test, expect } from './fixtures/test-fixtures';

test.describe('Authentication and Authorization', () => {
  test('should show an error for invalid credentials', async ({ page }) => {
    await page.goto('/login');

    await page.getByLabel('Email').fill('wrong@example.com');
    await page.getByLabel('Password').fill('wrongpassword');
    await page.getByRole('button', { name: 'Kirish' }).click();

    // Assuming the API returns a specific message for invalid credentials
    await expect(page.getByText('Incorrect username or password')).toBeVisible();
  });

  test('should allow a user to log in and then log out', async ({ browser }) => {
    // Use a new context to ensure a clean session
    const page = await browser.newPage();
    await page.goto('/login');

    // Successful login
    await page.getByLabel('Email').fill('admin@example.com');
    await page.getByLabel('Password').fill('adminpassword');
    await page.getByRole('button', { name: 'Kirish' }).click();
    await expect(page.getByRole('heading', { name: 'Boshqaruv paneli' })).toBeVisible();

    // Logout
    // This assumes a logout button is available, perhaps in a user dropdown menu
    await page.getByTestId('user-menu-button').click();
    await page.getByRole('menuitem', { name: 'Chiqish' }).click();
    
    // Verify user is redirected to the login page
    await expect(page).toHaveURL('/login');
    await expect(page.getByRole('button', { name: 'Kirish' })).toBeVisible();
  });
});