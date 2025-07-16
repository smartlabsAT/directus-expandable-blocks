# Technical Architecture

## 📚 Documentation Moved to Wiki

The comprehensive technical architecture documentation has been moved to our GitHub Wiki for better organization and navigation.

### 🔗 Architecture Documentation

Visit the **[GitHub Wiki](https://github.com/smartlabsAT/directus-expandable-blocks/wiki)** for detailed technical documentation:

- **[Architecture Overview](https://github.com/smartlabsAT/directus-expandable-blocks/wiki/04-Architecture-Overview)** - Core concepts, component structure, TypeScript architecture
- **[Data Flow & State Management](https://github.com/smartlabsAT/directus-expandable-blocks/wiki/05-Data-Flow)** - Understanding the M2A challenge, lifecycle, and state management
- **[API Integration](https://github.com/smartlabsAT/directus-expandable-blocks/wiki/06-API-Integration)** - Store architecture, form integration, and reactive updates
- **[Development Guide](https://github.com/smartlabsAT/directus-expandable-blocks/wiki/07-Development)** - Debugging, testing, and best practices

### 🚀 Quick Overview

**Expandable Blocks** is a Vue 3 interface extension for Directus that provides inline editing for M2A (Many-to-Any) relationships. Key architectural decisions:

1. **Native Directus Integration** - Works within Directus' form system, no custom API calls
2. **Two-Component Architecture** - Separation between editing (interface.vue) and display (NestedBlocks.vue)
3. **Smart Dirty State Tracking** - Individual block change detection with position tracking
4. **TypeScript Strict Mode** - Full type safety throughout the codebase
5. **Composable Architecture** - Core logic extracted into reusable composables

For the complete technical documentation, please visit our [Wiki](https://github.com/smartlabsAT/directus-expandable-blocks/wiki).

---

> **Note**: This file serves as a pointer to the comprehensive documentation in the Wiki. The Wiki provides better navigation, search capabilities, and is easier to maintain.