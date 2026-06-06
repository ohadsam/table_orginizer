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

  /* ── Render existing items if loaded ── */
  // Items.renderAll() is already triggered by State.on('dataLoaded') in items.js
  if (hasData) {
    UI.updateStats();
  }

  /* ── Stats update on any change ── */
  State.on('change', () => UI.updateStats());

  /* ── Header buttons ── */
  document.getElementById('btnSettings')?.addEventListener('click', () => Modals.openSettings());
  document.getElementById('btnExport')?.addEventListener('click', () => Storage.exportJSON());
  document.getElementById('btnImport')?.addEventListener('click', () => {
    document.getElementById('importFileInput').click();
  });
  document.getElementById('importFileInput')?.addEventListener('change', async e => {
    const file = e.target.files[0];
    if (!file) return;
    await Storage.importJSON(file);
    Items.renderAll();
    Guests.render();
    e.target.value = '';
  });
  document.getElementById('btnPrintPlan')?.addEventListener('click', () => Print.printPlan());
  document.getElementById('btnPrintList')?.addEventListener('click', () => Print.printList());
  document.getElementById('eventNameDisplay')?.addEventListener('click', () => Modals.openSettings());

  /* ── Sidebar: add items ── */
  document.querySelectorAll('[data-add-item]').forEach(btn => {
    btn.addEventListener('click', () => {
      const type = btn.dataset.addItem;
      if (type === 'table') {
        Modals.openAddTable();
      } else if (type === 'shape') {
        Modals.openAddShape();
      } else {
        Items.addSpecialItem(type, {
          x: 500 + Math.random() * 300,
          y: 350 + Math.random() * 300
        });
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
    if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); Storage.save(); UI.toast('נשמר ✓','success',1500); }
    if ((e.ctrlKey || e.metaKey) && e.key === 'e') { e.preventDefault(); Storage.exportJSON(); }
    if (e.key === '+' || e.key === '=') Canvas.setZoom(State.get().canvas.zoom + CONFIG.ZOOM_STEP);
    if (e.key === '-')                   Canvas.setZoom(State.get().canvas.zoom - CONFIG.ZOOM_STEP);
    if (e.key === '0')                   Canvas.fitAll();
  });

  /* ── Show welcome if empty ── */
  if (!hasData) {
    UI.toast('ברוכים הבאים! התחל בהגדרת האירוע ➜ ⚙️', 'info', 6000);
  }

  console.log('🎉 Seating Planner loaded');
});
