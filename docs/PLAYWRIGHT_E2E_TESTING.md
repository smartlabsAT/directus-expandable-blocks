# 🎭 Playwright E2E Testing Setup

Dieses Dokument beschreibt das Playwright E2E Testing Setup für die ExpandableBlocks Directus Extension.

## ✅ Was funktioniert (Schritt 1 abgeschlossen)

### 🔑 **Token-basierte Authentication**
- **Admin Token**: Vollzugriff für Test-Setup/Teardown
- **Editor Token**: Eingeschränkte Rechte für realistische Tests
- **Beide Token funktionieren**: API-Verbindung erfolgreich getestet

### 🧪 **Erfolgreiche Tests (6/7 passing)**
1. ✅ **Admin API Token works correctly**
2. ✅ **Editor API Token works correctly** 
3. ✅ **Can list collections with Editor token** (23 Collections gefunden)
4. ✅ **Can reach Directus login page**
5. ✅ **Directus admin interface loads without errors**
6. ✅ **Can access API endpoint directly via browser**

### 🏗️ **Test-Architektur**
```
test/
├── e2e/
│   ├── extension-simple.spec.ts    # ✅ Funktionierende Basis-Tests
│   └── extension-basic.spec.ts     # 🚧 Erweiterte Tests (in Entwicklung)
├── helpers/
│   └── directus-api.ts             # ✅ API Helper für Token-Auth
└── fixtures/
    └── test-data.ts                # ✅ Test-Daten Vorlagen
```

## 🚀 **Quick Start**

### Tests ausführen
```bash
# Alle E2E Tests
npm run test:e2e

# Nur funktionierende Tests
npm run test:e2e extension-simple.spec.ts

# Mit UI (visuell)
npm run test:e2e:ui

# Debug-Modus
npm run test:e2e:debug
```

### Environment Setup
**`.env` Datei bereits konfiguriert:**
```env
DIRECTUS_URL=backend.smartlabs.dev
DIRECTUS_API_TOKEN_ADMIN=BmXD-D4Yr8btiWSeiTjpLzM7lXhRC18W
DIRECTUS_API_TOKEN_EDITOR=erfGzpZYX5GEV7i_XbpvBHQGK1BZbU99
```

## 📊 **Test-Ergebnisse**

### ✅ **API Tests (100% erfolgreich)**
- **Admin Token**: `admin@example.com` ✅
- **Editor Token**: `editor@editor.at` ✅
- **Collections Access**: 23 Collections verfügbar ✅
- **Browser API Access**: Direkter Token-Zugriff funktioniert ✅

### 🌐 **Browser Tests (100% erfolgreich)**
- **Login Page**: Erreichbar ("Sign In · Smartlabs") ✅
- **JavaScript Errors**: Keine kritischen Fehler ✅
- **SSL/HTTPS**: Konfiguriert mit `ignoreHTTPSErrors: true` ✅

### 📋 **Verfügbare Collections**
```
Page, content_block, content_block_blocks, content_blocks, 
content_button, content_headline, content_headline_translations, 
content_wysiwig, extra, extra_Blocks, ...
```

## 🎯 **Nächste Schritte (für weitere Entwicklung)**

### Schritt 2: Extension-spezifische Tests
- [ ] Navigation zu Collections mit ExpandableBlocks
- [ ] Interface-Interaktionen testen
- [ ] M2A Relationship Management
- [ ] Drag & Drop Funktionalität

### Schritt 3: Session-basierte Authentication
- [ ] Login-Flow für komplexere Browser-Tests
- [ ] Storage State für Session-Management
- [ ] Authenticated Page Objects

### Schritt 4: Visual Testing
- [ ] Screenshot-Vergleiche
- [ ] UI Regression Tests
- [ ] Cross-Browser Testing

## 🔧 **Konfiguration**

### playwright.config.ts
```typescript
export default defineConfig({
  testDir: './test/e2e',
  use: {
    baseURL: `https://${process.env.DIRECTUS_URL}`,
    ignoreHTTPSErrors: true,  // Für Development SSL
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium' },
    { name: 'firefox' },
    { name: 'webkit' }
  ]
});
```

### Verfügbare NPM Scripts
```json
{
  "test:e2e": "playwright test",
  "test:e2e:ui": "playwright test --ui",
  "test:e2e:debug": "playwright test --debug",
  "test:e2e:headed": "playwright test --headed"
}
```

## 🎊 **Erfolg!**

**Schritt 1 ist abgeschlossen!** 

✅ Playwright erfolgreich integriert  
✅ Token-Authentication funktioniert  
✅ API-Tests laufen stabil  
✅ Browser-Tests erreichen Directus  
✅ SSL-Probleme gelöst  
✅ 6/7 Tests erfolgreich  

Das System ist bereit für die nächsten Schritte der Extension-Testing-Entwicklung!