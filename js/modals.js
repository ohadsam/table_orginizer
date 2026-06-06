'use strict';

const Modals = (() => {

  /* ═══════════════════ ADD TABLE ═══════════════════ */
  let _tableShapeEdit = 'circle';
  let _editingTableId = null;

  function openAddTable(preset) {
    _editingTableId = null;
    _tableShapeEdit = preset?.shape || State.get().settings.defaultShape;

    document.getElementById('tableModalTitle').textContent = 'הוסף שולחן';
    document.getElementById('tableNumber').value  = '';
    document.getElementById('tableSeats').value   = preset?.seats || 10;
    document.getElementById('tableLabel').value   = preset?.label || '';
    document.getElementById('tableWidth').value   = '';
    document.getElementById('tableHeight').value  = '';
    syncShapeBtns(_tableShapeEdit);
    UI.openModal('modalAddTable');
  }

  function openEditTable(id) {
    const item = State.getItem(id);
    if (!item) return;
    _editingTableId = id;
    _tableShapeEdit = item.shape;

    document.getElementById('tableModalTitle').textContent = 'עריכת שולחן';
    document.getElementById('tableNumber').value  = item.number || '';
    document.getElementById('tableSeats').value   = item.seats;
    document.getElementById('tableLabel').value   = item.label || '';
    document.getElementById('tableWidth').value   = item.width;
    document.getElementById('tableHeight').value  = item.height;
    syncShapeBtns(_tableShapeEdit);
    UI.openModal('modalAddTable');
  }

  function syncShapeBtns(shape) {
    document.querySelectorAll('#tableShapeSelector .shape-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.shape === shape);
    });
  }

  function confirmTable() {
    const number = parseInt(document.getElementById('tableNumber').value) || null;
    const seats  = Math.max(1, parseInt(document.getElementById('tableSeats').value) || 10);
    const label  = document.getElementById('tableLabel').value.trim();
    const wVal   = parseInt(document.getElementById('tableWidth').value);
    const hVal   = parseInt(document.getElementById('tableHeight').value);

    if (_editingTableId) {
      const item = State.getItem(_editingTableId);
      const updates = { shape: _tableShapeEdit, seats, label };
      if (number) updates.number = number;
      if (wVal)   updates.width  = Math.max(60, wVal);
      if (hVal)   updates.height = Math.max(60, hVal);
      State.updateItem(_editingTableId, updates);
    } else {
      const sz = CONFIG.TABLE_SIZES[_tableShapeEdit] || CONFIG.TABLE_SIZES.circle;
      Items.addTable({
        shape:  _tableShapeEdit,
        seats,  label,
        number: number || undefined,
        width:  wVal ? Math.max(60, wVal) : sz.width,
        height: hVal ? Math.max(60, hVal) : (_tableShapeEdit === 'circle' || _tableShapeEdit === 'square' ? (wVal || sz.width) : sz.height),
        x: 400 + Math.random() * 200, y: 300 + Math.random() * 200
      });
    }
    UI.closeModal('modalAddTable');
  }

  /* ═══════════════════ EDIT NON-TABLE ITEM ═══════════════════ */
  let _editingItemId = null;

  function openEditItem(id) {
    const item = State.getItem(id);
    if (!item) return;
    _editingItemId = id;
    const body = document.getElementById('editItemBody');
    const typeLabels = { dancefloor: 'רחבת ריקודים', dj: 'עמדת DJ', door: 'כניסה', shape: 'צורה' };
    document.getElementById('editItemTitle').textContent = 'עריכת ' + (typeLabels[item.type] || item.type);
    body.innerHTML = `
      <div class="form-group">
        <label>תווית</label>
        <input id="editItemLabel" class="input" value="${UI.escHtml(item.label || '')}">
      </div>
      <div class="form-group">
        <label>רוחב</label><input id="editItemW" class="input" type="number" value="${item.width}">
      </div>
      <div class="form-group">
        <label>גובה</label><input id="editItemH" class="input" type="number" value="${item.height}">
      </div>
      ${item.type === 'shape' ? `
      <div class="form-group">
        <label>צורה</label>
        <div class="shape-selector" id="editShapeSelector">
          <button class="shape-btn ${item.shape==='rectangle'?'active':''}" data-shape="rectangle">▭ מלבן</button>
          <button class="shape-btn ${item.shape==='square'?'active':''}"    data-shape="square">⬜ ריבוע</button>
          <button class="shape-btn ${item.shape==='circle'?'active':''}"    data-shape="circle">⭕ עגול</button>
        </div>
      </div>
      <div class="form-group">
        <label>צבע רקע</label>
        <input id="editItemColor" class="input" type="color" value="${item.color || CONFIG.COLORS.shape}">
      </div>` : ''}`;
    document.querySelectorAll('#editShapeSelector .shape-btn').forEach(b => {
      b.addEventListener('click', () => {
        document.querySelectorAll('#editShapeSelector .shape-btn').forEach(x => x.classList.remove('active'));
        b.classList.add('active');
      });
    });
    UI.openModal('modalEditItem');
  }

  function confirmEditItem() {
    if (!_editingItemId) return;
    const updates = {
      label:  document.getElementById('editItemLabel')?.value.trim(),
      width:  Math.max(40, parseInt(document.getElementById('editItemW')?.value) || 80),
      height: Math.max(40, parseInt(document.getElementById('editItemH')?.value) || 80)
    };
    const shapeBtn = document.querySelector('#editShapeSelector .shape-btn.active');
    if (shapeBtn) updates.shape = shapeBtn.dataset.shape;
    const colorEl = document.getElementById('editItemColor');
    if (colorEl) updates.color = colorEl.value;
    State.updateItem(_editingItemId, updates);
    UI.closeModal('modalEditItem');
  }

  function deleteEditItem() {
    if (!_editingItemId) return;
    if (UI.confirmDialog('למחוק פריט זה?')) {
      State.removeItem(_editingItemId);
      _editingItemId = null;
      UI.closeModal('modalEditItem');
    }
  }

  /* ═══════════════════ ADD/EDIT GUEST ═══════════════════ */
  let _editingGuestId   = null;
  let _selectedTags     = new Set();

  function openAddGuest() {
    _editingGuestId = null;
    _selectedTags   = new Set();
    document.getElementById('guestModalTitle').textContent = 'הוסף מוזמן';
    document.getElementById('guestName').value     = '';
    document.getElementById('guestAdults').value   = 2;
    document.getElementById('guestChildren').value = 0;
    document.getElementById('guestNotes').value    = '';
    renderGuestTagsSelector();
    UI.openModal('modalAddGuest');
    setTimeout(() => document.getElementById('guestName')?.focus(), 100);
  }

  function openEditGuest(id) {
    const g = State.getGuest(id);
    if (!g) return;
    _editingGuestId = id;
    _selectedTags   = new Set(g.tags || []);
    document.getElementById('guestModalTitle').textContent = 'עריכת מוזמן';
    document.getElementById('guestName').value     = g.name;
    document.getElementById('guestAdults').value   = g.adults;
    document.getElementById('guestChildren').value = g.children;
    document.getElementById('guestNotes').value    = g.notes || '';
    renderGuestTagsSelector();
    UI.openModal('modalAddGuest');
  }

  function renderGuestTagsSelector() {
    const wrap = document.getElementById('guestTagsSelector');
    if (!wrap) return;
    const tags = State.get().tags;
    wrap.innerHTML = tags.map(t => {
      const color = UI.tagColor(t);
      const on    = _selectedTags.has(t);
      return `<button class="tag-select-btn ${on?'active':''}" data-tag="${UI.escHtml(t)}"
        style="color:${color};border-color:${color}${on?';background:'+color+'22':''}">${UI.escHtml(t)}</button>`;
    }).join('');
    wrap.querySelectorAll('.tag-select-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const t = btn.dataset.tag;
        _selectedTags.has(t) ? _selectedTags.delete(t) : _selectedTags.add(t);
        btn.classList.toggle('active');
        const color = UI.tagColor(t);
        if (btn.classList.contains('active')) btn.style.background = color + '22';
        else btn.style.background = '';
      });
    });
  }

  function confirmGuest() {
    const name     = document.getElementById('guestName').value.trim();
    const adults   = Math.max(0, parseInt(document.getElementById('guestAdults').value)   || 0);
    const children = Math.max(0, parseInt(document.getElementById('guestChildren').value) || 0);
    const notes    = document.getElementById('guestNotes').value.trim();
    if (!name) { UI.toast('נא להזין שם', 'warning'); return; }
    if (adults + children === 0) { UI.toast('נא להזין לפחות אדם אחד', 'warning'); return; }
    const tags = [..._selectedTags];

    if (_editingGuestId) {
      State.updateGuest(_editingGuestId, { name, adults, children, tags, notes });
    } else {
      State.addGuest({ name, adults, children, tags, notes });
    }
    UI.closeModal('modalAddGuest');
  }

  /* ═══════════════════ SHAPE MODAL ═══════════════════ */
  let _shapeModalShape = 'rectangle';

  function openAddShape() {
    _shapeModalShape = 'rectangle';
    document.getElementById('shapeWidth').value  = 110;
    document.getElementById('shapeHeight').value = 110;
    document.getElementById('shapeColor').value  = '#e0e0e0';
    document.getElementById('shapeLabel').value  = '';
    document.querySelectorAll('#shapeSelectorBtns .shape-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.shape === _shapeModalShape);
    });
    UI.openModal('modalAddShape');
  }

  function confirmAddShape() {
    const w     = Math.max(40, parseInt(document.getElementById('shapeWidth').value)  || 110);
    const h     = Math.max(40, parseInt(document.getElementById('shapeHeight').value) || 110);
    const color = document.getElementById('shapeColor').value;
    const label = document.getElementById('shapeLabel').value.trim();
    Items.addSpecialItem('shape', {
      shape: _shapeModalShape,
      color, label,
      width: w, height: (_shapeModalShape === 'circle' || _shapeModalShape === 'square') ? w : h,
      x: 500 + Math.random() * 200, y: 400 + Math.random() * 200
    });
    UI.closeModal('modalAddShape');
  }

  /* ═══════════════════ GUEST DROP HANDLER ═══════════════════ */
  function handleGuestDrop(guestId, tableId) {
    const guest = State.getGuest(guestId);
    const table = State.getItem(tableId);
    if (!guest || !table) return;

    // Already at this exact table — no-op
    if (guest.tableId === tableId) return;

    // Occupancy excluding this guest (in case they're currently at this table)
    const baseOcc = State.getTableGuests(tableId)
      .filter(g => g.id !== guestId)
      .reduce((s, g) => s + g.total, 0);
    const newOcc = baseOcc + guest.total;

    if (newOcc <= table.seats) {
      State.assignGuest(guestId, tableId);
      UI.toast(`${UI.escHtml(guest.name)} שובצו לשולחן ${table.number}`, 'success');
      return;
    }

    // overflow
    showOverflowModal(guest, table, newOcc - table.seats);
  }

  function showOverflowModal(guest, table, overflow) {
    const body = document.getElementById('overflowModalBody');
    const foot = document.getElementById('overflowModalFooter');
    body.innerHTML = `
      <p>שולחן <strong>${table.number}</strong> מכיל ${table.seats} מושבים ותפוס ב-${State.getTableOccupancy(table.id)}.</p>
      <p>לא ניתן למקם את כל <strong>${guest.total} האנשים</strong> מהקבוצה "<strong>${UI.escHtml(guest.name)}</strong>".</p>
      <p>החריגה היא <strong>${overflow}</strong> אנשים.</p>`;
    foot.innerHTML = `
      <button class="btn btn-primary" id="btnOverflowForce">שבץ בכל זאת</button>
      <button class="btn btn-secondary" id="btnOverflowCancel">ביטול</button>`;

    document.getElementById('btnOverflowForce').onclick = () => {
      State.assignGuest(guest.id, table.id);
      UI.toast(`${guest.name} שובצו לשולחן ${table.number} (חריגה!)`, 'warning');
      UI.closeModal('modalOverflow');
    };
    document.getElementById('btnOverflowCancel').onclick = () => UI.closeModal('modalOverflow');
    UI.openModal('modalOverflow');
  }

  /* ═══════════════════ EVENT SETTINGS ═══════════════════ */
  function openSettings() {
    const s = State.get();
    document.getElementById('settingEventName').value     = s.event.name;
    document.getElementById('settingEventType').value     = s.event.type;
    document.getElementById('settingEventDate').value     = s.event.date;
    document.getElementById('settingVenue').value         = s.event.venue;
    document.getElementById('settingParentsSeats').value  = s.settings.defaultParentsSeats;
    document.getElementById('settingFriendsSeats').value  = s.settings.defaultFriendsSeats;
    document.getElementById('settingDefaultShape').value  = s.settings.defaultShape;
    renderTagsManager();
    UI.openModal('modalSettings');
  }

  function renderTagsManager() {
    const wrap = document.getElementById('tagsManager');
    if (!wrap) return;
    const tags = State.get().tags;
    wrap.innerHTML = tags.map(t => `
      <span class="tag-manager-item">
        ${UI.tagBadge(t)}
        <button class="btn-icon-xs btn-remove-tag" data-tag="${UI.escHtml(t)}" title="הסר תגית">✕</button>
      </span>`).join('');
    wrap.querySelectorAll('.btn-remove-tag').forEach(btn => {
      btn.addEventListener('click', () => {
        if (UI.confirmDialog(`למחוק תגית "${btn.dataset.tag}"?`)) {
          State.removeTag(btn.dataset.tag);
          renderTagsManager();
        }
      });
    });
  }

  function saveSettings() {
    State.setEventField('name',  document.getElementById('settingEventName').value.trim());
    State.setEventField('type',  document.getElementById('settingEventType').value);
    State.setEventField('date',  document.getElementById('settingEventDate').value);
    State.setEventField('venue', document.getElementById('settingVenue').value.trim());
    State.setSetting('defaultParentsSeats', parseInt(document.getElementById('settingParentsSeats').value) || 8);
    State.setSetting('defaultFriendsSeats', parseInt(document.getElementById('settingFriendsSeats').value) || 10);
    State.setSetting('defaultShape', document.getElementById('settingDefaultShape').value);
    updateEventHeader();
    UI.closeModal('modalSettings');
    UI.toast('ההגדרות נשמרו ✓', 'success');
  }

  function updateEventHeader() {
    const e = State.get().event;
    const nameEl = document.getElementById('eventNameDisplay');
    if (nameEl) nameEl.textContent = e.name || 'לחץ להגדרת אירוע';
    const typeEl = document.getElementById('eventTypeDisplay');
    if (typeEl) typeEl.textContent = CONFIG.EVENT_TYPES[e.type] || '';
  }

  /* ═══════════════════ AUTO-ASSIGN ═══════════════════ */
  function openAutoAssign() {
    const stats = State.getStats();
    document.getElementById('autoAssignInfo').innerHTML =
      `<p>מוזמנים לא משובצים: <strong>${stats.pendingGuests}</strong> | שולחנות פנויים: <strong>${
        State.getTables().filter(t => State.getTableOccupancy(t.id) < t.seats).length
      }</strong></p>`;
    UI.openModal('modalAutoAssign');
  }

  /* ═══════════════════ INIT ═══════════════════ */
  function init() {
    // Table modal
    document.querySelectorAll('#tableShapeSelector .shape-btn').forEach(b => {
      b.addEventListener('click', () => {
        _tableShapeEdit = b.dataset.shape;
        syncShapeBtns(_tableShapeEdit);
      });
    });
    document.getElementById('btnConfirmTable')?.addEventListener('click', confirmTable);

    // Edit item modal
    document.getElementById('btnConfirmEditItem')?.addEventListener('click', confirmEditItem);
    document.getElementById('btnDeleteEditItem')?.addEventListener('click', deleteEditItem);

    // Guest modal
    document.getElementById('btnConfirmGuest')?.addEventListener('click', confirmGuest);
    document.getElementById('guestName')?.addEventListener('keydown', e => { if (e.key === 'Enter') confirmGuest(); });
    document.getElementById('btnAddNewTag')?.addEventListener('click', () => {
      const inp = document.getElementById('newTagInput');
      const val = inp.value.trim();
      if (val) { State.addTag(val); inp.value = ''; renderGuestTagsSelector(); }
    });

    // Shape modal
    document.querySelectorAll('#shapeSelectorBtns .shape-btn').forEach(b => {
      b.addEventListener('click', () => {
        _shapeModalShape = b.dataset.shape;
        document.querySelectorAll('#shapeSelectorBtns .shape-btn').forEach(x => x.classList.remove('active'));
        b.classList.add('active');
        // square / circle: sync height to width
        if (_shapeModalShape !== 'rectangle') {
          const w = document.getElementById('shapeWidth').value;
          document.getElementById('shapeHeight').value = w;
        }
      });
    });
    document.getElementById('shapeWidth')?.addEventListener('input', () => {
      if (_shapeModalShape !== 'rectangle')
        document.getElementById('shapeHeight').value = document.getElementById('shapeWidth').value;
    });
    document.getElementById('btnConfirmShape')?.addEventListener('click', confirmAddShape);

    // Settings modal
    document.getElementById('btnSaveSettings')?.addEventListener('click', saveSettings);
    document.getElementById('btnAddTagManager')?.addEventListener('click', () => {
      const inp = document.getElementById('newTagManagerInput');
      const val = inp.value.trim();
      if (val) { State.addTag(val); inp.value = ''; renderTagsManager(); }
    });

    // Auto-assign
    document.getElementById('btnConfirmAutoAssign')?.addEventListener('click', () => {
      const split = document.getElementById('autoAssignSplit').checked;
      const keep  = document.getElementById('autoAssignKeepExisting').checked;
      AutoAssign.run({ allowSplit: split, keepExisting: keep });
      UI.closeModal('modalAutoAssign');
    });

    State.on('eventChanged', updateEventHeader);
    State.on('dataLoaded',   updateEventHeader);
    updateEventHeader();
  }

  return {
    init,
    openAddTable, openEditTable,
    openEditItem, openAddGuest, openEditGuest,
    openAddShape, openSettings, openAutoAssign,
    handleGuestDrop, updateEventHeader,
    renderTagsManager
  };
})();
