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
  document.getElementById('btnPrintFull')?.addEventListener('click',  () => Print.printFull());
  document.getElementById('btnPrintDiagram')?.addEventListener('click', () => Modals.openPrintDiagram());
  document.getElementById('btnPrintCards')?.addEventListener('click', () => Modals.openPrintCards());
  document.getElementById('btnUndo')?.addEventListener('click', () => History.undo());
  document.getElementById('btnRedo')?.addEventListener('click', () => History.redo());
  document.getElementById('eventNameDisplay')?.addEventListener('click', () => Modals.openSettings());
  document.getElementById('btnDistribute')?.addEventListener('click',    () => Canvas.distributeTablesEvenly());
  document.getElementById('btnRenumber')?.addEventListener('click',        () => Items.renumberTables());
  document.getElementById('btnRenumberDesc')?.addEventListener('click',    () => Items.renumberTables({ reversed: true }));
  document.getElementById('btnNormalizeSizes')?.addEventListener('click',  () => Modals.openNormalizeSizes());
  document.getElementById('btnBulkEdit')?.addEventListener('click',        () => Modals.openBulkEdit());
  document.getElementById('btnAlign')?.addEventListener('click',           () => Modals.openAlignItems());

  /* ── Header dropdowns ── */
  (function initHeaderDropdowns() {
    const pairs = [
      { toggleId: 'btnDropdownExport', menuId: 'menuDropdownExport' },
      { toggleId: 'btnDropdownPrint',  menuId: 'menuDropdownPrint'  },
    ];

    function closeAll() {
      pairs.forEach(({ toggleId, menuId }) => {
        document.getElementById(toggleId)?.classList.remove('dd-open');
        document.getElementById(menuId)?.classList.remove('dd-open');
      });
    }

    pairs.forEach(({ toggleId, menuId }) => {
      const toggle = document.getElementById(toggleId);
      const menu   = document.getElementById(menuId);
      if (!toggle || !menu) return;

      toggle.addEventListener('click', e => {
        e.stopPropagation();
        const wasOpen = menu.classList.contains('dd-open');
        closeAll();
        if (!wasOpen) {
          // Position menu using fixed coords (avoids overflow:hidden clipping on mobile)
          const headerRect = document.querySelector('.app-header').getBoundingClientRect();
          const btnRect    = toggle.getBoundingClientRect();
          const menuW      = 260;
          let left = btnRect.left;
          if (left + menuW > window.innerWidth - 8) left = window.innerWidth - menuW - 8;
          if (left < 8) left = 8;
          menu.style.top  = headerRect.bottom + 'px';
          menu.style.left = left + 'px';
          toggle.classList.add('dd-open');
          menu.classList.add('dd-open');
        }
      });

      // Clicking a menu item closes the dropdown (event bubbles up to this listener)
      menu.addEventListener('click', () => closeAll());
    });

    // Close on any outside click
    document.addEventListener('click', () => closeAll());

    // Canvas items call e.stopPropagation() so the document listener above won't fire for them.
    // Use capture phase to catch canvas clicks before item handlers run.
    document.getElementById('canvasViewport')?.addEventListener('click', () => closeAll(), { capture: true });

    // Close on Escape
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') closeAll();
    });

    // Close when window resizes (menu position becomes stale)
    window.addEventListener('resize', () => closeAll(), { passive: true });
  })();

  /* ── Layout Options ── */
  document.getElementById('btnSaveLayout')?.addEventListener('click', () => Modals.openSaveLayout());
  // btnDeleteLayout is wired in modals.js init() (needs access to _activeLayoutId)
  document.getElementById('btnExportLayouts')?.addEventListener('click', () => Storage.exportLayoutOptions());
  document.getElementById('btnImportLayouts')?.addEventListener('click', () => {
    document.getElementById('importLayoutsInput')?.click();
  });
  let _pendingLayoutsFile = null;
  document.getElementById('importLayoutsInput')?.addEventListener('change', e => {
    const file = e.target.files[0]; if (!file) return;
    _pendingLayoutsFile = file;
    UI.openModal('modalImportLayouts');
    e.target.value = '';
  });
  document.getElementById('btnImportLayoutsMerge')?.addEventListener('click', async () => {
    try { if (_pendingLayoutsFile) await Storage.importLayoutOptions(_pendingLayoutsFile, true); }
    finally { _pendingLayoutsFile = null; UI.closeModal('modalImportLayouts'); }
  });
  document.getElementById('btnImportLayoutsReplace')?.addEventListener('click', async () => {
    try { if (_pendingLayoutsFile) await Storage.importLayoutOptions(_pendingLayoutsFile, false); }
    finally { _pendingLayoutsFile = null; UI.closeModal('modalImportLayouts'); }
  });

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

  /* ── Show welcome / storage warning ── */
  if (!hasData) {
    // First-ever load: show getting-started tips + storage warning
    UI.showGettingStarted(true);
    setTimeout(() => UI.showStorageWarning(true), 1000);
  } else {
    // Returning user: show storage warning periodically (every 4h unless dismissed)
    UI.showStorageWarning(false);
  }

  console.log('🎉 Seating Planner loaded');
});
