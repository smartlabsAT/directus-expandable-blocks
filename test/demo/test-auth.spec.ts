/**
 * Test different authentication methods to find what works
 */

import { test, expect } from '@playwright/test';
import { getEditorUser } from '../helpers/directus-api';

test.describe('Authentication Tests', () => {
  
  test('Method 1: Direct URL with access_token', async ({ page }) => {
    const editorUser = getEditorUser();
    
    console.log('Testing direct URL with access_token...');
    await page.goto(`/admin?access_token=${editorUser.token}`);
    await page.waitForLoadState('networkidle');
    
    // Check if we're on login page or admin
    const url = page.url();
    console.log('Current URL:', url);
    
    // Take screenshot
    await page.screenshot({ path: 'test-auth-method1.png' });
    
    // Try to find login form or admin elements
    const hasLoginForm = await page.locator('input[type="email"], input[type="password"]').count() > 0;
    const hasAdminElements = await page.locator('.module-nav, .v-navigation, [data-v-navigation]').count() > 0;
    
    console.log('Has login form:', hasLoginForm);
    console.log('Has admin elements:', hasAdminElements);
    
    expect(hasAdminElements).toBeTruthy();
  });
  
  test('Method 2: Set cookie before navigation', async ({ page, context }) => {
    const editorUser = getEditorUser();
    
    console.log('Testing cookie-based authentication...');
    
    // Set cookie before navigation
    await context.addCookies([{
      name: 'directus_session_token',
      value: editorUser.token,
      domain: new URL(editorUser.baseURL).hostname,
      path: '/',
      httpOnly: true,
      secure: true,
      sameSite: 'Lax'
    }]);
    
    await page.goto('/admin');
    await page.waitForLoadState('networkidle');
    
    const url = page.url();
    console.log('Current URL:', url);
    
    await page.screenshot({ path: 'test-auth-method2.png' });
  });
  
  test('Method 3: API login first, then navigate', async ({ page, request }) => {
    const editorUser = getEditorUser();
    
    console.log('Testing API login + navigation...');
    
    // First, check if we can get user info with the token
    const userResponse = await request.get(`${editorUser.baseURL}/users/me`, {
      headers: {
        'Authorization': `Bearer ${editorUser.token}`
      }
    });
    
    if (userResponse.ok()) {
      const userData = await userResponse.json();
      console.log('Token is valid for user:', userData.data.email);
    }
    
    // Now try to navigate with the token
    await page.goto(`/admin?access_token=${editorUser.token}`);
    await page.waitForTimeout(3000); // Give it more time
    
    const url = page.url();
    console.log('Current URL after wait:', url);
    
    await page.screenshot({ path: 'test-auth-method3.png' });
  });
});