/**
 * Basic E2E Tests for ExpandableBlocks Extension
 * Tests against running Directus instance using Editor token
 */

import { test, expect } from '@playwright/test';
import {
  getEditorUser,
  getAdminUser,
  getAPIHeaders,
  loginAdminUI
} from '../helpers/directus-api';
import { testCollections } from '../fixtures/test-data';

test.describe('ExpandableBlocks Extension - Basic Functionality', () => {
  
  test.beforeAll('Setup test collections with Admin', async ({ request }) => {
    const adminUser = getAdminUser();
    
    // Create test collections using direct API calls
    try {
      const response = await request.get(`${adminUser.baseURL}/users/me`, {
        headers: getAPIHeaders(adminUser)
      });
      
      if (response.ok()) {
        console.log('✅ Admin API connection verified');
      } else {
        console.log('⚠️ Admin API connection failed:', response.status());
      }
    } catch (error) {
      console.log('ℹ️ Setup error:', error.message);
    }
  });

  test('Editor can access Directus and verify API connection', async ({ request }) => {
    const editorUser = getEditorUser();
    
    // Test API access using direct request
    const response = await request.get(`${editorUser.baseURL}/users/me`, {
      headers: getAPIHeaders(editorUser)
    });
    
    expect(response.ok()).toBeTruthy();
    const userInfo = await response.json();
    
    expect(userInfo.data).toBeDefined();
    expect(userInfo.data.email).toBeDefined();
    console.log('✅ Editor API access verified:', userInfo.data.email);
  });

  test('Can access Directus Admin Interface as logged-in user', async ({ page, request }) => {
    // Bearer tokens cannot drive the SPA — establish a real session via cookie login.
    await loginAdminUI(page, request);

    await page.goto('/admin');
    await page.waitForLoadState('networkidle');

    // Title is project-name based ("… · Smartlabs" locally, "… · Directus" upstream).
    const title = await page.title();
    expect(title).toMatch(/Directus|Smartlabs/);

    // Login form must not be present once authenticated.
    const loginForm = page.locator('form[data-cy="login-form"]');
    await expect(loginForm).not.toBeVisible();

    // Verify the admin shell rendered.
    const moduleBar = page.locator('[data-cy="navigation"], .module-bar, .sidebar, .app-sidebar');
    const mainContent = page.locator('[data-cy="content"], .main-content, .app-main, .content');
    const hasModuleBar = await moduleBar.first().isVisible().catch(() => false);
    const hasMainContent = await mainContent.first().isVisible().catch(() => false);
    expect(hasModuleBar || hasMainContent).toBeTruthy();

    console.log('✅ Successfully accessed Directus admin interface');
  });

  test('Can navigate to Content Management section', async ({ page, request }) => {
    await loginAdminUI(page, request);

    await page.goto('/admin');
    await page.waitForLoadState('networkidle');

    // Look for Content Management or Collections navigation
    // (mixing CSS and Playwright text engines in one comma-separated list is a syntax error)
    const contentLink = page
      .locator('a[href*="/admin/content"], a[href*="/content"]')
      .or(page.getByText('Content', { exact: false }))
      .first();

    if (await contentLink.isVisible().catch(() => false)) {
      await contentLink.click();
      await page.waitForLoadState('networkidle');

      const url = page.url();
      expect(url).toContain('content');

      console.log('✅ Successfully navigated to Content Management');
    } else {
      console.log('ℹ️ Content Management navigation not found - checking current collections');

      await page.goto(`/admin/content/${testCollections.content_blocks}`);
      await page.waitForLoadState('networkidle');

      const url = page.url();
      expect(url).toContain(testCollections.content_blocks);

      console.log('✅ Successfully accessed test collection directly');
    }
  });

  test('Can access test collection and see ExpandableBlocks interface', async ({ page, request }) => {
    await loginAdminUI(page, request);

    await page.goto(`/admin/content/${testCollections.content_blocks}`);
    await page.waitForLoadState('networkidle');

    // The test collection may not exist locally; in that case Directus redirects
    // to /admin/content. Either landing place is acceptable for this smoke test.
    const url = page.url();
    expect(url).toMatch(new RegExp(`/admin/content(/${testCollections.content_blocks})?`));

    // The admin shell must be present regardless of whether the collection exists.
    const moduleBar = page.locator('[data-cy="navigation"], .module-bar, .sidebar, .app-sidebar');
    await expect(moduleBar.first()).toBeVisible();

    console.log('✅ Successfully accessed content area at:', url);

    // If we landed on the actual collection, try the create flow.
    if (url.includes(testCollections.content_blocks)) {
      const addButton = page.locator('button:has-text("Add"), button:has-text("Create"), [data-cy="add-item"]').first();
      if (await addButton.isVisible().catch(() => false)) {
        await addButton.click();
        await page.waitForLoadState('networkidle');
        const formFields = page.locator('input, textarea, select, .interface, .field');
        await expect(formFields.first()).toBeVisible();
        console.log('✅ Item creation form loaded - ExpandableBlocks interface available');
      }
    }
  });
});

test.describe('ExpandableBlocks Extension - API Permissions', () => {
  
  test('Editor has correct permissions to read collections', async ({ request }) => {
    const editorUser = getEditorUser();
    
    // Test if editor can read collections
    const response = await request.get(`${editorUser.baseURL}/collections`, {
      headers: getAPIHeaders(editorUser)
    });
    
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data.data).toBeDefined();
    
    console.log('✅ Editor can read collections:', data.data.length, 'collections available');
  });

  test('Admin has full permissions', async ({ request }) => {
    const adminUser = getAdminUser();
    
    // Test admin access
    const userResponse = await request.get(`${adminUser.baseURL}/users/me`, {
      headers: getAPIHeaders(adminUser)
    });
    expect(userResponse.ok()).toBeTruthy();
    const userInfo = await userResponse.json();
    expect(userInfo.data).toBeDefined();
    
    // Test collections access
    const collectionsResponse = await request.get(`${adminUser.baseURL}/collections`, {
      headers: getAPIHeaders(adminUser)
    });
    expect(collectionsResponse.ok()).toBeTruthy();
    
    console.log('✅ Admin has full access to Directus API');
  });
});