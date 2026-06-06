'use strict';

const Storage = (() => {
  let _saveTimer = null;

  function saveNow() {
    clearTimeout(_saveTimer);
    try {
      localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(State.serialize()));
    } catch (e) {
      console.warn('Save failed:', e);
    }
  }

  function save() {
    clearTimeout(_saveTimer);
    _saveTimer = setTimeout(saveNow, 400);
  }

  function load() {
    try {
      const raw = localStorage.getItem(CONFIG.STORAGE_KEY);
      if (raw) {
        State.deserialize(JSON.parse(raw));
        return true;
      }
    } catch (e) {
      console.warn('Load failed:', e);
    }
    return false;
  }

  function exportJSON() {
    const data = State.serialize();
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const name = (data.event.name || 'תוכנית_הושבה').replace(/\s+/g, '_');
    const date = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `${name}_${date}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    UI.toast('הקובץ יוצא בהצלחה ✓', 'success');
  }

  function exportCSV() {
    const state = State.get();
    const guests = [...state.guests].sort((a, b) => {
      const ta = a.tableId ? (State.getItem(a.tableId)?.number ?? 9999) : 99999;
      const tb = b.tableId ? (State.getItem(b.tableId)?.number ?? 9999) : 99999;
      return ta - tb || a.name.localeCompare(b.name, 'he');
    });
    const esc = v => {
      const s = String(v ?? '');
      return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    const header = ['שם', 'מבוגרים', 'ילדים', 'סהכ', 'תגיות', 'שולחן'];
    const rows = guests.map(g => [
      g.name, g.adults, g.children, g.total,
      (g.tags || []).join('; '),
      g.tableId ? (State.getItem(g.tableId)?.number ?? '') : ''
    ].map(esc).join(','));
    const csv = '﻿' + [header.join(','), ...rows].join('\r\n');  // BOM → Hebrew opens in Excel

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    const name = (state.event.name || 'רשימת_מוזמנים').replace(/\s+/g, '_');
    a.href = url;
    a.download = `${name}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
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
          save();
          UI.toast('הנתונים יובאו בהצלחה ✓', 'success');
          resolve(data);
        } catch (err) {
          UI.toast('שגיאה בקריאת הקובץ', 'error');
          reject(err);
        }
      };
      reader.onerror = () => { UI.toast('שגיאה בפתיחת הקובץ', 'error'); reject(reader.error); };
      reader.readAsText(file);
    });
  }

  // Auto-save on every state change
  State.on('change', save);

  return { save, saveNow, load, exportJSON, exportCSV, importJSON };
})();
