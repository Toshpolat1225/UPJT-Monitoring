import { chromium, FullConfig } from '@playwright/test';
import path from 'path';

export const ADMIN_STORAGE_STATE = path.join(__dirname, '.auth/admin.json');
export const GSM_STORAGE_STATE = path.join(__dirname, '.auth/gsm.json');
export const MASTER_STORAGE_STATE = path.join(__dirname, '.auth/master.json');

async function globalSetup(config: FullConfig) {
  const { baseURL, storageState } = config.projects[0].use;
  const browser = await chromium.launch();
  const page = await browser.newPage();

  const login = async (email: string, pass: string, file: string) => {
    await page.goto(baseURL + '/login');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Parol').fill(pass);
    await page.getByRole('button', { name: 'Kirish' }).click();
    await page.waitForURL(baseURL + '/dashboard');
    await page.context().storageState({ path: file });
  };

  // NOTE: Replace with actual test user credentials from a secure source
  await login('admin@upjt.uz', 'AdminPass123!', ADMIN_STORAGE_STATE);
  await login('gsm@upjt.uz', 'GsmPass123!', GSM_STORAGE_STATE);
  await login('master@upjt.uz', 'MasterPass123!', MASTER_STORAGE_STATE);

  await browser.close();
}

export default globalSetup;