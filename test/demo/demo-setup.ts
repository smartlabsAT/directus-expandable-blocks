/**
 * Global setup for demo recordings
 * Prepares environment for professional demo videos
 */

import { chromium, FullConfig } from '@playwright/test';
import { getAdminUser, getAPIHeaders } from '../helpers/directus-api';

async function globalSetup(_config: FullConfig) {
  console.log('🎬 Setting up demo environment...');
  
  const adminUser = getAdminUser();
  
  // Launch browser for setup
  const browser = await chromium.launch();
  const context = await browser.newContext({
    ignoreHTTPSErrors: true
  });
  
  try {
    // Test API connection
    const response = await context.request.get(`${adminUser.baseURL}/users/me`, {
      headers: getAPIHeaders(adminUser)
    });
    
    if (response.ok()) {
      const userData = await response.json();
      console.log('✅ Demo environment ready');
      console.log(`✅ Admin user: ${userData.data.email}`);
      console.log(`✅ Directus URL: ${adminUser.baseURL}`);
    } else {
      console.log('⚠️ Warning: API connection failed');
    }
    
    // Optional: Pre-create demo content if needed
    // This is where you could set up specific demo data
    
  } catch (error) {
    console.log('ℹ️ Setup info:', error.message);
  } finally {
    await context.close();
    await browser.close();
  }
  
  console.log('🎬 Demo environment setup complete!\n');
}

export default globalSetup;