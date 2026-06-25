# Seating Planner — Claude Code Guide

Hebrew-language (RTL) event seating planner. Pure frontend: HTML + vanilla JS + CSS. No build step, no framework, no server. Runs on GitHub Pages.

## Quick Start

Open `index.html` in a browser, or serve with any static file server:
```bash
python3 -m http.server 8080
```

## Architecture

All JS uses the IIFE module pattern (`const Foo = (() => { ... return {...}; })()`). Modules communicate through a central event bus on `State`.

### Module Load Order (index.html `<script>` tags)
```
config.js → state.js → ui.js → canvas.js → drag.js →
items.js → guests.js → modals.js → storage.js →
print.js → history.js → autoassign.js → nav.js → app.js
```
`app.js` is the only entry point — it wires everything in `DOMContentLoaded`.

### Module Responsibilities

| File | Role |
|------|------|
| `config.js` | Frozen constants: sizes, colours, zoom limits, proximity defs, event types |
| `state.js` | Single source of truth. All mutation goes through here. Emits events. |
| `ui.js` | Toast notifications, modal open/close, stats bar, HTML escaping, tag colours |
| `canvas.js` | Viewport pan/zoom, coordinate transforms, pinch-to-zoom, fit-all, focusOnItem, distributeTablesEvenly |
| `drag.js` | Pointer-events drag for canvas items (move + resize) and guest cards |
| `items.js` | Renders canvas items as DOM; SVG table drawing (scaled fonts + guest rows); selection; drop highlights; renumberTables |
| `guests.js` | Sidebar guest list: render, search, tag filter, sort, group, filter, drag reorder |
| `modals.js` | All modal logic: add/edit table, guest, item, auto-assign, overflow, settings |
| `storage.js` | Multi-event localStorage auto-save (debounced 400ms), JSON/CSV export-import |
| `print.js` | Builds print-area HTML (plan, list, all, full) and triggers `window.print()` |
| `history.js` | Undo/Redo via full-state JSON snapshots (max 50, debounced 350ms) |
| `autoassign.js` | Smart auto-assign: affinity groups, proximity scoring, real split, auto-create tables |
| `nav.js` | Collapsible item-navigation panel (left edge); renders all canvas items as a color-coded list; hover tooltips; click to select+focus; right-click opens context menu |
| `app.js` | DOMContentLoaded init, header button wiring, keyboard shortcuts |

## State & Event Bus

```javascript
State.on('eventName', callback)   // subscribe
State.emit('eventName', data)     // publish (also fires 'change')
```

### Key Events

| Event | Payload | Who emits | Who listens |
|-------|---------|-----------|-------------|
| `itemAdded` | item | state.js | items.js (render), nav.js (renderAll) |
| `itemUpdated` | item | state.js | items.js (refresh), nav.js (renderAll) |
| `itemRemoved` | id | state.js | items.js (remove el), guests.js (re-render displaced), nav.js (renderAll) |
| `guestAdded` | guest | state.js | guests.js (render) |
| `guestUpdated` | guest | state.js | guests.js (render), items.js (refresh table) |
| `guestRemoved` | `{id, tableId}` | state.js | guests.js (render), items.js (refresh table), nav.js (refreshDot) |
| `guestAssigned` | `{guestId, tableId, prevTableId}` | state.js | guests.js (render), items.js (refresh both tables), nav.js (refreshDot both) |
| `dataLoaded` | — | state.js | items.js (renderAll), guests.js (renderTagFilter+render), modals.js (updateEventHeader+renderLayoutDropdown), nav.js (renderAll) |
| `change` | `{evt, data}` | state.js (auto) | storage.js (save), app.js (updateStats), history.js (scheduleCapture) |
| `eventSwitched` | — | storage.js | history.js (reset — clears undo/redo stacks), modals.js (reset _activeLayoutId) |
| `layoutOptionsChanged` | `{id}` | state.js | modals.js (renderLayoutDropdown, auto-clear stale _activeLayoutId) |

**CRITICAL**: `change` is fired automatically after every other event. Never emit `change` directly.

## Multi-Event Storage

Each event is stored independently in localStorage. Two keys are used:

- **`seating_planner_meta`** — JSON object `{ currentId, events: [{id, name, date, updated}] }`
- **`seating_planner_event_${id}`** — full serialized event state (same shape as single-event JSON export)

### Key invariant

`Storage._currentId` **must be set before any State mutation** in `createEvent()` and `switchEvent()`. The debounced `save()` listener fires on every state change; if `_currentId` is stale, the write goes to the wrong key. This is why all event-switch logic sets `_currentId` before calling `State.resetBoard()` or `State.deserialize()`.

### API

```javascript
Storage.createEvent({ keepGuests: false })  // new event; keepGuests=true copies guests without assignments
Storage.switchEvent(id)                     // persist current, load target
Storage.deleteEvent(id)                     // cannot delete last event
Storage.getEventsList()                     // → { events, currentId }
Storage.updateCurrentMeta()                 // sync meta name/date from current state
```

### Migration

On first load, if no meta key exists but the legacy `seating_planner_v2` key does, the data is migrated automatically to `evt_1` in the new multi-event format.

### History boundary

`State.emit('eventSwitched')` triggers `History.reset()`, which clears undo/redo stacks and takes a fresh snapshot. This prevents cross-event undo/redo corruption.

## Canvas Coordinate Math

The canvas uses CSS transform on `.canvas-room` with **`transform-origin: 0 0`**:
```
viewport_x = canvas_x * zoom + panX
canvas_x   = (viewport_x - panX) / zoom
```

`Canvas.viewportToCanvas(clientX, clientY)` and `Canvas.canvasToViewport(cx, cy)` handle the conversion.

## Sidebar-Aware Viewport Width

`Canvas._canvasAreaW(vr?)` returns the effective canvas width, excluding any portion covered by the sidebar. The formula handles both layout modes:

- **Desktop**: sidebar is a flex sibling to the right of `canvasViewport`. `position` is `static`, so the early-return is not taken. `vr.right ≤ sbR.left` → overlap = 0 → returns `vr.width` (canvas-area's own flex width already excludes the sidebar).
- **Mobile (≤768px)**: sidebar is `position:fixed` overlay. `_canvasAreaW` detects this and returns `vr.width` immediately (full viewport). Before any spatial operation, `_closeMobileSidebar()` closes the open sidebar so the full viewport is actually visible.

```javascript
function _canvasAreaW(vr) {
    vr = vr || viewport.getBoundingClientRect();
    const sb = document.getElementById('sidebar');
    if (!sb) return vr.width;
    // On mobile, sidebar is position:fixed overlay — fitAll/focusOnItem close it first,
    // so it is always off-screen here; return full viewport width.
    if (window.getComputedStyle(sb).position === 'fixed') return vr.width;
    const sbR = sb.getBoundingClientRect();
    return vr.width - Math.max(0, vr.right - sbR.left);
}
```

Always pass the already-fetched `vr` when calling `_canvasAreaW` inside a function that already called `viewport.getBoundingClientRect()`, to avoid a redundant layout query.

### Mobile sidebar auto-close

`Canvas._closeMobileSidebar()` (module-private) is called at the start of `fitAll()` and `focusOnItem()`. It removes the `sidebar-open` class and resets the toggle button text to `☰`. This ensures:
- `fitAll()` always centers content in the full visible viewport, not in a partial strip occluded by the overlay.
- `focusOnItem()` places the target item at the visible center, not hidden under the open sidebar.

`findFreePosition()` in `items.js` uses the same `position === 'fixed'` early-return pattern inline.

`fitAll()` uses `_canvasAreaW` to compute `availW` and centers content: `panX = (availW - contentW) / 2 - minX * zoom`. `focusOnItem()` centers on `_canvasAreaW(vr) / 2`.

## Undo/Redo

`history.js` captures full `JSON.stringify(State.serialize())` snapshots.

- `restoring` flag: prevents `scheduleCapture` from firing during `State.deserialize()` (would create infinite loop)
- `suspended` flag: prevents capturing the initial page load
- Always call `clearTimeout(timer); capture()` at the top of both `undo()` and `redo()` to flush any pending debounced change before navigating history
- `History.reset()`: clears stacks + takes fresh snapshot; called on `eventSwitched`

## Table Locking

`item.locked = true` means:
- AutoAssign skips this table (`capacity[t.id] = 0`)
- 🔒 badge appears in the SVG
- Existing guest assignments are preserved when re-running auto-assign with `keepExisting: false`

To unlock: double-click the table → uncheck the "נעול" checkbox → save.

## Custom Colors

Every canvas item (table, dancefloor, dj, door, shape) can have a custom color stored as `item.color`.

- **Tables**: color checkbox + color picker in the table edit modal. When enabled, `item.color` is stored; when disabled, `item.color = null` and the dynamic occupancy-based color is used.
- **Special items**: color picker always shown in the edit modal. Defaults to `CONFIG.COLORS[item.type]`.
- **Rendering**: `items.js buildTableSVG()` uses `item.color || tableColor(occ, seats)`. Special items use `item.color || CONFIG.COLORS[item.type]`.
- **Guest sidebar cards**: tables with a custom color show a colored `border-inline-end` on every guest card assigned to that table, and the table-number badge background also uses the custom color (via inline `style="background:COLOR"` on the `.guest-table-badge` span).
- **Print output**: table card borders and header backgrounds use the custom color. Guest list rows use `border-inline-end` on the table color column.

## Header Dropdowns

The header-actions area has two grouped dropdown menus implemented as `.header-dropdown` divs:

### 📦 Export/Import dropdown (`dropdownExport`)
Toggle: `btnDropdownExport` | Menu: `menuDropdownExport`

| Button ID | Action |
|-----------|--------|
| `btnExport` | `Storage.exportProjectJSON()` |
| `btnImport` | triggers `importFileInput.click()` |
| `btnExportCsv` | `Storage.exportCSV()` |
| `btnExportLayouts` | `Storage.exportLayoutOptions()` |
| `btnImportLayouts` | triggers `importLayoutsInput.click()` |

### 🖨️ Print dropdown (`dropdownPrint`)
Toggle: `btnDropdownPrint` | Menu: `menuDropdownPrint`

| Button ID | Action |
|-----------|--------|
| `btnPrintPlan` | `Print.printPlan()` |
| `btnPrintList` | `Print.printList()` |
| `btnPrintAll` | `Print.printAll()` |
| `btnPrintFull` | `Print.printFull()` |
| `btnPrintCards` | `Modals.openPrintCards()` |

### Dropdown behavior (app.js `initHeaderDropdowns`)
- `position: fixed` menu positioned via JS on each open (`getBoundingClientRect` of header and toggle button)
- `dd-open` class on both toggle and menu when open
- Closes on: outside click, menu item click (event bubbles), Escape key
- Toggle has CSS `::after { content: ' ▾' }` for dropdown indicator

### Layout Options row (header-center)
`#layoutOptionsRow` contains only: select dropdown + 💾 `btnSaveLayout` + 🗑 `btnDeleteLayout`. The export/import layout buttons were moved to the main export dropdown.

## Button Tooltips

All buttons have `title` attributes with a descriptive label and action. Key examples:

- Header dropdowns: `btnDropdownExport` → "תפריט ייצוא וייבוא נתונים", `btnDropdownPrint` → "תפריט הדפסה — בחר סוג הדפסה"
- Guest cards: "מצא שולחן פנוי עבור מוזמן זה" (🔍), "עריכת פרטי המוזמן" (✏️), "מחיקת המוזמן מהרשימה" (🗑)
- Canvas resize handle: "גרור לשינוי גודל הפריט"

## Clear Board Buttons

Settings modal footer has two destructive actions:

| Button | ID | Calls | Confirmation text |
|--------|-----|-------|-------------------|
| 🗑 נקה הכל (כולל מוזמנים) | `btnResetBoard` | `State.resetBoard()` | "למחוק את הכל לחלוטין? (שולחנות, מוזמנים, ופרטי אירוע)" |
| 🗑 נקה שולחנות (שמור מוזמנים) | `btnResetKeepGuests` | `State.resetBoardKeepGuests()` | "לנקות את כל השולחנות והפריטים? רשימת המוזמנים תישמר (שיבוצים יאופסו)." |

`resetBoard()` clears items + guests + event metadata (tags and tablePresets are kept — they are configuration, not event data). `resetBoardKeepGuests()` clears items only, nulls all `tableId` assignments, and drops split-artifact guests.

## Per-Type Table Shape Defaults

The Add Table modal has a **type selector** row (shown only in add mode, hidden in edit mode):

- **כללי** (`data-ttype=""`) — uses `settings.defaultShape` + 10 seats
- **👫 חברים** (`data-ttype="friends"`) — uses `settings.defaultFriendsShape` + `settings.defaultFriendsSeats`
- **👨‍👩‍👧 הורים** (`data-ttype="parents"`) — uses `settings.defaultParentsShape` + `settings.defaultParentsSeats`

`_applyTableType(type)` in `modals.js` reads live `State.get().settings`, writes to `#tableSeats`, calls `syncShapeBtns`, and toggles `.active` on type buttons.

**Important interaction**: clicking a **preset button** also resets the type buttons to "כללי" active (preset overrides type selection). Conversely, clicking a type button after a preset overwrites the preset's shape and seat count.

New settings fields: `defaultFriendsShape` (default `'circle'`) and `defaultParentsShape` (default `'rectangle'`) are stored in `createDefaultState().settings` and configured via `settingFriendsShape` / `settingParentsShape` selects in the settings modal.

Font appearance settings (`fontNumberSize`, `fontLabelSize`, `fontGuestSize`, `fontOccupancySize`, `fontNumberColor`, `fontLabelColor`, `fontGuestColor`, `fontOccupancyColor`) are also in `createDefaultState().settings`. Size fields default to `null` (auto-scaled). They are edited in the "מראה טקסט בשולחנות" section of the settings modal and apply to both canvas rendering and print output. Saving the settings modal calls `Items.renderAll()` so existing canvas items immediately reflect the new sizes/colors. Each row has a per-row ↺ reset button (`btn-font-reset[data-row]`) and there is a global `#btnResetAllFonts` button — both reset input fields only (state is updated on save). Handlers are wired via `btn.onclick` in `openSettings()` each time the modal opens.

## Find Table (🔍 button)

Every guest card has a 🔍 button that opens `modalFindTable` via `Modals.openFindTable(guestId)`.

**Algorithm** (`_findTableCandidates`):
1. Excludes locked tables and the guest's current table.
2. Scores each remaining table by counting how many of the guest's own tags are present among guests already seated there.
3. Splits candidates into `fitting` (free ≥ guest.total) and `partial` (0 < free < guest.total).
4. Sorts `fitting` by tag score desc, then by tightest fit (least wasted seats).
5. Sorts `partial` by tag score desc, then by most free space.

**Modal flow**:
- **Fitting tables found**: shows up to 5 ranked options; "שבץ" assigns immediately.
- **No fitting table**: shows "no-fit" message; if partial tables exist, shows them with "פצל" buttons — each requires a `confirmDialog` before calling `splitGuestAtTable`.
- **Footer "צור שולחן חדש"**: shown only when `fitting.length === 0`; creates a table using the first preset (or defaults), assigns the guest, and calls `Canvas.focusOnItem`.

**Re-render note**: `_renderFindTableBody` reads live state on each open, so the list reflects table occupancy at the moment the modal is opened.

## Guest Split

When a guest group doesn't fit at one table:
- **Auto-assign**: `placeWithSplit` creates sibling guest cards with `splitOf: originalId`
- **Manual drag**: overflow modal offers a split button; `splitGuestAtTable` handles it
- **Find Table modal**: partial-fit rows offer a split button with `confirmDialog` confirmation
- Split guests show a `⛓ פוצל` badge on their sidebar card and `(פיצול)` in print output

## Full Project Import / Export

`Storage.exportProjectJSON()` exports the entire project — all events, their items, guests, settings, table presets, tags, and canvas positions — as a single JSON file (format version 2):

```json
{
  "version": 2,
  "exportedAt": "...",
  "meta": { "currentId": "evt_1", "events": [{ "id": "evt_1", "name": "...", "date": "...", "updated": "..." }] },
  "events": {
    "evt_1": { /* full State.serialize() snapshot */ }
  }
}
```

`Storage.importProjectJSON(file)` auto-detects format:
- **Full project file** (`data.meta && data.events` object) → replaces ALL localStorage events with the imported ones, confirms with `window.confirm` first.
- **Single-event file** (old format, no `meta`/`events` keys) → backward-compatible: deserializes into the current event.

**Write-before-delete safety**: new event keys are written BEFORE old ones are removed. If writing fails mid-way, old data is still intact. Old keys not in the new project are deleted only after the new meta is committed.

**Key invariant**: `_currentId` is set after `writeMeta(cleanMeta)` and before `State.deserialize()`, so the auto-save listener writes to the correct key.

**Filename**: derived from the current active event (`_currentId`), falling back to the first event.

**Triggering**: `btnExport` (📤) and `Ctrl+E` both call `exportProjectJSON`. `btnImport` (📥) calls `importProjectJSON` which handles both formats.

## Guest Import / Export

```javascript
Storage.exportGuestsJSON()               // exports {version:1, tags, guests} — no tableId/splitOf
Storage.importGuestsJSON(file, merge)    // merge=true adds to existing; merge=false replaces
```

Exported files omit table assignments and split markers so the list is portable across events. On replace mode with an empty file, a `window.confirm` is required to prevent accidental data loss.

## Print

Five modes, each with its own hidden `<div>` in `index.html`:

| Mode | Print area | Content |
|------|-----------|---------|
| `plan` | `#printPlanArea` | Table cards grid (3-column) + stats header; tables sorted by number ascending; shape icon (○/▭/□) shown beside seat count |
| `list` | `#printListArea` | Sortable guest table with table number column |
| `all` | `#printAllArea` | Room SVG diagram + page break + full guest table |
| `full` | `#printFullArea` | Room diagram + **one page per table** (visual SVG + full guest detail) + final guest table |
| `cards` | `#printCardsArea` | Grid of 8×8 cm foldable seating cards (2 per row, A4 portrait) |

### Room diagram SVG (`printAll`, `printFull`)

`Print.buildRoomDiagramSVG()` computes a bounding box from all canvas items and renders a simplified SVG (no seat circles). Returns `{ svg }`. Font sizes and guest names use the same per-table scaling as `buildTableSVG()` in `items.js`: `scale = Math.min(W,H) / 130`, then clamp-based sizes using the same settings keys. Guest names render one per SVG `<text>` line with overflow indicator. SVG inline `max-height:120mm` ensures the diagram (≈120mm) fits on the same page as the header (~50mm) within landscape A4 (~186mm usable).

**Important**: `@page` rules cannot be nested inside CSS selectors. The landscape rule must be top-level — `printAll` and `printFull` call `_injectLandscape()` which writes `@page { size: A4 landscape; margin: 12mm 15mm; }` into a `<style id="_printOrientStyle">` tag before `window.print()` and `_clearLandscape()` removes it in a `setTimeout`. All pages in `printAll`/`printFull` are landscape (avoids blank-page bugs from CSS named-page transitions in Chromium). `printPlan` and `printList` remain portrait.

### Full print (`printFull`)

`Print.printFull()` produces a comprehensive multi-page document:
1. **Page 1** — event header, stats summary, room diagram SVG.
2. **One page per table** (via `page-break-before:always`) — a header with all table properties (see below), a large visual SVG of the table with seat circles (filled/empty), and a detailed guest table with columns: #, name, adults, children, total, tags, notes.
3. **Final page** — full guest list sorted by table then name, using the same `buildGuestTableHTML` helper.

All pages in `printFull` print landscape (injected `@page { size: A4 landscape; }`).

**Per-table page header** contains all properties also visible in the Full Details modal:
- Table number and label (title row, large font)
- Occupancy (`occ / seats מושבים`), shape (עיגול / מלבן / ריבוע), dimensions (`w×h`), custom color swatch (if set), lock badge (if locked) — all in the meta row

**Shape label mapping**: `{ circle: 'עיגול', rectangle: 'מלבן', square: 'ריבוע' }` — all three shapes distinguished correctly.

**`_buildTableVisualSVG(item, occ)`**: renders a print-sized SVG of the table body and seat circles, seat occupancy indicators, number, label, and guest names (same positioning math as `buildTableSVG()` in `items.js`). **`occ` must be passed** from the caller — passing `undefined` causes all seats to render empty (they compare `i < undefined` → always false). Uses `Items.distributeRectSeats` for rect seat layout (exported from `items.js`) to keep canvas and print rendering consistent. Font sizes/colors follow the same settings keys (`fontGuestSize/fontGuestColor` etc.), with print-appropriate defaults (`numSize=22`, `labelSize=13`, `guestSize=10`, `occuSize=9`).

**Page orientation**: `printAll` and `printFull` always print landscape via `_injectLandscape()` / `_clearLandscape()` helper pair (JS-injected `@page` rule). CSS named-page rules are not used because Chromium inserts a blank page before the first element that transitions from the default unnamed page to a named page.

**Tags escaping**: All user-supplied tag strings are passed through `UI.escHtml` in both `buildGuestRows` (shared helper) and `printFull`'s per-table guest detail rows.

## Collision-Free Item Placement

`Items.findFreePosition(w, h)` — used automatically by `addTable` and `addSpecialItem` when no explicit `x`/`y` is supplied:

1. Computes the viewport-center in canvas coordinates using `State.get().canvas` (zoom/panX/panY) and the sidebar width.
2. Tries that center point. If free (no overlap with existing items + GAP=30px clearance), returns it immediately.
3. Otherwise, spirals outward in rings of `step = max(w,h) + GAP`, checking 12 candidate points per ring (every 30°).
4. Fallback: stacks below all existing items.

**Obstacle list** is rebuilt fresh on each call from `State.get().items`. For batch additions (qty > 1 in the table modal), each sequential `addTable` call sees the previously added tables in state, so they spread without collision.

**Auto-assign** (`autoCreateTables`) passes explicit `x`/`y` to `Items.addTable`, so `findFreePosition` is bypassed — it has its own grid+ring placement logic.

### New-item flash
Every `addTable` / `addSpecialItem` call triggers `flashItem(id)` (50 ms delay for DOM readiness). Flash lasts 2.5 s — long enough to spot the new item in a crowded canvas.

### Table hover tooltip

Every table element fires `mouseenter`/`mousemove`/`mouseleave` events that show/move/hide a singleton `div.table-hover-tooltip` appended to `document.body`. The tooltip lists all assigned guests (up to 14, then "+N more"), the occupancy ratio, and the table number/label. Position is clamped to the viewport edges. The element is created lazily on first use (`_getTooltip()`) and reused.

### Table SVG font scaling

`buildTableSVG()` computes `scale = minDim / 130` where `minDim = Math.min(width, height)`. Font sizes follow this priority:

1. **Per-table override** — `item.fontSize` / `item.fontLabelSize` / `item.fontGuestSize` / `item.fontOccupancySize`
2. `settings.fontNumberSize / fontLabelSize / fontGuestSize / fontOccupancySize` — global event settings
3. Auto-scaled fallback (clamped):

| Variable | Per-table field | Formula (fallback) | Min–Max |
|----------|-----------------|--------------------|---------|
| `numFont` | `item.fontSize` | `stt.fontNumberSize \|\| round(15 * scale)` | 10–24 |
| `labelFont` | `item.fontLabelSize` | `stt.fontLabelSize \|\| round(10 * scale)` | 7–14 |
| `guestFont` | `item.fontGuestSize` | `stt.fontGuestSize \|\| round(8 * scale)` | 6–11 |
| `occuFont` | `item.fontOccupancySize` | `stt.fontOccupancySize \|\| round(7 * scale)` | 6–9 |

Font **colors** follow the same source (no per-table override, global settings only):

| Variable | Setting key | Default |
|----------|-------------|---------|
| `numColor` | `fontNumberColor` | `#1a237e` |
| `labelColor` | `fontLabelColor` | `#37474f` |
| `guestColor` | `fontGuestColor` | `#546e7a` |
| `occuColor` | `fontOccupancyColor` | `#888888` |

These settings are also applied in `print.js` (`buildRoomDiagramSVG` — colors only; `_buildTableVisualSVG` — both colors and all per-table font sizes). All settings persist in JSON export/import automatically via `State.serialize()`.

Per-table font overrides: `item.fontSize` (number), `item.fontLabelSize` (label), `item.fontGuestSize` (guest names), `item.fontOccupancySize` (occupancy). Settable via the bulk edit modal (`modalBulkEdit`). When set, they take priority over global settings for that specific table.

Guest names are rendered one per SVG `<text>` line below the label. Available lines = `floor(remainingHeight / lineH)` where `lineH = guestFont + 2.5`. When `guests.length > rawMaxG`, `maxG` is reduced by 1 to reserve a slot for the `+N` overflow indicator, ensuring it stays within the table body boundary.

### Table renumber (`Items.renumberTables`)

`Items.renumberTables({ reversed = false } = {})` — two buttons in the header:
- `btnRenumber` (# מחדש) — forward order (smallest position gets number 1)
- `btnRenumberDesc` (# הפוך) — reverse order (largest position gets number 1)

Sorts all tables by visual position: top-to-bottom rows (snapped within `ROW_SNAP = 60px`), then right-to-left within each row (RTL convention). When `reversed=true`, the sorted array is reversed before number assignment. Wrapped in `Guests.startBatch()` / `Guests.endBatch()` so a single re-render follows all `State.updateItem` calls.

**Number-locked tables** (`item.numberLocked = true`): collected into a `lockedNums` Set. Unlocked tables are assigned sequential numbers 1, 2, 3… skipping any number already in `lockedNums`. This ensures locked tables keep their numbers while unlocked tables fill in the remaining slots. A toast indicates how many locked tables were skipped.

The `#` badge (purple, top-left corner of the SVG) is displayed on canvas and in the tables-only print diagram for tables where `item.numberLocked` is true. The `numberLocked` field is editable in both the edit-table modal (`tableNumberLockRow` form-group, hidden in add mode) and the full-details modal (`detailsTableNumberLock` checkbox).

### Distribute tables evenly (`Canvas.distributeTablesEvenly`)

Triggered by `btnDistribute` (header). Two steps:
1. **Normalize sizes**: within each shape group, apply the largest `width`/`height` to all members.
2. **Grid-arrange**: `cols = ceil(sqrt(n))`, spacing = `max(w, h) + 50px gap`. Grid is centered on the visible canvas viewport. Followed by `fitAll()` after 50 ms.

Both loops are wrapped in `Guests.startBatch()` / `Guests.endBatch()` to produce a single sidebar re-render.

### Normalize table sizes (`Modals.openNormalizeSizes`)

Triggered by `btnNormalizeSizes` (↔ גודל) in the canvas controls bar. Opens `modalNormalizeSizes`.

**Modal controls:**
- **`#normalizeSizeRef`** — `<select>` listing all tables sorted by number (shows shape + current dimensions in each option).
- **`#normalizeSameShape`** — checkbox (checked by default): when checked, only tables of the SAME SHAPE as the reference are resized.
- **`#normalizeSizePreview`** — live preview text: "N שולחנות יושוו ל-W×H פיקסלים" — updates on every change to the select or checkbox.
- **`btnConfirmNormalizeSizes`** — applies the resize: calls `State.updateItem(id, { width, height })` for each target, wrapped in `Guests.startBatch()` / `Guests.endBatch()`.

**Key functions in `modals.js`:**
- `openNormalizeSizes()` — builds the option list, resets `normalizeSameShape` checkbox to `checked` on every open, wires `onchange` listeners (idempotent), calls `_normalizeSizePreview()`, opens modal.
- `_normalizeSizePreview()` — reads current select value + checkbox, filters tables, updates preview text.
- `_confirmNormalizeSizes()` — applies size updates, shows toast, closes modal. If the reference table was deleted after the modal was opened, shows a warning toast and closes the modal instead of failing silently.

**Shape labels**: `_shapeLabel` / `_shapeLabelPlur` use `'עגול'` / `'עגולים'` (consistent with the rest of the codebase — not `'עיגול'`).

**Important**: only `width` and `height` are updated — shape, seats, label, color, and position are untouched.

## Auto-Assign Improvements

`AutoAssign.run({ allowSplit, keepExisting, respectProximity, createTables })`:

- `createTables: true` — calls `autoCreateTables(pending)` to create enough new tables to cover the capacity deficit before assigning. Uses the first table preset if available, otherwise `defaultFriendsSeats`/`defaultShape` from settings.
- Returns `{ assigned, failed, splitsCreated, tablesCreated }`. A result modal (`modalAutoAssignResult`) shows these stats after each run. The modal is skipped if all four values are zero (run bailed early with a toast).
- `baseY` for new tables uses `items.reduce((acc, i) => Math.max(acc, ...), 220)` rather than `Math.max(...items.map(...))` to avoid `-Infinity` on an empty items array.

## Layout Options (Multiple Seating Arrangements)

Each event can have multiple named seating arrangements (layout options). The live state (items, guest assignments, canvas view) is always the working copy. Layout options are named snapshots the user can save and restore.

### Data structure

`_state.layoutOptions` — array stored alongside items/guests/canvas in every serialized state. Each option:
```javascript
{
  id:          'opt_1750000000000',   // 'opt_' + Date.now()
  name:        'סידור א׳',
  items:       [...],                 // deep copy of state.items at save time
  assignments: { 'guest_1': 'item_2', 'guest_3': null, ... }, // all guest → tableId mappings
  canvas:      { zoom, panX, panY }
}
```

Layout options are included automatically in all event JSON exports/imports (via `State.serialize()` / `State.deserialize()`).

### State API

| Method | Description |
|--------|-------------|
| `State.saveLayoutOption(name, id?)` | Snapshot current items + assignments + canvas. If `id` is provided, updates that option; otherwise creates new with `'opt_'+Date.now()`. Emits `layoutOptionsChanged`. Returns the saved option's ID. |
| `State.loadLayoutOption(id)` | Replaces state items + guest assignments + canvas from snapshot. Emits `dataLoaded`. Returns `true`/`false`. |
| `State.deleteLayoutOption(id)` | Removes option from array. Emits `layoutOptionsChanged`. |
| `State.getLayoutOptions()` | Returns `[{id, name}]` (no full snapshot data). |
| `State.setLayoutOptions(arr)` | Replaces entire `layoutOptions` array; used by import. Emits `layoutOptionsChanged`. |

### UI

Header center (`#layoutOptionsRow`):
- `#selectLayoutOption` — `<select>` showing "── פריסה נוכחית ──" + all named options. Value `""` = no active option (working state); non-empty = ID of loaded option.
- `#btnSaveLayout` (💾) — opens `modalSaveLayout`. If a name matching an existing option is entered → updates that option; otherwise creates new.
- `#btnDeleteLayout` (🗑) — visible only when `_activeLayoutId` is set; confirms then calls `State.deleteLayoutOption`.
- `#btnExportLayouts` (📐) — moved to the 📦 Export/Import header dropdown; calls `Storage.exportLayoutOptions()`.
- `#btnImportLayouts` (📐) — moved to the 📦 Export/Import header dropdown; opens file picker → `modalImportLayouts` → merge or replace.

### `_activeLayoutId` (modals.js private)

Tracks which option was last loaded. Set to the option's ID after loading; reset to `null` when user selects "פריסה נוכחית" or when the active option is deleted (auto-corrected in the `layoutOptionsChanged` listener). Used by:
- `renderLayoutDropdown()` — sets `select.value` and shows/hides `btnDeleteLayout`
- `openSaveLayout()` — pre-fills the name input with the active option's name

### Dedicated export/import (Storage)

`Storage.exportLayoutOptions()` — downloads `{ version:1, exportedAt, layoutOptions: [...] }` as JSON. Warns if no options exist.

`Storage.importLayoutOptions(file, merge)` — parses file; if `merge=true`, adds new options (skips duplicate IDs); if `merge=false`, replaces all options via `State.setLayoutOptions()`. Calls `saveNow()` after import.

### Key invariant

`_activeLayoutId` must be set BEFORE calling `State.loadLayoutOption()` so that the synchronous `dataLoaded` → `renderLayoutDropdown()` call sees the new value. The change handler in modals.js follows this order.

## Serialization

`State.serialize()` / `State.deserialize()` serialize the full `_state` object as JSON. `deserialize` does a deep merge with `createDefaultState()` so old saves missing new keys still get defaults. Always update `CONFIG.STORAGE_KEY` (e.g., `seating_planner_v3`) when making breaking schema changes — this prevents loading corrupt old data.

## Key Patterns

### Adding a new item type
1. Add size constant in `config.js`
2. Add color in `CONFIG.COLORS`
3. Handle in `items.js` `addSpecialItem` switch
4. Add icon in `buildSpecialHTML` icons map
5. Add button in `index.html` sidebar (if needed)

### Adding a new guest field
1. Add to `addGuest` / `updateGuest` form in `modals.js`
2. Persist automatically (state is serialized wholesale)
3. Show in `buildGuestCard` in `guests.js` if visible
4. Add column to CSV export in `storage.js` if needed

### Adding a new modal
1. Add `.modal-overlay` HTML in `index.html`
2. Add `data-close-modal` attribute to close buttons (handled globally by `ui.js initModals`)
3. Add open/confirm functions in `modals.js`
4. Wire button in `modals.js init()` or `app.js`

## Item Context Menu

Every canvas item has a `⋮` action button (top-left corner, visible on hover/select) and supports right-click. Both open a shared singleton context menu (`_ctxMenu` in `items.js`) with:

- **📋 פרטים מלאים** — calls `Modals.openItemDetails(id)`; opens the full-details modal
- **שכפל** — calls `State.duplicateItem(id)`; new item is selected
- **שנה טקסט** — inline input + Enter/✓ → `State.updateItem(id, { label })`; calls `Guests.render()` for tables
- **שנה צבע** — inline color picker; ✓ button confirms (`State.updateItem`) and calls `Guests.render()` for tables; ✕ sets `color: null` (reverts to occupancy color for tables, default type color for special items)
- **סיבוב פריט** — inline row (`#ctxRotRow`, **all items**): ↺ (-90°) / ↻ (+90°) buttons apply immediately (menu stays open); number input 0–359 + ✓ saves; ⊙ resets to null (no rotation). Stored as `item.rotation` (degrees). CSS `transform: rotate(Ndeg)` is applied to the element. Resize handle is hidden when rotation ≠ 0 (resize doesn't work correctly with CSS rotation).
- **סיבוב טקסט** — inline row (`#ctxTextRotRow`, **all items**): select 0°/90°/180°/270°; ✓ saves to `item.textRotation`. For tables: wraps all text elements in `<g transform="rotate(deg,cx,cy)">`. For special items: applies `transform:rotate(deg);display:inline-block` to `.special-label`.
- **גודל גופן / צבע גופן** — two inline rows (`#ctxFontSizeRow`, `#ctxFontColorRow`) shown **only for non-table items**. ✓ saves to `item.fontSize` / `item.fontColor`; ✕ clears to null (auto). Applied in `buildSpecialHTML()` via inline style on the `.special-label` span. Both fields are hex-sanitized before rendering.
- **גודל אייקון** — inline row (`#ctxIconSizeRow`) shown **only for non-table items**. ✓ saves to `item.iconSize`; ✕ clears to null (auto = CSS `font-size: 24px`). Applied in `buildSpecialHTML()` via inline `font-size` on the `.special-icon` span.
- **הסתר אייקון** — inline row (`#ctxHideIconRow`, **non-table items only**): checkbox + ✓ saves to `item.hideIcon` (bool). When true, `buildSpecialHTML()` skips the `<span class="special-icon">` element entirely.
- **✓ שמור וסגור** — (`#ctxSaveAll`) shown **only for non-table items**; closes the menu. For non-table items all inline row ✓/✕ buttons apply their change immediately **without** closing the menu (via `_closeIfTable()` helper), so the user can adjust multiple properties before clicking this button.
- **⊞ יישר/פזר פריטים** — (`#ctxAlignBtn`) shown when ≥2 items are selected; opens `Modals.openAlignItems()`.
- **מחק** — confirm dialog → `State.removeItem(id)`

### Context menu pitfalls

- **Action button blocks drag**: `pointerdown` on `.item-action-btn` calls `e.stopPropagation()` to prevent drag initiation.
- **Outside-click capture listener**: added once in `_buildCtxMenu` with `capture: true`; skips clicks inside the menu or on `.item-action-btn` elements.
- **Live color preview vs. Guests.render()**: `input` event updates item only (cheap SVG redraw); `Guests.render()` is deferred to the ✓ button to avoid full sidebar rebuild on every color-picker drag tick.
- **Singleton menu**: `_ctxMenu` is created lazily on first use (`_buildCtxMenu`), then reused. All button handlers close over `_ctxItemId`.

## Item Full Details Modal (`modalItemDetails`)

`Modals.openItemDetails(id)` opens `modalItemDetails` (`.modal-xl`, 820px max-width) with all editable fields for any canvas item. The body (`#itemDetailsBody`) is rebuilt on every call.

### Table fields (two-column layout)
Left column — editable form:
- **מספר שולחן** (`detailsTableNumber`) — positive integer; only written to state if non-empty
- **תווית / שם** (`detailsTableLabel`)
- **מספר מושבים** (`detailsTableSeats`) — min 1, max 50
- **צורת שולחן** (`detailsShapeSelector`) — circle / rectangle / square; updates `_detailsShape` on click
- **גודל** (`detailsTableW` / `detailsTableH`) — min 60px each; only written if non-zero
- **גודל גופן** (`detailsTableFontSize`) — optional override; null if empty
- **צבע מותאם אישית** (`detailsColorEnabled` checkbox + `detailsTableColor` picker)
- **נעל שולחן** (`detailsTableLock`)

Right column — live guest roster:
- **+ הוסף מוזמן** button (header row, `btnDetailAddGuest`) — calls `openAddGuestToTable(id)`
- Table with columns: שם, מבוגרים, ילדים, תגיות, הערות, buttons
- **✏️ ערוך** — closes `modalItemDetails` and opens `openEditGuest(id)` (called directly inside the same IIFE)
- **✕ הסר** — `confirmDialog` → `State.assignGuest(gid, null)` → `openItemDetails(id)` to refresh

### Add Guest to Table (`modalAddGuestToTable`)

`Modals.openAddGuestToTable(tableId)` — opened from the `+ הוסף מוזמן` button in `openItemDetails`.

- Shows a searchable list of all unassigned guests (`tableId === null && !splitOf`)
- Multi-select via checkboxes; search filters by name (case-insensitive substring)
- Confirming assigns all checked guests via `State.assignGuest` wrapped in `Guests.startBatch()/endBatch()`
- After confirm: closes `modalAddGuestToTable`, re-opens `openItemDetails(tableId)` to refresh the roster, shows a success toast
- Module-level `_addGuestToTableId` tracks the target table ID across render cycles

### Special item fields (single-column)
Label, width (min 40), height (min 40), color picker. Shape selector shown only for `type === 'shape'`.

### Save (`saveItemDetails`)
- Tables: reads all form fields, calls `State.updateItem` then `Guests.render()`
- Special items: reads label/width/height/color/shape, calls `State.updateItem`
- Both paths call `UI.toast('הפרטים עודכנו ✓', 'success', 1800)` on success

### Key implementation notes
- `_detailsItemId` and `_detailsShape` are module-level variables in `modals.js`; separate from `_editingTableId`/`_tableShapeEdit` used by the add/edit table modal
- `openItemDetails` always rebuilds body HTML from live state, so calling it again after an unassign gives a fresh view
- `openEditGuest` is called directly (not via `Modals.`) since both functions are inside the same IIFE

## Item Navigation Panel (`nav.js`)

`ItemNav` (`js/nav.js`) is a collapsible panel pinned to the left edge of the screen (below the header). It lists every canvas item for quick orientation and navigation.

### HTML structure
```html
<div id="itemNavPanel">
  <button id="itemNavToggleBtn">▶</button>
  <div id="itemNavContent">
    <div class="item-nav-header">פריטי האולם</div>
    <div id="itemNavList"></div>
  </div>
</div>
```

### Behavior
- **Toggle**: `▶` / `◀` button collapses/expands the panel. Class `nav-open` on `#itemNavPanel` shows the content.
- **List order**: tables sorted by number (ascending), then all non-table items.
- **Color dot**: reflects the item's current color — occupancy-based for tables without a custom color, or `item.color` if set. Shape of dot: circular (`border-radius:50%`) for circle tables, square otherwise.
- **Click** → `Items.selectItem(id)` + `Canvas.focusOnItem(id)`.
- **Right-click** → `Items.openCtxMenu(id, clientX, clientY)` — same context menu as right-clicking the canvas item.
- **Hover tooltip**: a singleton `div.nav-item-tooltip` appended to `<body>`. For tables: scaled SVG preview (140px max), label, occupancy, and a scrollable guest list showing up to 12 guests with their names, seat count (if >1), and color-coded tag badges; empty tables show "שולחן ריק". For special items: colored icon block, label, and dimensions. Tooltip position is clamped to viewport edges (both left and right).
- **Print**: hidden via `#itemNavPanel { display: none !important; }` in `print.css`.

### State synchronization
| Event | Action |
|-------|--------|
| `itemAdded` | Full re-render of list |
| `itemUpdated` | Full re-render of list |
| `itemRemoved` | Full re-render of list |
| `dataLoaded` | Full re-render of list |
| `guestAssigned` | `_refreshDot(tableId)` + `_refreshDot(prevTableId)` — cheap color-only update |
| `guestRemoved` | `_refreshDot(tableId)` — cheap color-only update |

### Exports used from `items.js`
- `Items.selectItem(id)` — select the item on canvas
- `Items.openCtxMenu(id, viewX, viewY)` — open the item's context menu at viewport coordinates
- `Items.buildTableSVG(item)` — generate the table SVG string for the tooltip preview

Both `buildTableSVG` and `openCtxMenu` were made public (added to the `items.js` return object) specifically for use by this panel.

## Guest List Controls

A `.guest-counts-bar` strip sits **between the `.stats-bar` and the "הוסף לאולם" panel** (i.e. below the four summary stats and above the add-items grid), showing live totals: `👨 N מבוגרים | 👧 N ילדים`. It is a full-width centered row with `direction: ltr` to prevent RTL bidi reordering of the emoji+number sequence. The counts are driven by `#statAdults` and `#statChildren` elements updated by `UI.updateStats()` (which calls `State.getStats()`). `State.getStats()` returns `totalAdults` and `totalChildren` in addition to the existing fields. Split siblings carry their own `adults`/`children` values (the original is mutated down proportionally), so summing all rows gives correct totals.

The guest panel has three sections:
1. **`.guests-search`** — search input + `#btnToggleFilters` collapse button (▲/▼)
2. **`#filterActiveBar`** — hidden by default; shown below search when the filter area is collapsed **and** any filter is active. Displays a summary like `"🔍 פילטר פעיל: 2 תגיות"` and a quick-clear button (`#btnClearFiltersBar`).
3. **`#guestsFiltersArea`** — collapsible wrapper containing `#tagsFilter` and `#guestsControls`. Has `max-height: 185px` and `overflow-y: auto` so it never steals space from the guest list.

`#btnToggleFilters` toggles the `.collapsed` class on `#guestsFiltersArea` (which sets `display:none`), updates button text (▲/▼), toggles `.collapsed-state` CSS class on the button, and calls `_updateClearBtn()` to refresh the banner and filter indicator.

`_updateClearBtn()` also toggles `.filter-active` on `#btnToggleFilters` whenever any filter is active (shows orange dot indicator regardless of collapse state).

**Layout notes**: `.guests-filters-area` is `flex-shrink: 0` so it never shrinks below its `max-height`. `.guests-list` has `min-height: 0` so flex can correctly shrink it to a small height when needed (without this, `overflow-y: auto` on a flex child doesn't scroll correctly).

`Guests.renderControls()` renders four rows inside `#guestsControls`:

### Sort modes
| Value | Behaviour |
|-------|-----------|
| `default` | Insertion order (state array) |
| `nameAsc` | Hebrew locale A→Z |
| `nameDesc` | Hebrew locale Z→A |
| `seatedFirst` | Assigned guests first |
| `unseatedFirst` | Unassigned guests first |
| `nearDanceFirst` | Guests with `nearDance` proximity preference first |
| `farDanceFirst` | Guests with `farDance` proximity preference first |
| `tableNumAsc` | Table number ascending; unassigned (number 0) appear first. Secondary sort by name. |
| `tableNumDesc` | Table number descending; unassigned (number 0) appear last. Secondary sort by name. |
| `custom` | User-defined drag order (`_customOrder` array) |

`custom` is activated automatically when the user drags a guest card via the reorder handle (⠿). `_customOrder` is seeded from the current state order on first drag.

### Group modes
| Value | Behaviour |
|-------|-----------|
| `none` | Flat list |
| `byTag` | One collapsible section per tag; guests with multiple tags appear in each matching section |
| `byTable` | One collapsible section per table (sorted by number), plus "לא שובצו" at the bottom |
| `byProximity` | One collapsible section per proximity key (from `CONFIG.PROXIMITY`), plus "ללא העדפה" at the bottom |

Collapse state is stored in the `_collapsed` Set (keyed `tag:TAG`, `table:ID`, or `prox:KEY`). Toggling does not trigger a full re-render — it only adds/removes the `collapsed` CSS class.

**Multi-tag/multi-proximity duplicate binding**: In `byTag` and `byProximity` modes a guest may appear in multiple sections, each with the same `data-guest-id` attribute. `_bindCardEvents` uses `listEl.querySelectorAll('[data-guest-id="..."]')` to wire all occurrences. The `id` attribute is NOT used on guest cards to avoid invalid duplicate IDs.

### Filter controls
- **Assigned toggle** (`_filterAssigned`): `null` = all, `true` = assigned only, `false` = unassigned only.
- **Table number** (`_filterTableNum`): free-text input filtered against `State.getItem(g.tableId)?.number`.
- **Tag filter** (`_filterTags` Set): rendered in `#tagsFilter` bar above the list; clicking a tag toggles it.
- **Tag filter mode** (`_tagFilterMode`): `'or'` (any selected tag) or `'and'` (all selected tags). OR/AND toggle buttons appear in the tag bar when 2+ tags are selected. Resets to `'or'` when fewer than 2 tags are active.
- **Proximity filter** (`_filterProximity`): `null` = all, or a proximity key (`'nearDance'`, `'farDance'`, `'nearEntrance'`), or `'none'` = guests with no proximity preference.
- **Search** (`_searchText`): `#guestSearch` text input, substring match on guest name.

`clearFilters()` resets all six dimensions (including `_filterProximity` and `_tagFilterMode`) and re-renders the tag bar and controls row.

The "✕ נקה" button gains the `.visible` class when any filter is active; hidden otherwise.

### Drag reorder (HTML5 drag)

The reorder handle (⠿ span) is separate from the pointer-based canvas-drag system. To avoid conflicts:
- Guest cards default to `draggable="false"`.
- `pointerdown` on the handle sets `el.draggable = true` and stops propagation (so canvas drag does not start).
- `dragend` resets `el.draggable = false`.
- `dragstart` is unconditional: if the element is draggable when the browser fires it, the drag is valid.

`_moveGuestBefore(srcId, targetId)` splices `srcId` before `targetId` in `_customOrder` and activates `custom` sort mode.

### Batching

`Guests.startBatch()` / `Guests.endBatch()` suppress intermediate renders during bulk `State.updateItem` loops (e.g., `distributeTablesEvenly`, `renumberTables`). `endBatch()` calls `render()` exactly once.

## Seating Cards (`printCards`)

`Print.printCards(opts)` prints one foldable tent card per guest (default 8×8 cm). Cards are sorted by table number then name.

**Card anatomy** (portrait, fold-in-half horizontally):
- Top half (`sc-top`): empty area, or background image if provided; dashed fold line at the border.
- Bottom half (`sc-bottom`): guest name (large, bold), table line (`שולחן N — label`), optional custom text row.

**Options object:**

| Field | Type | Default | Notes |
|-------|------|---------|-------|
| `nameFont` | string | `'inherit'` | Font for guest name; must be whitelisted |
| `nameFontSize` | number | `16` | Name font size in pt; clamped 6–40 |
| `nameColor` | string | `'#111111'` | Name text color; must match `/^#[0-9a-fA-F]{6}$/` |
| `nameBold` | boolean | `true` | Applies `font-weight:700` to name (default: bold) |
| `nameItalic` | boolean | `false` | Applies `font-style:italic` to name |
| `tableFont` | string | `'inherit'` | Font for table line; must be whitelisted |
| `tableFontSize` | number | `12` | Table line font size in pt; clamped 6–40 |
| `tableColor` | string | `'#333333'` | Table line text color; must match `/^#[0-9a-fA-F]{6}$/` |
| `tableBold` | boolean | `false` | Applies `font-weight:700` to table line |
| `tableItalic` | boolean | `false` | Applies `font-style:italic` to table line |
| `customText` | string | `''` | Optional extra line on every card |
| `customFont` | string | `'inherit'` | Font for custom text; must be whitelisted |
| `customFontSize` | number | `11` | Custom text font size in pt; clamped 6–28 |
| `customColor` | string | `'#333333'` | Custom text color; must match `/^#[0-9a-fA-F]{6}$/` |
| `customBold` | boolean | `false` | Applies `font-weight:700` to custom text |
| `customItalic` | boolean | `false` | Applies `font-style:italic` to custom text |
| `bgImage` | string\|null | `null` | Data URL (`data:image/...`); validated before use |
| `cardSize` | number | `80` | Card width & height in mm; clamped 50–120. Available sizes in modal: 60/70/80/90/100 mm |
| `showLabel` | boolean | `true` | If false, table label is omitted from the table line |
| `showCounts` | boolean | `true` | If true, shows adults/children counts (`מבוגרים: X \| ילדים: Y`) below the table line; blank cards show placeholder lines when enabled |
| `blankCount` | number | `0` | Number of blank placeholder cards to append (clamped 0–100) |
| `blankOnly` | boolean | `false` | If true, guest cards are skipped — only blank cards are printed |

**Card size**: `cardSize` is validated/clamped to 50–120mm. A `<style>` element overrides `.seating-card { width:Xmm; height:Xmm; }` and `.sc-top { height:X/2mm; }` at print time and is removed in the post-print cleanup timeout. On A4 portrait with 8mm @page margins, usable width ≈ 186mm (210 − 16mm margins − 8mm padding). Cards up to 90mm fit 2 per row (2×90mm + 5mm gap = 185mm); 100mm cards wrap to **1 per row** (2×100mm = 200mm > 186mm). Note: 90mm has only ~1mm clearance — browser sub-pixel rounding could cause wrapping on some print engines. Default 8×8 cm: 2 columns × 3 rows = **6 cards per page**.

**Blank cards**: When `blankCount > 0`, blank `.seating-card` elements are appended after guest cards (or in place of them when `blankOnly=true`). Their bottom half shows `שם: _______________` and `שולחן: ____________` placeholder lines (`.sc-placeholder`) plus the `customText` row if set.

**Background image security**: `bgImage` is validated against `/^data:image\//`. The data URL is injected into a single `<style>` element (not repeated inline per card) to avoid inflating the DOM for large images.

**Font whitelist**: `nameFont`, `tableFont`, and `customFont` are all validated against the same fixed Set of allowed values: `inherit`, Arial, Helvetica, Tahoma, Verdana, Trebuchet MS, Segoe UI, Calibri, Times New Roman, Georgia, Courier New, Impact, Comic Sans MS.

**Inline style override**: Name and table styles are applied as inline `style` attributes on `.sc-name` and `.sc-table` elements, overriding the CSS defaults. For `nameBold=false`, `font-weight:400` is explicitly set to override the CSS `font-weight:700` default.

**CSS**: `body[data-print-mode="cards"]` activates `#printCardsArea { display: flex !important; }`. Cards use `@page { margin: 8mm }` injected via `_injectCardsPage()` (reuses `_printOrientStyle` element).

**Background image note**: Browser must have "Print background graphics" enabled; a warning banner is shown in the modal when an image is loaded.

**Modal** (`modalPrintCards`): Live preview card (size scales with selection at 1.8px per mm), card size selector (60/70/80/90/100 mm), background image upload, per-section font/size/bold/italic/color controls for name, table line (includes show-label toggle), and custom text; blank cards section (count + blank-only option), template save/export/import. Uses `.modal.modal-md` (max-width 520px).

**Card template**: Settings are saved to localStorage key `seating_cards_template` (version 1 JSON). Background image is excluded (too large). Template buttons in modal footer: 💾 שמור (save default), 📤 ייצוא (export JSON), 📥 ייבוא (import JSON). On modal open, the saved template is automatically applied; if no template exists, factory defaults are used.

## Tables-Only Diagram Print (`printTablesDiagram`)

`Print.printTablesDiagram(opts)` — triggered by `btnPrintDiagram` (🗺) in the header, which now opens `modalPrintDiagram` (`Modals.openPrintDiagram()`). The modal lets the user choose the print mode and then calls `Print.printTablesDiagram({ showGuestList, guestFontSize, cols, showLabel, showOccupancy, fontMode, svgNumFont, svgLblFont, svgGstFont, svgOccFont, orientation })`.

### Font mode (`fontMode`)

Both standard and guest-list modes respect `fontMode`:

| Value | Behaviour |
|-------|-----------|
| `'auto'` (default) | Font sizes are auto-scaled proportionally to each table's size using `scale = Math.min(W,H)/130`. Per-table and global settings are ignored — ensures consistent readability regardless of canvas extent. |
| `'fixed'` | Fonts use explicit pt values (`svgNumFont`, `svgLblFont`, `svgGstFont`, `svgOccFont`). Standard SVG uses CSS `style="font-size:Xpt"` (physical units, unaffected by viewBox scale). Mini SVG uses the normalized 56.7-unit viewBox where 1 unit ≈ 1pt. |

**Why auto ignores canvas px values**: Per-table `item.fontSize` and global `stt.fontNumberSize` are canvas pixel values. In standard mode the viewBox spans the entire canvas in px — a 24px font on a 2000px canvas prints ~9pt, but on a 500px canvas prints ~35pt. Auto mode avoids this unpredictability by scaling relative to each table's own size.

### Standard mode (`showGuestList: false`, default)
- Compact event header (title, date, occupancy stats)
- Full-detail SVG of **only table items** (`buildRoomTablesOnlySVG(fontMode, overrideNumFont, overrideLblFont, overrideGstFont, overrideOccFont)`): seat circles (filled/empty, using `CONFIG.COLORS.seatOccupied` / `seatOver` / `seatEmpty`), occupancy-based or custom colors, table numbers, labels, and guest names
- Bounding box uses `seatPad = CONFIG.SEAT_RADIUS * 2 + 10` to include seat circles that extend outside item bounds
- `🔒` badge (top-right) for assignment-locked tables; `#` badge (purple, top-left) for number-locked tables
- SVG `max-height: 162mm` in landscape (A4 ~186mm usable minus ~24mm for header); `max-height: 245mm` in portrait (A4 ~273mm usable minus ~28mm for header) — controlled by `body[data-print-orient]` CSS attribute set at print time
- **Fixed mode pt-to-px**: layout calculations (text y-positions, guest list line height) need canvas-px estimates of pt sizes. Conversion: `ptToPx = 1 / (min(250/vbW, 162/vbH) * 2.835)` where 250mm and 162mm are the estimated usable A4 landscape print dimensions.

### Guest-list mode (`showGuestList: true`)
- Compact event header
- Two sub-modes controlled by `guestInShape` parameter:

#### Standard sub-mode (`guestInShape: false`, default)
- CSS grid (`diag-blocks-wrap`) of one **block** per table, sorted by table number
- Each block (`.diag-block`): flex row with a **mini table SVG** (`.diag-table-svg-wrap`, 20mm wide) beside a **compact HTML table** (`.diag-mini-table`, font size user-selectable 5–12pt)
  - Mini SVG (`_buildTableMiniSVG(item, occ, showLabel, showOccupancy, numFontOverride=0, lblFontOverride=0, occFontOverride=0)`): shows table shape (circle/rect), occupancy-based color, table number (bold). When `showOccupancy=true`, occ/seats text at top. When `showLabel=true` and `item.label` is set, label text below number (number shifts up). No seat circles for compactness. Font overrides: 0 = pure auto-scale (formula only, does NOT fall through to `item.fontXxx` or global settings — those are canvas px values and would be misinterpreted as pt in the normalized viewBox). **ViewBox normalization**: the SVG uses `viewBox="0 0 56.7 NH"` where NW=56.7 user units ≈ 20mm at 1pt/unit (since 20mm ÷ 0.353mm/pt ≈ 56.7). This means 1 SVG user unit ≈ 1pt in print, so user-entered font sizes map directly to physical pt values. Auto-scale: `scale = Math.min(56.7, NH) / 130`, clamping to minimums (10pt num, 7pt label, 6pt occu).
  - Mini table: colored header row (`background = item.color || tableOccupancyColor`; text color auto-contrasted via `_contrastColor(hex)`); rows of guest name + total count; split guests tagged `(פ)`
  - Header color uses `print-color-adjust: exact` so backgrounds print correctly
- In fixed mode, `numFontOverride/lblFontOverride/occFontOverride` are set to `svgNumFont/svgLblFont/svgOccFont`; in auto mode they are 0
- Grid columns: user-selected 2–5 (default 4); `guestFontSize` 5–12pt (default 8pt) controls guest-row text
- `_contrastColor(hex)`: returns `#fff` or `#111` based on WCAG luminance threshold 0.55

#### Guest-in-shape sub-mode (`guestInShape: true`, `gisOpts` object required)
All guests are rendered **inside** the table shape SVG, which grows vertically to fit. No HTML guest table beside it.

`_calcTableGuestInShapeHeight(item, guests, opts)` — calculates required SVG height:
```
h = 10 (top pad) + numFont + 4
  + (occFont + 3)  if opts.showOcc
  + (lblFont + 3)  if opts.showLabel && item.label
  + 7              if guests.length > 0 (divider)
  + guests.length × (gstFont + 3)
  + 8 (bottom pad)
```

`_buildTableGuestInShapeSVG(item, occ, guests, opts, forcedH)` — renders one table:
- Fixed SVG width `NW = 150` units
- Height: `NH = forcedH` (or contentH if not forced); for circles `NH = max(NW, forcedH)` (minimum square)
- Circle tables draw an `ellipse` (rx = NW/2−3, ry = NH/2−3); rectangles/squares draw a `rect`
- Content flows top-to-bottom: number → occupancy → label → divider line → guest names
- Guest names truncated to 20 chars (16 if count is shown); `opts.showCounts` appends ` (N)` when `guest.total > 1`

`_buildTablesGuestInShapeHTML(tables, cols, opts)` — normalizes sizes within `(shape, seats)` groups:
1. First pass: compute `_calcTableGuestInShapeHeight` for every table
2. Build `groupMaxH` map: key = `"${shape}_${seats}"`, value = max height in group
3. Second pass: render each table with `forcedH = groupMaxH.get(key)`
4. Returns `<div class="diag-blocks-wrap" ...>` grid

**`gisOpts` fields**:

| Field | Type | Default | Notes |
|-------|------|---------|-------|
| `numFont` | number | 18 | Table number font size (8–40) |
| `numColor` | hex | `#1a237e` | Table number color |
| `occFont` | number | 11 | Occupancy font size (6–30) |
| `occColor` | hex | `#888888` | Occupancy color |
| `lblFont` | number | 12 | Label font size (6–30) |
| `lblColor` | hex | `#37474f` | Label color |
| `gstFont` | number | 10 | Guest name font size (6–30) |
| `gstColor` | hex | `#333333` | Guest name color |
| `showOcc` | boolean | true | Show occupancy (X/Y) |
| `showLabel` | boolean | true | Show table label |
| `showCounts` | boolean | false | Show guest count `(N)` beside name |

Print orientation is user-selectable (`orientation = 'landscape'` default, or `'portrait'`). `_injectLandscape()` is called for landscape; `_clearLandscape()` for portrait. `document.body.dataset.printOrient` is set to the chosen orientation so CSS can apply the correct SVG `max-height`. Print mode `"diagram"` activates `#printTablesDiagramArea { display: flex }`.

### `modalPrintDiagram`
Modal (`modal-sm`) with:
- **Orientation toggle**: `btnDiagramOrientPortrait` (📄 לאורך) / `btnDiagramOrientLandscape` (🖼 לרוחב, active by default) — two `.shape-btn` buttons; reset to landscape on every open
- Font mode toggle: `btnDiagramFontAuto` (active by default) / `btnDiagramFontFixed` — segmented button pair using `.shape-btn` styling; toggles `#diagramFixedFontOpts` visibility and `#diagramFontModeHint`
- Fixed font inputs (in `#diagramFixedFontOpts`, 4-column grid, visible only in fixed mode):
  - `inputDiagramSvgNumFont` — table number font size (6–36pt, default 14)
  - `inputDiagramSvgLblFont` — table label font size (6–24pt, default 9)
  - `inputDiagramSvgGstFont` — guest names font size in standard SVG (6–18pt, default 8)
  - `inputDiagramSvgOccFont` — occupancy text font size (6–18pt, default 7)
- Checkbox `chkDiagramShowGuests` — shows/hides `#diagramGuestOpts` section; also hides `#diagramStdOpts`
- Guest list options (in `#diagramGuestOpts`, visible only when guest checkbox checked):
  - `inputDiagramGuestFont` — guest row font size in HTML table (5–12pt, default 8)
  - `selectDiagramCols` — column count (2/3/4/5, default 4)
  - `chkDiagramShowLabel` (checked by default) — show table label in mini SVG
  - `chkDiagramShowOccupancy` (checked by default) — show occ/seats in mini SVG
  - `chkDiagramGuestInShape` — enable guest-in-shape mode; shows `#diagramGuestInShapeOpts`
  - In `#diagramGuestInShapeOpts`: 4-row table (number/occupancy/label/guests) with font-size + color-picker + show-toggle per row; plus `chkGisShowCounts` for showing guest count beside name
- `btnDoPrintDiagram` — closes modal and calls `Print.printTablesDiagram(opts)`

### Standard diagram mode toggles (in modal, before the guest-list section)
Three checkboxes control what appears in the standard SVG diagram (when "הצג רשימת מוזמנים" is unchecked); hidden when guest-list mode is active:
- `chkDiagramStdLabel` (checked by default) — show/hide table labels in SVG
- `chkDiagramStdOccupancy` (checked by default) — show/hide occupancy (X/Y) text in SVG
- `chkDiagramStdGuests` (unchecked by default) — show/hide guest names in SVG

`buildRoomTablesOnlySVG` signature: `(fontMode, overrideNumFont, overrideLblFont, overrideGstFont, overrideOccFont, showLabel, showOccupancy, showGuests)`. All three boolean params default to their natural values (showLabel=true, showOccupancy=true, showGuests=false). textRotation per item is respected in SVG output.

## Item Rotation

Every canvas item supports rotation via `item.rotation` (integer degrees, 0–359, null = no rotation).

- Applied as CSS `transform: rotate(Ndeg)` on the `.canvas-item` element in `renderItem`.
- Resize handle (`.resize-handle`) is hidden when `item.rotation` is set (resize doesn't work correctly with CSS rotation due to coordinate mismatch).
- Set via context menu rotation row (↺ -90°, ↻ +90°, number input 0–359, ⊙ reset).
- +90°/−90° buttons apply immediately; menu stays open for iterative rotation.
- Rotation is preserved in JSON export/import automatically (serialized in item state).
- **Note**: Drag still works correctly (center-based). findFreePosition and bounding-box logic use the unrotated item bounds.

## Text Rotation

Every item supports independent text rotation via `item.textRotation` (0, 90, 180, 270 degrees, null = 0).

- **Tables** (`buildTableSVG`): text elements (number, label, occupancy, guest names) are accumulated in a `texts` string, then wrapped in `<g transform="rotate(textRot,W/2,H/2)">` before adding to the SVG. Shape/seat elements stay in `shapes` (never rotated). Lock/number badges stay in `badges` (never rotated).
- **Special items** (`buildSpecialHTML`): adds `transform:rotate(textRotDeg);display:inline-block` to `.special-label` inline style.
- Set via context menu text-rotation select (0°/90°/180°/270°) + ✓.
- Also applied in `buildRoomTablesOnlySVG` (diagram print) using the same `<g transform="rotate(...)">` pattern.

## Hide Icon

Special items (dancefloor, DJ, door, shape) support hiding the emoji icon via `item.hideIcon` (boolean, null = false).

- When `item.hideIcon` is truthy, `buildSpecialHTML()` skips the `<span class="special-icon">` element entirely.
- Set via context menu "הסתר אייקון" checkbox + ✓ (shown only for non-table items).
- Allows text-only labels for items where the icon is unwanted.

## Align / Distribute Items (`modalAlignItems`)

`Modals.openAlignItems()` — triggered by header button `btnAlign` (⊞, visible when ≥2 items selected) or context menu "⊞ יישר/פזר פריטים" (shown when ≥2 items selected).

Uses `Items.getSelectedIds()` to get the set of items to align. All coordinate math uses `item.x` / `item.y` (canvas center positions) and `item.width` / `item.height`.

### Alignment operations
| Button ID | Action |
|-----------|--------|
| `alignLeft` | All items' left edge = min left edge in selection |
| `alignRight` | All items' right edge = max right edge in selection |
| `alignTop` | All items' top edge = min top edge in selection |
| `alignBottom` | All items' bottom edge = max bottom edge in selection |
| `alignCenterH` | All items' center X = mean center X of selection |
| `alignCenterV` | All items' center Y = mean center Y of selection |
| `distributeH` | Sort by X; equal center-to-center horizontal spacing (requires ≥3 items) |
| `distributeV` | Sort by Y; equal center-to-center vertical spacing (requires ≥3 items) |

Distribution keeps the leftmost/topmost and rightmost/bottommost items fixed; middle items are repositioned with equal center-to-center step.

All operations are wrapped in `Guests.startBatch()` / `Guests.endBatch()` to avoid O(n) sidebar re-renders.

`btnAlign` visibility is managed by `_updateBulkEditBtn()` in `items.js` — shown when `_selectedIds.size >= 2`.

## Multi-Table Bulk Edit

Allows editing shared properties across multiple selected tables at once.

### Selection
- `_selectedIds: Set<string>` — all currently selected item IDs (in `items.js`)
- `_selectedId: string|null` — the last selected item (backward-compatible single-selection)
- **Ctrl+click / ⌘+click** calls `toggleSelectItem(id)` — adds or removes from `_selectedIds`
- Regular click calls `selectItem(id)` — clears `_selectedIds` and selects only one
- Right-click on an already-selected item does NOT clear the multi-selection (`if (!_selectedIds.has(id)) selectItem(id)`)
- `deselectAll()` clears both `_selectedIds` and `_selectedId`
- `Escape` key closes context menu and calls `deselectAll()`
- Delete/Backspace key on multi-selection triggers a confirmation and deletes all selected items

### Bulk edit button
`_updateBulkEditBtn()` — called after every selection change. Shows `btnBulkEdit` (✏️ in header) when ≥1 table is selected; updates its tooltip text with the count. Hidden when no tables are selected.

### Context menu bulk edit
When ≥2 tables are selected and the context menu opens, `ctxBulkEditSep` and `ctxBulkEditBtn` are shown. Button label is `"ערוך N שולחנות נבחרים"`. Clicking calls `Modals.openBulkEdit()`.

### `openBulkEdit()` (modals.js)
1. Gets selected table IDs via `Items.getSelectedIds()`, filters to `type === 'table'`
2. Displays count in `#bulkEditCount`
3. Pre-fills fields from first table's values
4. Resets all checkboxes to unchecked
5. Wires mutual exclusion between `chkBulkColor` and `chkBulkResetColor`
6. Save button applies only checked fields via `State.updateItem` wrapped in `Guests.startBatch()` / `Guests.endBatch()`

### `modalBulkEdit` fields
| Element | Field | Notes |
|---------|-------|-------|
| `chkBulkSeats` + `bulkEditSeats` | `seats` | Clamped 1–50 |
| `chkBulkShape` + `#bulkShapeSelector .shape-btn` | `shape` | `circle` / `rectangle` / `square`; local `_bulkShape` var tracks active selection; shape buttons pre-filled from first selected table |
| `chkBulkFont` + `bulkEditFontSize` | `fontSize` | null if empty (auto); table number font |
| `chkBulkLabelFont` + `bulkEditLabelFontSize` | `fontLabelSize` | null if empty (auto); table label font |
| `chkBulkGuestFont` + `bulkEditGuestFontSize` | `fontGuestSize` | null if empty (auto); guest names font |
| `chkBulkOccuFont` + `bulkEditOccuFontSize` | `fontOccupancySize` | null if empty (auto); occupancy ratio font |
| `chkBulkColor` + `bulkEditColor` | `color` | Mutual exclusive with chkBulkResetColor |
| `chkBulkResetColor` | `color: null` | Reverts to dynamic occupancy color |

### Exported symbols (items.js return object)
- `toggleSelectItem(id)` — toggle single item in multi-selection
- `getSelectedIds()` — returns `[...\_selectedIds]`
- `selectItem`, `getSelected`, `deselectAll` — unchanged single-selection API

## Print Improvements

- **Room diagram SVG** (`buildRoomDiagramSVG`): table numbers use `font-size="16"` (circles) / `font-size="15"` (rects) and `font-weight="800"` for high contrast. Labels use `font-weight="700"` at font-size 10/9.
- **Guest list table** now has an 8th column **תווית** (table label). `buildGuestRows` emits `<td>${tableLabel}</td>` and the totals row has an extra empty `<td>`.

## Common Pitfalls

- **Double render**: Don't call `renderItem()` directly after `State.addItem()` — `itemAdded` event handles it.
- **State mutation in sort**: Use `[...(g.tags || [])].sort()` not `g.tags.sort()`.
- **Redo flush**: Always `clearTimeout(timer); capture()` before popping undo/redo stacks.
- **guestRemoved payload**: Always `{ id, tableId }` — items.js needs tableId to refresh the right table.
- **History during restore**: `restoring = true` before `State.deserialize()`, `false` after — prevents snapshot loops.
- **Multi-event _currentId**: Set `_currentId` BEFORE calling `State.resetBoard()` / `State.deserialize()` in storage.js. The debounced change listener uses `_currentId` to determine which key to write.
- **Nested @page CSS**: `@page` rules cannot be nested inside regular CSS selectors. Use JS-injected `<style>` tags for conditional page orientation.
- **saveNow null guard**: `saveNow()` returns early if `_currentId` is null — prevents orphan writes during initialization or after a `deleteEvent` clears the ID before switching.
- **Guest card IDs**: Guest cards use `data-guest-id` (not `id`) so that `byTag` grouping can render the same guest in multiple sections without invalid duplicate `id` attributes. Always bind card events via `querySelectorAll('[data-guest-id="..."]')`.
- **Drag reorder vs. canvas drag**: Guest cards are `draggable="false"` by default. Only `pointerdown` on `.guest-reorder-handle` sets `draggable="true"`. Never set `draggable="true"` unconditionally — it would conflict with the pointer-based canvas drag for assigning guests to tables.
- **Tag AND/OR mode**: `_tagFilterMode` resets to `'or'` whenever `_filterTags.size < 2`. The OR/AND toggle buttons are only rendered in `renderTagFilter()` when `_filterTags.size >= 2`.
- **Batch during multi-updateItem loops**: Wrap any loop that calls `State.updateItem` multiple times in `Guests.startBatch()` / `Guests.endBatch()` to prevent O(n) sidebar re-renders.
- **CSS cache busting**: When deploying CSS changes to GitHub Pages, bump the `?v=N` query string on the `<link>` tags in `index.html` (e.g. `style.css?v=3`). GitHub Pages CDN caches CSS files; the old version can be served while the new HTML is live, making elements with `display:none` (like `.dropdown-menu`) render as visible blocks.
- **iOS Safari `position:fixed` in scroll containers**: Do NOT put `overflow-x: auto` / `overflow: scroll` on a parent of a `position:fixed` child. iOS Safari may treat the fixed child as `position:absolute` relative to the scrolling container. The `.header-actions` bar does not use `overflow-x: auto` for this reason; the button count is kept small enough to fit without scrolling.
- **Canvas items block dropdown close**: Canvas items call `e.stopPropagation()` on click, preventing the document-level `closeAll()` from firing. Use a `{capture: true}` listener on `#canvasViewport` to close dropdowns before item handlers run.

## Storage Warning & Getting Started

### Storage warning (`UI.showStorageWarning(force)`)

A fixed-position floating notification (`.storage-warning`) appended to `<body>`, warning users that all data is stored in localStorage and will be lost on cache clear.

**Behavior:**
- `force=true` — always shows (used on new event creation, first load)
- `force=false` — respects two localStorage guards:
  - `sp_storage_warn_dismissed = 'true'` → never show again
  - `sp_storage_warn_last` (timestamp) → show only if 4+ hours have passed since last show
- Updating `sp_storage_warn_last` on every show (even forced) prevents the periodic popup from firing again right after a forced show
- "אל תציג הודעה זו שוב" checkbox — sets `sp_storage_warn_dismissed = 'true'` when closing

**Trigger points:**
- `app.js` DOMContentLoaded: `showStorageWarning(true)` if no data (first load), else `showStorageWarning(false)` (periodic)
- `modals.js` `btnConfirmNewEvent` handler: `showStorageWarning(true)` after event creation (400ms delay)

**CSS:** `.storage-warning`, `.sw-header`, `.sw-icon`, `.sw-title`, `.sw-close`, `.sw-body`, `.sw-no-more`, animations `sw-in`/`sw-out`, class `sw-hiding` triggers exit animation before removal.

### Getting started tips (`UI.showGettingStarted(force)`)

Opens `modalGettingStarted` — a styled modal with 5 numbered tips (set up event, add tables, add guests, assign, backup).

**Behavior:**
- `force=true` — always shows
- `force=false` — shows only if `sp_gs_shown` is not `'true'` in localStorage
- Always sets `sp_gs_shown = 'true'` after showing (so `force=false` shows at most once)
- Opens with 500ms delay (allows page to settle)

**Trigger points:**
- `app.js` DOMContentLoaded: `showGettingStarted(true)` if no data (first load)
- `modals.js` `btnConfirmNewEvent` handler: `showGettingStarted(true)` after event creation (400ms delay)

**CSS:** `.gs-header`, `.gs-close`, `.gs-steps`, `.gs-step`, `.gs-num` — blue gradient header, numbered step circles.

## Guest Dependencies

Each event stores a `guestDependencies` array: `[{id, guestA, guestB, type, strength, notes}]`. Dependency types are defined in `CONFIG.DEPENDENCY_TYPES` (8 types: spouses, parents, family, friends, colleagues, divorced, conflict, prohibited). The `strength` field drives auto-assign behavior: `required` (must sit together), `preferred` (+score), `avoid` (-score), `forbidden` (hard constraint — can never share a table).

### State API
```javascript
State.addDependency({guestA, guestB, type, strength, notes})  // returns dep; guards guestA !== guestB
State.removeDependency(id)
State.updateDependency(id, updates)
State.getGuestDependencies(guestId)  // deps involving that guest
```

All mutators emit `dependenciesChanged`. `resetBoard()` clears `guestDependencies`. `resetBoardKeepGuests()` filters out deps referencing dropped split-artifact guests.

### Dependency Diagram Modal (`modalGuestDependencies`)
Opened from the 🔗 panel-header button or from individual guest card 🔗 buttons. Three tabs:
- **Graph** — `<canvas>` network view (circles = guests, colored edges = dep types)
- **Table** — sortable table of all deps with edit/delete
- **Suggest** — auto-suggestions based on shared tags

### `_nextDepId` recovery
`deserialize()` derives `_nextDepId` from `max(depId numeric suffix) + 1`, not from array length, to handle saves with deleted deps.

## Auto-Assign Algorithm (Hybrid CSP-Greedy)

`AutoAssign.run(opts)` — reads `state.settings.autoAssign`:

```javascript
{
  allowSplit: bool,
  keepExisting: bool,
  respectProximity: bool,
  createTables: bool,
  respectDependencies: bool,    // enables hard forbidden + soft scoring
  tableTypes: [],               // per-type config (future)
  customDepTypes: []            // user-defined dependency type names
}
```

**Phase 1 — Dependency maps** (if `respectDependencies`):
`buildDepMaps(guestDependencies)` → `{ forbidden, required, preferred, avoid }` maps (guestId → Set of co-guestIds).

**Phase 2 — Sort most-constrained first**: `sortByConstraints(guests, depMaps)` — guests with the most required+forbidden relationships are processed first.

**Phase 3 — Greedy assignment per affinity group**: For each group, `findBestTable()` filters out tables containing forbidden co-guests (`hasForbidden()`), then ranks by `proximityScore + depScore()` (required +500, preferred +200, avoid -300).

**`placeWithSplit()`** accepts `depMaps` and `tableGuests` as parameters; checks `hasForbidden()` before each split placement and updates `tableGuests` after each sub-placement so later iterations see correct state.

## New Venue Elements (Special Items)

11 new item types added to `addSpecialItem()`, `buildSpecialHTML()`, `config.js` SIZES/COLORS, and `index.html` sidebar:

| Type | Icon | Size (w×h) |
|------|------|------------|
| `stairs` | 🪜 | 90×60 |
| `elevator` | 🛗 | 60×60 |
| `kitchen` | 🍳 | 120×80 |
| `balcony` | 🌿 | 160×100 |
| `pool` | 🏊 | 200×120 |
| `waterfall` | 💧 | 80×120 |
| `bar` | 🍹 | 160×80 |
| `stage` | 🎤 | 200×100 |
| `photo` | 📸 | 100×80 |
| `buffet` | 🍽️ | 160×80 |
| `bathroom` | 🚻 | 60×50 |

All new types are handled in `print.js` `SPECIAL_ICONS` map and receive correct `item.rotation` wrapping in all print SVGs.

The extra venue items are grouped in a collapsible section in the sidebar (toggle via `btnToggleVenueItems`), wired in `modals.js init()`.

## Children with Parents

Guests have a `childrenWithParents` field (integer, 0–N) indicating how many of their children must be seated with a parent (not split to a different table). Set via the guest add/edit modal — the field is shown/hidden based on whether `guestChildren > 0`.

`State.addGuest()` initializes `childrenWithParents: 0`. Serialized and exported automatically.

## CSV / Excel Guest Import

`Storage.importGuestsCsv(file, merge)` — parses CSV with full quote/escape handling.
`Storage.importGuestsExcel(file, merge)` — uses SheetJS (`window.XLSX`) loaded from CDN. Checks `typeof XLSX === 'undefined'` and shows error toast if not loaded.
`Storage.downloadGuestTemplate()` — downloads a BOM-prefixed UTF-8 CSV with Hebrew headers and 4 example rows.

### Column headers recognized (Hebrew and English aliases)
| Column | Aliases |
|--------|---------|
| שם | name |
| מבוגרים | adults |
| ילדים | children |
| ילדים עם הורים | childrenWithParents |
| תגיות | tags (semicolon-separated) |
| הערות | notes |
| העדפת מיקום | proximity (nearDance/farDance/nearEntrance) |

### UI buttons (Export/Import dropdown)
- `btnDownloadGuestTemplate` — download template CSV
- `btnImportGuestsCsv` — trigger CSV file picker
- `btnImportGuestsExcel` — trigger Excel file picker
- `importGuestsCsvInput` (hidden file input) — shared for both
- `modalImportGuestsCsv` — merge/replace choice modal

SheetJS CDN: `https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js` (no SRI hash — known limitation).

## Demo Project

`Storage.loadDemoProject()` — injects a hardcoded demo event (חתונת כהן) with 12 guests, 7 items (3 tables + dancefloor + door + stage + 1 empty table), 3 guest dependencies, and 4 tags. Saves to localStorage under key `demo_${Date.now()}` and switches to it.

`Storage.removeDemoProject()` — deletes the demo event; guards against deleting it when it's the only event.

`Storage.isDemoLoaded()` — returns true if the demo event ID is still in the meta events list.

The demo event ID is tracked in localStorage key `sp_demo_event_id`. Buttons `btnLoadDemo` and `btnRemoveDemo` are in the Export/Import dropdown section "פרויקט דוגמא".

## Hints System

`UI.initHints()` — called from `app.js DOMContentLoaded`. Shows one random non-dismissed hint card in `#hintsContainer`. Dismissed hint IDs stored in localStorage key `sp_hints_hidden` (JSON array).

8 built-in hints covering: drag-to-assign, Ctrl+click multi-select, right-click context menu, guest dependencies, layout options, backup export, zoom/fit, CSV import.

Each hint card has:
- **✕** (dismiss-one) — adds hint ID to localStorage, hides card with animation
- **הסתר הכל** (dismiss-all) — adds all hint IDs, clears container

`_HINTS_KEY = 'sp_hints_hidden'`. Hints become visible after a 2-second delay via `.hint-visible` CSS class.

## Auto-Assign Settings Modal (`modalAutoAssignSettings`)

Opened from `btnOpenAutoAssignSettings` in the auto-assign modal footer.

Saves to `state.settings.autoAssign`:
- `respectDependencies` — checkbox
- `tableTypes` — array of per-type configs (name, quantity, seats, minOccupancyBeforeSplit)
- `customDepTypes` — array of user-defined dependency type names

## Print: Item Rotation

`item.rotation` (whole-item rotation, integer degrees) is now applied in all print SVG outputs:
- `buildRoomDiagramSVG`: tables and special items wrapped in `<g transform="rotate(deg,cx,cy)"><g transform="translate(lx,ly)">...</g></g>`
- `buildRoomTablesOnlySVG`: same wrapping pattern

`item.textRotation` (text-only rotation) is handled separately by wrapping only text elements in an inner `<g transform="rotate(textRot,W/2,H/2)">`.

## File Structure

```
table_orginizer/
├── index.html          # Single page, all modals inline
├── css/
│   ├── style.css       # Main styles (RTL, canvas, sidebar, modals, responsive)
│   └── print.css       # A4 print styles for plan, guest list, and all-in-one
├── js/
│   ├── config.js
│   ├── state.js
│   ├── ui.js
│   ├── canvas.js
│   ├── drag.js
│   ├── items.js
│   ├── guests.js
│   ├── modals.js
│   ├── storage.js
│   ├── print.js
│   ├── history.js
│   ├── autoassign.js
│   ├── nav.js
│   └── app.js
└── .nojekyll           # Required for GitHub Pages (prevents Jekyll processing)
```

## GitHub Pages

The app is served from the `main` branch root. URL:
```
https://ohadsam.github.io/table_orginizer/
```

Ensure `.nojekyll` exists at the repo root (it does) and GitHub Pages is configured to deploy from `main` / root in the repository settings.
