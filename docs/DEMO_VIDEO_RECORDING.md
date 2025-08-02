# 🎬 Professional Demo Video Recording mit Playwright

Dieses System erstellt automatisch **professionelle Produktpräsentations-Videos** für die ExpandableBlocks Extension.

## 🚀 Quick Start

### Demo-Videos erstellen
```bash
# Vollständige Produktpräsentation
npm run demo:product

# Feature-Highlights (kurz)
npm run demo:highlights

# Alle Demos
npm run demo:record
```

### 📹 Video-Output
Nach dem Ausführen findest du:
- **WebM-Videos**: `demo-test-results/` Ordner (in Unterverzeichnissen pro Test)
- **Screenshots**: `demo-test-results/*/test-finished-*.png`, etc.
- **HTML-Report**: `demo-results/index.html`

## 🎯 Demo-Scenarios

### 1. **Complete Product Demonstration**
**Datei**: `test/demo/product-demo.spec.ts`

**User Journey** (automatisch aufgezeichnet):
1. 🏠 **Directus Admin Access** - Login mit Editor Token
2. 📋 **Content Management** - Navigation zu Collections  
3. 🎨 **ExpandableBlocks Interface** - Extension in Aktion
4. ➕ **Content Creation** - Neuen Inhalt erstellen
5. 🔧 **Feature Demo** - Interaktionen und UI-Elemente
6. 📸 **Screenshots** - Wichtige Momente festhalten

### 2. **Feature Highlights Demo**  
**Schnelle Übersicht** der wichtigsten Features

## ⚙️ Professionelle Video-Einstellungen

### 🎥 **Video-Qualität**
```typescript
// playwright-demo.config.ts
use: {
  video: 'on',                    // Immer aufzeichnen
  slowMo: 1500,                   // Langsam für Demo-Sichtbarkeit
  viewport: { width: 1920, height: 1080 },  // Full HD
  headless: false,                // Sichtbarer Browser
  screenshot: 'on',               // Screenshots bei jedem Schritt
}
```

### 🎨 **Demo-Features**
- ✅ **1920x1080 Full HD** Videos
- ✅ **Langsame Geschwindigkeit** (1.5s Delay)
- ✅ **Automatische Screenshots** an wichtigen Stellen
- ✅ **Browser sichtbar** für natürliche Bewegungen
- ✅ **Professionelle Pausen** zwischen Aktionen
- ✅ **Hover-Effekte** für UI-Highlights

## 📋 Demo-Script Features

### 🎬 **Automatische Szenen**
```typescript
// Scene 1: Landing and Login
console.log('📍 Scene 1: Accessing Directus Admin');

// Scene 2: Navigation 
console.log('📍 Scene 2: Navigating to Content Management');

// Scene 3: Extension Demo
console.log('📍 Scene 3: Opening Collection with ExpandableBlocks');
```

### 📸 **Screenshot-Sammlung**
Automatisch erstellte Screenshots für Präsentationen:
- `01-admin-dashboard.png` - Directus Dashboard
- `02-collection-pages.png` - Collection Overview
- `03-item-creation-form.png` - Content Creation
- `04-expandable-blocks-interface.png` - **Extension in Action**
- `05-final-interface-state.png` - Finaler Zustand

### 🎯 **Intelligente Navigation**
```typescript
// Sucht automatisch nach Collections mit Extension
const collections = ['content_blocks', 'pages', 'Page', 'content_block'];

// Findet Add-Buttons unabhängig vom UI
const addButton = page.locator('button:has-text("Add"), button:has-text("Create")');

// Erkennt ExpandableBlocks Interface
const blockElements = page.locator('.expandable-blocks, .block-list');
```

## 🎥 Video-Output Beispiele

### **Vollständige Demo** (ca. 2-3 Minuten)
- Zeigt komplette User Journey
- Alle Extension-Features
- Professionelle Geschwindigkeit
- Ready für Kundenpräsentationen

### **Feature Highlights** (ca. 30-60 Sekunden)
- Schnelle Übersicht
- Wichtigste Funktionen
- Social Media geeignet

## 🔧 Anpassungen & Customization

### Demo-Script erweitern
```typescript
// Eigene Demo-Szenen hinzufügen
test('Custom Feature Demo', async ({ page }) => {
  // Deine spezifische Demo-Logic
  await page.goto('/admin/your-feature');
  await page.waitForTimeout(2000); // Demo-Pause
  await page.screenshot({ path: 'demo-results/custom-feature.png' });
});
```

### Video-Einstellungen anpassen
```typescript
// playwright-demo.config.ts
use: {
  slowMo: 2000,                   // Noch langsamer
  viewport: { width: 1280, height: 720 },  // Andere Auflösung
  // Weitere Anpassungen...
}
```

## 📊 Demo-Ergebnisse

Nach dem Ausführen erhältst du:

### 📁 **Output-Struktur**
```
demo-test-results/
├── product-demo-*/           # Pro Test ein Verzeichnis
│   ├── video.webm           # Hauptvideo (WebM)
│   ├── screenshots/         # Alle Demo-Screenshots
│   │   ├── 01-admin-dashboard.png
│   │   ├── 02-expandable-blocks-page.png
│   │   ├── 03-expandable-blocks-interface.png
│   │   └── ...
│   └── trace.zip            # Debug-Informationen
└── demo-results/
    └── index.html           # HTML-Report
```

### 🎬 **Video-Specs**
- **Format**: WebM/MP4 (browser-dependent)
- **Auflösung**: 1920x1080 (Full HD)
- **Qualität**: Hoch (für Präsentationen geeignet)
- **Dauer**: 2-5 Minuten (je nach Demo)

## 💡 Pro-Tips für beste Ergebnisse

### 🎯 **Vor der Aufnahme**
1. **System aufräumen**: Andere Programme schließen
2. **Browser-Cache leeren**: Für konsistente Ladezeiten  
3. **Internetverbindung prüfen**: Stabile Verbindung zu Directus
4. **Demo-Daten vorbereiten**: Testinhalte im System anlegen

### 🎨 **Für beste Video-Qualität**
1. **Hohe Bildschirmauflösung** verwenden
2. **Demo bei Tageslicht** aufnehmen (bessere Sichtbarkeit)
3. **Notifications ausschalten** (keine Störungen)
4. **Langsame Demo-Geschwindigkeit** beibehalten

### 📱 **Verschiedene Formate**
```bash
# Desktop Demo (Standard, mit Browser-Fenster)
npm run demo:product

# Feature Highlights (headless, ohne Browser-Fenster)
npm run demo:highlights

# Alle Demos (Browser-Fenster sichtbar)
npm run demo:record
```

## 🔄 Workflow Integration

### **Development Workflow**
1. **Feature entwickeln**
2. **Demo-Script anpassen** (falls nötig)
3. **Demo-Video erstellen**: `npm run demo:product`
4. **Video für Präsentation nutzen**

### **Marketing Workflow**
1. **Demo-Video erstellen**
2. **Screenshots extrahieren** für Dokumentation
3. **Video nachbearbeiten** (optional)
4. **In Präsentationen einbinden**

---

## 🎊 **Ready für professionelle Produktpräsentationen!**

Mit diesem Setup kannst du **jederzeit** hochwertige Demo-Videos erstellen:
- ✅ Automatisch und reproduzierbar
- ✅ Professionelle Qualität
- ✅ Immer up-to-date mit aktueller Extension
- ✅ Screenshots inklusive für Dokumentation

**Ein Befehl - komplette Produktpräsentation!** 🚀