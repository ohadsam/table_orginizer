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
| `dataLoaded` | — | state.js | items.js (renderAll), guests.js (renderTagFilter+render), modals.js (updateEventHeader), nav.js (renderAll) |
| `change` | `{evt, data}` | state.js (auto) | storage.js (save), app.js (updateStats), history.js (scheduleCapture) |
| `eventSwitched` | — | storage.js | history.js (reset — clears undo/redo stacks) |

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

## Button Tooltips

All buttons have `title` attributes with a descriptive label and action. Key examples:

- Header: `btnExport` → "ייצוא נתוני האירוע לקובץ JSON", `btnAutoAssign` → "פתח חלון שיבוץ אוטומטי — שיבוץ מוזמנים לשולחנות לפי תגיות"
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
| `plan` | `#printPlanArea` | Table cards grid (3-column) + stats header |
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

1. `item.fontSize` — per-table manual override (number modal `#tableFontSize`); replaces `numFont` only
2. `settings.fontNumberSize / fontLabelSize / fontGuestSize / fontOccupancySize` — global event settings
3. Auto-scaled fallback (clamped):

| Variable | Formula (fallback) | Min–Max |
|----------|--------------------|---------|
| `numFont` | `item.fontSize \|\| stt.fontNumberSize \|\| round(15 * scale)` | 10–24 |
| `labelFont` | `stt.fontLabelSize \|\| round(10 * scale)` | 7–14 |
| `guestFont` | `stt.fontGuestSize \|\| round(8 * scale)` | 6–11 |
| `occuFont` | `stt.fontOccupancySize \|\| round(7 * scale)` | 6–9 |

Font **colors** follow the same source (no per-table override, global settings only):

| Variable | Setting key | Default |
|----------|-------------|---------|
| `numColor` | `fontNumberColor` | `#1a237e` |
| `labelColor` | `fontLabelColor` | `#37474f` |
| `guestColor` | `fontGuestColor` | `#546e7a` |
| `occuColor` | `fontOccupancyColor` | `#888888` |

These settings are also applied in `print.js` (`buildRoomDiagramSVG` — colors only; `_buildTableVisualSVG` — both colors and number/label sizes). All settings persist in JSON export/import automatically via `State.serialize()`.

`item.fontSize` is a per-table manual override (stored in state, editable in the table modal via `#tableFontSize`). When set, it replaces `numFont` only.

Guest names are rendered one per SVG `<text>` line below the label. Available lines = `floor(remainingHeight / lineH)` where `lineH = guestFont + 2.5`. When `guests.length > rawMaxG`, `maxG` is reduced by 1 to reserve a slot for the `+N` overflow indicator, ensuring it stays within the table body boundary.

### Table renumber (`Items.renumberTables`)

Triggered by `btnRenumber` (header). Sorts all tables by visual position: top-to-bottom rows (snapped within `ROW_SNAP = 60px`), then right-to-left within each row (RTL convention). Assigns sequential numbers 1, 2, 3…. Wrapped in `Guests.startBatch()` / `Guests.endBatch()` so a single re-render follows all `State.updateItem` calls.

### Distribute tables evenly (`Canvas.distributeTablesEvenly`)

Triggered by `btnDistribute` (header). Two steps:
1. **Normalize sizes**: within each shape group, apply the largest `width`/`height` to all members.
2. **Grid-arrange**: `cols = ceil(sqrt(n))`, spacing = `max(w, h) + 50px gap`. Grid is centered on the visible canvas viewport. Followed by `fitAll()` after 50 ms.

Both loops are wrapped in `Guests.startBatch()` / `Guests.endBatch()` to produce a single sidebar re-render.

## Auto-Assign Improvements

`AutoAssign.run({ allowSplit, keepExisting, respectProximity, createTables })`:

- `createTables: true` — calls `autoCreateTables(pending)` to create enough new tables to cover the capacity deficit before assigning. Uses the first table preset if available, otherwise `defaultFriendsSeats`/`defaultShape` from settings.
- Returns `{ assigned, failed, splitsCreated, tablesCreated }`. A result modal (`modalAutoAssignResult`) shows these stats after each run. The modal is skipped if all four values are zero (run bailed early with a toast).
- `baseY` for new tables uses `items.reduce((acc, i) => Math.max(acc, ...), 220)` rather than `Math.max(...items.map(...))` to avoid `-Infinity` on an empty items array.

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
- **גודל גופן / צבע גופן** — two inline rows (`#ctxFontSizeRow`, `#ctxFontColorRow`) shown **only for non-table items**. ✓ saves to `item.fontSize` / `item.fontColor`; ✕ clears to null (auto). Applied in `buildSpecialHTML()` via inline style on the `.special-label` span. Both fields are hex-sanitized before rendering.
- **גודל אייקון** — inline row (`#ctxIconSizeRow`) shown **only for non-table items**. ✓ saves to `item.iconSize`; ✕ clears to null (auto = CSS `font-size: 24px`). Applied in `buildSpecialHTML()` via inline `font-size` on the `.special-icon` span.
- **✓ שמור וסגור** — (`#ctxSaveAll`) shown **only for non-table items**; closes the menu. For non-table items all inline row ✓/✕ buttons apply their change immediately **without** closing the menu (via `_closeIfTable()` helper), so the user can adjust multiple properties before clicking this button.
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
- Table with columns: שם, מבוגרים, ילדים, תגיות, הערות, buttons
- **✏️ ערוך** — closes `modalItemDetails` and opens `openEditGuest(id)` (called directly inside the same IIFE)
- **✕ הסר** — `confirmDialog` → `State.assignGuest(gid, null)` → `openItemDetails(id)` to refresh

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
| `customText` | string | `''` | Optional extra line on every card |
| `customFont` | string | `'inherit'` | Must be one of the whitelisted font values |
| `customFontSize` | number | `11` | In pt; clamped 6–28 |
| `customColor` | string | `'#333333'` | Must match `/^#[0-9a-fA-F]{6}$/` |
| `bgImage` | string|null | `null` | Data URL (`data:image/...`); validated before use |
| `cardSize` | number | `80` | Card width & height in mm; clamped 50–120. Available sizes in modal: 60/70/80/90/100 mm |

**Card size**: `cardSize` is validated/clamped to 50–120mm. A `<style>` element overrides `.seating-card { width:Xmm; height:Xmm; }` and `.sc-top { height:X/2mm; }` at print time and is removed in the post-print cleanup timeout. On A4 portrait with 8mm margins, cards ≤90mm fit 2 per row; 100mm cards also fit 2 per row (usable width ≈ 186mm, 2×100mm = 200mm > 186mm → wraps to 1 per row — controlled naturally by flex wrap). Default 8×8 cm: 2 columns × 3 rows = **6 cards per page**.

**Background image security**: `bgImage` is validated against `/^data:image\//`. The data URL is injected into a single `<style>` element (not repeated inline per card) to avoid inflating the DOM for large images.

**Font whitelist**: `customFont` is validated against a fixed Set of allowed values: `inherit`, `'Arial',sans-serif`, `'Times New Roman',Times,serif`, `Georgia,serif`, `'Courier New',monospace`.

**CSS**: `body[data-print-mode="cards"]` activates `#printCardsArea { display: flex !important; }`. Cards use `@page { margin: 8mm }` injected via `_injectCardsPage()` (reuses `_printOrientStyle` element).

**Background image note**: Browser must have "Print background graphics" enabled; a warning banner is shown in the modal when an image is loaded.

**Modal** (`modalPrintCards`): Live preview card (size scales with selection at 1.8px per mm), card size selector (60/70/80/90/100 mm), background image upload, optional custom text with font/size/color controls. Guest count summary shown at bottom.

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
