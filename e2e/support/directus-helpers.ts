import { Page, expect } from '@playwright/test';

export class DirectusHelpers {
  constructor(private page: Page) {}

  async login(email = 'admin@example.com', password = 'd1r3ctu5') {
    await this.page.goto('/admin/login');
    await this.page.fill('input[type="email"]', email);
    await this.page.fill('input[type="password"]', password);
    await this.page.click('button[type="submit"]');
    await this.page.waitForURL(/\/admin\/content/);
  }

  async navigateToItem(collection: string, itemId: number | string) {
    await this.page.goto(`/admin/content/${collection}/${itemId}`);
    await this.page.waitForSelector('.v-form', { state: 'visible' });
  }

  async createNewItem(collection: string) {
    await this.page.goto(`/admin/content/${collection}/+`);
    await this.page.waitForSelector('.v-form', { state: 'visible' });
  }

  async saveItem() {
    const saveButton = this.page.locator('button:has-text("Save")');
    await expect(saveButton).toBeEnabled();
    await saveButton.click();
    
    // Wait for save to complete
    await expect(saveButton).toBeDisabled();
    await this.page.waitForTimeout(1000); // Give it time to settle
  }

  async discardChanges() {
    const discardButton = this.page.locator('button:has-text("Discard Changes")');
    await discardButton.click();
    
    // Confirm in dialog if appears
    const confirmButton = this.page.locator('button:has-text("Discard")').last();
    if (await confirmButton.isVisible()) {
      await confirmButton.click();
    }
  }

  async expandBlock(blockIndex: number) {
    const blockHeaders = this.page.locator('.block-header');
    await blockHeaders.nth(blockIndex).click();
    await this.page.waitForTimeout(300); // Animation time
  }

  async addBlock(collectionName?: string) {
    const addButton = this.page.locator('.add-block-button');
    await addButton.click();
    
    if (collectionName) {
      // If multiple collections available, select from menu
      const menuItem = this.page.locator(`text=${collectionName}`);
      if (await menuItem.isVisible()) {
        await menuItem.click();
      }
    }
    
    await this.page.waitForTimeout(500); // Wait for block creation
  }

  async fillBlockField(blockIndex: number, fieldName: string, value: string) {
    // First expand the block
    await this.expandBlock(blockIndex);
    
    // Find the field within the block
    const block = this.page.locator('.block-content').nth(blockIndex);
    const field = block.locator(`input[name="${fieldName}"], textarea[name="${fieldName}"]`).first();
    
    await field.fill(value);
  }

  async deleteBlock(blockIndex: number) {
    // Open more menu
    const moreButtons = this.page.locator('.block-item button:has(svg[name="more_vert"])');
    await moreButtons.nth(blockIndex).click();
    
    // Click delete
    await this.page.locator('text=Delete').click();
    
    // Confirm deletion
    await this.page.locator('.v-dialog button:has-text("Delete")').click();
  }

  async duplicateBlock(blockIndex: number) {
    // Open more menu
    const moreButtons = this.page.locator('.block-item button:has(svg[name="more_vert"])');
    await moreButtons.nth(blockIndex).click();
    
    // Click duplicate
    await this.page.locator('text=Duplicate').click();
    await this.page.waitForTimeout(500); // Wait for duplication
  }

  async dragBlock(fromIndex: number, toIndex: number) {
    const dragHandles = this.page.locator('.drag-handle');
    const fromHandle = dragHandles.nth(fromIndex);
    const toHandle = dragHandles.nth(toIndex);
    
    await fromHandle.hover();
    await this.page.mouse.down();
    await toHandle.hover();
    await this.page.mouse.up();
    
    await this.page.waitForTimeout(300); // Animation time
  }

  async getBlockCount(): Promise<number> {
    const blocks = this.page.locator('.block-item');
    return await blocks.count();
  }

  async getBlockTitle(blockIndex: number): Promise<string> {
    const titles = this.page.locator('.block-title');
    return await titles.nth(blockIndex).textContent() || '';
  }

  async isBlockExpanded(blockIndex: number): Promise<boolean> {
    const blocks = this.page.locator('.block-item');
    const block = blocks.nth(blockIndex);
    const expandedClass = await block.getAttribute('class');
    return expandedClass?.includes('expanded') || false;
  }

  async isSaveButtonActive(): Promise<boolean> {
    const saveButton = this.page.locator('button:has-text("Save")');
    return await saveButton.isEnabled();
  }

  async checkDirtyIndicator(blockIndex: number): Promise<boolean> {
    const blocks = this.page.locator('.block-item');
    const dirtyIndicator = blocks.nth(blockIndex).locator('.dirty-indicator');
    return await dirtyIndicator.isVisible();
  }
}