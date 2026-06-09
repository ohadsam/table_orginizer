'use strict';

const Modals = (() => {

  /* ═══════════════════ ADD TABLE ═══════════════════ */
  let _tableShapeEdit = 'circle';
  let _editingTableId = null;

  function _applyTableType(type) {
    const s = State.get().settings;
    if (type === 'friends') {
      _tableShapeEdit = s.defaultFriendsShape || 'circle';
      document.getElementById('tableSeats').value = s.defaultFriendsSeats || 10;
    } else if (type === 'parents') {
      _tableShapeEdit = s.defaultParentsShape || 'rectangle';
      document.getElementById('tableSeats').value = s.defaultParentsSeats || 8;
    } else {
      _tableShapeEdit = s.defaultShape || 'circle';
      document.getElementById('tableSeats').value = 10;
    }
    syncShapeBtns(_tableShapeEdit);
    document.querySelectorAll('#tableTypeBtns .type-btn').forEach(b =>
      b.classList.toggle('active', b.dataset.ttype === type)
    );
  }

  function openAddTable(preset) {
    _editingTableId = null;
    _tableShapeEdit = preset?.shape || State.get().settings.defaultShape;

    document.getElementById('tableModalTitle').textContent = 'הוסף שולחן';
    document.getElementById('tableNumber').value   = '';
    document.getElementById('tableSeats').value    = preset?.seats || 10;
    document.getElementById('tableLabel').value    = preset?.label || '';
    document.getElementById('tableWidth').value    = '';
    document.getElementById('tableHeight').value   = '';
    document.getElementById('tableFontSize').value = '';
    document.getElementById('tableQty').value      = 1;
    document.getElementById('tableLock').checked   = false;
    document.getElementById('tableQtyRow').style.display  = '';
    document.getElementById('tableLockRow').style.display = 'none';
    document.getElementById('btnDuplicateTable').style.display = 'none';
    document.getElementById('btnUnassignAllFromTable').style.display = 'none';
    const tcEnabled = document.getElementById('tableColorEnabled');
    if (tcEnabled) { tcEnabled.checked = false; document.getElementById('tableColor').disabled = true; document.getElementById('tableColor').value = '#e3f2fd'; }
    // Show table type row and reset to 'כללי'
    const typeRow = document.getElementById('tableTypeRow');
    if (typeRow) typeRow.style.display = '';
    document.querySelectorAll('#tableTypeBtns .type-btn').forEach(b =>
      b.classList.toggle('active', b.dataset.ttype === '')
    );
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
    document.getElementById('tableNumber').value   = item.number || '';
    document.getElementById('tableSeats').value    = item.seats;
    document.getElementById('tableLabel').value    = item.label || '';
    document.getElementById('tableWidth').value    = item.width;
    document.getElementById('tableHeight').value   = item.height;
    document.getElementById('tableFontSize').value = item.fontSize || '';
    document.getElementById('tableLock').checked   = !!item.locked;
    document.getElementById('tableQtyRow').style.display  = 'none';
    document.getElementById('tableLockRow').style.display = '';
    document.getElementById('btnDuplicateTable').style.display = '';
    document.getElementById('btnUnassignAllFromTable').style.display = '';
    // Hide table type row in edit mode
    const typeRow2 = document.getElementById('tableTypeRow');
    if (typeRow2) typeRow2.style.display = 'none';
    const tcEnabled2 = document.getElementById('tableColorEnabled');
    if (tcEnabled2) {
      tcEnabled2.checked = !!item.color;
      const tcInput = document.getElementById('tableColor');
      tcInput.value    = item.color || '#e3f2fd';
      tcInput.disabled = !item.color;
    }
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
        document.querySelectorAll('#tableTypeBtns .type-btn').forEach(b =>
          b.classList.toggle('active', b.dataset.ttype === '')
        );
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
    const wVal      = parseInt(document.getElementById('tableWidth').value);
    const hVal      = parseInt(document.getElementById('tableHeight').value);
    const fontSizeV = parseFloat(document.getElementById('tableFontSize')?.value) || null;
    const locked    = document.getElementById('tableLock').checked;
    const colorEnabled = document.getElementById('tableColorEnabled')?.checked;
    const color  = colorEnabled ? (document.getElementById('tableColor')?.value || null) : null;

    if (_editingTableId) {
      const item = State.getItem(_editingTableId);
      const updates = { shape: _tableShapeEdit, seats, label, locked, color, fontSize: fontSizeV };
      if (number) updates.number = number;
      if (wVal)   updates.width  = Math.max(60, wVal);
      if (hVal)   updates.height = Math.max(60, hVal);
      State.updateItem(_editingTableId, updates);
      Guests.render(); // refresh guest card color borders
    } else {
      const sz = CONFIG.TABLE_SIZES[_tableShapeEdit] || CONFIG.TABLE_SIZES.circle;
      const qty = Math.max(1, Math.min(50, parseInt(document.getElementById('tableQty').value) || 1));
      const w   = wVal ? Math.max(60, wVal) : sz.width;
      const h   = hVal ? Math.max(60, hVal)
                       : (_tableShapeEdit === 'circle' || _tableShapeEdit === 'square' ? (wVal || sz.width) : sz.height);
      // No explicit x/y — Items.addTable uses findFreePosition for collision-free placement.
      for (let i = 0; i < qty; i++) {
        Items.addTable({
          shape:  _tableShapeEdit,
          seats,  label, color,
          fontSize: fontSizeV,
          number: (qty === 1 && number) ? number : undefined,
          width:  w, height: h
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
      <div class="form-group">
        <label>צבע רקע</label>
        <input id="editItemColor" class="input" type="color" value="${item.color || CONFIG.COLORS[item.type] || CONFIG.COLORS.shape}" style="height:40px;padding:4px">
      </div>
      ${item.type === 'shape' ? `
      <div class="form-group">
        <label>צורה</label>
        <div class="shape-selector" id="editShapeSelector">
          <button class="shape-btn ${item.shape==='rectangle'?'active':''}" data-shape="rectangle">▭ מלבן</button>
          <button class="shape-btn ${item.shape==='square'?'active':''}"    data-shape="square">⬜ ריבוע</button>
          <button class="shape-btn ${item.shape==='circle'?'active':''}"    data-shape="circle">⭕ עגול</button>
        </div>
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

  /* ═══════════════════ ITEM FULL DETAILS ═══════════════════ */
  let _detailsItemId = null;
  let _detailsShape  = null;

  function openItemDetails(id) {
    const item = State.getItem(id);
    if (!item) return;
    _detailsItemId = id;
    _detailsShape  = item.shape;

    const body = document.getElementById('itemDetailsBody');
    if (!body) return;

    if (item.type === 'table') {
      const guests = State.getTableGuests(id);
      const occ    = guests.reduce((s, g) => s + (g.total || 1), 0);
      document.getElementById('itemDetailsTitle').textContent =
        `פרטים מלאים — שולחן ${item.number != null ? item.number : ''}`.trim();

      const guestRows = guests.map(g => `
        <tr>
          <td>${UI.escHtml(g.name)}</td>
          <td>${g.adults}</td>
          <td>${g.children}</td>
          <td>${UI.escHtml((g.tags || []).join(', '))}</td>
          <td>${UI.escHtml(g.notes || '')}</td>
          <td style="white-space:nowrap">
            <button class="btn btn-sm btn-ghost" data-detail-edit-guest="${g.id}" title="ערוך מוזמן">✏️</button>
            <button class="btn btn-sm btn-danger" data-detail-unassign-guest="${g.id}" title="הסר מהשולחן">✕</button>
          </td>
        </tr>`).join('');

      body.innerHTML = `
        <div class="details-two-col">
          <div class="details-col">
            <h3 class="details-section-title">פרטי שולחן</h3>
            <div class="form-group">
              <label>מספר שולחן</label>
              <input type="number" id="detailsTableNumber" class="input" value="${item.number ?? ''}" min="1">
            </div>
            <div class="form-group">
              <label>תווית / שם</label>
              <input type="text" id="detailsTableLabel" class="input" value="${UI.escHtml(item.label || '')}">
            </div>
            <div class="form-group">
              <label>מספר מושבים</label>
              <input type="number" id="detailsTableSeats" class="input" value="${item.seats}" min="1" max="50">
            </div>
            <div class="form-group">
              <label>צורת שולחן</label>
              <div class="shape-selector" id="detailsShapeSelector">
                <button class="shape-btn ${item.shape==='circle'?'active':''}"    data-shape="circle">⭕ עגול</button>
                <button class="shape-btn ${item.shape==='rectangle'?'active':''}" data-shape="rectangle">▭ מלבן</button>
                <button class="shape-btn ${item.shape==='square'?'active':''}"    data-shape="square">⬜ ריבוע</button>
              </div>
            </div>
            <div class="form-group">
              <label>גודל (פיקסלים)</label>
              <div class="size-row">
                <input type="number" id="detailsTableW" class="input" value="${item.width}"  min="60" placeholder="רוחב">
                <span class="size-sep">×</span>
                <input type="number" id="detailsTableH" class="input" value="${item.height}" min="60" placeholder="גובה">
              </div>
            </div>
            <div class="form-group">
              <label>גודל גופן <small style="font-weight:400;color:#90a4ae">(ריק = אוטומטי)</small></label>
              <input type="number" id="detailsTableFontSize" class="input" value="${item.fontSize || ''}" placeholder="אוטומטי" min="6" max="40">
            </div>
            <div class="form-group">
              <label class="checkbox-label" style="margin-bottom:6px">
                <input type="checkbox" id="detailsColorEnabled" ${item.color ? 'checked' : ''}>
                <span>צבע מותאם אישית</span>
              </label>
              <input type="color" id="detailsTableColor" class="input" value="${item.color || '#e3f2fd'}"
                ${item.color ? '' : 'disabled'} style="width:56px;height:36px;padding:3px;cursor:pointer">
            </div>
            <div class="form-group">
              <label class="checkbox-label">
                <input type="checkbox" id="detailsTableLock" ${item.locked ? 'checked' : ''}>
                <span>🔒 נעל שולחן (השיבוץ האוטומטי לא ישנה אותו)</span>
              </label>
            </div>
          </div>
          <div class="details-col">
            <h3 class="details-section-title">
              מוזמנים בשולחן
              <span class="details-occ">${occ}/${item.seats}</span>
            </h3>
            ${guests.length ? `
            <table class="details-guest-table">
              <thead>
                <tr><th>שם</th><th>מבוגרים</th><th>ילדים</th><th>תגיות</th><th>הערות</th><th></th></tr>
              </thead>
              <tbody>${guestRows}</tbody>
            </table>` : '<p class="details-empty">אין מוזמנים משובצים לשולחן זה</p>'}
          </div>
        </div>`;

      body.querySelectorAll('#detailsShapeSelector .shape-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          body.querySelectorAll('#detailsShapeSelector .shape-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          _detailsShape = btn.dataset.shape;
        });
      });

      const colorEn  = body.querySelector('#detailsColorEnabled');
      const colorInp = body.querySelector('#detailsTableColor');
      colorEn?.addEventListener('change', () => { if (colorInp) colorInp.disabled = !colorEn.checked; });

      body.querySelectorAll('[data-detail-unassign-guest]').forEach(btn => {
        btn.addEventListener('click', () => {
          if (UI.confirmDialog('להסיר מוזמן זה מהשולחן?')) {
            State.assignGuest(btn.dataset.detailUnassignGuest, null);
            openItemDetails(id);
          }
        });
      });

      body.querySelectorAll('[data-detail-edit-guest]').forEach(btn => {
        btn.addEventListener('click', () => {
          UI.closeModal('modalItemDetails');
          openEditGuest(btn.dataset.detailEditGuest);
        });
      });

    } else {
      const typeLabels = { dancefloor: 'רחבת ריקודים', dj: 'עמדת DJ', door: 'כניסה', shape: 'צורה' };
      document.getElementById('itemDetailsTitle').textContent =
        'פרטים מלאים — ' + (typeLabels[item.type] || item.type);

      body.innerHTML = `
        <div class="form-group">
          <label>תווית</label>
          <input id="detailsItemLabel" class="input" value="${UI.escHtml(item.label || '')}">
        </div>
        <div class="form-group">
          <label>רוחב</label>
          <input id="detailsItemW" class="input" type="number" value="${item.width}" min="40">
        </div>
        <div class="form-group">
          <label>גובה</label>
          <input id="detailsItemH" class="input" type="number" value="${item.height}" min="40">
        </div>
        <div class="form-group">
          <label>צבע רקע</label>
          <input id="detailsItemColor" class="input" type="color"
            value="${item.color || CONFIG.COLORS[item.type] || CONFIG.COLORS.shape}"
            style="height:40px;padding:4px">
        </div>
        ${item.type === 'shape' ? `
        <div class="form-group">
          <label>צורה</label>
          <div class="shape-selector" id="detailsItemShapeSelector">
            <button class="shape-btn ${item.shape==='rectangle'?'active':''}" data-shape="rectangle">▭ מלבן</button>
            <button class="shape-btn ${item.shape==='square'?'active':''}"    data-shape="square">⬜ ריבוע</button>
            <button class="shape-btn ${item.shape==='circle'?'active':''}"    data-shape="circle">⭕ עגול</button>
          </div>
        </div>` : ''}`;

      body.querySelectorAll('#detailsItemShapeSelector .shape-btn').forEach(b => {
        b.addEventListener('click', () => {
          body.querySelectorAll('#detailsItemShapeSelector .shape-btn').forEach(x => x.classList.remove('active'));
          b.classList.add('active');
          _detailsShape = b.dataset.shape;
        });
      });
    }

    UI.openModal('modalItemDetails');
  }

  function saveItemDetails() {
    const item = State.getItem(_detailsItemId);
    if (!item) { UI.closeModal('modalItemDetails'); return; }

    if (item.type === 'table') {
      const number    = parseInt(document.getElementById('detailsTableNumber')?.value) || null;
      const seats     = Math.max(1, parseInt(document.getElementById('detailsTableSeats')?.value) || 10);
      const label     = document.getElementById('detailsTableLabel')?.value.trim() || '';
      const wVal      = parseInt(document.getElementById('detailsTableW')?.value);
      const hVal      = parseInt(document.getElementById('detailsTableH')?.value);
      const fontSizeV = parseFloat(document.getElementById('detailsTableFontSize')?.value) || null;
      const locked    = document.getElementById('detailsTableLock')?.checked || false;
      const colorEn   = document.getElementById('detailsColorEnabled')?.checked;
      const color     = colorEn ? (document.getElementById('detailsTableColor')?.value || null) : null;

      const updates = { seats, label, locked, color, fontSize: fontSizeV };
      if (_detailsShape) updates.shape = _detailsShape;
      if (number) updates.number = number;
      if (wVal)   updates.width  = Math.max(60, wVal);
      if (hVal)   updates.height = Math.max(60, hVal);

      State.updateItem(_detailsItemId, updates);
      Guests.render();
    } else {
      const updates = {
        label:  document.getElementById('detailsItemLabel')?.value.trim() || '',
        width:  Math.max(40, parseInt(document.getElementById('detailsItemW')?.value) || 80),
        height: Math.max(40, parseInt(document.getElementById('detailsItemH')?.value) || 80),
        color:  document.getElementById('detailsItemColor')?.value || null,
      };
      if (_detailsShape) updates.shape = _detailsShape;
      State.updateItem(_detailsItemId, updates);
    }

    UI.closeModal('modalItemDetails');
    UI.toast('הפרטים עודכנו ✓', 'success', 1800);
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
      width: w, height: (_shapeModalShape === 'circle' || _shapeModalShape === 'square') ? w : h
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
      // Cache before updateGuest mutates the live object in-place
      const origChildren = guest.children;
      State.updateGuest(guest.id, { adults: guest.adults, children: 0 });
      State.assignGuest(guest.id, table.id);
      State.addGuest({ name: guest.name + ' (ילדים)', adults: 0, children: origChildren,
        tags: [...(guest.tags||[])], proximity: [...(guest.proximity||[])],
        notes: guest.notes || '', splitOf: guest.id });
      UI.toast(`מבוגרים שובצו לשולחן ${table.number}; ילדים נותרו ברשימה`, 'success', 4000);
      UI.closeModal('modalOverflow');
    };
    const sk = document.getElementById('btnOverflowKids');
    if (sk) sk.onclick = () => {
      // Cache before updateGuest mutates the live object in-place
      const origAdults = guest.adults;
      State.updateGuest(guest.id, { adults: 0, children: guest.children });
      State.assignGuest(guest.id, table.id);
      State.addGuest({ name: guest.name + ' (מבוגרים)', adults: origAdults, children: 0,
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

  /* ═══════════════════ FIND TABLE ═══════════════════ */
  let _findTableGuestId = null;

  function openFindTable(guestId) {
    const guest = State.getGuest(guestId);
    if (!guest) return;
    _findTableGuestId = guestId;
    _renderFindTableBody();
    UI.openModal('modalFindTable');
  }

  function _findTableCandidates(guest) {
    const guestTags = new Set(guest.tags || []);
    return State.getTables()
      .filter(t => !t.locked && t.id !== guest.tableId)
      .map(t => {
        const occ  = State.getTableOccupancy(t.id);
        const free = t.seats - occ;
        if (free <= 0) return null;
        const atTableTags = new Set(State.getTableGuests(t.id).flatMap(g => g.tags || []));
        let tagScore = 0;
        guestTags.forEach(tag => { if (atTableTags.has(tag)) tagScore++; });
        return { table: t, free, tagScore, fits: free >= guest.total };
      })
      .filter(Boolean);
  }

  function _renderFindTableBody() {
    const guest  = State.getGuest(_findTableGuestId);
    const body   = document.getElementById('findTableBody');
    const footer = document.getElementById('findTableFooter');
    if (!body || !footer || !guest) return;

    const candidates = _findTableCandidates(guest);
    const fitting = candidates
      .filter(c => c.fits)
      .sort((a, b) => b.tagScore - a.tagScore || (a.free - guest.total) - (b.free - guest.total));
    const partial = candidates
      .filter(c => !c.fits)
      .sort((a, b) => b.tagScore - a.tagScore || b.free - a.free);

    const currentNote = guest.tableId
      ? `<p class="find-table-current">כרגע משובץ לשולחן ${State.getItem(guest.tableId)?.number ?? '?'}</p>`
      : '';

    let html = `<p class="find-table-guest-info">${currentNote}
      <strong>${UI.escHtml(guest.name)}</strong> &mdash;
      ${guest.adults} מבוגרים${guest.children ? ` + ${guest.children} ילדים` : ''}
      <span class="find-table-total">(${guest.total} אנשים)</span>
    </p>`;

    if (fitting.length > 0) {
      html += `<div class="find-table-section">שולחנות מתאימים</div><div class="find-table-list">`;
      fitting.slice(0, 5).forEach((c, i) => {
        const occ      = c.table.seats - c.free;
        const tagBadge = c.tagScore > 0 ? `<span class="find-match-badge">⭐ ${c.tagScore} תגיות</span>` : '';
        const lbl      = c.table.label ? ` <span class="find-table-lbl">— ${UI.escHtml(c.table.label)}</span>` : '';
        html += `
          <div class="find-table-row${i === 0 ? ' best' : ''}">
            <div class="find-table-info">
              <span class="find-table-num">שולחן ${c.table.number || '?'}${lbl}</span>
              <span class="find-table-occ">${occ}/${c.table.seats} תפוסים &middot; ${c.free} פנויים</span>
              ${tagBadge}
            </div>
            <button class="btn btn-sm btn-primary btn-ft-assign" data-tid="${c.table.id}">שבץ</button>
          </div>`;
      });
      html += `</div>`;
    } else {
      const noTablesAtAll = State.getTables().length === 0;
      html += `<p class="find-table-no-fit">⚠️ ${noTablesAtAll
        ? 'אין שולחנות בתכנית עדיין'
        : `אין שולחן שיכיל את הקבוצה כולה (${guest.total} אנשים)`}</p>`;
    }

    if (partial.length > 0) {
      html += `<div class="find-table-section">אפשרויות פיצול</div><div class="find-table-list">`;
      partial.slice(0, 3).forEach(c => {
        const occ      = c.table.seats - c.free;
        const tagBadge = c.tagScore > 0 ? `<span class="find-match-badge">⭐ ${c.tagScore} תגיות</span>` : '';
        const lbl      = c.table.label ? ` <span class="find-table-lbl">— ${UI.escHtml(c.table.label)}</span>` : '';
        html += `
          <div class="find-table-row">
            <div class="find-table-info">
              <span class="find-table-num">שולחן ${c.table.number || '?'}${lbl}</span>
              <span class="find-table-occ">${occ}/${c.table.seats} תפוסים &middot; ${c.free} פנויים</span>
              ${tagBadge}
            </div>
            <button class="btn btn-sm btn-secondary btn-ft-split" data-tid="${c.table.id}">
              פצל (${c.free} כאן)
            </button>
          </div>`;
      });
      html += `</div>`;
    }

    body.innerHTML = html;

    // Assign — re-check live capacity at click time to guard against state changes since render
    body.querySelectorAll('.btn-ft-assign').forEach(btn => {
      btn.addEventListener('click', () => {
        const table = State.getItem(btn.dataset.tid);
        const g     = State.getGuest(_findTableGuestId);
        if (!table || !g) return;
        const liveFree = table.seats - State.getTableOccupancy(table.id);
        if (liveFree < g.total) {
          UI.toast('השולחן התמלא — מרענן רשימה', 'warning');
          _renderFindTableBody();
          return;
        }
        State.assignGuest(g.id, table.id);
        UI.toast(`${UI.escHtml(g.name)} שובצו לשולחן ${table.number} ✓`, 'success');
        UI.closeModal('modalFindTable');
      });
    });

    // Split — re-fetch live free space at click time; data-free in HTML can be stale.
    // If liveFree >= g.total the table now fits everyone — promote to a direct assign.
    body.querySelectorAll('.btn-ft-split').forEach(btn => {
      btn.addEventListener('click', () => {
        const table   = State.getItem(btn.dataset.tid);
        const g       = State.getGuest(_findTableGuestId);
        if (!table || !g) return;
        const liveFree = Math.max(0, table.seats - State.getTableOccupancy(table.id));
        if (liveFree <= 0) {
          UI.toast('השולחן התמלא — מרענן רשימה', 'warning');
          _renderFindTableBody();
          return;
        }
        if (liveFree >= g.total) {
          // Table now fits the full group; assign directly instead of splitting
          State.assignGuest(g.id, table.id);
          UI.toast(`${UI.escHtml(g.name)} שובצו לשולחן ${table.number} ✓`, 'success');
          UI.closeModal('modalFindTable');
          return;
        }
        const rest = g.total - liveFree;
        const fromNote = g.tableId ? ` (יוסרו משולחן ${State.getItem(g.tableId)?.number ?? '?'})` : '';
        if (!UI.confirmDialog(`לפצל את "${g.name}"?${fromNote}\n${liveFree} ישובצו לשולחן ${table.number}, ${rest} ישארו כרטיס נפרד.`)) return;
        splitGuestAtTable(g, table, liveFree);
        UI.closeModal('modalFindTable');
      });
    });

    // Footer: explicit handlers on dynamic buttons (data-close-modal won't work on injected HTML)
    footer.innerHTML = `
      ${fitting.length === 0
        ? `<button class="btn btn-secondary" id="btnFindCreateTable">+ צור שולחן חדש ושבץ</button>`
        : ''}
      <button class="btn btn-ghost" id="btnFindClose">סגור</button>`;

    document.getElementById('btnFindClose')?.addEventListener('click', () => UI.closeModal('modalFindTable'));

    document.getElementById('btnFindCreateTable')?.addEventListener('click', () => {
      const g       = State.getGuest(_findTableGuestId);
      if (!g) return;
      const settings = State.get().settings;
      const presets  = State.get().tablePresets || [];
      const preset   = presets[0] || null;
      const shape    = preset?.shape  || settings.defaultShape  || 'circle';
      const sz       = CONFIG.TABLE_SIZES[shape] || CONFIG.TABLE_SIZES.circle;
      // Use ?? so a preset with seats:0 is treated as 0, not as a missing value
      const seats    = Math.max(g.total, preset?.seats ?? settings.defaultFriendsSeats ?? 10);
      const table    = Items.addTable({
        shape, seats,
        width:  preset?.width  || sz.width,
        height: preset?.height || sz.height
      });
      if (!table) { UI.toast('שגיאה ביצירת שולחן', 'error'); return; }
      State.assignGuest(g.id, table.id);
      // addTable already schedules flashItem(50ms); focusOnItem also calls flashItem immediately.
      // Call focusOnItem after the 50ms flash to avoid resetting the animation mid-play.
      setTimeout(() => Canvas.focusOnItem(table.id), 60);
      UI.toast(`שולחן חדש נוצר ו-${UI.escHtml(g.name)} שובצו ✓`, 'success', 3000);
      UI.closeModal('modalFindTable');
    });
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
    document.getElementById('settingFriendsShape').value  = s.settings.defaultFriendsShape || 'circle';
    document.getElementById('settingParentsShape').value  = s.settings.defaultParentsShape || 'rectangle';
    // Font size settings (empty string when null = auto)
    document.getElementById('settingFontNumberSize').value    = s.settings.fontNumberSize    ?? '';
    document.getElementById('settingFontLabelSize').value     = s.settings.fontLabelSize     ?? '';
    document.getElementById('settingFontGuestSize').value     = s.settings.fontGuestSize     ?? '';
    document.getElementById('settingFontOccupancySize').value = s.settings.fontOccupancySize ?? '';
    // Font color settings
    document.getElementById('settingFontNumberColor').value    = s.settings.fontNumberColor    || '#1a237e';
    document.getElementById('settingFontLabelColor').value     = s.settings.fontLabelColor     || '#37474f';
    document.getElementById('settingFontGuestColor').value     = s.settings.fontGuestColor     || '#546e7a';
    document.getElementById('settingFontOccupancyColor').value = s.settings.fontOccupancyColor || '#888888';
    // Wire per-row reset buttons
    const _fontDefaults = {
      number:    { sizeId: 'settingFontNumberSize',    colorId: 'settingFontNumberColor',    color: '#1a237e' },
      label:     { sizeId: 'settingFontLabelSize',     colorId: 'settingFontLabelColor',     color: '#37474f' },
      guest:     { sizeId: 'settingFontGuestSize',     colorId: 'settingFontGuestColor',     color: '#546e7a' },
      occupancy: { sizeId: 'settingFontOccupancySize', colorId: 'settingFontOccupancyColor', color: '#888888' }
    };
    document.querySelectorAll('.btn-font-reset').forEach(btn => {
      btn.onclick = () => {
        const d = _fontDefaults[btn.dataset.row];
        if (!d) return;
        document.getElementById(d.sizeId).value  = '';
        document.getElementById(d.colorId).value = d.color;
      };
    });
    const btnResetAll = document.getElementById('btnResetAllFonts');
    if (btnResetAll) {
      btnResetAll.onclick = () => {
        Object.values(_fontDefaults).forEach(d => {
          document.getElementById(d.sizeId).value  = '';
          document.getElementById(d.colorId).value = d.color;
        });
      };
    }
    renderTagsManager();
    renderPresetManager();
    renderEventsManager();
    UI.openModal('modalSettings');
  }

  function renderEventsManager() {
    const wrap = document.getElementById('eventsManager');
    if (!wrap) return;
    const { events, currentId } = Storage.getEventsList();
    if (!events.length) { wrap.innerHTML = ''; return; }
    wrap.innerHTML = events.map(ev => {
      const isCurrent = ev.id === currentId;
      const dateStr   = ev.date ? (() => { try { const [y,mo,d] = ev.date.split('-'); return new Date(+y, +mo-1, +d).toLocaleDateString('he-IL'); } catch(e) { return ev.date; } })() : '';
      return `
<div class="event-item ${isCurrent ? 'event-current' : ''}">
  <div class="event-item-info">
    <span class="event-item-name">${UI.escHtml(ev.name || 'אירוע ללא שם')}</span>
    ${dateStr ? `<span class="event-item-date">${dateStr}</span>` : ''}
    ${isCurrent ? '<span class="event-current-badge">נוכחי</span>' : ''}
  </div>
  <div class="event-item-actions">
    ${!isCurrent ? `<button class="btn btn-sm btn-secondary btn-switch-event" data-id="${ev.id}">עבור</button>` : ''}
    ${events.length > 1 ? `<button class="btn btn-sm btn-danger btn-delete-event" data-id="${ev.id}">מחק</button>` : ''}
  </div>
</div>`;
    }).join('');
    wrap.querySelectorAll('.btn-switch-event').forEach(btn => {
      btn.addEventListener('click', () => {
        Storage.switchEvent(btn.dataset.id);
        UI.closeModal('modalSettings');
      });
    });
    wrap.querySelectorAll('.btn-delete-event').forEach(btn => {
      btn.addEventListener('click', () => {
        const ev = Storage.getEventsList().events.find(e => e.id === btn.dataset.id);
        if (UI.confirmDialog(`למחוק את האירוע "${ev?.name || 'ללא שם'}"?`)) {
          Storage.deleteEvent(btn.dataset.id);
          renderEventsManager();
        }
      });
    });
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
    State.setSetting('defaultFriendsShape', document.getElementById('settingFriendsShape').value);
    State.setSetting('defaultParentsShape', document.getElementById('settingParentsShape').value);
    // Font size settings (null when empty = auto-scaled)
    const _fs = v => { const n = parseInt(v); return (isNaN(n) || n < 1) ? null : n; };
    State.setSetting('fontNumberSize',    _fs(document.getElementById('settingFontNumberSize').value));
    State.setSetting('fontLabelSize',     _fs(document.getElementById('settingFontLabelSize').value));
    State.setSetting('fontGuestSize',     _fs(document.getElementById('settingFontGuestSize').value));
    State.setSetting('fontOccupancySize', _fs(document.getElementById('settingFontOccupancySize').value));
    // Font color settings
    State.setSetting('fontNumberColor',    document.getElementById('settingFontNumberColor').value);
    State.setSetting('fontLabelColor',     document.getElementById('settingFontLabelColor').value);
    State.setSetting('fontGuestColor',     document.getElementById('settingFontGuestColor').value);
    State.setSetting('fontOccupancyColor', document.getElementById('settingFontOccupancyColor').value);
    Items.renderAll();
    Storage.updateCurrentMeta();
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

  function showAutoAssignResult(result) {
    const body = document.getElementById('autoAssignResultBody');
    if (!body) return;
    const { assigned, failed, splitsCreated, tablesCreated } = result;
    const rows = [];
    if (tablesCreated > 0)  rows.push(`<div class="result-row result-info"><strong>${tablesCreated}</strong> שולחנות נוצרו אוטומטית 🪑</div>`);
    rows.push(`<div class="result-row result-success"><strong>${assigned}</strong> מוזמנים שובצו ✅</div>`);
    if (splitsCreated > 0) rows.push(`<div class="result-row result-warning"><strong>${splitsCreated}</strong> קבוצות פוצלו ⛓ (מסומנות בכרטיסים ובהדפסה)</div>`);
    if (failed > 0)        rows.push(`<div class="result-row result-danger"><strong>${failed}</strong> מוזמנים לא שובצו ⚠️</div>`);
    body.innerHTML = `<div class="assign-result-grid">${rows.join('')}</div>`;
    UI.openModal('modalAutoAssignResult');
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
    // Table modal — type selector
    document.querySelectorAll('#tableTypeBtns .type-btn').forEach(b => {
      b.addEventListener('click', () => _applyTableType(b.dataset.ttype));
    });

    // Table modal — shape selector
    document.querySelectorAll('#tableShapeSelector .shape-btn').forEach(b => {
      b.addEventListener('click', () => {
        _tableShapeEdit = b.dataset.shape;
        syncShapeBtns(_tableShapeEdit);
      });
    });
    document.getElementById('btnConfirmTable')?.addEventListener('click', confirmTable);
    document.getElementById('btnDuplicateTable')?.addEventListener('click', duplicateTable);
    document.getElementById('tableColorEnabled')?.addEventListener('change', e => {
      const inp = document.getElementById('tableColor');
      if (inp) inp.disabled = !e.target.checked;
    });
    document.getElementById('btnUnassignAllFromTable')?.addEventListener('click', () => {
      if (!_editingTableId) return;
      const table = State.getItem(_editingTableId);
      if (!table) return;
      if (!UI.confirmDialog(`להסיר שיבוץ כל המוזמנים משולחן ${table.number}?`)) return;
      State.getTableGuests(_editingTableId).forEach(g => State.assignGuest(g.id, null));
      UI.closeModal('modalAddTable');
      UI.toast('כל המוזמנים הוסרו מהשולחן', 'info');
    });

    // Edit item modal
    document.getElementById('btnConfirmEditItem')?.addEventListener('click', confirmEditItem);
    document.getElementById('btnDeleteEditItem')?.addEventListener('click', deleteEditItem);
    document.getElementById('btnDuplicateItem')?.addEventListener('click', duplicateEditItem);

    // Item details modal
    document.getElementById('btnSaveItemDetails')?.addEventListener('click', saveItemDetails);

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
      if (UI.confirmDialog('למחוק את הכל לחלוטין? (שולחנות, מוזמנים, ופרטי אירוע)')) {
        State.resetBoard();
        UI.closeModal('modalSettings');
        UI.toast('הלוח נוקה', 'info');
      }
    });

    document.getElementById('btnResetKeepGuests')?.addEventListener('click', () => {
      if (UI.confirmDialog('לנקות את כל השולחנות והפריטים? רשימת המוזמנים תישמר (שיבוצים יאופסו).')) {
        State.resetBoardKeepGuests();
        UI.closeModal('modalSettings');
        UI.toast('השולחנות נוקו; המוזמנים נשמרו', 'info');
      }
    });

    // Auto-assign
    document.getElementById('btnConfirmAutoAssign')?.addEventListener('click', () => {
      const split  = document.getElementById('autoAssignSplit').checked;
      const keep   = document.getElementById('autoAssignKeepExisting').checked;
      const prox   = document.getElementById('autoAssignProximity').checked;
      const create = document.getElementById('autoAssignCreateTables')?.checked || false;
      UI.closeModal('modalAutoAssign');
      const result = AutoAssign.run({ allowSplit: split, keepExisting: keep, respectProximity: prox, createTables: create });
      if (result.assigned + result.failed + result.splitsCreated + result.tablesCreated === 0) return;
      if (result.tablesCreated > 0) requestAnimationFrame(() => Canvas.fitAll());
      showAutoAssignResult(result);
    });

    // New event modal
    document.getElementById('btnNewEvent')?.addEventListener('click', () => {
      UI.openModal('modalNewEvent');
    });
    document.getElementById('btnConfirmNewEvent')?.addEventListener('click', () => {
      const keep = document.getElementById('newEventKeepGuests')?.checked || false;
      UI.closeModal('modalNewEvent');
      UI.closeModal('modalSettings');
      Storage.createEvent({ keepGuests: keep });
    });

    // Import guests modal (merge/replace handled in app.js)
    document.getElementById('btnCloseAutoAssignResult')?.addEventListener('click', () => {
      UI.closeModal('modalAutoAssignResult');
    });

    State.on('eventChanged',   updateEventHeader);
    State.on('dataLoaded',     updateEventHeader);
    State.on('presetsChanged', renderTablePresets);
    updateEventHeader();
  }

  /* ── Print Cards modal ── */
  function openPrintCards() {
    const TEMPLATE_KEY = 'seating_cards_template';
    let _bgDataUrl = null;

    function _readForm() {
      return {
        version:        1,
        cardSize:       parseInt(document.getElementById('cardSizeSelect').value)       || 80,
        customText:     document.getElementById('cardCustomText').value.trim(),
        customFont:     document.getElementById('cardCustomFont').value,
        customFontSize: parseInt(document.getElementById('cardCustomFontSize').value)   || 11,
        customColor:    document.getElementById('cardCustomFontColor').value,
        customBold:     document.getElementById('cardCustomBold').classList.contains('active'),
        customItalic:   document.getElementById('cardCustomItalic').classList.contains('active'),
        showLabel:      document.getElementById('cardShowLabel').checked,
        blankEnabled:   document.getElementById('cardBlankEnabled').checked,
        blankCount:     parseInt(document.getElementById('cardBlankCount').value)        || 1,
        blankOnly:      document.getElementById('cardBlankOnly').checked
      };
    }

    function _applyForm(t) {
      if (!t) return;
      if (t.cardSize       != null) document.getElementById('cardSizeSelect').value      = String(t.cardSize);
      if (t.customText     != null) document.getElementById('cardCustomText').value      = t.customText;
      if (t.customFont     != null) document.getElementById('cardCustomFont').value      = t.customFont;
      if (t.customFontSize != null) document.getElementById('cardCustomFontSize').value  = String(t.customFontSize);
      if (t.customColor    != null) document.getElementById('cardCustomFontColor').value = t.customColor;
      document.getElementById('cardCustomBold').classList.toggle('active',   !!t.customBold);
      document.getElementById('cardCustomItalic').classList.toggle('active', !!t.customItalic);
      document.getElementById('cardShowLabel').checked    = t.showLabel !== false;
      document.getElementById('cardBlankEnabled').checked = !!t.blankEnabled;
      if (t.blankCount != null) document.getElementById('cardBlankCount').value = String(t.blankCount);
      // blankOnly only makes sense when blankEnabled — prevent cryptic "nothing to print" toast
      document.getElementById('cardBlankOnly').checked    = !!t.blankOnly && !!t.blankEnabled;
      document.getElementById('cardBlankOptions').style.display = t.blankEnabled ? '' : 'none';
    }

    function _updatePreview() {
      const text     = document.getElementById('cardCustomText').value.trim();
      const font     = document.getElementById('cardCustomFont').value;
      const size     = parseInt(document.getElementById('cardCustomFontSize').value) || 11;
      const color    = document.getElementById('cardCustomFontColor').value;
      const bold     = document.getElementById('cardCustomBold').classList.contains('active');
      const italic   = document.getElementById('cardCustomItalic').classList.contains('active');
      const showLbl  = document.getElementById('cardShowLabel').checked;
      const blankEn  = document.getElementById('cardBlankEnabled').checked;
      const sizeMm   = parseInt(document.getElementById('cardSizeSelect').value) || 80;
      const sizePx   = Math.round(sizeMm * 1.8);
      const sizeCm   = sizeMm / 10;

      // Resize preview
      const prevBox = document.getElementById('cardPreview');
      prevBox.style.width  = sizePx + 'px';
      prevBox.style.height = sizePx + 'px';
      document.getElementById('cardsPreviewLabel').textContent =
        `תצוגה מקדימה (${sizeCm}×${sizeCm} ס"מ)`;

      const blankOnly  = document.getElementById('cardBlankOnly').checked;
      const blankCount = parseInt(document.getElementById('cardBlankCount').value) || 1;

      // Blank-options panel
      document.getElementById('cardBlankOptions').style.display = blankEn ? '' : 'none';

      // Preview card content: switch to blank-placeholder layout when blankOnly is active
      const nameEl  = document.getElementById('cardPreviewName');
      const tableEl = document.getElementById('cardPreviewTable');
      if (blankEn && blankOnly) {
        nameEl.textContent  = 'שם: _______________';
        tableEl.textContent = 'שולחן: ____________';
        nameEl.style.fontWeight  = '400';
        nameEl.style.color       = '#777';
        tableEl.style.color      = '#777';
      } else {
        nameEl.textContent  = 'ישראל ישראלי';
        tableEl.textContent = showLbl ? 'שולחן 5 — (לדוגמה)' : 'שולחן 5';
        nameEl.style.fontWeight  = '';
        nameEl.style.color       = '';
        tableEl.style.color      = '';
      }

      // Background image
      const topEl = document.getElementById('cardPreviewTop');
      if (_bgDataUrl && /^data:image\//.test(_bgDataUrl)) {
        topEl.style.backgroundImage    = `url('${_bgDataUrl.replace(/'/g, '%27').replace(/\)/g, '%29')}')`;
        topEl.style.backgroundSize     = 'cover';
        topEl.style.backgroundPosition = 'center';
        document.getElementById('cardsBgNote').style.display = '';
      } else {
        topEl.style.backgroundImage = '';
        document.getElementById('cardsBgNote').style.display = 'none';
      }

      // Custom text
      const customEl = document.getElementById('cardPreviewCustom');
      if (text) {
        customEl.textContent         = text;
        customEl.style.display       = '';
        customEl.style.fontFamily    = font;
        customEl.style.fontSize      = size + 'pt';
        customEl.style.color         = color;
        customEl.style.fontWeight    = bold   ? '700'    : '';
        customEl.style.fontStyle     = italic ? 'italic' : '';
        document.getElementById('cardCustomFmtRow').style.display = '';
      } else {
        customEl.style.display = 'none';
        document.getElementById('cardCustomFmtRow').style.display = 'none';
      }

      // Summary
      const all    = State.get().guests;
      const seated = all.filter(g => g.tableId).length;
      let summary = '';
      if (!blankOnly && all.length > 0)
        summary = `${all.length} כרטיסי מוזמנים (${seated} עם שיבוץ, ${all.length - seated} ללא)`;
      if (blankEn && blankCount > 0) {
        if (summary) summary += ' + ';
        summary += `${blankCount} כרטיסים ריקים`;
      }
      if (blankOnly && all.length > 0)
        summary += ` (${all.length} כרטיסי מוזמנים יושמטו)`;
      document.getElementById('cardPrintSummary').textContent = summary
        ? `יודפסו: ${summary}`
        : 'לא נבחרו כרטיסים להדפסה';
    }

    // Load saved template (or apply defaults)
    const _defaults = {
      cardSize: 80, customText: '', customFont: 'inherit', customFontSize: 11,
      customColor: '#333333', customBold: false, customItalic: false,
      showLabel: true, blankEnabled: false, blankCount: 5, blankOnly: false
    };
    try {
      const saved = localStorage.getItem(TEMPLATE_KEY);
      _applyForm(saved ? JSON.parse(saved) : _defaults);
    } catch(e) { _applyForm(_defaults); }

    // Reset volatile/session state
    document.getElementById('cardCustomFmtRow').style.display  = 'none';
    document.getElementById('cardsBgNote').style.display        = 'none';
    document.getElementById('cardPreviewCustom').style.display  = 'none';
    document.getElementById('btnClearCardBg').style.display     = 'none';
    document.getElementById('cardBgName').textContent           = '';
    _bgDataUrl = null;

    // Live-preview handlers (all inputs/selects/checkboxes)
    ['cardCustomText','cardCustomFont','cardCustomFontSize','cardCustomFontColor',
     'cardSizeSelect','cardShowLabel','cardBlankEnabled','cardBlankCount','cardBlankOnly'
    ].forEach(id => {
      const el = document.getElementById(id);
      el.oninput  = _updatePreview;
      el.onchange = _updatePreview;
    });

    // Bold / Italic toggle buttons
    ['cardCustomBold','cardCustomItalic'].forEach(id => {
      document.getElementById(id).onclick = () => {
        document.getElementById(id).classList.toggle('active');
        _updatePreview();
      };
    });

    // Background image upload / clear
    document.getElementById('btnUploadCardBg').onclick = () =>
      document.getElementById('cardBgInput').click();
    document.getElementById('cardBgInput').onchange = e => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = ev => {
        _bgDataUrl = ev.target.result;
        document.getElementById('btnClearCardBg').style.display = '';
        document.getElementById('cardBgName').textContent = file.name;
        e.target.value = '';
        _updatePreview();
      };
      reader.readAsDataURL(file);
    };
    document.getElementById('btnClearCardBg').onclick = () => {
      _bgDataUrl = null;
      document.getElementById('btnClearCardBg').style.display = 'none';
      document.getElementById('cardBgName').textContent = '';
      _updatePreview();
    };

    // Template: save as default
    document.getElementById('btnSaveCardTemplate').onclick = () => {
      try {
        localStorage.setItem(TEMPLATE_KEY, JSON.stringify(_readForm()));
        UI.toast('תבנית נשמרה ✓', 'success', 1800);
      } catch(e) { UI.toast('שגיאה בשמירת התבנית', 'error', 2500); }
    };

    // Template: export to JSON file
    document.getElementById('btnExportCardTemplate').onclick = () => {
      const blob     = new Blob([JSON.stringify(_readForm(), null, 2)], { type: 'application/json' });
      const url      = URL.createObjectURL(blob);
      const evtName  = (State.get().settings?.eventName || '').trim();
      const a        = document.createElement('a');
      a.href = url;
      a.download = evtName ? `card-template-${evtName}.json` : 'card-template.json';
      a.click();
      URL.revokeObjectURL(url);
    };

    // Template: import from JSON file
    document.getElementById('btnImportCardTemplate').onclick = () =>
      document.getElementById('cardTemplateInput').click();
    document.getElementById('cardTemplateInput').onchange = e => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = ev => {
        try {
          _applyForm(JSON.parse(ev.target.result));
          _updatePreview();
          UI.toast('תבנית יובאה ✓', 'success', 1800);
        } catch(err) { UI.toast('שגיאה בייבוא התבנית', 'error', 2500); }
      };
      reader.readAsText(file);
      e.target.value = '';
    };

    // Print button
    document.getElementById('btnDoPrintCards').onclick = () => {
      const f = _readForm();
      UI.closeModal('modalPrintCards');
      Print.printCards({
        customText:     f.customText,
        customFont:     f.customFont,
        customFontSize: f.customFontSize,
        customColor:    f.customColor,
        customBold:     f.customBold,
        customItalic:   f.customItalic,
        bgImage:        _bgDataUrl,
        cardSize:       f.cardSize,
        showLabel:      f.showLabel,
        blankCount:     f.blankEnabled ? f.blankCount : 0,
        blankOnly:      f.blankOnly
      });
    };

    _updatePreview();
    UI.openModal('modalPrintCards');
  }

  return {
    init,
    openAddTable, openEditTable,
    openEditItem, openAddGuest, openEditGuest,
    openAddShape, openSettings, openAutoAssign,
    openFindTable, openItemDetails,
    openPrintCards,
    handleGuestDrop, updateEventHeader,
    renderTagsManager, renderPresetManager, renderTablePresets,
    renderEventsManager, showAutoAssignResult
  };
})();
