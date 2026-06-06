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
    document.getElementById('tableQty').value      = 1;
    document.getElementById('tableLock').checked   = false;
    document.getElementById('tableQtyRow').style.display  = '';
    document.getElementById('tableLockRow').style.display = 'none';
    document.getElementById('btnDuplicateTable').style.display = 'none';
    syncShapeBtns(_tableShapeEdit);
    renderTablePresets();
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
    document.getElementById('tableLock').checked  = !!item.locked;
    document.getElementById('tableQtyRow').style.display  = 'none';
    document.getElementById('tableLockRow').style.display = '';
    document.getElementById('btnDuplicateTable').style.display = '';
    syncShapeBtns(_tableShapeEdit);
    renderTablePresets();
    UI.openModal('modalAddTable');
  }

  function renderTablePresets() {
    const wrap = document.getElementById('tablePresetBtns');
    if (!wrap) return;
    const presets = State.get().tablePresets || [];
    const shapeIcon = { circle: '⭕', rectangle: '▭', square: '⬜' };
    if (!presets.length) {
      wrap.innerHTML = '<small style="color:#90a4ae">אין תבניות — הגדר בהגדרות ⚙️</small>';
      return;
    }
    wrap.innerHTML = presets.map((p, i) =>
      `<button class="preset-btn" data-preset="${i}" title="${shapeIcon[p.shape]||''} ${p.seats} מושבים · ${p.width}×${p.height}">${p.name}<br><small>${p.seats} מושבים</small></button>`
    ).join('');
    wrap.querySelectorAll('.preset-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const p = presets[parseInt(btn.dataset.preset)];
        if (!p) return;
        _tableShapeEdit = p.shape;
        syncShapeBtns(_tableShapeEdit);
        document.getElementById('tableSeats').value  = p.seats;
        document.getElementById('tableWidth').value  = p.width  || '';
        document.getElementById('tableHeight').value = p.height || '';
      });
    });
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
    const locked = document.getElementById('tableLock').checked;

    if (_editingTableId) {
      const item = State.getItem(_editingTableId);
      const updates = { shape: _tableShapeEdit, seats, label, locked };
      if (number) updates.number = number;
      if (wVal)   updates.width  = Math.max(60, wVal);
      if (hVal)   updates.height = Math.max(60, hVal);
      State.updateItem(_editingTableId, updates);
    } else {
      const sz = CONFIG.TABLE_SIZES[_tableShapeEdit] || CONFIG.TABLE_SIZES.circle;
      const qty = Math.max(1, Math.min(50, parseInt(document.getElementById('tableQty').value) || 1));
      const w   = wVal ? Math.max(60, wVal) : sz.width;
      const h   = hVal ? Math.max(60, hVal)
                       : (_tableShapeEdit === 'circle' || _tableShapeEdit === 'square' ? (wVal || sz.width) : sz.height);
      // Lay multiple tables out in a tidy grid near the centre of the view.
      const cols = Math.ceil(Math.sqrt(qty));
      const gapX = w + 50, gapY = h + 60;
      const baseX = 350, baseY = 280;
      for (let i = 0; i < qty; i++) {
        const r = Math.floor(i / cols), c = i % cols;
        Items.addTable({
          shape:  _tableShapeEdit,
          seats,  label,
          number: (qty === 1 && number) ? number : undefined,
          width:  w, height: h,
          x: baseX + c * gapX, y: baseY + r * gapY
        });
      }
    }
    UI.closeModal('modalAddTable');
  }

  function duplicateTable() {
    if (!_editingTableId) return;
    const copy = State.duplicateItem(_editingTableId);
    UI.closeModal('modalAddTable');
    if (copy) { Items.selectItem(copy.id); UI.toast('השולחן שוכפל ✓', 'success', 1800); }
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

  function duplicateEditItem() {
    if (!_editingItemId) return;
    const copy = State.duplicateItem(_editingItemId);
    UI.closeModal('modalEditItem');
    if (copy) { Items.selectItem(copy.id); UI.toast('הפריט שוכפל ✓', 'success', 1800); }
  }

  /* ═══════════════════ ADD/EDIT GUEST ═══════════════════ */
  let _editingGuestId   = null;
  let _selectedTags     = new Set();
  let _selectedProx     = new Set();

  function openAddGuest() {
    _editingGuestId = null;
    _selectedTags   = new Set();
    _selectedProx   = new Set();
    document.getElementById('guestModalTitle').textContent = 'הוסף מוזמן';
    document.getElementById('guestName').value     = '';
    document.getElementById('guestAdults').value   = 2;
    document.getElementById('guestChildren').value = 0;
    document.getElementById('guestNotes').value    = '';
    const addBtn = document.getElementById('btnConfirmGuestAndAdd');
    if (addBtn) addBtn.style.display = '';
    renderGuestTagsSelector();
    renderProximitySelector();
    UI.openModal('modalAddGuest');
    setTimeout(() => document.getElementById('guestName')?.focus(), 100);
  }

  function openEditGuest(id) {
    const g = State.getGuest(id);
    if (!g) return;
    _editingGuestId = id;
    _selectedTags   = new Set(g.tags || []);
    _selectedProx   = new Set(g.proximity || []);
    document.getElementById('guestModalTitle').textContent = 'עריכת מוזמן';
    document.getElementById('guestName').value     = g.name;
    document.getElementById('guestAdults').value   = g.adults;
    document.getElementById('guestChildren').value = g.children;
    document.getElementById('guestNotes').value    = g.notes || '';
    const addBtn = document.getElementById('btnConfirmGuestAndAdd');
    if (addBtn) addBtn.style.display = 'none';  // only for new guests
    renderGuestTagsSelector();
    renderProximitySelector();
    UI.openModal('modalAddGuest');
  }

  function renderProximitySelector() {
    const wrap = document.getElementById('guestProximitySelector');
    if (!wrap) return;
    wrap.innerHTML = Object.entries(CONFIG.PROXIMITY).map(([key, def]) => {
      const on = _selectedProx.has(key);
      return `<button class="prox-select-btn ${on ? 'active' : ''}" data-prox="${key}">${def.icon} ${def.label}</button>`;
    }).join('');
    wrap.querySelectorAll('.prox-select-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const k = btn.dataset.prox;
        // nearDance and farDance are mutually exclusive
        if (k === 'nearDance' && !_selectedProx.has(k)) _selectedProx.delete('farDance');
        if (k === 'farDance'  && !_selectedProx.has(k)) _selectedProx.delete('nearDance');
        _selectedProx.has(k) ? _selectedProx.delete(k) : _selectedProx.add(k);
        renderProximitySelector();
      });
    });
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

  function doSaveGuest() {
    const name     = document.getElementById('guestName').value.trim();
    const adults   = Math.max(0, parseInt(document.getElementById('guestAdults').value)   || 0);
    const children = Math.max(0, parseInt(document.getElementById('guestChildren').value) || 0);
    const notes    = document.getElementById('guestNotes').value.trim();
    if (!name) { UI.toast('נא להזין שם', 'warning'); return false; }
    if (adults + children === 0) { UI.toast('נא להזין לפחות אדם אחד', 'warning'); return false; }
    const tags      = [..._selectedTags];
    const proximity = [..._selectedProx];
    if (_editingGuestId) {
      State.updateGuest(_editingGuestId, { name, adults, children, tags, proximity, notes });
    } else {
      State.addGuest({ name, adults, children, tags, proximity, notes });
    }
    return true;
  }

  function confirmGuest() {
    if (doSaveGuest()) UI.closeModal('modalAddGuest');
  }

  function confirmGuestAndAdd() {
    if (doSaveGuest()) openAddGuest();   // re-opens with cleared fields
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
    const occExclGuest = State.getTableGuests(table.id)
      .filter(g => g.id !== guest.id)
      .reduce((s, g) => s + g.total, 0);
    const free = Math.max(0, table.seats - occExclGuest);

    const hasAdultsAndKids = guest.adults > 0 && guest.children > 0;
    const adultsHereFit    = hasAdultsAndKids && guest.adults  <= free;
    const kidsHereFit      = hasAdultsAndKids && guest.children <= free && !adultsHereFit;

    body.innerHTML = `
      <p>שולחן <strong>${table.number}</strong> מכיל ${table.seats} מושבים, ${free} פנויים.</p>
      <p>בקבוצה "<strong>${UI.escHtml(guest.name)}</strong>" יש <strong>${guest.adults} מבוגרים + ${guest.children} ילדים (${guest.total})</strong> — חריגה של <strong>${overflow}</strong>.</p>
      ${free > 0 ? `<p>אפשר לפצל: ${free} כאן, והשאר (${guest.total - free}) יישארו כרטיס נפרד.</p>` : ''}
      ${adultsHereFit ? `<p>פיצול חכם: <strong>מבוגרים (${guest.adults}) כאן</strong>, ילדים (${guest.children}) בכרטיס נפרד.</p>` : ''}
      ${kidsHereFit   ? `<p>פיצול חכם: <strong>ילדים (${guest.children}) כאן</strong>, מבוגרים (${guest.adults}) בכרטיס נפרד.</p>` : ''}`;

    const splitByCountBtn = free > 0
      ? `<button class="btn btn-primary" id="btnOverflowSplit">פצל לפי כמות: ${free} כאן</button>` : '';
    const splitAdultsBtn = adultsHereFit
      ? `<button class="btn btn-secondary" id="btnOverflowAdults">מבוגרים כאן, ילדים בנפרד</button>` : '';
    const splitKidsBtn = kidsHereFit
      ? `<button class="btn btn-secondary" id="btnOverflowKids">ילדים כאן, מבוגרים בנפרד</button>` : '';

    foot.innerHTML = `
      ${splitByCountBtn}${splitAdultsBtn}${splitKidsBtn}
      <button class="btn btn-secondary" id="btnOverflowForce">שבץ הכל בכל זאת</button>
      <button class="btn btn-ghost"     id="btnOverflowCancel">ביטול</button>`;

    document.getElementById('btnOverflowForce').onclick = () => {
      State.assignGuest(guest.id, table.id);
      UI.toast(`${UI.escHtml(guest.name)} שובצו לשולחן ${table.number} (חריגה!)`, 'warning');
      UI.closeModal('modalOverflow');
    };
    const sb = document.getElementById('btnOverflowSplit');
    if (sb) sb.onclick = () => { splitGuestAtTable(guest, table, free); UI.closeModal('modalOverflow'); };

    const sa = document.getElementById('btnOverflowAdults');
    if (sa) sa.onclick = () => {
      // Adults stay here, children become a new card
      State.updateGuest(guest.id, { adults: guest.adults, children: 0 });
      State.assignGuest(guest.id, table.id);
      State.addGuest({ name: guest.name + ' (ילדים)', adults: 0, children: guest.children,
        tags: [...(guest.tags||[])], proximity: [...(guest.proximity||[])],
        notes: guest.notes || '', splitOf: guest.id });
      UI.toast(`מבוגרים שובצו לשולחן ${table.number}; ילדים נותרו ברשימה`, 'success', 4000);
      UI.closeModal('modalOverflow');
    };
    const sk = document.getElementById('btnOverflowKids');
    if (sk) sk.onclick = () => {
      // Children stay here, adults become a new card
      State.updateGuest(guest.id, { adults: 0, children: guest.children });
      State.assignGuest(guest.id, table.id);
      State.addGuest({ name: guest.name + ' (מבוגרים)', adults: guest.adults, children: 0,
        tags: [...(guest.tags||[])], proximity: [...(guest.proximity||[])],
        notes: guest.notes || '', splitOf: guest.id });
      UI.toast(`ילדים שובצו לשולחן ${table.number}; מבוגרים נותרו ברשימה`, 'success', 4000);
      UI.closeModal('modalOverflow');
    };
    document.getElementById('btnOverflowCancel').onclick = () => UI.closeModal('modalOverflow');
    UI.openModal('modalOverflow');
  }

  // Seat `free` people from this guest at the table; the remainder becomes a new card left in the pool.
  function splitGuestAtTable(guest, table, free) {
    const aHere = Math.min(guest.adults, free);
    const cHere = free - aHere;
    const aRest = guest.adults   - aHere;
    const cRest = guest.children - cHere;
    State.updateGuest(guest.id, { adults: aHere, children: cHere });
    State.assignGuest(guest.id, table.id);
    if (aRest + cRest > 0) {
      State.addGuest({
        name: guest.name + ' (המשך)',
        adults: aRest, children: cRest,
        tags: [...(guest.tags || [])],
        proximity: [...(guest.proximity || [])],
        notes: guest.notes || '',
        splitOf: guest.id
      });
    }
    UI.toast(`פוצל: ${free} בשולחן ${table.number}, השאר נותר ברשימה`, 'success', 4000);
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
    renderPresetManager();
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

  function renderPresetManager() {
    const wrap = document.getElementById('presetManager');
    if (!wrap) return;
    const presets = State.get().tablePresets || [];
    const shapeLabel = { circle: 'עגול', rectangle: 'מלבן', square: 'ריבוע' };
    wrap.innerHTML = presets.length === 0
      ? '<p style="color:#90a4ae;font-size:13px;margin-bottom:6px">אין תבניות מוגדרות</p>'
      : presets.map((p, i) => `
        <div class="preset-item">
          <span class="preset-item-name">${UI.escHtml(p.name)}</span>
          <span class="preset-item-detail">${shapeLabel[p.shape] || p.shape} · ${p.seats} מושבים · ${p.width}×${p.height}</span>
          <button class="btn-icon-xs btn-remove-preset" data-idx="${i}" title="מחק תבנית">✕</button>
        </div>`).join('');
    wrap.querySelectorAll('.btn-remove-preset').forEach(btn => {
      btn.addEventListener('click', () => {
        State.removeTablePreset(parseInt(btn.dataset.idx));
        renderPresetManager();
        renderTablePresets();
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
    const stats   = State.getStats();
    const free    = State.getTables().filter(t => !t.locked && State.getTableOccupancy(t.id) < t.seats).length;
    const lockedN = State.getTables().filter(t => t.locked).length;
    const withProx = State.get().guests.filter(g => (g.proximity || []).length).length;
    document.getElementById('autoAssignInfo').innerHTML =
      `<p>מוזמנים לא משובצים: <strong>${stats.pendingGuests}</strong> | שולחנות פנויים: <strong>${free}</strong>${
        lockedN ? ` | נעולים: <strong>${lockedN}</strong>` : ''}${
        withProx ? ` | עם העדפת קרבה: <strong>${withProx}</strong>` : ''}</p>`;
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
    document.getElementById('btnDuplicateTable')?.addEventListener('click', duplicateTable);

    // Edit item modal
    document.getElementById('btnConfirmEditItem')?.addEventListener('click', confirmEditItem);
    document.getElementById('btnDeleteEditItem')?.addEventListener('click', deleteEditItem);
    document.getElementById('btnDuplicateItem')?.addEventListener('click', duplicateEditItem);

    // Guest modal
    document.getElementById('btnConfirmGuest')?.addEventListener('click', confirmGuest);
    document.getElementById('btnConfirmGuestAndAdd')?.addEventListener('click', confirmGuestAndAdd);
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
    // Preset manager
    document.getElementById('btnAddPreset')?.addEventListener('click', () => {
      const name   = document.getElementById('presetName').value.trim();
      const shape  = document.getElementById('presetShape').value;
      const seats  = Math.max(1, parseInt(document.getElementById('presetSeats').value) || 10);
      const wVal   = parseInt(document.getElementById('presetWidth').value);
      const hVal   = parseInt(document.getElementById('presetHeight').value);
      if (!name) { UI.toast('נא להזין שם לתבנית', 'warning'); return; }
      const sz = CONFIG.TABLE_SIZES[shape] || CONFIG.TABLE_SIZES.circle;
      State.addTablePreset({
        name, shape, seats,
        width:  wVal ? Math.max(60, wVal) : sz.width,
        height: hVal ? Math.max(60, hVal) : (shape === 'circle' || shape === 'square' ? (wVal || sz.width) : sz.height)
      });
      document.getElementById('presetName').value   = '';
      document.getElementById('presetWidth').value  = '';
      document.getElementById('presetHeight').value = '';
      renderPresetManager();
      renderTablePresets();
      UI.toast('התבנית נוספה ✓', 'success', 1500);
    });

    document.getElementById('btnResetBoard')?.addEventListener('click', () => {
      if (UI.confirmDialog('לנקות את כל השולחנות והמוזמנים? (ההגדרות והתגיות יישמרו)')) {
        State.resetBoard();
        UI.closeModal('modalSettings');
        UI.toast('הלוח נוקה', 'info');
      }
    });

    // Auto-assign
    document.getElementById('btnConfirmAutoAssign')?.addEventListener('click', () => {
      const split = document.getElementById('autoAssignSplit').checked;
      const keep  = document.getElementById('autoAssignKeepExisting').checked;
      const prox  = document.getElementById('autoAssignProximity').checked;
      AutoAssign.run({ allowSplit: split, keepExisting: keep, respectProximity: prox });
      UI.closeModal('modalAutoAssign');
    });

    State.on('eventChanged',   updateEventHeader);
    State.on('dataLoaded',     updateEventHeader);
    State.on('presetsChanged', renderTablePresets);
    updateEventHeader();
  }

  return {
    init,
    openAddTable, openEditTable,
    openEditItem, openAddGuest, openEditGuest,
    openAddShape, openSettings, openAutoAssign,
    handleGuestDrop, updateEventHeader,
    renderTagsManager, renderPresetManager, renderTablePresets
  };
})();
