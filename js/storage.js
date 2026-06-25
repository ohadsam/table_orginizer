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
    State.setLayoutOptions([]);  // layout options are per-event; don't carry over to the new event
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

  function exportLayoutOptions() {
    const opts = State.get().layoutOptions;
    if (!opts || !opts.length) { UI.toast('אין פריסות הושבה שמורות לייצוא', 'warning'); return; }
    const data  = { version: 1, exportedAt: new Date().toISOString(), layoutOptions: JSON.parse(JSON.stringify(opts)) };
    const json  = JSON.stringify(data, null, 2);
    const blob  = new Blob([json], { type: 'application/json;charset=utf-8' });
    const url   = URL.createObjectURL(blob);
    const a     = document.createElement('a');
    const name  = (State.get().event.name || 'פריסות').replace(/\s+/g, '_');
    const date  = new Date().toISOString().slice(0, 10);
    a.href = url; a.download = `${name}_פריסות_${date}.json`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
    UI.toast(`יוצאו ${opts.length} פריסות הושבה ✓`, 'success');
  }

  function importLayoutOptions(file, merge) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = e => {
        try {
          const data = JSON.parse(e.target.result);
          if (!Array.isArray(data.layoutOptions)) throw new Error('Invalid layout options file');
          const incoming = data.layoutOptions;
          let addedCount;
          if (!merge) {
            addedCount = incoming.length;
            State.setLayoutOptions(incoming);
          } else {
            const existingIds = new Set(State.get().layoutOptions.map(o => o.id));
            const toAdd = incoming.filter(o => !existingIds.has(o.id));
            addedCount = toAdd.length;
            State.setLayoutOptions([...State.get().layoutOptions, ...toAdd]);
          }
          saveNow();
          if (merge && addedCount === 0) {
            UI.toast('כל הפריסות כבר קיימות — לא נוספו פריסות חדשות', 'info');
          } else {
            UI.toast(`יובאו ${addedCount} פריסות הושבה ✓`, 'success');
          }
          resolve(data);
        } catch(err) { UI.toast('שגיאה בקריאת קובץ הפריסות', 'error'); reject(err); }
      };
      reader.onerror = () => { UI.toast('שגיאה בפתיחת הקובץ', 'error'); reject(reader.error); };
      reader.readAsText(file);
    });
  }

  /* ── Guest CSV import ── */
  // Expected columns (BOM-tolerant): שם, מבוגרים, ילדים, ילדים עם הורים, תגיות, הערות, העדפת מיקום
  function _parseCsvGuestRow(headers, cells) {
    const get = (variants) => {
      for (const v of variants) {
        const idx = headers.findIndex(h => h.replace(/^﻿/, '').trim() === v);
        if (idx >= 0) return (cells[idx] || '').trim();
      }
      return '';
    };
    const name     = get(['שם', 'Name', 'name']);
    if (!name) return null;
    const adults   = Math.max(0, parseInt(get(['מבוגרים', 'Adults', 'adults'])) || 0);
    const children = Math.max(0, parseInt(get(['ילדים', 'Children', 'children'])) || 0);
    const cwp      = Math.min(children, Math.max(0, parseInt(get(['ילדים עם הורים', 'childrenWithParents'])) || 0));
    const tagsRaw  = get(['תגיות', 'Tags', 'tags']);
    const tags     = tagsRaw ? tagsRaw.split(/[;,]/).map(t => t.trim()).filter(Boolean) : [];
    const notes    = get(['הערות', 'Notes', 'notes']);
    const proxRaw  = get(['העדפת מיקום', 'Proximity', 'proximity']);
    const proximity = proxRaw ? proxRaw.split(/[;,]/).map(p => p.trim()).filter(p => CONFIG.PROXIMITY[p]) : [];
    if (adults + children === 0) return null;
    return { name, adults, children, childrenWithParents: cwp, tags, notes, proximity };
  }

  function _parseCsv(text) {
    const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
    const parseLine = line => {
      const res = []; let cur = ''; let inQ = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') { if (inQ && line[i+1] === '"') { cur += '"'; i++; } else inQ = !inQ; }
        else if (ch === ',' && !inQ) { res.push(cur); cur = ''; }
        else cur += ch;
      }
      res.push(cur);
      return res;
    };
    const rows = lines.map(parseLine);
    if (rows.length < 2) return [];
    const headers = rows[0];
    return rows.slice(1).map(cells => _parseCsvGuestRow(headers, cells)).filter(Boolean);
  }

  function importGuestsCsv(file, merge) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = e => {
        try {
          const text   = e.target.result;
          const guests = _parseCsv(text);
          if (!guests.length) { UI.toast('לא נמצאו מוזמנים בקובץ. בדוק את הפורמט.', 'warning'); resolve(null); return; }
          if (!merge && State.get().guests.length > 0 &&
              !window.confirm(`ייבוא זה ימחק את ${State.get().guests.length} המוזמנים הקיימים. להמשיך?`)) {
            resolve(null); return;
          }
          State.importGuests(guests, null, merge);
          saveNow();
          UI.toast(`יובאו ${guests.length} מוזמנים מ-CSV ✓`, 'success');
          resolve(guests);
        } catch(err) { UI.toast('שגיאה בקריאת קובץ CSV', 'error'); reject(err); }
      };
      reader.onerror = () => { UI.toast('שגיאה בפתיחת הקובץ', 'error'); reject(reader.error); };
      reader.readAsText(file, 'UTF-8');
    });
  }

  /* ── Guest Excel import (uses SheetJS) ── */
  function importGuestsExcel(file, merge) {
    return new Promise((resolve, reject) => {
      if (typeof XLSX === 'undefined') {
        UI.toast('ספריית Excel לא נטענה — אנא רענן את הדף', 'error');
        reject(new Error('XLSX not loaded'));
        return;
      }
      const reader = new FileReader();
      reader.onload = e => {
        try {
          const wb     = XLSX.read(e.target.result, { type: 'array' });
          const ws     = wb.Sheets[wb.SheetNames[0]];
          const rows   = XLSX.utils.sheet_to_json(ws, { header: 1 });
          if (rows.length < 2) { UI.toast('הקובץ ריק', 'warning'); resolve(null); return; }
          const headers = rows[0].map(h => String(h || '').trim());
          const guests  = rows.slice(1).map(cells => {
            const strCells = cells.map(c => String(c ?? '').trim());
            return _parseCsvGuestRow(headers, strCells);
          }).filter(Boolean);
          if (!guests.length) { UI.toast('לא נמצאו מוזמנים. בדוק את הפורמט.', 'warning'); resolve(null); return; }
          if (!merge && State.get().guests.length > 0 &&
              !window.confirm(`ייבוא זה ימחק את ${State.get().guests.length} המוזמנים הקיימים. להמשיך?`)) {
            resolve(null); return;
          }
          State.importGuests(guests, null, merge);
          saveNow();
          UI.toast(`יובאו ${guests.length} מוזמנים מ-Excel ✓`, 'success');
          resolve(guests);
        } catch(err) { UI.toast('שגיאה בקריאת קובץ Excel', 'error'); reject(err); }
      };
      reader.onerror = () => { UI.toast('שגיאה בפתיחת הקובץ', 'error'); reject(reader.error); };
      reader.readAsArrayBuffer(file);
    });
  }

  /* ── Guest template CSV download ── */
  function downloadGuestTemplate() {
    const header = 'שם,מבוגרים,ילדים,ילדים עם הורים,תגיות,הערות,העדפת מיקום';
    const examples = [
      'משפחת כהן,2,0,0,משפחה,,',
      'משפחת לוי,2,2,1,"משפחה;חברים",ילדים אלרגיים,',
      'דוד ורחל ישראלי,2,0,0,VIP,,nearEntrance',
      'חברים מהצבא,4,0,0,חברים,,nearDance'
    ];
    const csv  = '﻿' + [header, ...examples].join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = 'תבנית_ייבוא_מוזמנים.csv';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
    UI.toast('תבנית ייבוא הורדה ✓', 'success', 1800);
  }

  /* ── Demo Project ── */
  const _DEMO_ID_KEY = 'sp_demo_event_id';

  function _buildDemoState() {
    const now = new Date().toISOString();
    return {
      event: { name: 'חתונת כהן — פרויקט דוגמא', date: '2026-12-20', notes: 'פרויקט דוגמא — ניתן למחוק בכל עת' },
      settings: {
        defaultShape: 'circle', defaultFriendsShape: 'circle', defaultParentsShape: 'rectangle',
        defaultFriendsSeats: 8, defaultParentsSeats: 10,
        fontNumberSize: null, fontLabelSize: null, fontGuestSize: null, fontOccupancySize: null,
        fontNumberColor: '#1a237e', fontLabelColor: '#37474f', fontGuestColor: '#546e7a', fontOccupancyColor: '#888888',
        autoAssign: { allowSplit: false, keepExisting: false, respectProximity: true, createTables: false, respectDependencies: true, tableTypes: [], customDepTypes: [] }
      },
      tags: ['משפחה', 'חברים', 'עבודה', 'VIP'],
      tablePresets: [{ name: 'שולחן עגול 8', shape: 'circle', seats: 8, width: 130, height: 130 }],
      guests: [
        { id: 'g1',  name: 'דוד ורחל כהן',     adults: 2, children: 0, childrenWithParents: 0, tags: ['משפחה', 'VIP'], notes: 'הורי החתן', proximity: ['nearEntrance'], tableId: 'i1', splitOf: null },
        { id: 'g2',  name: 'יוסף ומרים לוי',   adults: 2, children: 2, childrenWithParents: 1, tags: ['משפחה'],       notes: '',                proximity: [],              tableId: 'i1', splitOf: null },
        { id: 'g3',  name: 'שרה אברהם',         adults: 1, children: 0, childrenWithParents: 0, tags: ['משפחה'],       notes: 'סבתא של החתן',   proximity: ['nearEntrance'], tableId: 'i1', splitOf: null },
        { id: 'g4',  name: 'איתי ונועה ישראלי', adults: 2, children: 1, childrenWithParents: 1, tags: ['חברים'],       notes: '',                proximity: ['nearDance'],    tableId: 'i2', splitOf: null },
        { id: 'g5',  name: 'רונית מזרחי',       adults: 1, children: 0, childrenWithParents: 0, tags: ['חברים'],       notes: '',                proximity: ['nearDance'],    tableId: 'i2', splitOf: null },
        { id: 'g6',  name: 'גיל ורינת שמעון',   adults: 2, children: 0, childrenWithParents: 0, tags: ['חברים'],       notes: '',                proximity: [],              tableId: 'i2', splitOf: null },
        { id: 'g7',  name: 'אריאל ושני פרידמן', adults: 2, children: 3, childrenWithParents: 2, tags: ['חברים'],       notes: 'ילדים קטנים',    proximity: [],              tableId: 'i2', splitOf: null },
        { id: 'g8',  name: 'נעמי כץ',           adults: 1, children: 0, childrenWithParents: 0, tags: ['עבודה'],       notes: '',                proximity: [],              tableId: 'i3', splitOf: null },
        { id: 'g9',  name: 'עמית ודנה הרצוג',   adults: 2, children: 0, childrenWithParents: 0, tags: ['עבודה'],       notes: '',                proximity: [],              tableId: 'i3', splitOf: null },
        { id: 'g10', name: 'אורן ביטון',         adults: 1, children: 0, childrenWithParents: 0, tags: ['עבודה'],       notes: '',                proximity: [],              tableId: 'i3', splitOf: null },
        { id: 'g11', name: 'מיכל שוורץ',        adults: 1, children: 0, childrenWithParents: 0, tags: ['חברים', 'VIP'],notes: '',                proximity: [],              tableId: null, splitOf: null },
        { id: 'g12', name: 'יניב ואורית גולן',  adults: 2, children: 1, childrenWithParents: 1, tags: ['משפחה'],       notes: '',                proximity: [],              tableId: null, splitOf: null }
      ],
      items: [
        { id: 'i1', type: 'table', number: 1, label: 'שולחן כבוד', shape: 'rectangle', seats: 10, width: 200, height: 100, x: 300, y: 200, color: '#e8d5b7', locked: false, rotation: null, textRotation: null, numberLocked: false, fontSize: null, fontLabelSize: null, fontGuestSize: null, fontOccupancySize: null },
        { id: 'i2', type: 'table', number: 2, label: 'חברים',       shape: 'circle',    seats: 8,  width: 130, height: 130, x: 550, y: 200, color: null,      locked: false, rotation: null, textRotation: null, numberLocked: false, fontSize: null, fontLabelSize: null, fontGuestSize: null, fontOccupancySize: null },
        { id: 'i3', type: 'table', number: 3, label: 'עבודה',       shape: 'circle',    seats: 8,  width: 130, height: 130, x: 700, y: 200, color: null,      locked: false, rotation: null, textRotation: null, numberLocked: false, fontSize: null, fontLabelSize: null, fontGuestSize: null, fontOccupancySize: null },
        { id: 'i4', type: 'table', number: 4, label: '',            shape: 'circle',    seats: 8,  width: 130, height: 130, x: 550, y: 360, color: null,      locked: false, rotation: null, textRotation: null, numberLocked: false, fontSize: null, fontLabelSize: null, fontGuestSize: null, fontOccupancySize: null },
        { id: 'i5', type: 'dancefloor', label: 'רחבת ריקודים', width: 220, height: 150, x: 160, y: 340, color: '#c8e6c9', rotation: null, textRotation: null },
        { id: 'i6', type: 'door',       label: 'כניסה',        width: 70,  height: 40,  x: 160, y: 150, color: null,      rotation: null, textRotation: null },
        { id: 'i7', type: 'stage',      label: 'במה',          width: 180, height: 80,  x: 160, y: 490, color: '#fff9c4', rotation: null, textRotation: null }
      ],
      canvas: { zoom: 1, panX: 60, panY: 40 },
      guestDependencies: [
        { id: 'dep1', guestA: 'g1', guestB: 'g3', type: 'family',   strength: 'preferred', notes: 'סבתא עם הורי החתן' },
        { id: 'dep2', guestA: 'g4', guestB: 'g5', type: 'friends',  strength: 'preferred', notes: '' },
        { id: 'dep3', guestA: 'g8', guestB: 'g9', type: 'friends',  strength: 'preferred', notes: 'עמיתים לעבודה' }
      ],
      _nextDepId: 4,
      layoutOptions: []
    };
  }

  function loadDemoProject() {
    if (!UI.confirmDialog('לטעון את פרויקט הדוגמא? פעולה זו תוסיף אירוע חדש לרשימת האירועים.')) return;
    const demoState = _buildDemoState();
    const id = 'demo_' + Date.now();
    try {
      localStorage.setItem(evtKey(id), JSON.stringify(demoState));
      const m = readMeta() || { currentId: null, events: [] };
      m.events.push({ id, name: demoState.event.name, date: demoState.event.date, updated: new Date().toISOString() });
      writeMeta(m);
      localStorage.setItem(_DEMO_ID_KEY, id);
      // Set currentId and persist meta BEFORE emitting eventSwitched
      _currentId = id;
      m.currentId = id;
      writeMeta(m);
      State.deserialize(demoState);
      State.emit('eventSwitched');
      UI.toast('פרויקט הדוגמא נטען ✓', 'success', 2500);
    } catch(e) {
      console.warn('loadDemoProject failed:', e);
      UI.toast('שגיאה בטעינת פרויקט הדוגמא', 'error', 3000);
    }
  }

  function removeDemoProject() {
    const id = localStorage.getItem(_DEMO_ID_KEY);
    if (!id) { UI.toast('לא נמצא פרויקט דוגמא', 'info', 2000); return; }
    const m = readMeta();
    const events = m?.events || [];
    if (events.length <= 1) {
      UI.toast('לא ניתן למחוק את האירוע היחיד. צור אירוע חדש תחילה.', 'warning', 3000);
      return;
    }
    if (!UI.confirmDialog('למחוק את פרויקט הדוגמא? הנתונים יאבדו לצמיתות.')) return;
    try {
      deleteEvent(id);
      localStorage.removeItem(_DEMO_ID_KEY);
      UI.toast('פרויקט הדוגמא הוסר ✓', 'success', 2000);
    } catch(e) {
      UI.toast('שגיאה בהסרת פרויקט הדוגמא', 'error', 3000);
    }
  }

  function isDemoLoaded() {
    const id = localStorage.getItem(_DEMO_ID_KEY);
    if (!id) return false;
    const m = readMeta();
    return !!(m?.events?.find(e => e.id === id));
  }

  function exportDependencies() {
    const state = State.get();
    const deps  = state.guestDependencies || [];
    if (!deps.length) { UI.toast('אין תלויות לייצוא', 'info', 2000); return; }
    const data = {
      version:    1,
      exportedAt: new Date().toISOString(),
      dependencies: deps
    };
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    const name = (state.event.name || 'תלויות').replace(/\s+/g, '_');
    const date = new Date().toISOString().slice(0, 10);
    a.href = url; a.download = `${name}_תלויות_${date}.json`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
    UI.toast('התלויות יוצאו ✓', 'success');
  }

  function importDependencies(file, merge) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = e => {
        try {
          const data = JSON.parse(e.target.result);
          if (!Array.isArray(data.dependencies)) throw new Error('Invalid dependencies file');
          const guestIds   = new Set(State.get().guests.map(g => g.id));
          const allImported = data.dependencies;
          const incoming   = allImported.filter(d => guestIds.has(d.guestA) && guestIds.has(d.guestB));
          if (incoming.length < allImported.length) {
            UI.toast(`${allImported.length - incoming.length} קשרים הושמטו — מוזמנים לא נמצאו`, 'warning', 3500);
          }
          const existing = State.get().guestDependencies || [];

          if (!merge) {
            // Snapshot IDs before removal — removeDependency splices the live array in-place
            [...existing].forEach(d => State.removeDependency(d.id));
          }

          const existingPairs = new Set(
            State.get().guestDependencies.map(d => [d.guestA, d.guestB].sort().join('|'))
          );

          let added = 0;
          incoming.forEach(dep => {
            const key = [dep.guestA, dep.guestB].sort().join('|');
            if (merge && existingPairs.has(key)) return;
            State.addDependency({
              guestA:   dep.guestA,
              guestB:   dep.guestB,
              type:     dep.type     || 'friends',
              strength: dep.strength || 'preferred',
              notes:    dep.notes    || ''
            });
            existingPairs.add(key);
            added++;
          });

          saveNow();
          UI.toast(added + ' תלויות יובאו ✓', 'success', 2000);
          resolve(added);
        } catch(err) {
          UI.toast('שגיאה בייבוא קובץ תלויות', 'error');
          reject(err);
        }
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
    importGuestsCsv, importGuestsExcel, downloadGuestTemplate,
    exportLayoutOptions, importLayoutOptions,
    exportDependencies, importDependencies,
    createEvent, switchEvent, deleteEvent,
    getEventsList, updateCurrentMeta,
    loadDemoProject, removeDemoProject, isDemoLoaded
  };
})();
