/**
 * Login helper for Directus browser authentication
 * Uses email/password login to create a real session
 */

import { Page } from '@playwright/test';

export interface DirectusCredentials {
  email: string;
  password: string;
}

/**
 * Login to Directus using the login form
 */
export async function loginToDirectus(page: Page, credentials: DirectusCredentials) {
  console.log('📝 Logging in to Directus with:', credentials.email);
  
  // Navigate to login page
  await page.goto('/admin/login');
  await page.waitForLoadState('networkidle');
  
  // Fill in login form
  await page.fill('input[type="email"]', credentials.email);
  await page.fill('input[type="password"]', credentials.password);
  
  // Submit form
  await page.click('button[type="submit"]');
  
  // Wait for navigation to complete
  await page.waitForLoadState('networkidle');
  
  // Wait for admin interface to load
  await page.waitForSelector('.module-nav, .v-navigation, [class*="navigation"]', { 
    timeout: 10000 
  }).catch(() => {
    console.log('⚠️ Navigation elements not found, checking alternative selectors...');
  });
  
  console.log('✅ Logged in successfully');
  
  // Additional wait to ensure everything is loaded
  await page.waitForTimeout(2000);
}

/**
 * Check if we're logged in
 */
export async function isLoggedIn(page: Page): Promise<boolean> {
  const url = page.url();
  
  // If we're on login page, we're not logged in
  if (url.includes('/login')) {
    return false;
  }
  
  // Check for admin interface elements
  const hasAdminElements = await page.locator('.module-nav, .v-navigation, [class*="navigation"]').count() > 0;
  return hasAdminElements;
}