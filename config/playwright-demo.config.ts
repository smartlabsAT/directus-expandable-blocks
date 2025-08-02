import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '../.env' });

/**
 * Playwright configuration specifically optimized for Demo Videos
 * High quality, slower pace, professional recording settings
 */
export default defineConfig({
  testDir: '../test/demo',
  
  /* Single worker for demo consistency */
  workers: 1,
  
  /* No retries for demos */
  retries: 0,
  
  /* Timeout for demo steps */
  timeout: 60000,
  
  /* Reporter for demo output */
  reporter: [
    ['list'],
    ['html', { outputFolder: '../test-output/demo-results' }]
  ],
  
  /* Demo-optimized settings */
  use: {
    /* Base URL */
    baseURL: `https://${process.env.DIRECTUS_URL}`,

    /* Always record video for demos */
    video: 'on',
    
    /* High quality screenshots */
    screenshot: 'on',
    
    /* Ignore HTTPS errors for development */
    ignoreHTTPSErrors: true,
    
    /* Demo-friendly timing */
    actionTimeout: 10000,
    navigationTimeout: 30000,
    
    /* Slow down for demo visibility */
    slowMo: 1500,
    
    /* High resolution for professional videos */
    viewport: { width: 1920, height: 1080 },
    
    /* Show browser for full demos, headless for highlights */
    headless: process.env.DEMO_HEADLESS === 'true',
    
    /* Enable trace for debugging */
    trace: 'on',
  },

  /* Demo projects - focus on main browsers */
  projects: [
    {
      name: 'demo-chromium',
      use: { 
        ...devices['Desktop Chrome'],
        viewport: { width: 1920, height: 1080 },
        // Chrome-specific settings for best video quality
        launchOptions: {
          args: [
            '--no-sandbox',
            '--disable-web-security',
            '--allow-running-insecure-content',
            '--window-size=1920,1080'
          ]
        }
      },
    },
    
    // Optional: Safari for cross-browser demos
    {
      name: 'demo-webkit',
      use: { 
        ...devices['Desktop Safari'],
        viewport: { width: 1920, height: 1080 }
      },
    },
  ],

  /* Output directories for demo artifacts */
  outputDir: '../test-output/demo-test-results/',
  
  /* Global setup for demo environment */
  globalSetup: '../test/demo/demo-setup.ts',
});