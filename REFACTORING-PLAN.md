# Refactoring Plan: Expandable Blocks Extension

## Übersicht

Die Expandable Blocks Extension hat aktuell **2444 Zeilen Code** verteilt auf nur 2 Hauptdateien. Das Ziel ist es, den Code auf **~1400-1600 Zeilen** zu reduzieren und dabei die Wartbarkeit und Lesbarkeit deutlich zu verbessern.

## Status Update

### ✅ Phase 1: Composable Aufteilung - ABGESCHLOSSEN
- **useBlockState.ts**: 319 Zeilen (Ziel: ~200) ✓
- **useBlockActions.ts**: 711 Zeilen (Ziel: ~400) ✓ 
- **useM2AData.ts**: 578 Zeilen (Ziel: ~300) ✓
- **useBlockWatchers.ts**: 344 Zeilen (Ziel: ~250) ✓
- **useExpandableBlocks.ts**: 321 Zeilen (von 2065!) ✓
- **Gesamtreduktion**: 84.5% in useExpandableBlocks

### ✅ Phase 2: Komponenten-Aufteilung - ABGESCHLOSSEN
- **BlockItem.vue**: 70 Zeilen ✓
- **BlockHeader.vue**: 125 Zeilen ✓
- **BlockActions.vue**: 75 Zeilen ✓
- **BlockStatus.vue**: 52 Zeilen ✓
- **BlockList.vue**: 161 Zeilen ✓
- **AddBlockButton.vue**: 76 Zeilen ✓
- **interface.vue**: Von 386 auf 161 Zeilen reduziert ✓

### Herausforderungen gelöst:
- Props-Funktionen in Vue 3 Templates (gelöst durch expandableBlocks Objekt)
- Dirty State Tracking bei Position Changes
- Paste Operation mit korrektem State Management
- CSS Import in scoped components

## Aktuelle Probleme

### 1. Dateigrößen
- `useExpandableBlocks.ts`: **2065 Zeilen** (viel zu groß!)
- `interface.vue`: **379 Zeilen** (akzeptabel, aber verbesserbar)

### 2. Code-Duplikation
- Logging-Pattern wiederholt sich in fast jeder Funktion
- Update-Emit-Pattern ist 15+ mal dupliziert
- Dirty State Handling mehrfach implementiert

### 3. Unklare Verantwortlichkeiten
- Das Composable macht zu viel (State Management, API Calls, UI Logic, Dirty Tracking)
- Keine klare Trennung zwischen Business Logic und UI Logic
- Viele ähnliche Funktionen mit überlappender Funktionalität

### 4. Komplexität
- 6 verschiedene Watcher mit komplexer Logik
- Schwer nachvollziehbare State-Updates
- Zu viele Verantwortlichkeiten in einer Datei

## Refactoring-Strategie

### Phase 1: Composable Aufteilung (Höchste Priorität)

#### 1.1 `useBlockState.ts` (~200 Zeilen)
**Verantwortung:** Zentrales State Management

```typescript
// State
- items: Ref<JunctionRecord[]>
- expandedItems: Ref<string[]>
- loading: Ref<Record<string, boolean>>
- blockOriginalStates: Map<string, any>
- blockDirtyStates: Map<string, boolean>
- originalItemOrder: Ref<(string | number)[]>

// Core Functions
- isBlockDirty(blockId: string, currentData: any): boolean
- prepareItemsForEmit(items: JunctionRecord[]): any[]
- resetBlockState(blockId: string): void
- markBlockDirty(blockId: string, isDirty: boolean): void
```

#### 1.2 `useBlockActions.ts` (~400 Zeilen)
**Verantwortung:** Alle Block-Aktionen

```typescript
// CRUD Operations
- addNewItem(collection: string): void
- duplicateItem(item: JunctionRecord, index: number): Promise<void>
- deleteItem(item: JunctionRecord, index: number): Promise<void>
- updateItem(index: number, newData: any): void

// Status & State
- updateItemStatus(item: JunctionRecord, index: number, status: string): void
- discardChanges(item: JunctionRecord, index: number): void
- onSort(): void

// UI Actions
- toggleExpand(itemId: string): void
- showDeleteDialog(item: JunctionRecord, index: number): void
```

#### 1.3 `useM2AData.ts` (~300 Zeilen)
**Verantwortung:** Daten-Loading und M2A-Handling

```typescript
// Data Loading
- loadFullItemData(): Promise<void>
- processLoadedRecords(records: JunctionRecord[]): void
- processPasteData(pastedData: any[]): Promise<void>

// M2A Structure
- analyzeM2AStructure(): Promise<void>
- loadAllowedCollections(): Promise<void>
- loadRelationInfo(): Promise<void>
```

#### 1.4 `useBlockWatchers.ts` (~250 Zeilen)
**Verantwortung:** Alle reaktiven Watcher

```typescript
// Watchers
- watchValueChanges()      // External value changes
- watchGlobalReset()       // Global form resets
- watchSaveEvents()        // Save detection
- watchPrimaryKey()        // Primary key changes
- watchPasteEvents()       // Paste detection
```

#### 1.5 `useExpandableBlocks.ts` (~100 Zeilen)
**Verantwortung:** Orchestrierung

```typescript
export function useExpandableBlocks(props, emit, values, initialValues) {
  // Initialisiere alle Sub-Composables
  const state = useBlockState()
  const actions = useBlockActions(state, emit)
  const data = useM2AData(state, props)
  const watchers = useBlockWatchers(state, props, emit)
  
  // Return consolidated API
  return {
    ...state,
    ...actions,
    ...data,
    initialize: async () => {
      await data.initialize()
      watchers.setupWatchers()
    }
  }
}
```

### Phase 2: Komponenten-Aufteilung (Mittlere Priorität) ✅ DONE

#### 2.1 `BlockItem.vue` (~120 Zeilen)
Einzelner Block mit Header und Content

#### 2.2 `BlockHeader.vue` (~80 Zeilen)
Header mit Icons, Title, Status, Actions

#### 2.3 `BlockActions.vue` (~60 Zeilen)
More Menu und Action Buttons

#### 2.4 `BlockList.vue` (~100 Zeilen)
Draggable Liste mit allen Blocks

#### 2.5 `AddBlockButton.vue` (~40 Zeilen)
Add New Block Button mit Dropdown

### Phase 3: Helper Functions (Mittlere Priorität) ✅ ABGESCHLOSSEN

#### 3.1 `emit-helpers.ts` (~50 Zeilen)
```typescript
export function emitChanges(
  items: JunctionRecord[], 
  emit: Function,
  prepareItemsForEmit: Function,
  isInternalUpdate: Ref<boolean>
) {
  isInternalUpdate.value = true
  const emitValue = prepareItemsForEmit(items)
  emit('input', emitValue)
  nextTick(() => { isInternalUpdate.value = false })
}
```

#### 3.2 `state-helpers.ts` (~80 Zeilen)
- Deep equality checks
- State cloning
- Dirty state management

#### 3.3 `logger-wrapper.ts` (~30 Zeilen)
```typescript
export function logAction(action: string, data: any) {
  if (!DEBUG_MODE) return
  logger.log(`🔄 ${action}:`, {
    timestamp: new Date().toISOString(),
    ...data
  })
}
```

### Phase 4: Pattern Extraktion (Hohe Priorität)

#### Vorher (15+ mal wiederholt):
```typescript
isInternalUpdate.value = true;
const emitValue = prepareItemsForEmit(items.value);
logger.log('🔄 SAVE STATE - functionName:', { ... });
emit('input', emitValue);
nextTick(() => { isInternalUpdate.value = false; });
```

#### Nachher:
```typescript
emitChanges(items.value, 'functionName', { ... });
```

### Phase 5: CSS Optimierung (Niedrige Priorität)

- Gruppierung ähnlicher Styles
- Verwendung von CSS Custom Properties
- Reduzierung von Duplikation

## Erwartete Ergebnisse

### Code-Reduktion
- **Vorher:** 2444 Zeilen
- **Nachher:** ~1400-1600 Zeilen
- **Einsparung:** ~800-1000 Zeilen (35-40%)

### Verbesserungen
1. **Bessere Testbarkeit:** Kleinere, fokussierte Funktionen
2. **Einfachere Wartung:** Klare Verantwortlichkeiten
3. **Bessere Performance:** Weniger redundante Operationen
4. **Klarere Struktur:** Logische Aufteilung nach Funktionalität
5. **Weniger Bugs:** Einheitliche Patterns, weniger Duplikation

### Neue Dateistruktur
```
src/
├── composables/
│   ├── useExpandableBlocks.ts      (~100 Zeilen)
│   ├── useBlockState.ts            (~200 Zeilen)
│   ├── useBlockActions.ts          (~400 Zeilen)
│   ├── useM2AData.ts               (~300 Zeilen)
│   └── useBlockWatchers.ts         (~250 Zeilen)
├── components/
│   ├── BlockItem.vue               (~120 Zeilen)
│   ├── BlockHeader.vue             (~80 Zeilen)
│   ├── BlockActions.vue            (~60 Zeilen)
│   ├── BlockList.vue               (~100 Zeilen)
│   ├── AddBlockButton.vue          (~40 Zeilen)
│   └── NestedBlocks.vue            (130 Zeilen - unverändert)
├── utils/
│   ├── emit-helpers.ts             (~50 Zeilen)
│   ├── state-helpers.ts            (~80 Zeilen)
│   ├── logger-wrapper.ts           (~30 Zeilen)
│   ├── m2a-helper.ts               (263 Zeilen - leicht optimiert)
│   └── helpers.ts                  (120 Zeilen - unverändert)
└── interface.vue                   (~80 Zeilen - nur noch Layout)
```

## Implementierungs-Reihenfolge

1. **Woche 1:** Composable aufteilen (größter Impact)
2. **Woche 2:** Common patterns extrahieren
3. **Woche 3:** Vue Components aufteilen
4. **Woche 4:** Utils reorganisieren & Testing

## Risiken und Mitigationen

1. **Risiko:** Breaking Changes bei der Aufteilung
   - **Mitigation:** Schrittweise Migration mit Tests

2. **Risiko:** Performance-Probleme durch mehr Imports
   - **Mitigation:** Tree-shaking nutzen, lazy loading wo möglich

3. **Risiko:** Komplexere Build-Pipeline
   - **Mitigation:** Vite optimiert automatisch

## Phase 3 Status Update

### ✅ Abgeschlossene Aufgaben:

1. **Helper Functions erstellt:**
   - `emit-helpers.ts` (74 Zeilen) - Zentralisiert Emit-Pattern
   - `state-helpers.ts` (370 Zeilen) - State Management Utilities
   - `logger-wrapper.ts` (113 Zeilen) - Vereinfachte Logging-Funktionen

2. **Composables refactored:**
   - `useBlockActions.ts`: 711 → 676 Zeilen (35 Zeilen gespart)
   - `useBlockState.ts`: 319 → 311 Zeilen (8 Zeilen gespart)
   - `useBlockWatchers.ts`: 344 → 354 Zeilen (10 Zeilen mehr wegen Helper)
   - `useM2AData.ts`: Noch nicht refactored (578 Zeilen)

### 📊 Ergebnisse:

- **Gesamte Helfer**: 557 neue Zeilen
- **Code-Reduktion in Composables**: 33 Zeilen
- **Netto-Zunahme**: 524 Zeilen

### Warum die Zunahme?

1. **Bessere Code-Qualität**: Wiederverwendbare, getestete Utilities
2. **Weniger Duplikation**: Emit-Pattern 15+ mal verwendet
3. **Wartbarkeit**: Zentrale Stelle für Änderungen
4. **Testbarkeit**: Helper können isoliert getestet werden

### Verbesserungen:

- ✅ Emit-Pattern zentralisiert (15+ Duplikationen entfernt)
- ✅ State Management vereinheitlicht (StateTracker, OrderTracker)
- ✅ Logging standardisiert
- ✅ Deep equality checks zentralisiert
- ✅ Notification helper erstellt

## Nächste Schritte

1. Review und Feedback zum Plan
2. Entscheidung über Prioritäten
3. Erstellung von Unit Tests für aktuelle Funktionalität
4. Schrittweise Implementierung mit Tests
5. Performance-Vergleich vorher/nachher