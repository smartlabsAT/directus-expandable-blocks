# Local Wiki Preview

This directory contains the documentation for the GitHub Wiki.

## 🔍 Preview Options

### Option 1: VS Code
Install the "Markdown Preview Enhanced" extension and open any .md file.

### Option 2: Local Server
```bash
# Install grip (GitHub Readme Instant Preview)
pip install grip

# Run from wiki directory
cd wiki
grip

# Open http://localhost:6419
```

### Option 3: IntelliJ IDEA
Use the built-in Markdown preview or install "Markdown Navigator Enhanced" plugin.

## 📁 File Structure

- `01-Home.md` - Main wiki homepage
- `02-Installation.md` - Installation guide
- `03-Configuration.md` - Configuration options
- `04-Architecture-Overview.md` - Architecture overview
- `05-Data-Flow.md` - Data flow documentation
- `06-API-Integration.md` - API integration guide
- `07-Development.md` - Development guide
- `08-Examples.md` - Usage examples
- `09-Contributing.md` - Contributing guidelines
- `10-Roadmap.md` - Project roadmap
- `11-Changelog.md` - Version history
- `_Sidebar.md` - Wiki navigation sidebar

## 🚀 Publishing to GitHub Wiki

1. Enable Wiki in repository settings
2. Clone the wiki repository:
   ```bash
   git clone https://github.com/smartlabsAT/directus-expandable-blocks.wiki.git
   ```
3. Copy all files from this directory
4. Commit and push

## ⚠️ Note on Wiki Links

Wiki links use the format `[[Page Title|filename]]`. These will only work properly in the GitHub Wiki interface, not in regular markdown preview.