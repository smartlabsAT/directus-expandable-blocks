# Directus Expandable Blocks Interface

A powerful M2A (Many-to-Any) interface for Directus with inline expandable editing.

## ✨ Features

### Core Interface
- **Inline Expandable Editing**: Edit block content directly without opening separate forms
- **Drag & Drop Sorting**: Reorder blocks with intuitive drag-and-drop
- **Status Management**: Quick status changes with visual indicators
- **Dirty State Tracking**: Visual feedback for unsaved changes
- **Compact & Full View Modes**: Adaptive display options
- **Keyboard Navigation**: Full keyboard support

### Advanced Functionality
- **Nested M2A Support**: Handle complex nested relationships
- **Custom Field Filtering**: Show only specific fields in edit mode
- **Template System**: Pre-configured content templates
- **Status Management**: Built-in content status workflows

### Configuration Options
- Enable/disable sorting
- Show/hide item IDs
- Accordion mode (one block expanded at a time)
- Compact display mode
- Maximum block limits
- Custom field filtering

## 📦 Installation

### Via NPM (Recommended)

```bash
npm install directus-extension-expandable-blocks
```

### Manual Installation

1. Download the latest release
2. Extract to your Directus `extensions/interfaces/` directory
3. Restart Directus

## 🚀 Usage

### Basic Setup

1. Create an M2A field in your collection
2. Set the interface to "Expandable Blocks"
3. Configure your allowed collections
4. Customize options as needed


### Example M2A Structure

```yaml
Page Collection:
  - id
  - title
  - content_blocks (M2A field)

Block Collections:
  - content_text: { headline, subheadline, content }
  - content_hero: { headline, subheadline, button_text, image }
  - content_cta: { title, description, button_text, button_link }
```

## ⚙️ Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `enableSorting` | boolean | `true` | Allow drag & drop reordering |
| `showItemId` | boolean | `true` | Display item IDs in headers |
| `startExpanded` | boolean | `false` | Start with all blocks expanded |
| `accordionMode` | boolean | `false` | Only one block expanded at a time |
| `compactMode` | boolean | `false` | Use compact display |
| `maxBlocks` | number | `null` | Maximum number of blocks |
| `isAllowedDelete` | boolean | `true` | Allow block deletion |
| `isAllowedDuplicate` | boolean | `true` | Allow block duplication |


## 🧪 Testing

The extension includes comprehensive test coverage:

```bash
# Unit tests
npm run test

# E2E tests  
npm run test:e2e

# Test coverage
npm run test:coverage

# Watch mode
npm run dev
```

## 📝 Development

```bash
# Install dependencies
npm install

# Development build with watching
npm run dev

# Production build
npm run build

# Link for local development
npm run link
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Ensure all tests pass
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details

## 🐛 Issues & Support

Report issues on [GitHub](https://github.com/smartlabsAT/directus-expandable-blocks/issues) Issues

## 🔄 Changelog

### v1.0.0
- Initial release
- Inline expandable editing for M2A fields
- Drag & drop sorting with visual feedback
- Status management with visual indicators
- Comprehensive testing suite
- Full TypeScript support

---

Made with ❤️ for the Directus community