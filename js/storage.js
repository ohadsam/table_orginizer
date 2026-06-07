'use strict';

const Storage = (() => {
  let _saveTimer = null;
  let _currentId = null;

  function evtKey(id) { return CONFIG.STORAGE_EVENT_PREFIX + id; }

  function readMeta() {
    try {
      const raw = localStorage.getItem(CONFIG.STORAGE_META_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch(e) { return null; }
  }

  function writeMeta(m) {
    try { localStorage.setItem(CONFIG.STORAGE_META_KEY, JSON.stringify(m)); }
    catch(e) { console.warn('writeMeta failed:', e); }
  }

  function saveNow() {
    if (!_currentId) return;
    clearTimeout(_saveTimer);
    try {
      const s = State.serialize();
      localStorage.setItem(evtKey(_currentId), JSON.stringify(s));
      const m = readMeta() || { events: [] };
      const entry = m.events.find(e => e.id === _currentId);
      if (entry) {
        entry.name    = s.event.name || 'אירוע ללא שם';
        entry.date    = s.event.date || '';
        entry.updated = new Date().toISOString();
        writeMeta(m);
      }
    } catch(e) { console.warn('Save failed:', e); }
  }

  function save() {
    clearTimeout(_saveTimer);
    _saveTimer = setTimeout(saveNow, 400);
  }

  function load() {
    let m = readMeta();

    if (!m) {
      // Try to migrate from legacy key
      const legacy = localStorage.getItem(CONFIG.STORAGE_KEY);
      if (legacy) {
        try {
          const data = JSON.parse(legacy);
          _currentId = 'evt_1';
          m = {
            currentId: _currentId,
            events: [{ id: _currentId, name: data.event?.name || 'אירוע ראשון',
                       date: data.event?.date || '', updated: new Date().toISOString() }]
          };
          writeMeta(m);
          localStorage.setItem(evtKey(_currentId), legacy);
          State.deserialize(data);
          return true;
        } catch(e) { console.warn('Migration failed:', e); }
      }
      // No data — create first event slot
      _currentId = 'evt_' + Date.now();
      m = { currentId: _currentId, events: [{ id: _currentId, name: '', date: '', updated: new Date().toISOString() }] };
      writeMeta(m);
      return false;
    }

    // Restore from meta
    _currentId = m.currentId;
    if (!_currentId || !m.events.find(e => e.id === _currentId)) {
      _currentId = m.events[0]?.id;
    }
    if (!_currentId) {
      _currentId = 'evt_' + Date.now();
      m.currentId = _currentId;
      m.events.push({ id: _currentId, name: '', date: '', updated: new Date().toISOString() });
      writeMeta(m);
      return false;
    }

    try {
      const raw = localStorage.getItem(evtKey(_currentId));
      if (raw) { State.deserialize(JSON.parse(raw)); return true; }
    } catch(e) { console.warn('Load failed:', e); }
    return false;
  }

  function updateCurrentMeta() {
    const m = readMeta();
    if (!m) return;
    const s = State.get();
    const entry = m.events.find(e => e.id === _currentId);
    if (entry) {
      entry.name = s.event.name || 'אירוע ללא שם';
      entry.date = s.event.date || '';
      writeMeta(m);
    }
  }

  function createEvent({ keepGuests = false } = {}) {
    saveNow();
    const newId = 'evt_' + Date.now();
    const m = readMeta() || { events: [] };
    m.events.push({ id: newId, name: '', date: '', updated: new Date().toISOString() });
    m.currentId = newId;
    writeMeta(m);
    _currentId = newId; // must set BEFORE state mutation so change events target the new key
    if (keepGuests) State.resetBoardKeepGuests();
    else            State.resetBoard();
    saveNow();
    State.emit('eventSwitched');
    UI.toast('אירוע חדש נוצר ✓', 'success');
  }

  function switchEvent(id, { silent = false } = {}) {
    if (id === _currentId) return;
    saveNow();
    const m = readMeta();
    if (!m || !m.events.find(e => e.id === id)) return;
    m.currentId = id;
    writeMeta(m);
    _currentId = id; // must set BEFORE deserialize
    try {
      const raw = localStorage.getItem(evtKey(id));
      if (raw) State.deserialize(JSON.parse(raw));
      else     State.resetBoard();
    } catch(e) { console.warn('Switch failed:', e); State.resetBoard(); UI.toast('נתוני האירוע פגומים — הלוח אופס', 'error'); }
    State.emit('eventSwitched');
    if (!silent) UI.toast('עברת לאירוע ✓', 'success', 1500);
  }

  function deleteEvent(id) {
    const m = readMeta();
    if (!m) return;
    if (m.events.length <= 1) { UI.toast('לא ניתן למחוק את האירוע האחרון', 'warning'); return; }
    localStorage.removeItem(evtKey(id));
    m.events = m.events.filter(e => e.id !== id);
    if (_currentId === id) {
      m.currentId = m.events[0].id;
      writeMeta(m);
      _currentId = null; // null guard in saveNow() prevents writing to the deleted key
      switchEvent(m.events[0].id, { silent: true });
    } else {
      writeMeta(m);
    }
    UI.toast('האירוע נמחק ✓', 'info');
  }

  function getEventsList() {
    const m = readMeta();
    return { events: m?.events || [], currentId: _currentId };
  }

  function exportJSON() {
    const data = State.serialize();
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    const name = (data.event.name || 'תוכנית_הושבה').replace(/\s+/g, '_');
    const date = new Date().toISOString().slice(0, 10);
    a.href = url; a.download = `${name}_${date}.json`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
    UI.toast('הקובץ יוצא בהצלחה ✓', 'success');
  }

  function exportProjectJSON() {
    saveNow();
    const m = readMeta();
    if (!m) { UI.toast('אין נתונים לייצוא', 'warning'); return; }
    const project = {
      version: 2,
      exportedAt: new Date().toISOString(),
      meta: m,
      events: {}
    };
    m.events.forEach(ev => {
      try {
        const raw = localStorage.getItem(evtKey(ev.id));
        if (raw) project.events[ev.id] = JSON.parse(raw);
      } catch(e) { console.warn('Failed to read event', ev.id, e); }
    });
    const json = JSON.stringify(project, null, 2);
    const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    const date = new Date().toISOString().slice(0, 10);
    const currentEvName = m.events.find(ev => ev.id === _currentId)?.name || m.events[0]?.name || '';
    const name = (currentEvName || 'פרויקט').replace(/\s+/g, '_');
    a.href = url; a.download = `${name}_${date}_פרויקט.json`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
    const exported = Object.keys(project.events).length;
    if (exported < m.events.length) {
      UI.toast(`הפרויקט יוצא — ${exported} מתוך ${m.events.length} אירועים (חלק מהנתונים פגומים)`, 'warning');
    } else {
      UI.toast(`הפרויקט יוצא בהצלחה (${exported} אירועים) ✓`, 'success');
    }
  }

  function _importFullProject(project) {
    return new Promise((resolve, reject) => {
      try {
        const importEvents = project.meta?.events || [];
        const importCount  = importEvents.length;
        if (!importCount) throw new Error('No events in project file');

        const existingMeta  = readMeta();
        const existingCount = existingMeta?.events?.length || 0;
        const msg = existingCount > 0
          ? `ייבוא זה ימחק את ${existingCount} האירועים הנוכחיים ויחליף ב-${importCount} אירועים מהקובץ.\nלהמשיך?`
          : `לייבא פרויקט עם ${importCount} אירועים?`;
        if (!window.confirm(msg)) { resolve(null); return; }

        // Write new event data FIRST — old keys remain intact until meta is committed
        const validIds = new Set();
        importEvents.forEach(ev => {
          const evData = project.events[ev.id];
          if (evData) { localStorage.setItem(evtKey(ev.id), JSON.stringify(evData)); validIds.add(ev.id); }
        });

        const cleanMeta = {
          ...project.meta,
          events: importEvents.filter(ev => validIds.has(ev.id))
        };
        if (!cleanMeta.events.length) throw new Error('No valid event data found in project file');
        if (!validIds.has(cleanMeta.currentId)) cleanMeta.currentId = cleanMeta.events[0].id;

        // Commit meta, then set _currentId (must precede any State mutation)
        writeMeta(cleanMeta);
        _currentId = cleanMeta.currentId;

        // Now safe to remove old keys that are no longer in the project
        if (existingMeta) {
          existingMeta.events.forEach(ev => {
            if (!validIds.has(ev.id)) localStorage.removeItem(evtKey(ev.id));
          });
        }

        const raw = localStorage.getItem(evtKey(_currentId));
        if (raw) State.deserialize(JSON.parse(raw));
        else     State.resetBoard();

        State.emit('eventSwitched');
        const loaded = validIds.size;
        const toast = loaded < importCount
          ? `יובאו ${loaded} מתוך ${importCount} אירועים (חלק מהנתונים חסרו בקובץ)`
          : `הפרויקט יובא — ${loaded} אירועים ✓`;
        UI.toast(toast, loaded < importCount ? 'warning' : 'success');
        resolve(project);
      } catch(err) { reject(err); }  // importProjectJSON's catch shows the toast
    });
  }

  function exportCSV() {
    const state = State.get();
    const guests = [...state.guests].sort((a, b) => {
      const ta = a.tableId ? (State.getItem(a.tableId)?.number ?? 9999) : 99999;
      const tb = b.tableId ? (State.getItem(b.tableId)?.number ?? 9999) : 99999;
      return ta - tb || a.name.localeCompare(b.name, 'he');
    });
    const esc = v => { const s = String(v ?? ''); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
    const header = ['שם', 'מבוגרים', 'ילדים', 'סהכ', 'תגיות', 'שולחן', 'פיצול'];
    const rows = guests.map(g => [
      g.name, g.adults, g.children, g.total,
      (g.tags || []).join('; '),
      g.tableId ? (State.getItem(g.tableId)?.number ?? '') : '',
      g.splitOf ? 'כן' : ''
    ].map(esc).join(','));
    const csv  = '﻿' + [header.join(','), ...rows].join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    const name = (state.event.name || 'רשימת_מוזמנים').replace(/\s+/g, '_');
    a.href = url; a.download = `${name}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
    UI.toast('רשימת המוזמנים יוצאה ל-CSV ✓', 'success');
  }

  function importJSON(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = e => {
        try {
          const data = JSON.parse(e.target.result);
          State.deserialize(data);
          saveNow();
          UI.toast('הנתונים יובאו בהצלחה ✓', 'success');
          resolve(data);
        } catch(err) { UI.toast('שגיאה בקריאת הקובץ', 'error'); reject(err); }
      };
      reader.onerror = () => { UI.toast('שגיאה בפתיחת הקובץ', 'error'); reject(reader.error); };
      reader.readAsText(file);
    });
  }

  function importProjectJSON(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async e => {
        try {
          const data = JSON.parse(e.target.result);
          if (data.meta && data.events && typeof data.events === 'object') {
            // Full project file
            const result = await _importFullProject(data);
            resolve(result);
          } else {
            // Single-event file — backward-compatible import into current event
            State.deserialize(data);
            saveNow();
            UI.toast('האירוע יובא בהצלחה ✓', 'success');
            resolve(data);
          }
        } catch(err) { UI.toast('שגיאה בייבוא הקובץ', 'error'); reject(err); }
      };
      reader.onerror = () => { UI.toast('שגיאה בפתיחת הקובץ', 'error'); reject(reader.error); };
      reader.readAsText(file);
    });
  }

  function exportGuestsJSON() {
    const state = State.get();
    const guests = state.guests.map(g => ({
      name:      g.name,
      adults:    g.adults,
      children:  g.children,
      tags:      g.tags || [],
      proximity: g.proximity || [],
      notes:     g.notes || ''
    }));
    const data = { version: 1, tags: state.tags, guests };
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    const name = (state.event.name || 'מוזמנים').replace(/\s+/g, '_');
    const date = new Date().toISOString().slice(0, 10);
    a.href = url; a.download = `${name}_מוזמנים_${date}.json`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
    UI.toast('רשימת המוזמנים יוצאה ✓', 'success');
  }

  function importGuestsJSON(file, merge) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = e => {
        try {
          const data = JSON.parse(e.target.result);
          if (!Array.isArray(data.guests)) throw new Error('Invalid guest file');
          if (!merge && State.get().guests.length > 0 &&
              !window.confirm(`ייבוא זה ימחק את ${State.get().guests.length} המוזמנים הקיימים. להמשיך?`)) {
            resolve(null); return;
          } else if (!merge && data.guests.length === 0 &&
              !window.confirm('הקובץ ריק. האם להמשיך ולמחוק את כל המוזמנים הנוכחיים?')) {
            resolve(null); return;
          }
          State.importGuests(data.guests, data.tags || null, merge);
          saveNow();
          UI.toast('המוזמנים יובאו בהצלחה ✓', 'success');
          resolve(data);
        } catch(err) { UI.toast('שגיאה בקריאת הקובץ', 'error'); reject(err); }
      };
      reader.onerror = () => { UI.toast('שגיאה בפתיחת הקובץ', 'error'); reject(reader.error); };
      reader.readAsText(file);
    });
  }

  // Auto-save on every state change
  State.on('change', save);

  return {
    save, saveNow, load,
    exportJSON, exportProjectJSON, exportCSV,
    importJSON, importProjectJSON,
    exportGuestsJSON, importGuestsJSON,
    createEvent, switchEvent, deleteEvent,
    getEventsList, updateCurrentMeta
  };
})();
