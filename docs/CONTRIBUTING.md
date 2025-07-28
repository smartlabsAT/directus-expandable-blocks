# Contributing to Directus Expandable Blocks

Thank you for your interest in contributing to the Directus Expandable Blocks extension! 🎉

## 🚀 Quick Start

1. **Fork** the repository
2. **Clone** your fork: `git clone https://github.com/your-username/directus-expandable-blocks.git`
3. **Install** dependencies: `pnpm install` (we use pnpm for package management)
4. **Start** development: `npm run dev` (automatic rebuild watcher)
5. **Test** your changes: `npm run test -- --run`

## 🌟 Ways to Contribute

### 🐛 Bug Reports
Found a bug? Help us fix it!
- Use our [Bug Report Template](https://github.com/smartlabsAT/directus-expandable-blocks/issues/new?template=bug_report.md)
- Include steps to reproduce
- Provide your environment details
- Add screenshots if applicable

### 💡 Feature Requests
Have an idea? We'd love to hear it!
- Use our [Feature Request Template](https://github.com/smartlabsAT/directus-expandable-blocks/issues/new?template=feature_request.md)
- Explain the use case
- Describe the expected behavior
- Consider implementation complexity

### 🔧 Code Contributions
Ready to code? Here's how:

#### Development Setup
```bash
# Clone the repository
git clone https://github.com/smartlabsAT/directus-expandable-blocks.git
cd directus-expandable-blocks

# Install dependencies (we use pnpm)
pnpm install

# Start development server (automatic rebuild watcher)
npm run dev

# Run tests (use --run to avoid watch mode)
npm run test -- --run

# Build the extension (required for API testing)
npm run build

# Type checking
npm run type-check
```

#### Branch Strategy
- **main**: Stable release branch
- **develop**: Active development branch
- **feature/your-feature**: Your feature branch
- **hotfix/issue-number**: Critical bug fixes

#### Coding Standards
- **TypeScript**: All code must be typed (strict mode)
- **Logging**: Use the logger wrapper, NEVER console.log directly
- **Code Reuse**: ALWAYS search for existing functions before creating new ones
- **Directus Native**: Use Directus functionality when available
- **Tests**: Add tests for new features
- **Documentation**: Update docs for public APIs
- **Git Commits**: Clean commit messages, NO AI signatures

## 🧪 Testing

### Running Tests
```bash
# Run all tests (IMPORTANT: use --run to avoid watch mode)
npm run test -- --run     

# Interactive test UI
npm run test:ui           

# Generate coverage report
npm run test:coverage     

# Type checking
npm run type-check        
```

### E2E Tests

**Note**: E2E tests have been removed from the project. All testing is now done through comprehensive unit tests with Vitest.

### CI/CD Testing
Our GitHub Actions workflow runs:
- Unit tests with Vitest
- Type checking with TypeScript
- Build verification
- Currently skips E2E tests in CI environment

### Manual Testing
1. Build the extension: `npm run build`
2. Restart Directus: `docker compose restart directus`
3. Test in real Directus instance
4. Verify all interface options work:
   - Drag & drop sorting
   - Save and Stay functionality
   - Discard all changes
   - Block dirty state indicators
   - Add existing items functionality
   - Item search and filtering
   - Translation support
   - Role-based permissions
5. Test API endpoints:
   - `/expandable-blocks-api/:collection/search`
   - `/expandable-blocks-api/:collection/items`
6. Test with different collections and field types
7. Check responsive design and drawer width adjustments

## 📝 Pull Request Process

### Before Submitting
- [ ] Tests pass locally
- [ ] Code follows style guidelines
- [ ] Documentation is updated
- [ ] No breaking changes (or clearly documented)
- [ ] Commit messages are descriptive

### PR Template
```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Unit tests added/updated
- [ ] E2E tests added/updated
- [ ] Manual testing completed

## Screenshots
(if applicable)
```

### Review Process
1. **Automated Checks**: CI/CD must pass
2. **Code Review**: At least one maintainer approval
3. **Testing**: Manual verification if needed
4. **Merge**: Squash merge to main branch

## 🎯 Priority Areas

### High Priority
- 🐛 **Bug Fixes**: Critical issues and edge cases
- 📱 **Mobile Support**: Responsive design improvements
- ♿ **Accessibility**: WCAG compliance enhancements
- 🔧 **Performance**: Large dataset optimizations

### Medium Priority
- 🎨 **UI/UX**: Visual improvements and animations
- 📚 **Documentation**: Guides, examples, and tutorials
- 🔧 **Developer Tools**: CLI utilities and generators
- 🚀 **Performance**: Optimization and caching

### Low Priority
- 🌈 **Themes**: Custom visual themes
- 🔌 **Integrations**: Third-party service connections
- 📊 **Analytics**: Usage tracking and insights

## 🏷️ Issue Labels

| Label | Description |
|-------|-------------|
| `bug` | Something isn't working |
| `enhancement` | New feature or request |
| `good first issue` | Good for newcomers |
| `help wanted` | Extra attention needed |
| `ai` | Related to AI features |
| `ui/ux` | User interface improvements |
| `testing` | Test-related changes |
| `documentation` | Documentation improvements |

## 💬 Communication

### GitHub Issues & Discussions
Use [GitHub Issues](https://github.com/smartlabsAT/directus-expandable-blocks/issues) for:
- Bug reports
- Feature requests
- Technical questions

### GitHub Discussions
Use [GitHub Discussions](https://github.com/smartlabsAT/directus-expandable-blocks/discussions) for:
- Design decisions
- Architecture discussions
- Long-form conversations
- Community showcases

### Email
For sensitive matters: [hello@smartlabs.at](mailto:hello@smartlabs.at)

## 🎨 Design Guidelines

### UI/UX Principles
- **Directus Native**: Follow Directus design language
- **Accessibility First**: WCAG 2.1 AA compliance
- **Mobile Responsive**: Works on all screen sizes
- **Performance**: Smooth animations and interactions
- **Intuitive**: Self-explanatory interfaces

### Component Standards
- Use Directus components when possible
- Follow Vue 3 Composition API patterns
- Implement proper error handling
- Support dark/light themes
- Include loading states

## 📄 Code of Conduct

### Our Standards
- **Respectful**: Treat everyone with kindness
- **Inclusive**: Welcome diverse perspectives
- **Constructive**: Provide helpful feedback
- **Professional**: Maintain project focus
- **Collaborative**: Work together effectively

### Unacceptable Behavior
- Harassment or discrimination
- Trolling or inflammatory comments
- Personal attacks or insults
- Spam or off-topic content
- Violating privacy or confidentiality

### Enforcement
Reports can be made to [hello@smartlabs.at](mailto:hello@smartlabs.at). All reports will be reviewed promptly and fairly.

## 🏆 Recognition

### Contributors
All contributors are recognized in:
- GitHub contributors page
- Release notes
- Annual contributor highlights
- Community showcases

### Special Recognition
- **Core Contributors**: Consistent, high-quality contributions
- **Community Champions**: Outstanding community support
- **Innovation Awards**: Breakthrough features or improvements

## 🤝 Sponsor Development

Support the project:
- [GitHub Sponsors](https://github.com/sponsors/smartlabsAT)
- Commission custom features
- Priority support packages
- Corporate sponsorship opportunities

## 📧 Questions?

- 💬 **Discord**: [Join our server](https://discord.gg/directus-expandable-blocks)
- 🐛 **Issues**: [Create an issue](https://github.com/smartlabsAT/directus-expandable-blocks/issues)
- 💡 **Discussions**: [Start a discussion](https://github.com/smartlabsAT/directus-expandable-blocks/discussions)
- 📧 **Email**: [hello@smartlabs.at](mailto:hello@smartlabs.at)

---

Thank you for contributing to the Directus Expandable Blocks extension! 🙏