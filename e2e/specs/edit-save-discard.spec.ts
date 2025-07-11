import { test, expect } from '@playwright/test';
import { DirectusHelpers } from '../support/directus-helpers';

test.describe('Edit, Save, and Discard', () => {
  let directus: DirectusHelpers;

  test.beforeEach(async ({ page }) => {
    directus = new DirectusHelpers(page);
    await directus.login();
    await directus.navigateToItem('pages', 9999);
  });

  test('should track dirty state correctly', async ({ page }) => {
    // Initially save button should be disabled
    let saveEnabled = await directus.isSaveButtonActive();
    expect(saveEnabled).toBe(false);
    
    // Edit a block
    await directus.fillBlockField(0, 'title', 'Modified Title');
    
    // Save button should now be enabled
    saveEnabled = await directus.isSaveButtonActive();
    expect(saveEnabled).toBe(true);
    
    // Dirty indicator should be visible
    const hasDirtyIndicator = await directus.checkDirtyIndicator(0);
    expect(hasDirtyIndicator).toBe(true);
  });

  test('should save changes correctly', async ({ page }) => {
    // Make changes
    const newTitle = 'Updated Test Title ' + Date.now();
    await directus.fillBlockField(0, 'title', newTitle);
    
    // Save
    await directus.saveItem();
    
    // Reload page
    await page.reload();
    await page.waitForSelector('.block-item');
    
    // Verify saved title
    const savedTitle = await directus.getBlockTitle(0);
    expect(savedTitle).toBe(newTitle);
  });

  test('should discard individual block changes', async ({ page }) => {
    // Get original title
    const originalTitle = await directus.getBlockTitle(0);
    
    // Make changes
    await directus.fillBlockField(0, 'title', 'Temporary Change');
    
    // Open more menu and discard
    const moreButton = page.locator('.block-item').first().locator('button:has(svg[name="more_vert"])');
    await moreButton.click();
    await page.locator('text=Discard Changes').click();
    
    // Title should revert
    const revertedTitle = await directus.getBlockTitle(0);
    expect(revertedTitle).toBe(originalTitle);
    
    // Save button should be disabled
    const saveEnabled = await directus.isSaveButtonActive();
    expect(saveEnabled).toBe(false);
  });

  test('should handle global discard all changes', async ({ page }) => {
    // Make changes to multiple blocks
    await directus.fillBlockField(0, 'title', 'Changed Block 1');
    await directus.fillBlockField(1, 'title', 'Changed Block 2');
    
    // Both blocks should show dirty indicators
    let dirty1 = await directus.checkDirtyIndicator(0);
    let dirty2 = await directus.checkDirtyIndicator(1);
    expect(dirty1).toBe(true);
    expect(dirty2).toBe(true);
    
    // Global discard
    await directus.discardChanges();
    
    // Dirty indicators should be gone
    dirty1 = await directus.checkDirtyIndicator(0);
    dirty2 = await directus.checkDirtyIndicator(1);
    expect(dirty1).toBe(false);
    expect(dirty2).toBe(false);
    
    // Save button should be disabled
    const saveEnabled = await directus.isSaveButtonActive();
    expect(saveEnabled).toBe(false);
  });

  test('should keep blocks expanded after save', async ({ page }) => {
    // Expand multiple blocks
    await directus.expandBlock(0);
    await directus.expandBlock(1);
    
    // Make a change
    await directus.fillBlockField(0, 'title', 'Test Expansion Persistence');
    
    // Save
    await directus.saveItem();
    
    // Blocks should still be expanded
    const expanded1 = await directus.isBlockExpanded(0);
    const expanded2 = await directus.isBlockExpanded(1);
    expect(expanded1).toBe(true);
    expect(expanded2).toBe(true);
  });

  test('should keep blocks expanded after discard', async ({ page }) => {
    // Expand blocks
    await directus.expandBlock(0);
    await directus.expandBlock(1);
    
    // Make changes
    await directus.fillBlockField(0, 'title', 'Temporary Change');
    
    // Discard
    await directus.discardChanges();
    
    // Blocks should still be expanded
    const expanded1 = await directus.isBlockExpanded(0);
    const expanded2 = await directus.isBlockExpanded(1);
    expect(expanded1).toBe(true);
    expect(expanded2).toBe(true);
  });

  test('should handle mixed clean and dirty blocks', async ({ page }) => {
    // Edit only the second block
    await directus.fillBlockField(1, 'title', 'Only This Block Changed');
    
    // Only second block should show dirty indicator
    const dirty1 = await directus.checkDirtyIndicator(0);
    const dirty2 = await directus.checkDirtyIndicator(1);
    expect(dirty1).toBe(false);
    expect(dirty2).toBe(true);
    
    // Save and verify
    await directus.saveItem();
    
    // No blocks should be dirty after save
    const postSaveDirty1 = await directus.checkDirtyIndicator(0);
    const postSaveDirty2 = await directus.checkDirtyIndicator(1);
    expect(postSaveDirty1).toBe(false);
    expect(postSaveDirty2).toBe(false);
  });
});