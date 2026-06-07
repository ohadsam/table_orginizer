# Verify Seating Planner Changes

This app has no automated test suite. Verify changes by running the app and exercising the relevant feature manually.

## Start the server
```bash
python3 -m http.server 8080
```
Open http://localhost:8080 in a browser.

## Feature checklist to run through after any change

### Core flow
- [ ] Add a table (circle and rectangle shapes)
- [ ] Add guests (with adults, children, tags, proximity)
- [ ] Drag a guest card onto a table — guest appears in the table SVG
- [ ] Drag a guest between tables
- [ ] Undo / Redo (Ctrl+Z / Ctrl+Y)

### Auto-assign
- [ ] Click Auto-assign → tables fill without overlap
- [ ] Enable "Create tables automatically" → new tables appear in a ring around the dance floor (if present) with no overlaps

### Multi-event
- [ ] Create a new event from Settings → old event data still loads after switching back
- [ ] "Keep guests" checkbox carries guests (without split artefacts) to the new event

### Print
- [ ] Print Plan → table cards visible with guest names
- [ ] Print All → room SVG diagram + guest list on separate page; landscape if room is wide

### Colors
- [ ] Set a custom color on a table → all assigned guest cards update their border immediately
- [ ] Export JSON → color preserved; Import JSON → color restored

### Import/Export
- [ ] Export guests JSON → re-import as merge → no duplicates lost
- [ ] Export CSV → opens in spreadsheet with correct columns including split column

## Regression areas to check after each major change
- Guest count in header stats (assigned / pending / total)
- Undo/Redo does not cross event boundaries
- localStorage `seating_planner_meta` key is intact after every action (check DevTools → Application → Local Storage)
