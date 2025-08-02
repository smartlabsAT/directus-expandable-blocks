/**
 * Professional Product Demo for ExpandableBlocks Extension
 * Creates a high-quality video demonstration of key features
 */

import { test, expect } from '@playwright/test';
import { getEditorUser } from '../helpers/directus-api';
import { loginToDirectus } from './login-helper';

test.describe('ExpandableBlocks - Product Demo 🎬', () => {
  
  test('Complete Product Demonstration', async ({ page }) => {
    console.log('🎬 Starting ExpandableBlocks Product Demo...');
    
    const editorUser = getEditorUser();
    
    // === SCENE 1: Landing and Login ===
    console.log('📍 Scene 1: Accessing Directus Admin');
    
    // Login with Admin credentials
    await loginToDirectus(page, {
      email: 'admin@example.com',
      password: 'd1r3ctu5'
    });
    
    // Add a professional pause for video
    await page.waitForTimeout(2000);
    
    // Take a screenshot of the admin interface
    await page.screenshot({ path: 'screenshots/01-admin-dashboard.png', fullPage: true });
    
    // === SCENE 2: Direct Navigation to ExpandableBlocks ===
    console.log('📍 Scene 2: Navigating directly to ExpandableBlocks element');
    
    // Navigate directly to the extra collection item with ExpandableBlocks
    await page.goto('/admin/content/extra/1');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    console.log('✅ Opened extra collection item with ExpandableBlocks');
    await page.screenshot({ path: 'screenshots/02-expandable-blocks-page.png', fullPage: true });
    
    // === SCENE 3: ExpandableBlocks Interface Demo ===
    console.log('📍 Scene 3: Demonstrating ExpandableBlocks Interface');
    
    // Look for the ExpandableBlocks interface
    const expandableBlocksInterface = page.locator('.expandable-blocks-interface, .v-field:has(.expandable-blocks), [class*="expandable-blocks"]').first();
    
    if (await expandableBlocksInterface.isVisible({ timeout: 5000 })) {
      console.log('✅ Found ExpandableBlocks interface!');
      
      // Scroll to the interface if needed
      await expandableBlocksInterface.scrollIntoViewIfNeeded();
      await page.waitForTimeout(1500);
      
      // Take screenshot of the interface
      await page.screenshot({ path: 'screenshots/03-expandable-blocks-interface.png', fullPage: true });
      
      // === SCENE 4: Adding Existing Blocks ===
      console.log('📍 Scene 4: Adding existing content blocks');
      
      // Look for "Add Existing Block" button - try multiple selectors
      const addExistingButton = page.locator('button:has-text("Add Existing Block"), button:has-text("Add Existing"), button:has-text("Add existing"), .add-existing-block, .add-existing-button').first();
      
      if (await addExistingButton.isVisible()) {
        console.log('✅ Found "Add Existing Block" button');
        
        // Hover over the button first
        await addExistingButton.hover();
        await page.waitForTimeout(1000);
        
        // Click the button
        await addExistingButton.click();
        console.log('✅ Clicked "Add Existing Block"');
        
        // Wait for the menu animation to complete
        await page.waitForTimeout(3000);
        
        // Take screenshot to see what happened
        await page.screenshot({ path: 'screenshots/04-after-click.png' });
        
        // Look for the menu/dropdown that appears - wait for it and be very specific
        await page.waitForSelector('.v-menu-content:visible, .dropdown-content:visible', { timeout: 5000 }).catch(() => {
          console.log('Menu selector not found with waitForSelector');
        });
        
        // Try to find the menu that's actually visible on screen
        const blockMenu = page.locator('.v-menu-content:visible, .dropdown-content:visible, [role="menu"]:visible').first();
        
        if (await blockMenu.isVisible()) {
          console.log('✅ Block selection menu opened');
          await page.screenshot({ path: 'screenshots/04-block-selection-menu.png' });
          
          // Debug: List all menu items
          const menuItems = blockMenu.locator('.v-list-item, [role="menuitem"], .menu-item');
          const itemCount = await menuItems.count();
          console.log(`📋 Found ${itemCount} menu items`);
          
          // Look specifically for "Content Headline" option - try various selectors
          const contentHeadlineOption = blockMenu.locator(
            'text="Content Headline", ' +
            'text="content_headline", ' +
            ':has-text("Content Headline"), ' +
            ':has-text("content_headline"), ' +
            '[role="menuitem"]:has-text("Content Headline"), ' +
            '[role="menuitem"]:has-text("content_headline"), ' +
            '.v-list-item:has-text("Content Headline"), ' +
            '.v-list-item:has-text("content_headline")'
          ).first();
          
          if (await contentHeadlineOption.isVisible()) {
            console.log('✅ Found "Content Headline" option');
            
            // Hover over it first
            await contentHeadlineOption.hover();
            await page.waitForTimeout(1000);
            
            // Click on Content Headline
            await contentHeadlineOption.click();
            console.log('✅ Clicked "Content Headline"');
            
            // Wait for drawer to open
            await page.waitForTimeout(3000);
            
            // Check if drawer opened
            const drawer = page.locator('.v-drawer, .drawer, [role="dialog"], .item-selector-drawer').first();
            if (await drawer.isVisible()) {
              console.log('✅ Item selector drawer opened!');
              await page.screenshot({ path: 'screenshots/05-item-selector-drawer.png', fullPage: true });
              
              // Stop here as requested - extended pause to show drawer animation
              console.log('📍 Stopping at drawer view as requested');
              console.log('⏳ Waiting to show drawer animation and content...');
              await page.waitForTimeout(10000); // 10 seconds to show the drawer properly
              
              // Take another screenshot after drawer is fully loaded
              await page.screenshot({ path: 'screenshots/06-drawer-fully-open.png', fullPage: true });
              console.log('✅ Drawer demonstration complete');
            }
          } else {
            console.log('⚠️ "Content Headline" option not found, trying first menu item');
            
            // Try to click the first available option in the menu - avoid navigation links
            const firstOption = blockMenu.locator('.v-list-item:not(:has-text("Skip")), [role="menuitem"]:not(:has-text("Skip")), .menu-item').first();
            
            if (await firstOption.isVisible()) {
              console.log('✅ Found first menu option');
              
              await firstOption.hover();
              await page.waitForTimeout(1000);
              
              await firstOption.click();
              console.log('✅ Clicked first menu option');
              
              // Wait for drawer to open
              await page.waitForTimeout(3000);
              
              // Check if drawer opened
              const drawer = page.locator('.v-drawer, .drawer, [role="dialog"], .item-selector-drawer').first();
              if (await drawer.isVisible()) {
                console.log('✅ Item selector drawer opened!');
                await page.screenshot({ path: 'screenshots/05-item-selector-drawer.png', fullPage: true });
                
                // Extended pause to show drawer animation
                console.log('📍 Stopping at drawer view');
                console.log('⏳ Waiting to show drawer animation and content...');
                await page.waitForTimeout(10000); // 10 seconds to show the drawer properly
                
                // Take another screenshot after drawer is fully loaded
                await page.screenshot({ path: 'screenshots/06-drawer-fully-open.png', fullPage: true });
                console.log('✅ Drawer demonstration complete');
              }
            }
          }
        } else {
          console.log('⚠️ Block selection menu did not appear');
        }
      } else {
        console.log('⚠️ "Add Existing Block" button not found');
      }
      
      // === SCENE 5: Final View ===
      console.log('📍 Scene 5: Final view of the interface');
      
      // Take a final screenshot showing the current state
      await page.screenshot({ path: 'screenshots/07-final-state.png', fullPage: true });
      
    } else {
      console.log('⚠️ ExpandableBlocks interface not found on this page');
      
      // Take a screenshot anyway to see what's on the page
      await page.screenshot({ path: 'screenshots/03-page-content.png', fullPage: true });
    }
    
    // === SCENE 6: Demo Conclusion ===
    console.log('📍 Scene 6: Demo Conclusion');
    
    // Scroll to top for final view
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(2000);
    
    // Final screenshot
    await page.screenshot({ path: 'screenshots/08-demo-complete.png', fullPage: true });
    
    console.log('🎬 Demo recording complete!');
    console.log('📹 Video file will be saved in demo-test-results/');
    console.log('📸 Screenshots saved for presentation materials');
    
    // Keep browser open briefly for final video frames
    await page.waitForTimeout(3000);
  });
  
  test('Feature Highlights Demo', async ({ page }) => {
    console.log('🎬 Starting Feature Highlights Demo...');
    
    const editorUser = getEditorUser();
    
    // Quick feature overview - login first
    await loginToDirectus(page, {
      email: 'admin@example.com', 
      password: 'd1r3ctu5'
    });
    
    // Navigate through key areas quickly
    await page.goto('/admin/content');
    await page.waitForTimeout(2000);
    
    await page.screenshot({ path: 'screenshots/highlights-01-collections.png' });
    
    // Try to access settings or admin areas
    await page.goto('/admin/settings');
    await page.waitForTimeout(2000);
    
    await page.screenshot({ path: 'screenshots/highlights-02-settings.png' });
    
    console.log('🎬 Feature highlights demo complete!');
  });
});