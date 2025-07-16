# Contributing Guide

Thank you for your interest in contributing to Directus Expandable Blocks! This guide will help you get started.

## 🤝 How to Contribute

### Types of Contributions

- **Bug Fixes**: Help us squash bugs
- **Features**: Implement new functionality
- **Documentation**: Improve or translate docs
- **Examples**: Share your use cases
- **Tests**: Increase test coverage
- **Performance**: Optimize the code

### Getting Started

1. **Fork the Repository**
   ```bash
   # Fork on GitHub, then:
   git clone https://github.com/YOUR-USERNAME/directus-expandable-blocks
   cd directus-expandable-blocks
   ```

2. **Create a Branch**
   ```bash
   git checkout -b feature/your-feature-name
   # or
   git checkout -b fix/issue-number
   ```

3. **Install Dependencies**
   ```bash
   npm install
   ```

4. **Start Development**
   ```bash
   npm run dev
   ```

## 📋 Development Process

### 1. Code Standards

- **TypeScript**: Use strict mode
- **Vue 3**: Composition API with `<script setup>`
- **ESLint**: Run `npm run lint`
- **Prettier**: Auto-format on save

### 2. Commit Messages

Follow conventional commits:

```
feat: add accordion mode
fix: resolve drag-and-drop issue in Safari
docs: update installation guide
test: add tests for dirty state detection
perf: optimize large dataset rendering
chore: update dependencies
```

### 3. Testing

**Before submitting:**

```bash
# Run all tests
npm run test
npm run test:e2e

# Check types
npm run typecheck

# Lint code
npm run lint
```

**Add tests for:**
- New features
- Bug fixes
- Edge cases

### 4. Documentation

Update documentation for:
- New features
- API changes
- Configuration options
- Examples

## 🔄 Pull Request Process

### 1. Before Submitting

- [ ] Tests pass (`npm test`)
- [ ] Code is linted (`npm run lint`)
- [ ] Types check (`npm run typecheck`)
- [ ] Documentation updated
- [ ] Changelog entry added

### 2. PR Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Unit tests pass
- [ ] E2E tests pass
- [ ] Manually tested

## Screenshots
(if applicable)

## Related Issues
Fixes #123
```

### 3. Review Process

1. **Automated Checks**: CI runs tests
2. **Code Review**: Maintainer review
3. **Testing**: Manual verification
4. **Merge**: Squash and merge

## 🐛 Reporting Issues

### Bug Reports

Include:
- Directus version
- Extension version
- Browser/OS
- Steps to reproduce
- Expected vs actual behavior
- Error messages
- Screenshots/videos

**Template:**
```markdown
**Environment:**
- Directus: v11.0.0
- Extension: v1.0.6
- Browser: Chrome 120
- OS: macOS 14

**Steps to Reproduce:**
1. Create M2A field
2. Add expandable-blocks interface
3. Try to drag block
4. Error occurs

**Expected:** Block moves
**Actual:** Console error

**Error:**
```
TypeError: Cannot read property...
```
```

### Feature Requests

Include:
- Use case description
- Proposed solution
- Alternative solutions
- Additional context

## 🧪 Testing Guidelines

### Unit Tests

```typescript
// src/utils/helpers.test.ts
import { describe, it, expect } from 'vitest';
import { isBlockDirty } from './helpers';

describe('isBlockDirty', () => {
  it('should detect content changes', () => {
    const original = { title: 'Old' };
    const current = { title: 'New' };
    
    expect(isBlockDirty(original, current)).toBe(true);
  });
});
```

### E2E Tests

```typescript
// tests/e2e/drag-drop.spec.ts
import { test, expect } from '@playwright/test';

test('should reorder blocks via drag and drop', async ({ page }) => {
  // Test implementation
});
```

## 🏗️ Architecture Guidelines

### Component Structure

```typescript
// Follow existing patterns
export function useExpandableBlocks(props, emit) {
  // State
  const items = ref<JunctionRecord[]>([]);
  
  // Computed
  const isDirty = computed(() => /* ... */);
  
  // Methods
  const addBlock = () => { /* ... */ };
  
  // Return public API
  return {
    items,
    isDirty,
    addBlock
  };
}
```

### Type Safety

```typescript
// Always use proper types
interface BlockOperation {
  type: 'add' | 'update' | 'delete';
  blockId: string;
  data?: Partial<ItemRecord>;
}
```

## 🌐 Internationalization

### Adding Translations

1. Create language file:
   ```
   src/locales/de-DE.json
   ```

2. Add translations:
   ```json
   {
     "add_block": "Block hinzufügen",
     "delete_block": "Block löschen",
     "duplicate_block": "Block duplizieren"
   }
   ```

3. Register in index.ts

## 📦 Release Process

Maintainers follow:

1. **Version Bump**
   ```bash
   npm run release:patch  # 1.0.0 → 1.0.1
   npm run release:minor  # 1.0.0 → 1.1.0
   npm run release:major  # 1.0.0 → 2.0.0
   ```

2. **Changelog Update**
3. **GitHub Release**
4. **NPM Publish**

## 💬 Community

- **Discord**: [Join our channel](https://discord.gg/directus-expandable-blocks)
- **GitHub Discussions**: Ask questions
- **Twitter**: [@smartlabsAT](https://twitter.com/smartlabsAT)

## 📜 Code of Conduct

- Be respectful
- Be inclusive
- Be constructive
- Be patient

## 📄 License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

> **Questions?** Open a [Discussion](https://github.com/smartlabsAT/directus-expandable-blocks/discussions) or reach out on Discord!