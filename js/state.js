'use strict';

const State = (() => {
  const _listeners = {};
  let _state = createDefaultState();

  function createDefaultState() {
    return {
      event: { type: 'wedding', name: '', date: '', venue: '' },
      settings: {
        defaultParentsSeats: 8,
        defaultFriendsSeats: 10,
        defaultShape: 'circle',
        defaultFriendsShape: 'circle',
        defaultParentsShape: 'rectangle',
        showGrid: false
      },
      canvas: { zoom: 0.6, panX: 40, panY: 40 },
      items: [],
      guests: [],
      tags: [...CONFIG.DEFAULT_TAGS],
      tablePresets: [
        { name: 'שולחן עגול',   shape: 'circle',    seats: 10, width: 130, height: 130 },
        { name: 'שולחן מלבן',   shape: 'rectangle', seats: 14, width: 210, height: 110 },
        { name: 'שולחן ארוך',    shape: 'rectangle', seats: 24, width: 320, height: 110 },
        { name: 'שולחן ריבועי',  shape: 'square',    seats:  8, width: 130, height: 130 }
      ],
      _nextItemId: 1,
      _nextGuestId: 1,
      _nextTableNum: 1
    };
  }

  /* ── event bus ── */
  function on(evt, cb) {
    (_listeners[evt] || (_listeners[evt] = [])).push(cb);
    return () => { _listeners[evt] = _listeners[evt].filter(x => x !== cb); };
  }
  function emit(evt, data) {
    (_listeners[evt] || []).forEach(cb => { try { cb(data); } catch(e){ console.error(e); } });
    if (evt !== 'change') emit('change', { evt, data });
  }

  /* ── getters ── */
  const get = () => _state;
  const getItem  = id => _state.items.find(i => i.id === id);
  const getGuest = id => _state.guests.find(g => g.id === id);
  const getTables = () => _state.items.filter(i => i.type === 'table');

  function getTableGuests(tableId) {
    return _state.guests.filter(g => g.tableId === tableId);
  }
  function getTableOccupancy(tableId) {
    return getTableGuests(tableId).reduce((s, g) => s + g.total, 0);
  }
  function getStats() {
    const totalGuests = _state.guests.reduce((s, g) => s + g.total, 0);
    const seatedGuests = _state.guests.filter(g => g.tableId).reduce((s, g) => s + g.total, 0);
    const totalCap = getTables().reduce((s, t) => s + t.seats, 0);
    return { totalGuests, seatedGuests, pendingGuests: totalGuests - seatedGuests,
             totalTables: getTables().length, totalCap };
  }

  /* ── items ── */
  function addItem(item) {
    item.id = 'item_' + (_state._nextItemId++);
    _state.items.push(item);
    emit('itemAdded', item);
    return item;
  }
  function updateItem(id, updates) {
    const item = getItem(id);
    if (!item) return null;
    Object.assign(item, updates);
    emit('itemUpdated', item);
    return item;
  }
  function removeItem(id) {
    const idx = _state.items.findIndex(i => i.id === id);
    if (idx < 0) return;
    _state.guests.forEach(g => { if (g.tableId === id) g.tableId = null; });
    _state.items.splice(idx, 1);
    emit('itemRemoved', id);
  }
  function duplicateItem(id) {
    const src = getItem(id);
    if (!src) return null;
    const copy = JSON.parse(JSON.stringify(src));
    delete copy.id;
    copy.x = (src.x || 0) + 40;
    copy.y = (src.y || 0) + 40;
    copy.locked = false;                       // copies start unlocked
    if (copy.type === 'table') copy.number = nextTableNumber();
    return addItem(copy);                       // emits itemAdded → renders
  }

  /* ── guests ── */
  function addGuest(guest) {
    guest.id = 'guest_' + (_state._nextGuestId++);
    guest.tableId = null;
    guest.total = (guest.adults || 0) + (guest.children || 0);
    _state.guests.push(guest);
    emit('guestAdded', guest);
    return guest;
  }
  function updateGuest(id, updates) {
    const guest = getGuest(id);
    if (!guest) return null;
    Object.assign(guest, updates);
    guest.total = (guest.adults || 0) + (guest.children || 0);
    emit('guestUpdated', guest);
    return guest;
  }
  function removeGuest(id) {
    const idx = _state.guests.findIndex(g => g.id === id);
    if (idx < 0) return;
    const tableId = _state.guests[idx].tableId;
    _state.guests.splice(idx, 1);
    emit('guestRemoved', { id, tableId });
  }
  function assignGuest(guestId, tableId) {
    const guest = getGuest(guestId);
    if (!guest) return false;
    const prev = guest.tableId;
    guest.tableId = tableId;
    emit('guestAssigned', { guestId, tableId, prevTableId: prev });
    return true;
  }

  /* ── table numbering ── */
  function nextTableNumber() {
    const used = new Set(getTables().map(t => t.number).filter(Boolean));
    let n = _state._nextTableNum;
    while (used.has(n)) n++;
    _state._nextTableNum = n + 1;
    return n;
  }

  /* ── tags ── */
  function addTag(tag) {
    tag = tag.trim();
    if (tag && !_state.tags.includes(tag)) {
      _state.tags.push(tag);
      emit('tagsChanged');
    }
  }
  /* ── table presets ── */
  function addTablePreset(preset) {
    _state.tablePresets.push(preset);
    emit('presetsChanged');
  }
  function removeTablePreset(idx) {
    if (idx >= 0 && idx < _state.tablePresets.length)
      _state.tablePresets.splice(idx, 1);
    emit('presetsChanged');
  }

  function removeTag(tag) {
    _state.tags = _state.tags.filter(t => t !== tag);
    _state.guests.forEach(g => { g.tags = (g.tags || []).filter(t => t !== tag); });
    emit('tagsChanged');
  }

  /* ── persistence ── */
  function serialize() {
    return JSON.parse(JSON.stringify(_state));
  }
  function deserialize(data) {
    const def = createDefaultState();
    // Deep merge nested objects so partial saves still get defaults
    _state = {
      ...def,
      ...data,
      event:    { ...def.event,    ...(data.event    || {}) },
      settings: { ...def.settings, ...(data.settings || {}) },
      canvas:   { ...def.canvas,   ...(data.canvas   || {}) },
      items:        Array.isArray(data.items)        ? data.items        : def.items,
      guests:       Array.isArray(data.guests)       ? data.guests       : def.guests,
      tags:         Array.isArray(data.tags)         ? data.tags         : def.tags,
      tablePresets: Array.isArray(data.tablePresets) ? data.tablePresets : def.tablePresets
    };
    _state.guests.forEach(g => { g.total = (g.adults || 0) + (g.children || 0); });
    emit('dataLoaded');
  }

  /* ── settings/event shorthand ── */
  function setEventField(key, val) {
    _state.event[key] = val;
    emit('eventChanged');
  }
  function setSetting(key, val) {
    _state.settings[key] = val;
    emit('settingsChanged');
  }
  function setCanvasView(zoom, panX, panY) {
    _state.canvas.zoom = zoom;
    _state.canvas.panX = panX;
    _state.canvas.panY = panY;
  }

  /* ── reset board (clears items, guests, and event metadata for a fresh new event) ── */
  function resetBoard() {
    _state.items  = [];
    _state.guests = [];
    _state._nextItemId  = 1;
    _state._nextGuestId = 1;
    _state._nextTableNum = 1;
    _state.event = { ...createDefaultState().event }; // clear event name/date for new event
    emit('dataLoaded');   // triggers full re-render
  }

  /* ── reset board keeping guests (wipes items/assignments only) ── */
  function resetBoardKeepGuests() {
    _state.guests = _state.guests.filter(g => !g.splitOf); // drop split artefacts to avoid double-counting
    _state.guests.forEach(g => { g.tableId = null; });
    _state.items = [];
    _state._nextItemId = 1;
    _state._nextTableNum = 1;
    emit('dataLoaded');
  }

  /* ── guest-only import (merge or replace) ── */
  function importGuests(guestsData, tagsData, merge) {
    if (!merge) {
      _state.guests = [];
      _state._nextGuestId = 1;
      if (tagsData) _state.tags = [...tagsData];
    } else if (tagsData) {
      tagsData.forEach(t => {
        t = String(t).trim();
        if (t && !_state.tags.includes(t)) _state.tags.push(t);
      });
    }
    guestsData.forEach(g => {
      const guest = {
        id: 'guest_' + (_state._nextGuestId++),
        name: g.name || '',
        adults: g.adults || 0,
        children: g.children || 0,
        tags: Array.isArray(g.tags) ? [...g.tags] : [],
        proximity: Array.isArray(g.proximity) ? [...g.proximity] : [],
        notes: g.notes || '',
        tableId: null
      };
      guest.total = guest.adults + guest.children;
      _state.guests.push(guest);
    });
    emit('dataLoaded');
  }

  return {
    get, on, emit,
    getItem, getGuest, getTables,
    getTableGuests, getTableOccupancy, getStats,
    addItem, updateItem, removeItem, duplicateItem,
    addGuest, updateGuest, removeGuest, assignGuest,
    nextTableNumber,
    addTablePreset, removeTablePreset,
    addTag, removeTag,
    serialize, deserialize, resetBoard, resetBoardKeepGuests, importGuests,
    setEventField, setSetting, setCanvasView
  };
})();
