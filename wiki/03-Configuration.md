# Configuration Guide

This guide covers all configuration options for the Expandable Blocks interface.

## 🚀 Quick Setup

### Step 1: Create an M2A Field

1. Navigate to **Settings → Data Model → [Your Collection]**
2. Click **"Create Field"**
3. Choose **"Many to Any Relationship (M2A)"**
4. Configure:
   - **Field Key**: e.g., `content_blocks`
   - **Related Collections**: Select block collections

### Step 2: Select Interface

1. In field settings, go to **"Interface"** tab
2. Select **"Expandable Blocks"** from dropdown
3. Configure interface options (see below)

## ⚙️ Interface Options

### Display Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| **Enable Sorting** | Boolean | `true` | Allow drag-and-drop reordering |
| **Show Item ID** | Boolean | `true` | Display the actual item ID (not junction ID) |
| **Start Expanded** | Boolean | `false` | Expand all blocks by default when page loads |
| **Accordion Mode** | Boolean | `false` | Only allow one expanded block at a time |
| **Compact Mode** | Boolean | `false` | Reduces height and hides metadata for compact view |

### Permission Controls

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| **Is Allowed Delete** | Boolean | `true` | Allow users to delete blocks |
| **Is Allowed Duplicate** | Boolean | `true` | Allow users to duplicate blocks |
| **Max Blocks** | Number | `null` | Maximum number of blocks allowed (empty = unlimited) |

### Field Filtering

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| **Show Fields Filter** | Array | `null` | Specify which fields to display in inline editor |
| **Allowed Collections** | Array | `[]` | Which collections can be used as blocks |

## 🎨 Field Configuration

### Filtering Fields

Control which fields appear in the expandable editor:

```json
{
  "field_filter": {
    "content_text": ["title", "content", "alignment"],
    "content_image": ["image", "caption", "alt_text"],
    "content_video": ["video_url", "title", "autoplay"]
  }
}
```

### Custom Labels

Override field labels:

```json
{
  "custom_labels": {
    "title": "Headline",
    "content": "Body Text",
    "video_url": "YouTube/Vimeo URL"
  }
}
```

## 📋 Example Configurations

### Blog Post Blocks

```javascript
{
  // Interface options
  "interface": "expandable-blocks",
  "options": {
    "enableSorting": true,
    "accordionMode": true,
    "startExpanded": false,
    "showItemId": true,
    "isAllowedDuplicate": true,
    "maxBlocks": 20
  }
}
```

### Landing Page Builder

```javascript
{
  "interface": "expandable-blocks",
  "options": {
    "enableSorting": true,
    "compactMode": false,
    "startExpanded": true,
    "isAllowedDelete": true,
    "isAllowedDuplicate": true,
    "showItemId": false
  }
}
```

### Fixed Layout

```javascript
{
  "interface": "expandable-blocks",
  "options": {
    "enableSorting": false,
    "isAllowedDelete": false,
    "isAllowedDuplicate": false,
    "maxBlocks": 5,
    "accordionMode": false
  }
}
```

## 🏗️ Collection Setup

### Recommended Block Collections

#### Text Block
```yaml
Collection: content_text
Fields:
  - title (string)
  - subtitle (string)
  - content (text/wysiwyg)
  - alignment (dropdown: left/center/right)
  - status (dropdown: draft/published)
```

#### Image Block
```yaml
Collection: content_image
Fields:
  - image (file)
  - caption (string)
  - alt_text (string)
  - link (string)
  - alignment (dropdown: left/center/right/full)
```

#### Call to Action
```yaml
Collection: content_cta
Fields:
  - title (string)
  - description (text)
  - button_text (string)
  - button_link (string)
  - button_style (dropdown: primary/secondary)
```

### Junction Collection

Directus automatically creates a junction collection:

```yaml
Collection: [parent]_blocks
Fields:
  - id (primary key)
  - [parent]_id (foreign key)
  - collection (string)
  - item (foreign key)
  - sort (integer)
```

## 🎯 Status Management

### Built-in Status Field

Add a status field to your blocks:

```javascript
{
  "field": "status",
  "type": "string",
  "interface": "select-dropdown",
  "options": {
    "choices": [
      { "text": "Draft", "value": "draft" },
      { "text": "Published", "value": "published" },
      { "text": "Archived", "value": "archived" }
    ]
  }
}
```

The interface will show status indicators:
- 🟢 Published (green)
- 🟡 Draft (yellow)
- 🔴 Archived (red)


## 🎨 Styling

### CSS Variables

Customize appearance with CSS variables:

```css
.expandable-blocks {
  --eb-primary-color: #00C897;
  --eb-border-radius: 8px;
  --eb-spacing: 16px;
  --eb-transition: 0.2s ease;
}
```


## 📱 Responsive Behavior

The interface automatically adapts to screen size:
- **Desktop**: Full features, side-by-side layout
- **Tablet**: Stacked layout, touch-optimized
- **Mobile**: Compact mode, simplified controls

---

> **Next**: Learn about the [[Architecture Overview|04-Architecture-Overview]] or see [[Examples|08-Examples]] for practical implementations.