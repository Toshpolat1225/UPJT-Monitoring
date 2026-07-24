import { test, expect } from './fixtures/test-fixtures';

test.describe('Master Data CRUD Operations (as Admin)', () => {
  // Use a unique plate number for each test run to avoid conflicts
  const uniquePlateNumber = `01${Math.floor(100 + Math.random() * 900)}TST`;

  test.beforeEach(async ({ adminPage }) => {
    await adminPage.goto('/master-data/vehicles');
  });

  test('should create a new vehicle', async ({ adminPage }) => {
    await adminPage.getByRole('button', { name: 'Yangi avtomobil' }).click();
    
    await adminPage.getByLabel('Davlat raqami').fill(uniquePlateNumber);
    await adminPage.getByLabel('Model').fill('MAN TGS 33.400 Test');
    // This assumes a combobox or select element for fuel type
    await adminPage.getByTestId('fuel-type-select').click();
    await adminPage.getByText('DIESEL').click();
    
    await adminPage.getByRole('button', { name: 'Saqlash' }).click();

    await expect(adminPage.getByText('Muvaffaqiyatli saqlandi')).toBeVisible();
    await expect(adminPage.getByRole('cell', { name: uniquePlateNumber })).toBeVisible();
  });

  test('should edit an existing vehicle', async ({ adminPage }) => {
    // This test depends on the 'create' test. For true independence, it should create its own vehicle.
    await adminPage.locator(`tr:has-text("${uniquePlateNumber}")`).getByRole('button', { name: 'Tahrirlash' }).click();
    
    await adminPage.getByLabel('Model').fill('MAN TGS 41.400 (Updated)');
    await adminPage.getByRole('button', { name: 'Saqlash' }).click();

    await expect(adminPage.getByText('Muvaffaqiyatli yangilandi')).toBeVisible();
    await expect(adminPage.getByRole('cell', { name: 'MAN TGS 41.400 (Updated)' })).toBeVisible();
  });

  test('should delete a vehicle', async ({ adminPage }) => {
    await adminPage.locator(`tr:has-text("${uniquePlateNumber}")`).getByRole('button', { name: "O'chirish" }).click();
    await adminPage.getByRole('button', { name: 'Tasdiqlash' }).click();

    await expect(adminPage.getByText("Muvaffaqiyatli o'chirildi")).toBeVisible();
    await expect(adminPage.getByRole('cell', { name: uniquePlateNumber })).not.toBeVisible();
  });
});