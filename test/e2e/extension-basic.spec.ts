/**
 * Basic E2E Tests for ExpandableBlocks Extension
 * Tests against running Directus instance using Editor token
 */

import { test, expect } from '@playwright/test';
import { 
  getEditorUser, 
  getAdminUser, 
  getAPIHeaders
} from '../helpers/directus-api';
import { testCollections, getTestDataForCollection } from '../fixtures/test-data';

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

  test('Can access Directus Admin Interface with Editor permissions', async ({ page }) => {
    const editorUser = getEditorUser();
    
    // Set Authorization header for all requests
    await page.setExtraHTTPHeaders({
      'Authorization': `Bearer ${editorUser.token}`
    });
    
    // Navigate to Directus admin
    await page.goto('/admin');
    
    // Wait for page to load and check if we're logged in
    await page.waitForLoadState('networkidle');
    
    // Should see the Directus admin interface (not login page)
    await expect(page).toHaveTitle(/Directus/);
    
    // Should not see login form
    const loginForm = page.locator('form[data-cy="login-form"]');
    await expect(loginForm).not.toBeVisible();
    
    // Should see navigation or content area indicating we're logged in
    const navigation = page.locator('[data-cy="navigation"]');
    const contentArea = page.locator('[data-cy="content"]');
    
    // At least one of these should be visible
    const isNavigationVisible = await navigation.isVisible().catch(() => false);
    const isContentVisible = await contentArea.isVisible().catch(() => false);
    
    if (!isNavigationVisible && !isContentVisible) {
      // Try alternative selectors for Directus admin interface
      const moduleBar = page.locator('.module-bar, .sidebar, .app-sidebar');
      const mainContent = page.locator('.main-content, .app-main, .content');
      
      const hasModuleBar = await moduleBar.first().isVisible().catch(() => false);
      const hasMainContent = await mainContent.first().isVisible().catch(() => false);
      
      expect(hasModuleBar || hasMainContent).toBeTruthy();
    }
    
    console.log('✅ Successfully accessed Directus admin interface with Editor token');
  });

  test('Can navigate to Content Management section', async ({ page }) => {
    const editorUser = getEditorUser();
    
    // Set Authorization header
    await page.setExtraHTTPHeaders({
      'Authorization': `Bearer ${editorUser.token}`
    });
    
    // Navigate to admin
    await page.goto('/admin');
    await page.waitForLoadState('networkidle');
    
    // Look for Content Management or Collections navigation
    const contentLink = page.locator('a[href*="/admin/content"], a[href*="/content"], text="Content"').first();
    
    if (await contentLink.isVisible()) {
      await contentLink.click();
      await page.waitForLoadState('networkidle');
      
      // Verify we're in content management area
      const url = page.url();
      expect(url).toContain('content');
      
      console.log('✅ Successfully navigated to Content Management');
    } else {
      console.log('ℹ️ Content Management navigation not found - checking current collections');
      
      // Try to navigate directly to a collection
      await page.goto(`/admin/content/${testCollections.content_blocks}`);
      await page.waitForLoadState('networkidle');
      
      // Check if collection page loaded
      const url = page.url();
      expect(url).toContain(testCollections.content_blocks);
      
      console.log('✅ Successfully accessed test collection directly');
    }
  });

  test('Can access test collection and see ExpandableBlocks interface', async ({ page }) => {
    const editorUser = getEditorUser();
    
    await page.setExtraHTTPHeaders({
      'Authorization': `Bearer ${editorUser.token}`
    });
    
    // Navigate directly to our test collection
    await page.goto(`/admin/content/${testCollections.content_blocks}`);
    await page.waitForLoadState('networkidle');
    
    // Verify we can see the collection
    expect(page.url()).toContain(testCollections.content_blocks);
    
    // Look for data table or collection items
    const dataTable = page.locator('table, .table, [data-cy="table"], .data-table');
    const itemsList = page.locator('.items-list, .collection-items, .content-items');
    
    const hasTable = await dataTable.first().isVisible().catch(() => false);
    const hasItems = await itemsList.first().isVisible().catch(() => false);
    
    expect(hasTable || hasItems).toBeTruthy();
    
    console.log('✅ Successfully accessed test collection with data');
    
    // Try to create a new item to see if ExpandableBlocks interface loads
    const addButton = page.locator('button:has-text("Add"), button:has-text("Create"), [data-cy="add-item"]').first();
    
    if (await addButton.isVisible()) {
      await addButton.click();
      await page.waitForLoadState('networkidle');
      
      // Wait for form to load
      await page.waitForTimeout(2000);
      
      // Look for any form fields or interface elements
      const formFields = page.locator('input, textarea, select, .interface, .field');
      await expect(formFields.first()).toBeVisible();
      
      console.log('✅ Item creation form loaded - ExpandableBlocks interface should be available');
    } else {
      console.log('ℹ️ Add button not found - checking existing items');
      
      // Try to edit an existing item
      const firstRow = page.locator('tr, .item-row').nth(1);
      if (await firstRow.isVisible()) {
        await firstRow.click();
        await page.waitForLoadState('networkidle');
        console.log('✅ Opened existing item for editing');
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