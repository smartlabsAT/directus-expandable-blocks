/**
 * Simplified E2E Tests for ExpandableBlocks Extension
 * Focus on working tests first, then expand
 */

import { test, expect } from '@playwright/test';
import { 
  getEditorUser, 
  getAdminUser, 
  getAPIHeaders
} from '../helpers/directus-api';

test.describe('ExpandableBlocks Extension - API Tests', () => {
  
  test('Admin API Token works correctly', async ({ request }) => {
    const adminUser = getAdminUser();
    
    const response = await request.get(`${adminUser.baseURL}/users/me`, {
      headers: getAPIHeaders(adminUser)
    });
    
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    
    expect(data.data).toBeDefined();
    expect(data.data.email).toBeDefined();
    console.log('✅ Admin Token works:', data.data.email, '- Role:', data.data.role?.name || 'N/A');
  });

  test('Editor API Token works correctly', async ({ request }) => {
    const editorUser = getEditorUser();
    
    const response = await request.get(`${editorUser.baseURL}/users/me`, {
      headers: getAPIHeaders(editorUser)
    });
    
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    
    expect(data.data).toBeDefined();
    expect(data.data.email).toBeDefined();
    console.log('✅ Editor Token works:', data.data.email, '- Role:', data.data.role?.name || 'N/A');
  });

  test('Can list collections with Editor token', async ({ request }) => {
    const editorUser = getEditorUser();
    
    const response = await request.get(`${editorUser.baseURL}/collections`, {
      headers: getAPIHeaders(editorUser)
    });
    
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    
    expect(data.data).toBeDefined();
    expect(Array.isArray(data.data)).toBeTruthy();
    
    // Look for common Directus collections
    const collectionNames = data.data.map((col: any) => col.collection);
    const hasDirectusUsers = collectionNames.includes('directus_users');
    const hasDirectusCollections = collectionNames.includes('directus_collections');
    
    // At least one system collection should be visible
    expect(hasDirectusUsers || hasDirectusCollections).toBeTruthy();
    
    console.log('✅ Editor can see', data.data.length, 'collections');
    console.log('Available collections:', collectionNames.slice(0, 10).join(', '));
  });

  test('Can access Directus info endpoint', async ({ request }) => {
    const editorUser = getEditorUser();
    
    const response = await request.get(`${editorUser.baseURL}/server/info`, {
      headers: getAPIHeaders(editorUser)
    });
    
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    
    expect(data.data).toBeDefined();
    expect(data.data.directus).toBeDefined();
    
    console.log('✅ Directus Version:', data.data.directus.version);
    console.log('✅ Node Version:', data.data.node.version);
  });
});

test.describe('ExpandableBlocks Extension - Basic Browser Tests', () => {
  
  test('Can reach Directus login page', async ({ page }) => {
    // Just test if we can reach the Directus instance
    await page.goto('/admin');
    await page.waitForLoadState('networkidle');
    
    // Should either see login page or admin interface
    const title = await page.title();
    
    // Accept both login page and admin interface
    const isDirectusPage = title.includes('Directus') || 
                          title.includes('Smartlabs') || 
                          title.includes('Sign In');
    
    expect(isDirectusPage).toBeTruthy();
    console.log('✅ Reached Directus page with title:', title);
  });

  test('Directus admin interface loads without errors', async ({ page }) => {
    // Monitor console errors
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });
    
    await page.goto('/admin');
    await page.waitForLoadState('networkidle');
    
    // Check for critical JavaScript errors
    const criticalErrors = errors.filter(error => 
      error.includes('Uncaught') || 
      error.includes('TypeError') ||
      error.includes('ReferenceError')
    );
    
    expect(criticalErrors.length).toBe(0);
    console.log('✅ No critical JavaScript errors found');
    
    if (errors.length > 0) {
      console.log('ℹ️ Non-critical console messages:', errors.length);
    }
  });

  test('Can access API endpoint directly via browser', async ({ page }) => {
    const editorUser = getEditorUser();
    
    // Navigate to API endpoint with token as query parameter
    const apiUrl = `${editorUser.baseURL}/users/me?access_token=${editorUser.token}`;
    await page.goto(apiUrl);
    
    // Should get JSON response
    const content = await page.textContent('body');
    expect(content).toBeTruthy();
    
    // Try to parse as JSON
    let jsonData;
    try {
      jsonData = JSON.parse(content!);
      expect(jsonData.data).toBeDefined();
      expect(jsonData.data.email).toBeDefined();
      console.log('✅ API endpoint accessible via browser:', jsonData.data.email);
    } catch (error) {
      console.log('⚠️ Response is not JSON, might be HTML error page');
      console.log('Response content:', content?.substring(0, 200));
      throw new Error('Expected JSON response from API');
    }
  });
});