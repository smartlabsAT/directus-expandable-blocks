# Directus Expandable Blocks Interface

A powerful M2A (Many-to-Any) interface for Directus with inline expandable editing and AI-powered content generation.

## ✨ Features

### Core Interface
- **Inline Expandable Editing**: Edit block content directly without opening separate forms
- **Drag & Drop Sorting**: Reorder blocks with intuitive drag-and-drop
- **Status Management**: Quick status changes with visual indicators
- **Dirty State Tracking**: Visual feedback for unsaved changes
- **Compact & Full View Modes**: Adaptive display options
- **Keyboard Navigation**: Full keyboard support

### Advanced Functionality
- **AI Content Generation**: Generate content using OpenAI GPT, Claude, or custom APIs
- **Multi-Field Selection**: Target specific fields for AI operations
- **Content Improvement**: Grammar, style, clarity, and SEO optimization
- **Translation Support**: Multi-language content translation
- **Template System**: Pre-configured content templates
- **Field-Specific Targeting**: Generate content for selected fields only

### Configuration Options
- Enable/disable sorting
- Show/hide item IDs
- Accordion mode (one block expanded at a time)
- Compact display mode
- Maximum block limits
- Custom field filtering
- AI provider configuration

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

### AI Configuration (Optional)

1. Enable AI Assistant in interface options
2. Choose provider (OpenAI, Claude, or Custom)
3. Add your API key
4. Configure model and parameters

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
| `enableAI` | boolean | `false` | Enable AI features |
| `aiProvider` | string | `'openai'` | AI provider (openai/claude/custom) |
| `aiApiKey` | string | `''` | API key for AI provider |
| `aiModel` | string | `'gpt-3.5-turbo'` | AI model to use |

## 🤖 AI Features

### Supported Providers
- **OpenAI**: GPT-3.5, GPT-4, GPT-4 Turbo, GPT-4o
- **Anthropic**: Claude 3 Haiku, Sonnet, Opus, Claude 3.5 Sonnet
- **Custom APIs**: Any OpenAI-compatible API

### AI Capabilities
- **Content Generation**: Create new content based on prompts
- **Content Improvement**: Grammar, style, clarity, tone, SEO
- **Translation**: Multi-language translation
- **Field Selection**: Target specific fields for AI operations
- **Context Awareness**: Uses page and block context for better results

### Usage Tips
- Select specific fields to generate targeted content
- Use descriptive prompts for better AI results
- The AI considers page context and surrounding blocks
- Generated content respects your brand voice and style

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

Report issues on [GitHub Issues](https://github.com/yourusername/directus-extension-expandable-blocks/issues)

## 🔄 Changelog

### v1.0.0
- Initial release
- Inline expandable editing
- AI content generation
- Multi-field selection
- Comprehensive testing suite
- Full TypeScript support

---

Made with ❤️ for the Directus community