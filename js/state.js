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
        showGrid: false,
        fontNumberSize: null,
        fontLabelSize: null,
        fontGuestSize: null,
        fontOccupancySize: null,
        fontNumberColor: '#1a237e',
        fontLabelColor: '#37474f',
        fontGuestColor: '#546e7a',
        fontOccupancyColor: '#888888',
        autoAssign: {
          allowSplit: true,
          keepExisting: false,
          respectProximity: true,
          createTables: false,
          respectDependencies: true,
          tableTypes: [],           // [{id, name, maxCount, maxSeats, minOccupancyBeforeSplit}]
          customDependencyTypes: [] // [{id, label, strength, color, icon}]
        },
        inferenceRules: null        // null = use CONFIG.DEFAULT_INFERENCE_RULES
      },
      canvas: { zoom: 0.6, panX: 40, panY: 40 },
      items: [],
      guests: [],
      guestDependencies: [],        // [{id, guestA, guestB, type, strength, label?}]
      tags: [...CONFIG.DEFAULT_TAGS],
      tablePresets: [
        { name: 'שולחן עגול',   shape: 'circle',    seats: 10, width: 130, height: 130 },
        { name: 'שולחן מלבן',   shape: 'rectangle', seats: 14, width: 210, height: 110 },
        { name: 'שולחן ארוך',    shape: 'rectangle', seats: 24, width: 320, height: 110 },
        { name: 'שולחן ריבועי',  shape: 'square',    seats:  8, width: 130, height: 130 }
      ],
      _nextItemId: 1,
      _nextGuestId: 1,
      _nextTableNum: 1,
      _nextDepId: 1,
      layoutOptions: []
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
    // Split siblings carry their own adults/children (original is mutated down proportionally),
    // so summing all rows gives correct totals as long as split fields stay in sync.
    const totalGuests   = _state.guests.reduce((s, g) => s + g.total, 0);
    const seatedGuests  = _state.guests.filter(g => g.tableId).reduce((s, g) => s + g.total, 0);
    const totalAdults   = _state.guests.reduce((s, g) => s + (g.adults   || 0), 0);
    const totalChildren = _state.guests.reduce((s, g) => s + (g.children || 0), 0);
    const totalCap      = getTables().reduce((s, t) => s + t.seats, 0);
    return { totalGuests, seatedGuests, pendingGuests: totalGuests - seatedGuests,
             totalTables: getTables().length, totalCap, totalAdults, totalChildren };
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
    if (guest.childrenWithParents === undefined) guest.childrenWithParents = 0;
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

  /* ── guest dependencies ── */
  function addDependency(dep) {
    if (!dep.guestA || !dep.guestB || dep.guestA === dep.guestB) return null;
    dep.id = 'dep_' + (_state._nextDepId++);
    if (!dep.strength && dep.type && CONFIG.DEPENDENCY_TYPES[dep.type])
      dep.strength = CONFIG.DEPENDENCY_TYPES[dep.type].strength;
    _state.guestDependencies.push(dep);
    emit('dependenciesChanged');
    return dep;
  }
  function removeDependency(id) {
    const idx = _state.guestDependencies.findIndex(d => d.id === id);
    if (idx < 0) return false;
    _state.guestDependencies.splice(idx, 1);
    emit('dependenciesChanged');
    return true;
  }
  function updateDependency(id, updates) {
    const dep = _state.guestDependencies.find(d => d.id === id);
    if (!dep) return null;
    Object.assign(dep, updates);
    if (updates.type && CONFIG.DEPENDENCY_TYPES[updates.type] && !updates.strength)
      dep.strength = CONFIG.DEPENDENCY_TYPES[updates.type].strength;
    emit('dependenciesChanged');
    return dep;
  }
  function getGuestDependencies(guestId) {
    return _state.guestDependencies.filter(d => d.guestA === guestId || d.guestB === guestId);
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
      settings: {
        ...def.settings,
        ...(data.settings || {}),
        autoAssign: { ...def.settings.autoAssign, ...((data.settings || {}).autoAssign || {}) }
      },
      canvas:   { ...def.canvas,   ...(data.canvas   || {}) },
      items:              Array.isArray(data.items)              ? data.items              : def.items,
      guests:             Array.isArray(data.guests)             ? data.guests             : def.guests,
      guestDependencies:  Array.isArray(data.guestDependencies)  ? data.guestDependencies  : def.guestDependencies,
      tags:               Array.isArray(data.tags)               ? data.tags               : def.tags,
      tablePresets:       Array.isArray(data.tablePresets)       ? data.tablePresets       : def.tablePresets,
      layoutOptions:      Array.isArray(data.layoutOptions)      ? data.layoutOptions      : def.layoutOptions
    };
    _state.guests.forEach(g => {
      g.total = (g.adults || 0) + (g.children || 0);
      if (g.childrenWithParents === undefined) g.childrenWithParents = 0;
    });
    // Derive _nextDepId from max existing ID suffix to handle deleted deps correctly
    if (!_state._nextDepId) {
      const maxId = _state.guestDependencies.reduce((mx, d) => {
        const n = parseInt((d.id || '').replace(/^dep_/, ''), 10);
        return isNaN(n) ? mx : Math.max(mx, n);
      }, 0);
      _state._nextDepId = maxId + 1;
    }
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
    _state.guestDependencies = [];
    _state._nextItemId  = 1;
    _state._nextGuestId = 1;
    _state._nextTableNum = 1;
    _state._nextDepId = 1;
    _state.event = { ...createDefaultState().event }; // clear event name/date for new event
    emit('dataLoaded');   // triggers full re-render
  }

  /* ── reset board keeping guests (wipes items/assignments only) ── */
  function resetBoardKeepGuests() {
    const keptGuestIds = new Set();
    _state.guests = _state.guests.filter(g => !g.splitOf); // drop split artefacts to avoid double-counting
    _state.guests.forEach(g => { g.tableId = null; keptGuestIds.add(g.id); });
    _state.items = [];
    _state._nextItemId = 1;
    _state._nextTableNum = 1;
    // Remove deps referencing dropped split-artifact guests
    _state.guestDependencies = _state.guestDependencies.filter(
      d => keptGuestIds.has(d.guestA) && keptGuestIds.has(d.guestB)
    );
    emit('dataLoaded');
  }

  /* ── layout options ── */
  function saveLayoutOption(name, id) {
    const opt = {
      id:   id || ('opt_' + Date.now()),
      name: name,
      items:       JSON.parse(JSON.stringify(_state.items)),
      assignments: {},
      canvas:      { ..._state.canvas }
    };
    _state.guests.forEach(g => { opt.assignments[g.id] = g.tableId; });
    const idx = _state.layoutOptions.findIndex(o => o.id === opt.id);
    if (idx >= 0) _state.layoutOptions[idx] = opt;
    else          _state.layoutOptions.push(opt);
    emit('layoutOptionsChanged', { id: opt.id });
    return opt.id;
  }

  function loadLayoutOption(id) {
    const opt = _state.layoutOptions.find(o => o.id === id);
    if (!opt) return false;
    _state.items = JSON.parse(JSON.stringify(opt.items));
    _state.guests.forEach(g => {
      g.tableId = Object.prototype.hasOwnProperty.call(opt.assignments, g.id)
        ? opt.assignments[g.id]
        : null;
    });
    if (opt.canvas) _state.canvas = { ..._state.canvas, ...opt.canvas };
    emit('dataLoaded');
    return true;
  }

  function deleteLayoutOption(id) {
    const idx = _state.layoutOptions.findIndex(o => o.id === id);
    if (idx < 0) return false;
    _state.layoutOptions.splice(idx, 1);
    emit('layoutOptionsChanged', { id: null });
    return true;
  }

  function getLayoutOptions() {
    return _state.layoutOptions.map(o => ({ id: o.id, name: o.name }));
  }

  function setLayoutOptions(arr) {
    _state.layoutOptions = Array.isArray(arr) ? JSON.parse(JSON.stringify(arr)) : [];
    emit('layoutOptionsChanged', { id: null });
  }

  /* ── inference rules ── */
  function saveInferenceRules(rules) {
    _state.settings.inferenceRules = rules;
    emit('change', { evt: 'inferenceRulesChanged' });
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
        childrenWithParents: g.childrenWithParents || 0,
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
    addDependency, removeDependency, updateDependency, getGuestDependencies,
    nextTableNumber,
    addTablePreset, removeTablePreset,
    addTag, removeTag,
    serialize, deserialize, resetBoard, resetBoardKeepGuests, importGuests,
    setEventField, setSetting, setCanvasView,
    saveLayoutOption, loadLayoutOption, deleteLayoutOption, getLayoutOptions, setLayoutOptions,
    saveInferenceRules
  };
})();
