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
print.js → history.js → autoassign.js → app.js
```
`app.js` is the only entry point — it wires everything in `DOMContentLoaded`.

### Module Responsibilities

| File | Role |
|------|------|
| `config.js` | Frozen constants: sizes, colours, zoom limits, proximity defs, event types |
| `state.js` | Single source of truth. All mutation goes through here. Emits events. |
| `ui.js` | Toast notifications, modal open/close, stats bar, HTML escaping, tag colours |
| `canvas.js` | Viewport pan/zoom, coordinate transforms, pinch-to-zoom, fit-all, focusOnItem |
| `drag.js` | Pointer-events drag for canvas items (move + resize) and guest cards |
| `items.js` | Renders canvas items as DOM; SVG table drawing; selection; drop highlights |
| `guests.js` | Sidebar guest list: render, search, tag filter, drag bind |
| `modals.js` | All modal logic: add/edit table, guest, item, auto-assign, overflow, settings |
| `storage.js` | Multi-event localStorage auto-save (debounced 400ms), JSON/CSV export-import |
| `print.js` | Builds print-area HTML (plan, guest list, or all) and triggers `window.print()` |
| `history.js` | Undo/Redo via full-state JSON snapshots (max 50, debounced 350ms) |
| `autoassign.js` | Smart auto-assign: affinity groups, proximity scoring, real split, auto-create tables |
| `app.js` | DOMContentLoaded init, header button wiring, keyboard shortcuts |

## State & Event Bus

```javascript
State.on('eventName', callback)   // subscribe
State.emit('eventName', data)     // publish (also fires 'change')
```

### Key Events

| Event | Payload | Who emits | Who listens |
|-------|---------|-----------|-------------|
| `itemAdded` | item | state.js | items.js (render) |
| `itemUpdated` | item | state.js | items.js (refresh) |
| `itemRemoved` | id | state.js | items.js (remove el), guests.js (re-render displaced) |
| `guestAdded` | guest | state.js | guests.js (render) |
| `guestUpdated` | guest | state.js | guests.js (render), items.js (refresh table) |
| `guestRemoved` | `{id, tableId}` | state.js | guests.js (render), items.js (refresh table) |
| `guestAssigned` | `{guestId, tableId, prevTableId}` | state.js | guests.js (render), items.js (refresh both tables) |
| `dataLoaded` | — | state.js | items.js (renderAll), guests.js (renderTagFilter+render), modals.js (updateEventHeader) |
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
- **Guest sidebar cards**: tables with a custom color show a colored `border-inline-end` on every guest card assigned to that table.
- **Print output**: table card borders and header backgrounds use the custom color. Guest list rows use `border-inline-end` on the table color column.

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

## Guest Import / Export

```javascript
Storage.exportGuestsJSON()               // exports {version:1, tags, guests} — no tableId/splitOf
Storage.importGuestsJSON(file, merge)    // merge=true adds to existing; merge=false replaces
```

Exported files omit table assignments and split markers so the list is portable across events. On replace mode with an empty file, a `window.confirm` is required to prevent accidental data loss.

## Print

Three modes, each with its own hidden `<div>` in `index.html`:

| Mode | Print area | Content |
|------|-----------|---------|
| `plan` | `#printPlanArea` | Table cards grid (3-column) + stats header |
| `list` | `#printListArea` | Sortable guest table with table number column |
| `all` | `#printAllArea` | Room SVG diagram + page break + full guest table |

### Room diagram SVG (`printAll`)

`Print.buildRoomDiagramSVG()` computes a bounding box from all canvas items and renders a simplified SVG (no seat circles). Landscape mode is auto-detected: if `width/height > 1.3`, a `@page { size: A4 landscape; }` rule is injected via a `<style id="_printOrientStyle">` tag right before `window.print()` and removed in a setTimeout cleanup.

**Important**: `@page` rules cannot be nested inside CSS selectors. The landscape rule must be top-level, which is why it is injected by JS rather than being in `print.css`.

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

### Seat count text
Both circle and rect `buildTableSVG` now render `"${item.seats} מושבים"` as a dedicated SVG text element (font-size 8, below the table number). The existing occupancy ratio `occupancy/seats` remains at the top of the circle in smaller font (7px) as a quick reference.

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

- **שכפל** — calls `State.duplicateItem(id)`; new item is selected
- **שנה טקסט** — inline input + Enter/✓ → `State.updateItem(id, { label })`; calls `Guests.render()` for tables
- **שנה צבע** — inline color picker; `input` event gives live item preview; ✓ button confirms and calls `Guests.render()` for tables; ✕ sets `color: null` (reverts to occupancy color for tables, default type color for special items)
- **מחק** — confirm dialog → `State.removeItem(id)`

### Context menu pitfalls

- **Action button blocks drag**: `pointerdown` on `.item-action-btn` calls `e.stopPropagation()` to prevent drag initiation.
- **Outside-click capture listener**: added once in `_buildCtxMenu` with `capture: true`; skips clicks inside the menu or on `.item-action-btn` elements.
- **Live color preview vs. Guests.render()**: `input` event updates item only (cheap SVG redraw); `Guests.render()` is deferred to the ✓ button to avoid full sidebar rebuild on every color-picker drag tick.
- **Singleton menu**: `_ctxMenu` is created lazily on first use (`_buildCtxMenu`), then reused. All button handlers close over `_ctxItemId`.

## Common Pitfalls

- **Double render**: Don't call `renderItem()` directly after `State.addItem()` — `itemAdded` event handles it.
- **State mutation in sort**: Use `[...(g.tags || [])].sort()` not `g.tags.sort()`.
- **Redo flush**: Always `clearTimeout(timer); capture()` before popping undo/redo stacks.
- **guestRemoved payload**: Always `{ id, tableId }` — items.js needs tableId to refresh the right table.
- **History during restore**: `restoring = true` before `State.deserialize()`, `false` after — prevents snapshot loops.
- **Multi-event _currentId**: Set `_currentId` BEFORE calling `State.resetBoard()` / `State.deserialize()` in storage.js. The debounced change listener uses `_currentId` to determine which key to write.
- **Nested @page CSS**: `@page` rules cannot be nested inside regular CSS selectors. Use JS-injected `<style>` tags for conditional page orientation.
- **saveNow null guard**: `saveNow()` returns early if `_currentId` is null — prevents orphan writes during initialization or after a `deleteEvent` clears the ID before switching.

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
│   └── app.js
└── .nojekyll           # Required for GitHub Pages (prevents Jekyll processing)
```

## GitHub Pages

The app is served from the `main` branch root. URL:
```
https://ohadsam.github.io/table_orginizer/
```

Ensure `.nojekyll` exists at the repo root (it does) and GitHub Pages is configured to deploy from `main` / root in the repository settings.
