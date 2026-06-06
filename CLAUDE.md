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
| `storage.js` | localStorage auto-save (debounced 400ms), JSON export/import, CSV export |
| `print.js` | Builds print-area HTML and triggers `window.print()` |
| `history.js` | Undo/Redo via full-state JSON snapshots (max 50, debounced 350ms) |
| `autoassign.js` | Smart auto-assign: affinity groups, proximity scoring, real split |
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

**CRITICAL**: `change` is fired automatically after every other event. Never emit `change` directly.

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

## Table Locking

`item.locked = true` means:
- AutoAssign skips this table (`capacity[t.id] = 0`)
- 🔒 badge appears in the SVG
- Existing guest assignments are preserved when re-running auto-assign with `keepExisting: false`

To unlock: double-click the table → uncheck the "נעול" checkbox → save.

## Proximity Scoring (Auto-Assign)

Defined in `CONFIG.PROXIMITY`. Each key maps to `{ target, want }`:
- `target`: item type (`'dancefloor'` or `'door'`)
- `want`: `'near'` (score = −distance) or `'far'` (score = +distance)

`nearDance` and `farDance` are mutually exclusive — the modal enforces this when toggling.

## Guest Split

When a guest group doesn't fit at one table:
- **Auto-assign**: `placeWithSplit` creates sibling guest cards with `splitOf: originalId`
- **Manual drag**: overflow modal offers a split button; `splitGuestAtTable` handles it

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

## Common Pitfalls

- **Double render**: Don't call `renderItem()` directly after `State.addItem()` — `itemAdded` event handles it.
- **State mutation in sort**: Use `[...(g.tags || [])].sort()` not `g.tags.sort()`.
- **Redo flush**: Always `clearTimeout(timer); capture()` before popping undo/redo stacks.
- **guestRemoved payload**: Always `{ id, tableId }` — items.js needs tableId to refresh the right table.
- **History during restore**: `restoring = true` before `State.deserialize()`, `false` after — prevents snapshot loops.

## File Structure

```
table_orginizer/
├── index.html          # Single page, all modals inline
├── css/
│   ├── style.css       # Main styles (RTL, canvas, sidebar, modals, responsive)
│   └── print.css       # A4 print styles for plan and guest list
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
