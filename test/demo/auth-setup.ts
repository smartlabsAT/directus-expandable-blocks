/**
 * Authentication setup for Directus in Playwright tests
 * Handles static token authentication and storage state
 */

import { Page, BrowserContext } from '@playwright/test';
import { DirectusUser } from '../helpers/directus-api';

/**
 * Authenticate with Directus using a static token
 * This sets the token in localStorage to persist authentication
 */
export async function authenticateWithToken(page: Page, user: DirectusUser) {
  // First navigate to the base URL
  await page.goto(user.baseURL);
  
  // Set the static token in localStorage
  // Directus looks for this in localStorage
  await page.evaluate((token) => {
    // Try multiple possible storage keys that Directus might use
    localStorage.setItem('directus-access-token', token);
    localStorage.setItem('directus-token', token);
    localStorage.setItem('auth-token', token);
    
    // Also try setting it as a directus_session_token cookie
    document.cookie = `directus_session_token=${token}; path=/; SameSite=Lax`;
  }, user.token);
  
  // Now navigate to admin with the token
  await page.goto(`/admin?access_token=${user.token}`);
  await page.waitForLoadState('networkidle');
  
  // Wait a bit to ensure authentication is processed
  await page.waitForTimeout(2000);
}

/**
 * Save authentication state for reuse
 */
export async function saveAuthState(context: BrowserContext, path: string) {
  await context.storageState({ path });
}

/**
 * Create a new context with saved authentication
 */
export async function createAuthenticatedContext(browser: any, statePath: string) {
  return await browser.newContext({
    storageState: statePath,
    ignoreHTTPSErrors: true
  });
}