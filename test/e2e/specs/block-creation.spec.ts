import { test, expect } from '@playwright/test';
import { DirectusHelpers } from '../support/directus-helpers';

test.describe('Block Creation', () => {
  let directus: DirectusHelpers;

  test.beforeEach(async ({ page }) => {
    // Skip all tests in CI environment
    if (process.env.CI || process.env.SKIP_E2E_TESTS) {
      test.skip();
      return;
    }
    
    directus = new DirectusHelpers(page);
    await directus.login();
    
    // Navigate to test page
    await directus.navigateToItem('pages', 9999);
  });

  test('should add a new text block', async ({ page }) => {
    // Get initial block count
    const initialCount = await directus.getBlockCount();
    
    // Add new block
    await directus.addBlock('Content Text');
    
    // Verify block was added
    const newCount = await directus.getBlockCount();
    expect(newCount).toBe(initialCount + 1);
    
    // Check that new block is expanded
    const isExpanded = await directus.isBlockExpanded(newCount - 1);
    expect(isExpanded).toBe(true);
    
    // Fill in block data
    await directus.fillBlockField(newCount - 1, 'title', 'New Test Block');
    await directus.fillBlockField(newCount - 1, 'content', 'This is a new block created via E2E test');
    
    // Save should be enabled
    const saveEnabled = await directus.isSaveButtonActive();
    expect(saveEnabled).toBe(true);
    
    // Save the page
    await directus.saveItem();
    
    // Verify save button is disabled after save
    const saveDisabled = await directus.isSaveButtonActive();
    expect(saveDisabled).toBe(false);
  });

  test('should add multiple blocks of different types', async ({ page }) => {
    const initialCount = await directus.getBlockCount();
    
    // Add text block
    await directus.addBlock('Content Text');
    await directus.fillBlockField(initialCount, 'title', 'Text Block');
    
    // Add image block
    await directus.addBlock('Content Image');
    await directus.fillBlockField(initialCount + 1, 'title', 'Image Block');
    
    // Verify both blocks were added
    const finalCount = await directus.getBlockCount();
    expect(finalCount).toBe(initialCount + 2);
  });

  test('should respect max blocks limit', async ({ page }) => {
    // This test would require setting up a field with maxBlocks option
    // For now, we'll skip implementation
    test.skip();
  });

  test('should show empty state when no blocks', async ({ page }) => {
    // Create a new page
    await directus.createNewItem('pages');
    
    // Fill basic page info
    await page.fill('input[name="title"]', 'Empty Block Test Page');
    await page.fill('input[name="slug"]', 'empty-block-test');
    
    // Check for empty state in blocks field
    const emptyState = page.locator('.empty-state');
    await expect(emptyState).toBeVisible();
    await expect(emptyState).toContainText('No blocks yet');
  });

  test('should handle unsaved parent item', async ({ page }) => {
    // Create new page without saving
    await directus.createNewItem('pages');
    
    // Try to add block
    await page.click('.add-block-button');
    
    // Should show warning
    const notification = page.locator('.v-notice, [role="alert"]');
    await expect(notification).toContainText('save');
  });
});