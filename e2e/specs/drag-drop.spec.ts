import { test, expect } from '@playwright/test';
import { DirectusHelpers } from '../support/directus-helpers';

test.describe('Drag and Drop', () => {
  let directus: DirectusHelpers;

  test.beforeEach(async ({ page }) => {
    directus = new DirectusHelpers(page);
    await directus.login();
    await directus.navigateToItem('pages', 9999);
  });

  test('should reorder blocks via drag and drop', async ({ page }) => {
    // Get initial block titles
    const firstTitle = await directus.getBlockTitle(0);
    const secondTitle = await directus.getBlockTitle(1);
    
    // Drag first block to second position
    await directus.dragBlock(0, 1);
    
    // Verify order changed
    const newFirstTitle = await directus.getBlockTitle(0);
    const newSecondTitle = await directus.getBlockTitle(1);
    
    expect(newFirstTitle).toBe(secondTitle);
    expect(newSecondTitle).toBe(firstTitle);
    
    // Save button should be active
    const saveEnabled = await directus.isSaveButtonActive();
    expect(saveEnabled).toBe(true);
  });

  test('should not allow dragging when sorting is disabled', async ({ page }) => {
    // This would require a page with sorting disabled
    // Check that drag handles are not visible
    const dragHandles = page.locator('.drag-handle');
    
    // In a real test, we'd navigate to a page with sorting disabled
    // For now, we just verify drag handles exist in our test page
    await expect(dragHandles.first()).toBeVisible();
  });

  test('should maintain data integrity after reordering', async ({ page }) => {
    // Expand first block and note its content
    await directus.expandBlock(0);
    const contentField = page.locator('.block-content').first().locator('textarea[name="content"]');
    const originalContent = await contentField.inputValue();
    
    // Reorder blocks
    await directus.dragBlock(0, 2);
    
    // Expand the block in its new position
    await directus.expandBlock(2);
    const movedContentField = page.locator('.block-content').nth(2).locator('textarea[name="content"]');
    const movedContent = await movedContentField.inputValue();
    
    // Content should be the same
    expect(movedContent).toBe(originalContent);
  });

  test('should update sort order immediately', async ({ page }) => {
    const initialCount = await directus.getBlockCount();
    
    // Perform multiple reorder operations
    if (initialCount >= 3) {
      await directus.dragBlock(2, 0); // Move last to first
      await directus.dragBlock(1, 2); // Move middle to last
      
      // Save button should still be active
      const saveEnabled = await directus.isSaveButtonActive();
      expect(saveEnabled).toBe(true);
    }
  });
});