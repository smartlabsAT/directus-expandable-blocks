import { FullConfig } from '@playwright/test';

async function globalSetup(config: FullConfig) {
  // In CI environment, we'll skip E2E tests for now
  if (process.env.CI) {
    console.log('Running in CI environment - E2E tests will be skipped');
    // Set an environment variable that tests can check
    process.env.SKIP_E2E_TESTS = 'true';
  }
}

export default globalSetup;