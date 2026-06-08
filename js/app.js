'use strict';

document.addEventListener('DOMContentLoaded', () => {

  /* ── Load persisted state ── */
  const hasData = Storage.load();

  /* ── Init modules ── */
  UI.initModals();
  UI.initMobileSidebar();
  Canvas.init();
  Guests.init();
  Modals.init();
  History.init();
  ItemNav.init();

  /* ── Render existing items if loaded ── */
  // Items.renderAll() is already triggered by State.on('dataLoaded') in items.js
  if (hasData) {
    UI.updateStats();
  }

  /* ── Stats update on any change ── */
  State.on('change', () => UI.updateStats());

  /* ── Header buttons ── */
  document.getElementById('btnSettings')?.addEventListener('click', () => Modals.openSettings());
  document.getElementById('btnExport')?.addEventListener('click', () => Storage.exportProjectJSON());
  document.getElementById('btnImport')?.addEventListener('click', () => {
    document.getElementById('importFileInput').click();
  });
  document.getElementById('importFileInput')?.addEventListener('change', async e => {
    const file = e.target.files[0];
    if (!file) return;
    await Storage.importProjectJSON(file);
    e.target.value = '';
  });
  document.getElementById('btnExportCsv')?.addEventListener('click', () => Storage.exportCSV());
  document.getElementById('btnPrintPlan')?.addEventListener('click', () => Print.printPlan());
  document.getElementById('btnPrintList')?.addEventListener('click', () => Print.printList());
  document.getElementById('btnPrintAll')?.addEventListener('click',  () => Print.printAll());
  document.getElementById('btnPrintFull')?.addEventListener('click', () => Print.printFull());
  document.getElementById('btnUndo')?.addEventListener('click', () => History.undo());
  document.getElementById('btnRedo')?.addEventListener('click', () => History.redo());
  document.getElementById('eventNameDisplay')?.addEventListener('click', () => Modals.openSettings());
  document.getElementById('btnDistribute')?.addEventListener('click', () => Canvas.distributeTablesEvenly());
  document.getElementById('btnRenumber')?.addEventListener('click',   () => Items.renumberTables());

  /* ── Guest export / import ── */
  document.getElementById('btnExportGuests')?.addEventListener('click', () => Storage.exportGuestsJSON());
  document.getElementById('btnImportGuests')?.addEventListener('click', () => document.getElementById('importGuestsInput')?.click());
  let _pendingGuestsFile = null;
  document.getElementById('importGuestsInput')?.addEventListener('change', e => {
    const file = e.target.files[0]; if (!file) return;
    _pendingGuestsFile = file;
    UI.openModal('modalImportGuests');
    e.target.value = '';
  });
  document.getElementById('btnImportGuestsMerge')?.addEventListener('click', async () => {
    try { if (_pendingGuestsFile) await Storage.importGuestsJSON(_pendingGuestsFile, true); }
    finally { _pendingGuestsFile = null; UI.closeModal('modalImportGuests'); }
  });
  document.getElementById('btnImportGuestsReplace')?.addEventListener('click', async () => {
    try { if (_pendingGuestsFile) await Storage.importGuestsJSON(_pendingGuestsFile, false); }
    finally { _pendingGuestsFile = null; UI.closeModal('modalImportGuests'); }
  });

  /* ── Sidebar: add items ── */
  document.querySelectorAll('[data-add-item]').forEach(btn => {
    btn.addEventListener('click', () => {
      const type = btn.dataset.addItem;
      if (type === 'table') {
        Modals.openAddTable();
      } else if (type === 'shape') {
        Modals.openAddShape();
      } else {
        Items.addSpecialItem(type); // position determined by findFreePosition
      }
    });
  });

  /* ── Sidebar: guests ── */
  document.getElementById('btnAddGuest')?.addEventListener('click', () => Modals.openAddGuest());
  document.getElementById('btnAutoAssign')?.addEventListener('click', () => Modals.openAutoAssign());

  /* ── Canvas: deselect on click ── */
  document.getElementById('canvasViewport')?.addEventListener('click', e => {
    if (e.target === document.getElementById('canvasViewport') ||
        e.target === document.getElementById('canvasRoom')) {
      Items.deselectAll();
    }
  });

  /* ── Keyboard shortcuts ── */
  document.addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
    const ctrl = e.ctrlKey || e.metaKey;
    if (ctrl && e.key.toLowerCase() === 'z' && !e.shiftKey) { e.preventDefault(); History.undo(); return; }
    if (ctrl && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) { e.preventDefault(); History.redo(); return; }
    if (ctrl && e.key.toLowerCase() === 's') { e.preventDefault(); Storage.save(); UI.toast('נשמר ✓','success',1500); return; }
    if (ctrl && e.key.toLowerCase() === 'e') { e.preventDefault(); Storage.exportProjectJSON(); return; }
    if (e.key === '+' || e.key === '=') Canvas.setZoom(State.get().canvas.zoom + CONFIG.ZOOM_STEP);
    if (e.key === '-')                   Canvas.setZoom(State.get().canvas.zoom - CONFIG.ZOOM_STEP);
    if (e.key === '0')                   Canvas.fitAll();
  });

  /* ── Persist to localStorage before the page unloads ── */
  window.addEventListener('beforeunload', () => {
    Storage.saveNow();
  });

  /* ── Show welcome if empty ── */
  if (!hasData) {
    UI.toast('ברוכים הבאים! התחל בהגדרת האירוע ➜ ⚙️', 'info', 6000);
  }

  console.log('🎉 Seating Planner loaded');
});
