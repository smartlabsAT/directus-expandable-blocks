# Testing Strategy

Comprehensive testing guide for the Expandable Blocks extension.

## 🧪 Testing Overview

### Test Structure

```
tests/
├── unit/                    # Unit tests
│   ├── composables/        # Composable tests
│   ├── utils/              # Utility tests
│   └── components/         # Component tests
├── e2e/                    # End-to-end tests
│   ├── basic.spec.ts       # Basic functionality
│   ├── drag-drop.spec.ts  # Drag & drop tests
│   └── permissions.spec.ts # Permission tests
└── fixtures/               # Test data
```

## 📦 Unit Testing

### Setup

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts']
  }
});
```

### Testing Composables

```typescript
// useExpandableBlocks.test.ts
import { describe, it, expect, vi } from 'vitest';
import { useExpandableBlocks } from '@/composables/useExpandableBlocks';

describe('useExpandableBlocks', () => {
  it('should initialize with empty blocks', () => {
    const props = { value: null };
    const emit = vi.fn();
    
    const { items } = useExpandableBlocks(props, emit);
    
    expect(items.value).toEqual([]);
  });
  
  it('should detect dirty state on content change', () => {
    const props = { value: [/* test data */] };
    const emit = vi.fn();
    
    const { isDirty, updateBlock } = useExpandableBlocks(props, emit);
    
    expect(isDirty.value).toBe(false);
    
    updateBlock('1', { title: 'New Title' });
    
    expect(isDirty.value).toBe(true);
    expect(emit).toHaveBeenCalled();
  });
});
```

### Testing Utilities

```typescript
// m2a-helper.test.ts
describe('M2A Helper', () => {
  it('should extract M2A structure correctly', () => {
    const relationInfo = {
      meta: {
        one_collection_field: 'collection',
        one_deselect_action: 'nullify'
      }
    };
    
    const result = extractM2AStructure('pages', 'blocks', relationInfo);
    
    expect(result).toEqual({
      junctionCollection: 'pages_blocks',
      junctionField: 'pages_id',
      collectionField: 'collection',
      itemField: 'blocks_id'
    });
  });
  
  it('should handle missing relations gracefully', () => {
    const result = extractM2AStructure('pages', 'blocks', null);
    
    expect(result).toBeNull();
  });
});
```

### Component Testing

```typescript
// NestedBlocks.test.ts
import { mount } from '@vue/test-utils';
import NestedBlocks from '@/components/NestedBlocks.vue';

describe('NestedBlocks', () => {
  it('renders blocks correctly', async () => {
    const wrapper = mount(NestedBlocks, {
      props: {
        items: [
          { id: 1, collection: 'text', item: { title: 'Test' } }
        ]
      }
    });
    
    expect(wrapper.find('.nested-block').exists()).toBe(true);
    expect(wrapper.text()).toContain('Test');
  });
  
  it('handles expansion correctly', async () => {
    const wrapper = mount(NestedBlocks, {
      props: {
        items: [/* test data */],
        startExpanded: false
      }
    });
    
    expect(wrapper.find('.block-content').exists()).toBe(false);
    
    await wrapper.find('.expand-button').trigger('click');
    
    expect(wrapper.find('.block-content').exists()).toBe(true);
  });
});
```

## 🌐 E2E Testing

### Playwright Setup

```typescript
// playwright.config.ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  use: {
    baseURL: 'http://localhost:8055',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
  ],
});
```

### Basic Functionality Tests

```typescript
// basic.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Expandable Blocks Basic', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/admin/content/pages/1');
    await page.waitForSelector('.expandable-blocks');
  });
  
  test('should add new block', async ({ page }) => {
    await page.click('[data-test="add-block-button"]');
    await page.click('[data-test="collection-content_text"]');
    
    const blocks = page.locator('.expandable-block');
    await expect(blocks).toHaveCount(1);
  });
  
  test('should edit block content', async ({ page }) => {
    await page.click('.expand-button');
    await page.fill('input[name="title"]', 'New Title');
    
    await expect(page.locator('.save-button')).toBeEnabled();
  });
});
```

### Drag & Drop Tests

```typescript
// drag-drop.spec.ts
test('should reorder blocks', async ({ page }) => {
  // Add multiple blocks
  await addBlock(page, 'content_text');
  await addBlock(page, 'content_image');
  
  // Get initial order
  const firstBlock = page.locator('.expandable-block').first();
  const initialText = await firstBlock.textContent();
  
  // Drag first block to second position
  await page.dragAndDrop(
    '.expandable-block:first-child .drag-handle',
    '.expandable-block:last-child'
  );
  
  // Verify order changed
  const newFirstBlock = page.locator('.expandable-block').first();
  const newText = await newFirstBlock.textContent();
  
  expect(newText).not.toBe(initialText);
});
```

### Permission Tests

```typescript
// permissions.spec.ts
test('should respect delete permissions', async ({ page }) => {
  // Login as limited user
  await loginAs(page, 'editor');
  
  await page.goto('/admin/content/pages/1');
  
  // Delete button should be hidden
  await expect(page.locator('.delete-button')).toBeHidden();
});
```

## 🎯 Key Testing Scenarios

### 1. State Management

```typescript
describe('State Management', () => {
  test('dirty state detection', () => {
    // Test content changes
    // Test position changes
    // Test combined changes
  });
  
  test('save and reset', () => {
    // Test save detection
    // Test state reset after save
    // Test original state updates
  });
});
```

### 2. Data Integrity

```typescript
describe('Data Integrity', () => {
  test('maintains junction IDs', () => {
    // Verify IDs preserved
    // Check foreign keys
  });
  
  test('handles missing data', () => {
    // Test null items
    // Test invalid collections
  });
});
```

### 3. Performance

```typescript
describe('Performance', () => {
  test('handles large datasets', () => {
    const largeDataset = generateBlocks(1000);
    // Test render time
    // Test memory usage
  });
  
  test('efficient updates', () => {
    // Test selective emitting
    // Test minimal re-renders
  });
});
```

## 🔍 Debugging Tests

### Visual Debugging

```typescript
// Use Playwright's UI mode
npm run test:e2e:ui

// Take screenshots on failure
test.afterEach(async ({ page }, testInfo) => {
  if (testInfo.status !== 'passed') {
    await page.screenshot({ 
      path: `screenshots/${testInfo.title}.png` 
    });
  }
});
```

### Console Logging

```typescript
// Capture console logs
page.on('console', msg => {
  console.log(`Browser: ${msg.text()}`);
});

// Check for errors
page.on('pageerror', error => {
  expect(error).toBeNull();
});
```

## 📊 Coverage Goals

### Target Coverage

- **Statements**: > 80%
- **Branches**: > 75%
- **Functions**: > 80%
- **Lines**: > 80%

### Critical Paths

Must have 100% coverage:
- Dirty state detection
- Save/discard logic
- Permission checks
- Data transformation

### Run Coverage

```bash
npm run test:coverage

# Generate HTML report
npm run test:coverage -- --reporter=html
```

## 🏆 Best Practices

### 1. Test Organization

```typescript
// Group related tests
describe('Feature: Drag and Drop', () => {
  describe('when sorting enabled', () => {
    // Tests
  });
  
  describe('when sorting disabled', () => {
    // Tests
  });
});
```

### 2. Test Data

```typescript
// Use factories
function createBlock(overrides = {}) {
  return {
    id: 1,
    collection: 'content_text',
    item: { title: 'Test' },
    sort: 0,
    ...overrides
  };
}
```

### 3. Async Testing

```typescript
// Always await async operations
test('async operations', async () => {
  const result = await loadBlockData('123');
  expect(result).toBeDefined();
});
```

### 4. Cleanup

```typescript
// Clean up after tests
afterEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});
```

---

> **Related**: [[Development|07-Development]] | [[Contributing|09-Contributing]]