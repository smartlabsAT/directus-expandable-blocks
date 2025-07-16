# Installation Guide

This guide covers all installation methods for the Directus Expandable Blocks extension.

## 📋 Prerequisites

- **Directus**: Version 11.0.0 or higher
- **Node.js**: Version 16.x or higher (for npm installation)
- **Database**: Any Directus-supported database

## 📦 Installation Methods

### Via NPM (Recommended)

The easiest way to install is through npm:

```bash
npm install directus-extension-expandable-blocks
```

After installation, restart your Directus instance:

```bash
npx directus start
```

### Manual Installation

1. **Download the Extension**
   - Visit [GitHub Releases](https://github.com/smartlabsAT/directus-expandable-blocks/releases)
   - Download the latest `directus-extension-expandable-blocks.zip`

2. **Extract to Extensions Directory**
   ```bash
   # Navigate to your Directus project
   cd /path/to/directus-project
   
   # Create interfaces directory if it doesn't exist
   mkdir -p extensions/interfaces
   
   # Extract the downloaded file
   unzip directus-extension-expandable-blocks.zip -d extensions/interfaces/
   ```

3. **Restart Directus**
   ```bash
   npx directus start
   ```

### Docker Installation

For Docker-based Directus installations:

#### Option 1: Using Dockerfile

```dockerfile
FROM directus/directus:latest

# Install the extension
RUN npm install directus-extension-expandable-blocks
```

#### Option 2: Using Docker Compose

```yaml
version: '3'
services:
  directus:
    image: directus/directus:latest
    volumes:
      - ./extensions:/directus/extensions
    # ... other configuration
```

Then install locally and mount:
```bash
# Install in local extensions directory
npm install --prefix ./extensions directus-extension-expandable-blocks
```

#### Option 3: Custom Docker Image

Create a custom Dockerfile:
```dockerfile
FROM directus/directus:latest

# Install extension globally
RUN npm install -g directus-extension-expandable-blocks

# Copy to extensions directory
RUN mkdir -p /directus/extensions/interfaces && \
    cp -r /usr/local/lib/node_modules/directus-extension-expandable-blocks \
    /directus/extensions/interfaces/
```

### Development Installation

For development or customization:

1. **Clone the Repository**
   ```bash
   git clone https://github.com/smartlabsAT/directus-expandable-blocks.git
   cd directus-expandable-blocks
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Build the Extension**
   ```bash
   npm run build
   ```

4. **Link to Directus**
   ```bash
   npm run link
   ```

5. **Start Development Mode**
   ```bash
   npm run dev
   ```

## ✅ Verify Installation

1. **Check Admin Interface**
   - Log into Directus Admin Panel
   - Navigate to Settings → Extensions
   - Look for "Expandable Blocks" in the Interfaces section

2. **Create a Test Field**
   - Go to Settings → Data Model
   - Select any collection
   - Create a new M2A field
   - The "Expandable Blocks" interface should appear in the interface dropdown

## 🔧 Troubleshooting

### Extension Not Appearing

1. **Clear Directus Cache**
   ```bash
   npx directus cache clear
   ```

2. **Check Extension Directory**
   ```bash
   ls -la extensions/interfaces/
   # Should show: directus-extension-expandable-blocks
   ```

3. **Verify Permissions**
   ```bash
   chmod -R 755 extensions/
   ```

### Docker-Specific Issues

- Ensure volumes are properly mounted
- Check container logs: `docker logs <container-name>`
- Verify extension is in the container: `docker exec <container> ls /directus/extensions/interfaces/`

### Build Errors

If building from source:
```bash
# Clean install
rm -rf node_modules package-lock.json
npm install
npm run build
```

## 🔄 Updating

### NPM Update
```bash
npm update directus-extension-expandable-blocks
# Restart Directus
```

### Manual Update
1. Download the latest release
2. Replace the existing extension directory
3. Restart Directus

### Docker Update
Rebuild your Docker image with the latest version.

## 🗑️ Uninstallation

### NPM
```bash
npm uninstall directus-extension-expandable-blocks
```

### Manual
```bash
rm -rf extensions/interfaces/directus-extension-expandable-blocks
```

Then restart Directus.

---

> **Next Steps**: After installation, proceed to [[Configuration|03-Configuration]] to set up your first expandable blocks field.