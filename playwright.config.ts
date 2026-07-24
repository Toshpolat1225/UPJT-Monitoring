import { defineConfig, devices } from '@playwright/test';
import path from 'path';
import { ADMIN_STORAGE_STATE, GSM_STORAGE_STATE, MASTER_STORAGE_STATE } from './tests/e2e/global.setup';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',

  // Use the global setup file to handle authentication
  globalSetup: require.resolve('./tests/e2e/global.setup'),

  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5173',
    trace: 'on-first-retry',
  },

  projects: [
    {
      name: 'Unauthenticated',
      use: { ...devices['Desktop Chrome'] },
      testMatch: /auth\.spec\.ts/, // Only run auth tests without being logged in
    },
    {
      name: 'Admin',
      use: { ...devices['Desktop Chrome'], storageState: ADMIN_STORAGE_STATE },
      dependencies: ['Unauthenticated'],
    },
    {
      name: 'GSM',
      use: { ...devices['Desktop Chrome'], storageState: GSM_STORAGE_STATE },
      dependencies: ['Unauthenticated'],
    },
    {
      name: 'Master',
      use: { ...devices['Desktop Chrome'], storageState: MASTER_STORAGE_STATE },
      dependencies: ['Unauthenticated'],
    },
  ],
});