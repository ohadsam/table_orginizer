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
    document.getElementById('tableQtyRow').style.display       = '';
    document.getElementById('tableLockRow').style.display      = 'none';
    const _nlEl = document.getElementById('tableNumberLock');
    if (_nlEl) _nlEl.checked = false;
    const _nlRow = document.getElementById('tableNumberLockRow');
    if (_nlRow) _nlRow.style.display = 'none';
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
    document.getElementById('tableQtyRow').style.display       = 'none';
    document.getElementById('tableLockRow').style.display      = '';
    const _nlEl2 = document.getElementById('tableNumberLock');
    if (_nlEl2) _nlEl2.checked = !!item.numberLocked;
    const _nlRow2 = document.getElementById('tableNumberLockRow');
    if (_nlRow2) _nlRow2.style.display = '';
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
    const locked       = document.getElementById('tableLock').checked;
    const numberLocked = document.getElementById('tableNumberLock')?.checked || false;
    const colorEnabled = document.getElementById('tableColorEnabled')?.checked;
    const color  = colorEnabled ? (document.getElementById('tableColor')?.value || null) : null;

    if (_editingTableId) {
      const item = State.getItem(_editingTableId);
      const updates = { shape: _tableShapeEdit, seats, label, locked, numberLocked, color, fontSize: fontSizeV };
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

  /* ═══════════════════ ADD GUEST TO TABLE ═══════════════════ */
  let _addGuestToTableId       = null;
  let _addGuestToTableSel      = new Set(); // selected IDs preserved across search re-renders
  let _addGuestToTableConfirmed = false;    // flag so the observer doesn't re-open after confirm

  function openAddGuestToTable(tableId) {
    _addGuestToTableId        = tableId;
    _addGuestToTableSel       = new Set();
    _addGuestToTableConfirmed = false;
    const table = State.getItem(tableId);
    if (!table) return;

    const title = document.getElementById('addGuestToTableTitle');
    if (title) title.textContent = `הוסף מוזמנים לשולחן ${table.number != null ? table.number : ''}`.trim();

    const searchEl = document.getElementById('addGuestToTableSearch');
    if (searchEl) {
      searchEl.value = '';
      searchEl.oninput = () => _renderAddGuestToTableList(searchEl.value);
    }

    _renderAddGuestToTableList('');

    const confirmBtn = document.getElementById('btnConfirmAddGuestToTable');
    if (confirmBtn) confirmBtn.onclick = _confirmAddGuestToTable;

    // Close item-details before opening so Escape returns cleanly.
    // A MutationObserver re-opens item-details when this modal loses .active
    // (handles Escape, backdrop click, and cancel button uniformly).
    UI.closeModal('modalItemDetails');
    UI.openModal('modalAddGuestToTable');

    const overlay = document.getElementById('modalAddGuestToTable');
    if (overlay) {
      const obs = new MutationObserver(() => {
        if (!overlay.classList.contains('active')) {
          obs.disconnect();
          if (!_addGuestToTableConfirmed) openItemDetails(_addGuestToTableId);
        }
      });
      obs.observe(overlay, { attributes: true, attributeFilter: ['class'] });
    }
  }

  function _renderAddGuestToTableList(search) {
    const listEl  = document.getElementById('addGuestToTableList');
    const emptyEl = document.getElementById('addGuestToTableEmpty');
    if (!listEl) return;

    const q = (search || '').trim().toLowerCase();
    const unassigned = State.get().guests.filter(g =>
      !g.tableId && !g.splitOf && (!q || (g.name || '').toLowerCase().includes(q))
    );

    if (!unassigned.length) {
      listEl.innerHTML = '';
      if (emptyEl) emptyEl.style.display = '';
      return;
    }
    if (emptyEl) emptyEl.style.display = 'none';

    listEl.innerHTML = unassigned.map(g => {
      const tagStr  = (g.tags || []).slice(0, 2).map(t => UI.escHtml(t)).join(', ');
      const checked = _addGuestToTableSel.has(g.id) ? 'checked' : '';
      return `<label class="add-guest-row">
        <input type="checkbox" data-guest-add="${UI.escHtml(g.id)}" ${checked} style="cursor:pointer">
        <span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${UI.escHtml(g.name || '')}</span>
        <span style="font-size:11px;color:#888;white-space:nowrap">${g.total > 1 ? g.total + ' אנשים' : ''}${tagStr ? (g.total > 1 ? ' · ' : '') + tagStr : ''}</span>
      </label>`;
    }).join('');

    // Keep the selection Set in sync when the user checks/unchecks
    listEl.querySelectorAll('[data-guest-add]').forEach(cb => {
      cb.addEventListener('change', () => {
        if (cb.checked) _addGuestToTableSel.add(cb.dataset.guestAdd);
        else            _addGuestToTableSel.delete(cb.dataset.guestAdd);
      });
    });
  }

  function _confirmAddGuestToTable() {
    if (!_addGuestToTableId || !_addGuestToTableSel.size) {
      UI.toast('לא נבחרו מוזמנים', 'warning', 2000);
      return;
    }
    const count = _addGuestToTableSel.size;
    _addGuestToTableConfirmed = true; // prevent observer from re-opening without updates

    Guests.startBatch();
    _addGuestToTableSel.forEach(gid => State.assignGuest(gid, _addGuestToTableId));
    Guests.endBatch();

    UI.closeModal('modalAddGuestToTable'); // observer fires here but _confirmed=true so it skips
    openItemDetails(_addGuestToTableId);   // explicitly re-open with updated guest list
    UI.toast(`${count} מוזמן${count > 1 ? 'ים' : ''} נוסף${count > 1 ? 'ו' : ''} לשולחן ✓`, 'success', 2000);
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
            <div class="form-group">
              <label class="checkbox-label">
                <input type="checkbox" id="detailsTableNumberLock" ${item.numberLocked ? 'checked' : ''}>
                <span>🔢 נעל מספר שולחן (המספור האוטומטי לא ישנה אותו)</span>
              </label>
            </div>
          </div>
          <div class="details-col">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;flex-wrap:wrap;gap:6px">
              <h3 class="details-section-title" style="margin:0">
                מוזמנים בשולחן
                <span class="details-occ">${occ}/${item.seats}</span>
              </h3>
              <button class="btn btn-sm btn-secondary" id="btnDetailAddGuest" title="הוסף מוזמנים לשולחן">+ הוסף מוזמן</button>
            </div>
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

      body.querySelector('#btnDetailAddGuest')?.addEventListener('click', () => {
        openAddGuestToTable(id);
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
      const locked       = document.getElementById('detailsTableLock')?.checked || false;
      const numberLocked = document.getElementById('detailsTableNumberLock')?.checked || false;
      const colorEn      = document.getElementById('detailsColorEnabled')?.checked;
      const color        = colorEn ? (document.getElementById('detailsTableColor')?.value || null) : null;

      const updates = { seats, label, locked, numberLocked, color, fontSize: fontSizeV };
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

  function _syncChildrenWithParentsVisibility() {
    const children = parseInt(document.getElementById('guestChildren').value) || 0;
    const grp = document.getElementById('guestChildrenWithParentsGroup');
    if (grp) grp.style.display = children > 0 ? '' : 'none';
    if (children === 0) {
      const cwp = document.getElementById('guestChildrenWithParents');
      if (cwp) cwp.value = 0;
    }
  }

  function openAddGuest() {
    _editingGuestId = null;
    _selectedTags   = new Set();
    _selectedProx   = new Set();
    document.getElementById('guestModalTitle').textContent = 'הוסף מוזמן';
    document.getElementById('guestName').value     = '';
    document.getElementById('guestAdults').value   = 2;
    document.getElementById('guestChildren').value = 0;
    const cwpEl = document.getElementById('guestChildrenWithParents');
    if (cwpEl) cwpEl.value = 0;
    document.getElementById('guestNotes').value    = '';
    _syncChildrenWithParentsVisibility();
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
    const cwpEl = document.getElementById('guestChildrenWithParents');
    if (cwpEl) cwpEl.value = g.childrenWithParents || 0;
    document.getElementById('guestNotes').value    = g.notes || '';
    _syncChildrenWithParentsVisibility();
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
    const childrenWithParents = children > 0
      ? Math.min(children, Math.max(0, parseInt(document.getElementById('guestChildrenWithParents')?.value) || 0))
      : 0;
    if (_editingGuestId) {
      State.updateGuest(_editingGuestId, { name, adults, children, childrenWithParents, tags, proximity, notes });
    } else {
      State.addGuest({ name, adults, children, childrenWithParents, tags, proximity, notes });
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
    const { assigned, failed, failedGuests, splitsCreated, tablesCreated, rerolled, runs, layoutName } = result;

    // Totals for percentage — use post-run state so keepExisting runs show accurate totals
    const allGuests   = State.get().guests.filter(g => !g.splitOf);
    const totalPeople = allGuests.reduce((s, g) => s + Math.max(1, g.total || 0), 0);
    const nowAssigned = allGuests.filter(g => g.tableId).reduce((s, g) => s + Math.max(1, g.total || 0), 0);
    const pct = totalPeople > 0 ? Math.round(nowAssigned / totalPeople * 100) : 0;

    const rows = [];
    if (rerolled && runs)   rows.push(`<div class="result-row result-info">הוגרל ${runs} פעמים — נבחרה התוצאה הטובה ביותר 🎲</div>`);
    if (layoutName)         rows.push(`<div class="result-row result-info">נשמר כפריסה: <strong>${UI.escHtml(layoutName)}</strong> 📐</div>`);
    if (tablesCreated > 0)  rows.push(`<div class="result-row result-info"><strong>${tablesCreated}</strong> שולחנות נוצרו אוטומטית 🪑</div>`);

    if (assigned === 0 && failed === 0 && tablesCreated === 0 && splitsCreated === 0) {
      rows.push(`<div class="result-row result-info">אין שינויים — כל המוזמנים כבר שובצו ✓</div>`);
    } else {
      const deltaNote = nowAssigned > assigned ? ` (${assigned} חדשים)` : '';
      rows.push(`<div class="result-row result-success"><strong>${nowAssigned}</strong> / ${totalPeople} מוזמנים שובצו (${pct}%)${deltaNote} ✅</div>`);
    }
    if (splitsCreated > 0) rows.push(`<div class="result-row result-warning"><strong>${splitsCreated}</strong> קבוצות פוצלו ⛓ (מסומנות בכרטיסים ובהדפסה)</div>`);
    if (failed > 0) {
      rows.push(`<div class="result-row result-danger"><strong>${failed}</strong> מוזמנים לא שובצו ⚠️</div>`);
      if (failedGuests && failedGuests.length) {
        const names = failedGuests.slice(0, 6).map(g =>
          `<li>${UI.escHtml(g.name)}${g.total > 1 ? ` (${g.total})` : ''}</li>`
        ).join('');
        const more  = failedGuests.length > 6
          ? `<li style="color:#90a4ae">...ועוד ${failedGuests.length - 6}</li>` : '';
        rows.push(`<ul style="margin:4px 0 0 0;padding:0 18px 0 0;font-size:12px;color:#b71c1c;line-height:1.7">${names}${more}</ul>`);
      }
    }

    body.innerHTML = `<div class="assign-result-grid">${rows.join('')}</div>`;
    UI.openModal('modalAutoAssignResult');
  }

  /* ═══════════════════ AUTO-ASSIGN AS LAYOUT ═══════════════════ */
  function openAutoAssignAsLayout(opts) {
    const state = State.get();
    const guests = state.guests.filter(g => !g.splitOf);
    if (!guests.length) {
      UI.toast('אין מוזמנים לשיבוץ', 'info');
      return;
    }

    const tableItems = state.items.filter(i => i.type === 'table' && !i.locked);
    const eventName  = state.event?.name || 'אירוע';
    const layoutName = eventName + ' — שיבוץ ' + (State.getLayoutOptions().length + 1);

    Guests.startBatch();
    try {
      tableItems.forEach(t => State.removeItem(t.id));
    } finally {
      Guests.endBatch();
    }

    // Run assign (createTables forced on so new tables are created as needed)
    const result = AutoAssign.run({ ...opts, keepExisting: false, createTables: true });

    // Don't save an empty layout snapshot if no guests were placed (e.g. all at locked tables)
    if (result.assigned === 0 && result.tablesCreated === 0) {
      UI.toast('לא נוצרה פריסה — לא שובצו מוזמנים', 'info');
      return;
    }

    // saveLayoutOption emits layoutOptionsChanged synchronously, which calls renderLayoutDropdown()
    // before returning. Set _activeLayoutId AFTER that fires, then re-render explicitly — same
    // pattern as confirmSaveLayout — so the dropdown shows the new layout selected.
    const savedId   = State.saveLayoutOption(layoutName);
    _activeLayoutId = savedId;
    renderLayoutDropdown();

    requestAnimationFrame(() => Canvas.fitAll());
    showAutoAssignResult({ ...result, layoutName });
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
    document.getElementById('guestChildren')?.addEventListener('input', _syncChildrenWithParentsVisibility);
    document.getElementById('btnAddNewTag')?.addEventListener('click', () => {
      const inp = document.getElementById('newTagInput');
      const val = inp.value.trim();
      if (val) { State.addTag(val); inp.value = ''; renderGuestTagsSelector(); }
    });

    // Guest dependencies modal
    document.getElementById('btnGuestDependencies')?.addEventListener('click', () => openGuestDependencies(null));
    document.getElementById('depTabGraph')?.addEventListener('click',   () => _renderDepView('graph'));
    document.getElementById('depTabAdd')?.addEventListener('click',     () => _renderDepView('add'));
    document.getElementById('depTabTable')?.addEventListener('click',   () => _renderDepView('table'));
    document.getElementById('depTabTypes')?.addEventListener('click',      () => _renderDepView('types'));
    document.getElementById('depTabSuggest')?.addEventListener('click',    () => _renderDepView('suggest'));
    document.getElementById('depTabInferRules')?.addEventListener('click', () => _renderDepView('inferrules'));
    document.getElementById('btnDepGraphAddMode')?.addEventListener('click', _toggleDepGraphAddMode);
    document.getElementById('btnPrintDependencies')?.addEventListener('click', _printDependencies);
    document.getElementById('btnExportDependencies')?.addEventListener('click', () => Storage.exportDependencies());
    document.getElementById('btnImportDependencies')?.addEventListener('click', () => document.getElementById('importDepsInput')?.click());
    document.getElementById('importDepsInput')?.addEventListener('change', e => {
      const file = e.target.files[0]; if (!file) return;
      _pendingDepsFile = file;
      UI.openModal('modalImportDeps');
      e.target.value = '';
    });
    document.getElementById('btnImportDepsMerge')?.addEventListener('click', async () => {
      try { if (_pendingDepsFile) await Storage.importDependencies(_pendingDepsFile, true); }
      finally { _pendingDepsFile = null; UI.closeModal('modalImportDeps'); }
    });
    document.getElementById('btnImportDepsReplace')?.addEventListener('click', async () => {
      try { if (_pendingDepsFile) await Storage.importDependencies(_pendingDepsFile, false); }
      finally { _pendingDepsFile = null; UI.closeModal('modalImportDeps'); }
    });
    // Cleanup type-picker dialog when dep modal closes
    document.querySelectorAll('[data-close-modal="modalGuestDependencies"]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.getElementById('_depTypePicker')?.remove();
        _depGraphAddMode = false;
        _depGraphFirstId = null;
      });
    });

    // Auto-assign settings modal
    document.getElementById('btnOpenAutoAssignSettings')?.addEventListener('click', () => {
      UI.closeModal('modalAutoAssign');
      openAutoAssignSettings();
    });
    document.getElementById('btnSaveAutoAssignSettings')?.addEventListener('click', _saveAutoAssignSettings);
    document.getElementById('btnAddTableType')?.addEventListener('click', () => {
      const f = document.getElementById('aaAddTableTypeForm');
      if (f) f.style.display = f.style.display === 'none' ? '' : 'none';
    });
    document.getElementById('btnConfirmAddTableType')?.addEventListener('click', () => {
      const name = document.getElementById('aaTypeNameInput')?.value.trim();
      if (!name) { UI.toast('נא להזין שם', 'warning'); return; }
      const maxCount = parseInt(document.getElementById('aaTypeMaxCount')?.value) || null;
      const maxSeats = parseInt(document.getElementById('aaTypeMaxSeats')?.value) || null;
      const minOcc   = Math.max(0, Math.min(100, parseInt(document.getElementById('aaTypeMinOccupancy')?.value) || 0));
      const s = State.get().settings;
      if (!s.autoAssign.tableTypes) s.autoAssign.tableTypes = [];
      s.autoAssign.tableTypes.push({ id: 'ttype_' + Date.now(), name, maxCount, maxSeats, minOccupancyBeforeSplit: minOcc });
      State.setSetting('autoAssign', s.autoAssign);
      document.getElementById('aaTypeNameInput').value = '';
      document.getElementById('aaAddTableTypeForm').style.display = 'none';
      _renderAATableTypesList();
      UI.toast('סוג שולחן נוסף ✓', 'success', 1500);
    });
    document.getElementById('btnAddCustomDepType')?.addEventListener('click', () => {
      const f = document.getElementById('aaAddCustomDepForm');
      if (f) f.style.display = f.style.display === 'none' ? '' : 'none';
    });
    document.getElementById('btnConfirmAddCustomDep')?.addEventListener('click', () => {
      const label  = document.getElementById('aaCustomDepLabel')?.value.trim();
      if (!label) { UI.toast('נא להזין שם', 'warning'); return; }
      const icon     = document.getElementById('aaCustomDepIcon')?.value.trim() || '🔗';
      const strength = document.getElementById('aaCustomDepStrength')?.value || 'preferred';
      const color    = document.getElementById('aaCustomDepColor')?.value || '#42A5F5';
      const s = State.get().settings;
      if (!s.autoAssign.customDependencyTypes) s.autoAssign.customDependencyTypes = [];
      s.autoAssign.customDependencyTypes.push({ id: 'cdt_' + Date.now(), label, icon, strength, color });
      State.setSetting('autoAssign', s.autoAssign);
      document.getElementById('aaCustomDepLabel').value = '';
      document.getElementById('aaAddCustomDepForm').style.display = 'none';
      _renderAACustomDepTypesList();
      UI.toast('סוג תלות נוסף ✓', 'success', 1500);
    });

    // Toggle extra venue items
    document.getElementById('btnToggleVenueItems')?.addEventListener('click', function() {
      const extra = document.getElementById('venueItemsExtra');
      const isHidden = !extra || extra.style.display === 'none';
      if (extra) extra.style.display = isHidden ? '' : 'none';
      this.textContent = isHidden ? '▲ פחות' : '▼ עוד';
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
    function _getAutoAssignOpts() {
      return {
        allowSplit:      document.getElementById('autoAssignSplit')?.checked !== false,
        keepExisting:    !!document.getElementById('autoAssignKeepExisting')?.checked,
        respectProximity: document.getElementById('autoAssignProximity')?.checked !== false,
        createTables:    !!document.getElementById('autoAssignCreateTables')?.checked,
        algorithm:       document.getElementById('autoAssignAlgorithm')?.value || 'csp-greedy'
      };
    }
    document.getElementById('btnConfirmAutoAssign')?.addEventListener('click', () => {
      const opts = _getAutoAssignOpts();
      UI.closeModal('modalAutoAssign');
      const result = AutoAssign.run(opts);
      if (result.noAction) return;
      if (result.tablesCreated > 0) requestAnimationFrame(() => Canvas.fitAll());
      showAutoAssignResult(result);
    });
    document.getElementById('btnAutoAssignReroll')?.addEventListener('click', () => {
      const opts = _getAutoAssignOpts();
      UI.closeModal('modalAutoAssign');
      const result = AutoAssign.reroll(opts);
      if (result.noAction) return;
      if (result.tablesCreated > 0) requestAnimationFrame(() => Canvas.fitAll());
      showAutoAssignResult(result);
    });
    document.getElementById('btnAutoAssignAsLayout')?.addEventListener('click', () => {
      const opts = _getAutoAssignOpts();
      UI.closeModal('modalAutoAssign');
      openAutoAssignAsLayout(opts);
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
      // Always show storage warning and getting-started tips on new event creation
      setTimeout(() => { UI.showStorageWarning(true); UI.showGettingStarted(true); }, 400);
    });

    // Import guests modal (merge/replace handled in app.js)
    document.getElementById('btnCloseAutoAssignResult')?.addEventListener('click', () => {
      UI.closeModal('modalAutoAssignResult');
    });

    State.on('eventChanged',        updateEventHeader);
    State.on('dataLoaded',          updateEventHeader);
    State.on('presetsChanged',      renderTablePresets);
    State.on('layoutOptionsChanged', () => {
      // Auto-clear active ID if its option was deleted
      if (_activeLayoutId && !State.getLayoutOptions().find(o => o.id === _activeLayoutId))
        _activeLayoutId = null;
      renderLayoutDropdown();
    });
    State.on('dataLoaded',          renderLayoutDropdown);
    State.on('eventSwitched',       () => { _activeLayoutId = null; renderLayoutDropdown(); });
    updateEventHeader();
    renderLayoutDropdown();

    // Delete layout (handler here so _activeLayoutId is in scope)
    document.getElementById('btnDeleteLayout')?.addEventListener('click', () => {
      if (!_activeLayoutId) return;
      const name = State.getLayoutOptions().find(o => o.id === _activeLayoutId)?.name || _activeLayoutId;
      if (!UI.confirmDialog(`למחוק את פריסת ההושבה "${name}"?`)) return;
      State.deleteLayoutOption(_activeLayoutId);  // emits layoutOptionsChanged → auto-clears _activeLayoutId + re-renders
      UI.toast(`הפריסה "${name}" נמחקה`, 'info');
    });

    // Save layout modal
    document.getElementById('btnConfirmSaveLayout')?.addEventListener('click', confirmSaveLayout);
    document.getElementById('layoutOptionName')?.addEventListener('keydown', e => {
      if (e.key === 'Enter') confirmSaveLayout();
    });

    // Layout dropdown change: load selected option
    document.getElementById('selectLayoutOption')?.addEventListener('change', e => {
      const id   = e.target.value;
      const prev = _activeLayoutId;
      if (!id) {
        _activeLayoutId = null;
        renderLayoutDropdown();
        return;
      }
      const optName = State.getLayoutOptions().find(o => o.id === id)?.name || id;
      if (!UI.confirmDialog(`לטעון את פריסת ההושבה "${optName}"?\nהמצב הנוכחי יוחלף.`)) {
        e.target.value = prev || '';
        return;
      }
      _activeLayoutId = id;          // set before load so dataLoaded → renderLayoutDropdown sees the right value
      if (!State.loadLayoutOption(id)) {
        _activeLayoutId = prev;      // revert on failure
        e.target.value  = prev || '';
        renderLayoutDropdown();      // re-sync dropdown after revert
      } else {
        requestAnimationFrame(() => Canvas.fitAll());
      }
    });
  }

  /* ── Print Cards modal ── */
  function openPrintCards() {
    const TEMPLATE_KEY = 'seating_cards_template';
    let _bgDataUrl = null;

    function _readForm() {
      return {
        version:       1,
        cardSize:      parseInt(document.getElementById('cardSizeSelect').value)      || 80,
        nameFont:      document.getElementById('cardNameFont').value,
        nameFontSize:  parseInt(document.getElementById('cardNameFontSize').value)    || 16,
        nameColor:     document.getElementById('cardNameFontColor').value,
        nameBold:      document.getElementById('cardNameBold').classList.contains('active'),
        nameItalic:    document.getElementById('cardNameItalic').classList.contains('active'),
        tableFont:     document.getElementById('cardTableFont').value,
        tableFontSize: parseInt(document.getElementById('cardTableFontSize').value)   || 12,
        tableColor:    document.getElementById('cardTableFontColor').value,
        tableBold:     document.getElementById('cardTableBold').classList.contains('active'),
        tableItalic:   document.getElementById('cardTableItalic').classList.contains('active'),
        customText:    document.getElementById('cardCustomText').value.trim(),
        customFont:    document.getElementById('cardCustomFont').value,
        customFontSize:parseInt(document.getElementById('cardCustomFontSize').value)  || 11,
        customColor:   document.getElementById('cardCustomFontColor').value,
        customBold:    document.getElementById('cardCustomBold').classList.contains('active'),
        customItalic:  document.getElementById('cardCustomItalic').classList.contains('active'),
        showLabel:     document.getElementById('cardShowLabel').checked,
        showCounts:    document.getElementById('cardShowCounts').checked,
        blankEnabled:  document.getElementById('cardBlankEnabled').checked,
        blankCount:    parseInt(document.getElementById('cardBlankCount').value)       || 1,
        blankOnly:     document.getElementById('cardBlankOnly').checked
      };
    }

    function _applyForm(t) {
      if (!t) return;
      if (t.cardSize       != null) document.getElementById('cardSizeSelect').value      = String(t.cardSize);
      if (t.nameFont       != null) document.getElementById('cardNameFont').value        = t.nameFont;
      if (t.nameFontSize   != null) document.getElementById('cardNameFontSize').value    = String(t.nameFontSize);
      if (t.nameColor      != null) document.getElementById('cardNameFontColor').value   = t.nameColor;
      if (t.nameBold   != null) document.getElementById('cardNameBold').classList.toggle('active',   !!t.nameBold);
      if (t.nameItalic != null) document.getElementById('cardNameItalic').classList.toggle('active', !!t.nameItalic);
      if (t.tableFont      != null) document.getElementById('cardTableFont').value       = t.tableFont;
      if (t.tableFontSize  != null) document.getElementById('cardTableFontSize').value   = String(t.tableFontSize);
      if (t.tableColor     != null) document.getElementById('cardTableFontColor').value  = t.tableColor;
      if (t.tableBold   != null) document.getElementById('cardTableBold').classList.toggle('active',   !!t.tableBold);
      if (t.tableItalic != null) document.getElementById('cardTableItalic').classList.toggle('active', !!t.tableItalic);
      if (t.customText     != null) document.getElementById('cardCustomText').value      = t.customText;
      if (t.customFont     != null) document.getElementById('cardCustomFont').value      = t.customFont;
      if (t.customFontSize != null) document.getElementById('cardCustomFontSize').value  = String(t.customFontSize);
      if (t.customColor    != null) document.getElementById('cardCustomFontColor').value = t.customColor;
      if (t.customBold   != null) document.getElementById('cardCustomBold').classList.toggle('active',   !!t.customBold);
      if (t.customItalic != null) document.getElementById('cardCustomItalic').classList.toggle('active', !!t.customItalic);
      document.getElementById('cardShowLabel').checked    = t.showLabel  !== false;
      if (t.showCounts != null) document.getElementById('cardShowCounts').checked = t.showCounts !== false;
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
      const showLbl    = document.getElementById('cardShowLabel').checked;
      const showCounts = document.getElementById('cardShowCounts').checked;
      const blankEn    = document.getElementById('cardBlankEnabled').checked;
      const sizeMm   = parseInt(document.getElementById('cardSizeSelect').value) || 80;
      const sizePx   = Math.round(sizeMm * 1.8);
      const sizeCm   = sizeMm / 10;

      const nameFont     = document.getElementById('cardNameFont').value;
      const nameFontSize = parseInt(document.getElementById('cardNameFontSize').value) || 16;
      const nameColor    = document.getElementById('cardNameFontColor').value;
      const nameBold     = document.getElementById('cardNameBold').classList.contains('active');
      const nameItalic   = document.getElementById('cardNameItalic').classList.contains('active');

      const tableFont     = document.getElementById('cardTableFont').value;
      const tableFontSize = parseInt(document.getElementById('cardTableFontSize').value) || 12;
      const tableColor    = document.getElementById('cardTableFontColor').value;
      const tableBold     = document.getElementById('cardTableBold').classList.contains('active');
      const tableItalic   = document.getElementById('cardTableItalic').classList.contains('active');

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

      // Preview card content
      const nameEl  = document.getElementById('cardPreviewName');
      const tableEl = document.getElementById('cardPreviewTable');
      if (blankEn && blankOnly) {
        nameEl.textContent       = 'שם: _______________';
        tableEl.textContent      = 'שולחן: ____________';
        nameEl.style.fontFamily  = '';
        nameEl.style.fontSize    = '';
        nameEl.style.fontWeight  = '400';
        nameEl.style.fontStyle   = '';
        nameEl.style.color       = '#777';
        tableEl.style.fontFamily = '';
        tableEl.style.fontSize   = '';
        tableEl.style.fontWeight = '400';
        tableEl.style.fontStyle  = '';
        tableEl.style.color      = '#777';
      } else {
        nameEl.textContent       = 'ישראל ישראלי';
        tableEl.textContent      = showLbl ? 'שולחן 5 — (לדוגמה)' : 'שולחן 5';
        nameEl.style.fontFamily  = nameFont;
        nameEl.style.fontSize    = nameFontSize + 'pt';
        nameEl.style.fontWeight  = nameBold  ? '700'    : '400';
        nameEl.style.fontStyle   = nameItalic  ? 'italic' : '';
        nameEl.style.color       = nameColor;
        tableEl.style.fontFamily = tableFont;
        tableEl.style.fontSize   = tableFontSize + 'pt';
        tableEl.style.fontWeight = tableBold  ? '700'    : '400';
        tableEl.style.fontStyle  = tableItalic ? 'italic' : '';
        tableEl.style.color      = tableColor;
      }

      // Counts preview
      const countsEl = document.getElementById('cardPreviewCounts');
      if (countsEl) {
        countsEl.style.display = showCounts ? '' : 'none';
        countsEl.textContent   = (blankEn && blankOnly)
          ? 'מבוגרים: ___ | ילדים: ___'
          : 'מבוגרים: 2 | ילדים: 1';
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

      // Custom text preview
      const customEl = document.getElementById('cardPreviewCustom');
      if (text) {
        customEl.textContent      = text;
        customEl.style.display    = '';
        customEl.style.fontFamily = font;
        customEl.style.fontSize   = size + 'pt';
        customEl.style.color      = color;
        customEl.style.fontWeight = bold   ? '700'    : '';
        customEl.style.fontStyle  = italic ? 'italic' : '';
      } else {
        customEl.style.display = 'none';
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
      if (blankEn && blankOnly && all.length > 0)
        summary += ` (${all.length} כרטיסי מוזמנים יושמטו)`;
      document.getElementById('cardPrintSummary').textContent = summary
        ? `יודפסו: ${summary}`
        : 'לא נבחרו כרטיסים להדפסה';
    }

    // Load saved template (or apply defaults)
    const _defaults = {
      cardSize:      80,
      nameFont:      'inherit', nameFontSize:  16, nameColor:  '#111111', nameBold:  true,  nameItalic:  false,
      tableFont:     'inherit', tableFontSize: 12, tableColor: '#333333', tableBold: false, tableItalic: false,
      customText:    '', customFont: 'inherit', customFontSize: 11,
      customColor: '#333333', customBold: false, customItalic: false,
      showLabel: true, showCounts: true, blankEnabled: false, blankCount: 5, blankOnly: false
    };
    try {
      const saved = localStorage.getItem(TEMPLATE_KEY);
      _applyForm(saved ? JSON.parse(saved) : _defaults);
    } catch(e) { _applyForm(_defaults); }

    // Reset volatile/session state
    document.getElementById('cardsBgNote').style.display        = 'none';
    document.getElementById('cardPreviewCustom').style.display  = 'none';
    document.getElementById('btnClearCardBg').style.display     = 'none';
    document.getElementById('cardBgName').textContent           = '';
    _bgDataUrl = null;

    // Live-preview handlers (all inputs/selects/checkboxes)
    ['cardNameFont','cardNameFontSize','cardNameFontColor',
     'cardTableFont','cardTableFontSize','cardTableFontColor',
     'cardCustomText','cardCustomFont','cardCustomFontSize','cardCustomFontColor',
     'cardSizeSelect','cardShowLabel','cardShowCounts','cardBlankEnabled','cardBlankCount','cardBlankOnly'
    ].forEach(id => {
      const el = document.getElementById(id);
      el.oninput  = _updatePreview;
      el.onchange = _updatePreview;
    });

    // Bold / Italic toggle buttons
    ['cardNameBold','cardNameItalic','cardTableBold','cardTableItalic','cardCustomBold','cardCustomItalic'].forEach(id => {
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
        nameFont:      f.nameFont,
        nameFontSize:  f.nameFontSize,
        nameColor:     f.nameColor,
        nameBold:      f.nameBold,
        nameItalic:    f.nameItalic,
        tableFont:     f.tableFont,
        tableFontSize: f.tableFontSize,
        tableColor:    f.tableColor,
        tableBold:     f.tableBold,
        tableItalic:   f.tableItalic,
        customText:    f.customText,
        customFont:    f.customFont,
        customFontSize:f.customFontSize,
        customColor:   f.customColor,
        customBold:    f.customBold,
        customItalic:  f.customItalic,
        bgImage:       _bgDataUrl,
        cardSize:      f.cardSize,
        showLabel:     f.showLabel,
        showCounts:    f.showCounts,
        blankCount:    f.blankEnabled ? f.blankCount : 0,
        blankOnly:     f.blankOnly
      });
    };

    _updatePreview();
    UI.openModal('modalPrintCards');
  }

  /* ── Align / Distribute Items modal ── */
  function openAlignItems() {
    const ids = Items.getSelectedIds();
    if (ids.length < 2) { UI.toast('יש לסמן לפחות 2 פריטים', 'info', 1800); return; }
    document.getElementById('alignItemCount').textContent = ids.length;

    function applyAlign(type) {
      const items = ids.map(id => State.getItem(id)).filter(Boolean);
      if (items.length < 2) return;
      let applied = false;
      Guests.startBatch();
      switch (type) {
        case 'left': {
          const edge = Math.min(...items.map(i => i.x - i.width / 2));
          items.forEach(i => State.updateItem(i.id, { x: edge + i.width / 2 }));
          applied = true; break;
        }
        case 'right': {
          const edge = Math.max(...items.map(i => i.x + i.width / 2));
          items.forEach(i => State.updateItem(i.id, { x: edge - i.width / 2 }));
          applied = true; break;
        }
        case 'top': {
          const edge = Math.min(...items.map(i => i.y - i.height / 2));
          items.forEach(i => State.updateItem(i.id, { y: edge + i.height / 2 }));
          applied = true; break;
        }
        case 'bottom': {
          const edge = Math.max(...items.map(i => i.y + i.height / 2));
          items.forEach(i => State.updateItem(i.id, { y: edge - i.height / 2 }));
          applied = true; break;
        }
        case 'centerH': {
          const cx = items.reduce((s, i) => s + i.x, 0) / items.length;
          items.forEach(i => State.updateItem(i.id, { x: cx }));
          applied = true; break;
        }
        case 'centerV': {
          const cy = items.reduce((s, i) => s + i.y, 0) / items.length;
          items.forEach(i => State.updateItem(i.id, { y: cy }));
          applied = true; break;
        }
        case 'distributeH': {
          if (items.length < 3) { UI.toast('פיזור שווה דורש לפחות 3 פריטים', 'info', 1800); break; }
          const sorted = [...items].sort((a, b) => a.x - b.x);
          const firstX = sorted[0].x, lastX = sorted[sorted.length - 1].x;
          const step = (lastX - firstX) / (sorted.length - 1);
          sorted.forEach((i, idx) => {
            if (idx === 0 || idx === sorted.length - 1) return;
            State.updateItem(i.id, { x: firstX + idx * step });
          });
          applied = true; break;
        }
        case 'distributeV': {
          if (items.length < 3) { UI.toast('פיזור שווה דורש לפחות 3 פריטים', 'info', 1800); break; }
          const sorted = [...items].sort((a, b) => a.y - b.y);
          const firstY = sorted[0].y, lastY = sorted[sorted.length - 1].y;
          const step = (lastY - firstY) / (sorted.length - 1);
          sorted.forEach((i, idx) => {
            if (idx === 0 || idx === sorted.length - 1) return;
            State.updateItem(i.id, { y: firstY + idx * step });
          });
          applied = true; break;
        }
      }
      Guests.endBatch();
      if (applied) UI.toast('יושר ✓', 'success', 1500);
    }

    const actions = {
      alignLeft: 'left', alignCenterH: 'centerH', alignRight: 'right',
      alignTop: 'top', alignCenterV: 'centerV', alignBottom: 'bottom',
      distributeH: 'distributeH', distributeV: 'distributeV'
    };
    Object.entries(actions).forEach(([btnId, type]) => {
      const btn = document.getElementById(btnId);
      if (btn) btn.onclick = () => applyAlign(type);
    });

    UI.openModal('modalAlignItems');
  }

  /* ── Print Diagram modal ── */
  function openPrintDiagram() {
    const btnAuto   = document.getElementById('btnDiagramFontAuto');
    const btnFixed  = document.getElementById('btnDiagramFontFixed');
    const fixedOpts = document.getElementById('diagramFixedFontOpts');
    const hint      = document.getElementById('diagramFontModeHint');

    if (btnAuto && btnFixed && fixedOpts) {
      // Reset to auto mode on every open
      btnAuto.classList.add('active');  btnFixed.classList.remove('active');
      fixedOpts.style.display = 'none';
      if (hint) hint.style.display = '';

      btnAuto.onclick = () => {
        btnAuto.classList.add('active');  btnFixed.classList.remove('active');
        fixedOpts.style.display = 'none';
        if (hint) hint.style.display = '';
      };
      btnFixed.onclick = () => {
        btnFixed.classList.add('active'); btnAuto.classList.remove('active');
        fixedOpts.style.display = '';
        if (hint) hint.style.display = 'none';
      };
    }

    const chk      = document.getElementById('chkDiagramShowGuests');
    const opts     = document.getElementById('diagramGuestOpts');
    const stdOpts  = document.getElementById('diagramStdOpts');
    if (chk) {
      // Reset to unchecked on every open so section visibility matches checkbox state
      chk.checked = false;
      if (opts)    opts.style.display    = 'none';
      if (stdOpts) stdOpts.style.display = '';
      chk.onchange = () => {
        if (opts)    opts.style.display    = chk.checked ? '' : 'none';
        if (stdOpts) stdOpts.style.display = chk.checked ? 'none' : '';
      };
    }

    const chkGis    = document.getElementById('chkDiagramGuestInShape');
    const gisOptsEl = document.getElementById('diagramGuestInShapeOpts');
    if (chkGis) {
      // Reset to unchecked on every open
      chkGis.checked = false;
      if (gisOptsEl) gisOptsEl.style.display = 'none';
      chkGis.onchange = () => {
        if (gisOptsEl) gisOptsEl.style.display = chkGis.checked ? '' : 'none';
      };
    }

    const btnOrientPortrait  = document.getElementById('btnDiagramOrientPortrait');
    const btnOrientLandscape = document.getElementById('btnDiagramOrientLandscape');
    if (btnOrientPortrait && btnOrientLandscape) {
      // Reset to landscape on every open
      btnOrientLandscape.classList.add('active');
      btnOrientPortrait.classList.remove('active');
      btnOrientPortrait.onclick = () => {
        btnOrientPortrait.classList.add('active');
        btnOrientLandscape.classList.remove('active');
      };
      btnOrientLandscape.onclick = () => {
        btnOrientLandscape.classList.add('active');
        btnOrientPortrait.classList.remove('active');
      };
    }

    const btn = document.getElementById('btnDoPrintDiagram');
    if (btn) {
      btn.onclick = () => {
        UI.closeModal('modalPrintDiagram');
        const fontMode      = btnFixed?.classList.contains('active') ? 'fixed' : 'auto';
        const orientation   = btnOrientPortrait?.classList.contains('active') ? 'portrait' : 'landscape';
        const showGuests    = chk?.checked || false;
        const fontSize      = parseInt(document.getElementById('inputDiagramGuestFont')?.value) || 8;
        const cols          = parseInt(document.getElementById('selectDiagramCols')?.value)     || 4;
        const showLabel     = document.getElementById('chkDiagramShowLabel')?.checked     !== false;
        const showOccupancy = document.getElementById('chkDiagramShowOccupancy')?.checked !== false;
        const svgNumFont    = Math.max(6, Math.min(36, parseInt(document.getElementById('inputDiagramSvgNumFont')?.value) || 14));
        const svgLblFont    = Math.max(6, Math.min(24, parseInt(document.getElementById('inputDiagramSvgLblFont')?.value) || 9));
        const svgGstFont    = Math.max(6, Math.min(18, parseInt(document.getElementById('inputDiagramSvgGstFont')?.value) || 8));
        const svgOccFont    = Math.max(6, Math.min(18, parseInt(document.getElementById('inputDiagramSvgOccFont')?.value) || 7));
        // Standard-mode visibility toggles
        const stdShowLabel     = document.getElementById('chkDiagramStdLabel')?.checked     !== false;
        const stdShowOccupancy = document.getElementById('chkDiagramStdOccupancy')?.checked !== false;
        const stdShowGuests    = document.getElementById('chkDiagramStdGuests')?.checked    === true;
        // Guest-in-shape mode
        const guestInShape = chkGis?.checked || false;
        const _sc = v => /^#[0-9a-fA-F]{6}$/.test(v || '') ? v : null;
        const gisOpts = guestInShape ? {
          numFont:    Math.max(8,  Math.min(40, parseInt(document.getElementById('inputGisNumFont')?.value)  || 18)),
          numColor:   _sc(document.getElementById('inputGisNumColor')?.value)  || '#1a237e',
          occFont:    Math.max(6,  Math.min(30, parseInt(document.getElementById('inputGisOccFont')?.value)  || 11)),
          occColor:   _sc(document.getElementById('inputGisOccColor')?.value)  || '#888888',
          lblFont:    Math.max(6,  Math.min(30, parseInt(document.getElementById('inputGisLblFont')?.value)  || 12)),
          lblColor:   _sc(document.getElementById('inputGisLblColor')?.value)  || '#37474f',
          gstFont:    Math.max(6,  Math.min(30, parseInt(document.getElementById('inputGisGstFont')?.value)  || 10)),
          gstColor:   _sc(document.getElementById('inputGisGstColor')?.value)  || '#333333',
          showOcc:    document.getElementById('chkGisShowOcc')?.checked    !== false,
          showLabel:  document.getElementById('chkGisShowLabel')?.checked  !== false,
          showCounts: document.getElementById('chkGisShowCounts')?.checked === true,
        } : null;
        Print.printTablesDiagram({ showGuestList: showGuests, guestFontSize: fontSize, cols,
          showLabel, showOccupancy, fontMode, svgNumFont, svgLblFont, svgGstFont, svgOccFont,
          stdShowLabel, stdShowOccupancy, stdShowGuests, guestInShape, gisOpts, orientation });
      };
    }
    UI.openModal('modalPrintDiagram');
  }

  /* ── Bulk Edit Tables modal ── */
  function openBulkEdit() {
    const ids = Items.getSelectedIds().filter(id => State.getItem(id)?.type === 'table');
    if (!ids.length) { UI.toast('לא נבחרו שולחנות לעריכה', 'info', 1800); return; }

    document.getElementById('bulkEditCount').textContent = ids.length;

    // Pre-fill from first table
    const first = State.getItem(ids[0]);
    const seatsEl   = document.getElementById('bulkEditSeats');
    const fontEl    = document.getElementById('bulkEditFontSize');
    const lblFontEl = document.getElementById('bulkEditLabelFontSize');
    const gstFontEl = document.getElementById('bulkEditGuestFontSize');
    const occFontEl = document.getElementById('bulkEditOccuFontSize');
    const colorEl   = document.getElementById('bulkEditColor');
    if (seatsEl)   seatsEl.value   = first.seats ?? 10;
    if (fontEl)    fontEl.value    = first.fontSize      || '';
    if (lblFontEl) lblFontEl.value = first.fontLabelSize || '';
    if (gstFontEl) gstFontEl.value = first.fontGuestSize || '';
    if (occFontEl) occFontEl.value = first.fontOccupancySize || '';
    if (colorEl)   colorEl.value   = first.color || '#e3f2fd';

    // Shape selector
    let _bulkShape = first.shape || 'circle';
    const shapeBtns = document.querySelectorAll('#bulkShapeSelector .shape-btn');
    function syncBulkShapeBtns(s) {
      shapeBtns.forEach(b => b.classList.toggle('active', b.dataset.shape === s));
    }
    syncBulkShapeBtns(_bulkShape);
    shapeBtns.forEach(b => {
      b.onclick = () => {
        _bulkShape = b.dataset.shape;
        syncBulkShapeBtns(_bulkShape);
        const chkShape = document.getElementById('chkBulkShape');
        if (chkShape) chkShape.checked = true;
      };
    });

    // Reset all checkboxes to unchecked
    ['chkBulkSeats','chkBulkShape','chkBulkFont','chkBulkLabelFont','chkBulkGuestFont','chkBulkOccuFont','chkBulkColor','chkBulkResetColor'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.checked = false;
    });

    // Mutual exclusion: color set vs. reset
    const chkColor      = document.getElementById('chkBulkColor');
    const chkResetColor = document.getElementById('chkBulkResetColor');
    if (chkColor && chkResetColor) {
      chkColor.onchange      = () => { if (chkColor.checked)      chkResetColor.checked = false; };
      chkResetColor.onchange = () => { if (chkResetColor.checked) chkColor.checked      = false; };
    }

    const saveBtn = document.getElementById('btnSaveBulkEdit');
    if (saveBtn) {
      saveBtn.onclick = () => {
        const applySeats      = document.getElementById('chkBulkSeats')?.checked;
        const applyShape      = document.getElementById('chkBulkShape')?.checked;
        const applyFont       = document.getElementById('chkBulkFont')?.checked;
        const applyLabelFont  = document.getElementById('chkBulkLabelFont')?.checked;
        const applyGuestFont  = document.getElementById('chkBulkGuestFont')?.checked;
        const applyOccuFont   = document.getElementById('chkBulkOccuFont')?.checked;
        const applyColor      = document.getElementById('chkBulkColor')?.checked;
        const resetColor      = document.getElementById('chkBulkResetColor')?.checked;

        if (!applySeats && !applyShape && !applyFont && !applyLabelFont && !applyGuestFont && !applyOccuFont && !applyColor && !resetColor) {
          UI.toast('לא נבחר שום שדה לעדכון', 'info', 1800);
          return;
        }

        const seats   = applySeats ? Math.max(1, Math.min(50, parseInt(seatsEl?.value) || 10)) : null;
        const font    = applyFont      ? (parseInt(fontEl?.value)    || null) : undefined;
        const lblFont = applyLabelFont ? (parseInt(lblFontEl?.value) || null) : undefined;
        const gstFont = applyGuestFont ? (parseInt(gstFontEl?.value) || null) : undefined;
        const occFont = applyOccuFont  ? (parseInt(occFontEl?.value) || null) : undefined;

        Guests.startBatch();
        ids.forEach(id => {
          const patch = {};
          if (applySeats)      patch.seats             = seats;
          if (applyShape)      patch.shape             = _bulkShape;
          if (applyFont)       patch.fontSize          = (font === null || font < 1) ? null : font;
          if (applyLabelFont)  patch.fontLabelSize     = (lblFont === null || lblFont < 1) ? null : lblFont;
          if (applyGuestFont)  patch.fontGuestSize     = (gstFont === null || gstFont < 1) ? null : gstFont;
          if (applyOccuFont)   patch.fontOccupancySize = (occFont === null || occFont < 1) ? null : occFont;
          if (applyColor)      patch.color             = colorEl?.value || null;
          else if (resetColor) patch.color             = null;
          if (Object.keys(patch).length) State.updateItem(id, patch);
        });
        Guests.endBatch();

        UI.toast(`עודכנו ${ids.length} שולחנות ✓`, 'success', 1800);
        UI.closeModal('modalBulkEdit');
      };
    }

    UI.openModal('modalBulkEdit');
  }

  /* ── Layout Options ── */
  let _activeLayoutId = null;

  function renderLayoutDropdown() {
    const sel = document.getElementById('selectLayoutOption');
    if (!sel) return;
    const opts = State.getLayoutOptions();
    sel.innerHTML = `<option value="">── פריסה נוכחית ──</option>` +
      opts.map(o => `<option value="${UI.escHtml(o.id)}">${UI.escHtml(o.name)}</option>`).join('');
    sel.value = _activeLayoutId || '';
    const delBtn = document.getElementById('btnDeleteLayout');
    if (delBtn) delBtn.style.display = _activeLayoutId ? '' : 'none';
  }

  function openSaveLayout() {
    const opts   = State.getLayoutOptions();
    const active = opts.find(o => o.id === _activeLayoutId);
    document.getElementById('layoutOptionName').value = active?.name || '';
    UI.openModal('modalSaveLayout');
    setTimeout(() => document.getElementById('layoutOptionName')?.focus(), 120);
  }

  function confirmSaveLayout() {
    const name = document.getElementById('layoutOptionName')?.value.trim();
    if (!name) { UI.toast('נא להזין שם לפריסה', 'warning'); return; }
    const opts     = State.getLayoutOptions();
    const existing = opts.find(o => o.name === name);
    // Only reuse an existing option's ID when the user typed that option's exact name.
    // When the name doesn't match any option, always create a new one (pass null).
    // Passing _activeLayoutId here would silently rename the active layout instead of
    // creating a second layout, which is never the intended behavior.
    const targetId = existing ? existing.id : null;
    const savedId  = State.saveLayoutOption(name, targetId);
    _activeLayoutId = savedId;
    renderLayoutDropdown();
    UI.closeModal('modalSaveLayout');
    UI.toast(existing ? `הפריסה "${name}" עודכנה ✓` : `הפריסה "${name}" נשמרה ✓`, 'success', 1800);
  }


  /* ═══════════════════════════════════════════
     Normalize table sizes
  ═══════════════════════════════════════════ */

  const _shapeLabel     = { circle: 'עגול', rectangle: 'מלבן', square: 'ריבוע' };
  const _shapeLabelPlur = { circle: 'עגולים', rectangle: 'מלבנים', square: 'ריבועים' };

  function _normalizeSizePreview() {
    const refEl    = document.getElementById('normalizeSizeRef');
    const sameOnly = document.getElementById('normalizeSameShape')?.checked ?? true;
    const refId    = refEl?.value;
    const preview  = document.getElementById('normalizeSizePreview');
    if (!preview) return;
    if (!refId) { preview.textContent = ''; return; }

    const tables = State.get().items.filter(i => i.type === 'table');
    const ref    = tables.find(t => t.id === refId);
    if (!ref) { preview.textContent = ''; return; }

    const targets = sameOnly
      ? tables.filter(t => t.id !== refId && t.shape === ref.shape)
      : tables.filter(t => t.id !== refId);

    if (!targets.length) {
      preview.textContent = 'אין שולחנות נוספים להשוואה.';
    } else {
      const label = sameOnly ? (_shapeLabelPlur[ref.shape] || ref.shape) : 'שולחנות';
      preview.textContent = `${targets.length} ${label} יושוו לגודל ${ref.width}×${ref.height} פיקסלים.`;
    }
  }

  function openNormalizeSizes() {
    const tables = State.get().items.filter(i => i.type === 'table');
    if (tables.length < 2) {
      UI.toast('יש צורך בלפחות שני שולחנות בכדי להשוות גדלים', 'info');
      return;
    }

    const sel = document.getElementById('normalizeSizeRef');
    if (sel) {
      sel.innerHTML = [...tables]
        .sort((a, b) => (a.number ?? 0) - (b.number ?? 0) || a.id.localeCompare(b.id))
        .map(t => {
          const sl = _shapeLabel[t.shape] || t.shape;
          const lbl = t.label ? ` — ${UI.escHtml(t.label)}` : '';
          return `<option value="${t.id}">שולחן ${t.number ?? '?'} (${sl} ${t.width}×${t.height})${lbl}</option>`;
        })
        .join('');
    }

    // Reset checkbox to default on every open
    const chkEl   = document.getElementById('normalizeSameShape');
    if (chkEl) chkEl.checked = true;

    // Wire live-update listeners once (idempotent after first open)
    const refEl   = document.getElementById('normalizeSizeRef');
    const confirmBtn = document.getElementById('btnConfirmNormalizeSizes');
    if (refEl)    refEl.onchange = _normalizeSizePreview;
    if (chkEl)    chkEl.onchange = _normalizeSizePreview;
    if (confirmBtn) confirmBtn.onclick = _confirmNormalizeSizes;

    _normalizeSizePreview();
    UI.openModal('modalNormalizeSizes');
  }

  function _confirmNormalizeSizes() {
    const refEl    = document.getElementById('normalizeSizeRef');
    const sameOnly = document.getElementById('normalizeSameShape')?.checked ?? true;
    const refId    = refEl?.value;
    if (!refId) return;

    const tables  = State.get().items.filter(i => i.type === 'table');
    const ref     = tables.find(t => t.id === refId);
    if (!ref) { UI.toast('שולחן הייחוס לא נמצא — נסה לפתוח את החלון מחדש', 'warning'); UI.closeModal('modalNormalizeSizes'); return; }

    const targets = sameOnly
      ? tables.filter(t => t.id !== refId && t.shape === ref.shape)
      : tables.filter(t => t.id !== refId);

    if (!targets.length) {
      UI.toast('אין שולחנות נוספים להשוואה', 'info');
      UI.closeModal('modalNormalizeSizes');
      return;
    }

    Guests.startBatch();
    targets.forEach(t => State.updateItem(t.id, { width: ref.width, height: ref.height }));
    Guests.endBatch();

    UI.closeModal('modalNormalizeSizes');
    const typeLabel = sameOnly ? (_shapeLabelPlur[ref.shape] || 'שולחנות') : 'שולחנות';
    UI.toast(`${targets.length} ${typeLabel} הושוו לגודל שולחן ${ref.number ?? '?'} (${ref.width}×${ref.height}) ✓`, 'success', 2500);
  }


  /* ═══════════════════ GUEST DEPENDENCIES ═══════════════════ */

  let _depFocusGuest    = null;
  let _depActiveTab     = 'graph';
  let _depGraphAddMode  = false;
  let _depGraphFirstId  = null;
  let _newTypePositive  = true;   // persists between _renderDepTypesView calls
  let _pendingDepsFile  = null;
  let _depGraphLayout = 'circle';  // 'circle' | 'alpha' | 'category'
  let _depGraphSearch = '';
  let _depSearchTimer = null;

  function openGuestDependencies(focusGuestId) {
    if (focusGuestId) _depFocusGuest = focusGuestId;
    _depGraphAddMode = false;
    _depGraphFirstId = null;
    // Clean up any stale type-picker dialog from a previous session
    document.getElementById('_depTypePicker')?.remove();
    UI.openModal('modalGuestDependencies');
    _renderDepView('graph');
  }

  function _renderDepView(tab) {
    _depActiveTab = tab;
    const ALL_TABS = ['graph','add','table','types','suggest','inferrules'];
    ALL_TABS.forEach(t => {
      // Special case: 'inferrules' maps to 'depInferRulesView' (camelCase) and 'depTabInferRules'
      let viewId, btnId;
      if (t === 'inferrules') {
        viewId = 'depInferRulesView';
        btnId  = 'depTabInferRules';
      } else {
        viewId = 'dep' + t.charAt(0).toUpperCase() + t.slice(1) + 'View';
        btnId  = 'depTab' + t.charAt(0).toUpperCase() + t.slice(1);
      }
      const view = document.getElementById(viewId);
      const btn  = document.getElementById(btnId);
      if (view) view.style.display = (t === tab) ? '' : 'none';
      if (btn)  btn.classList.toggle('active', t === tab);
    });
    if (tab === 'graph')      _renderDepGraph();
    if (tab === 'add')        _renderDepAddView();
    if (tab === 'table')      _renderDepTable();
    if (tab === 'types')      _renderDepTypesView();
    if (tab === 'suggest')    _renderDepSuggest();
    if (tab === 'inferrules') _renderDepInferRules();
  }

  function _toggleDepGraphAddMode() {
    _depGraphAddMode = !_depGraphAddMode;
    _depGraphFirstId = null;
    const btn = document.getElementById('btnDepGraphAddMode');
    const status = document.getElementById('depGraphAddStatus');
    if (btn) btn.classList.toggle('btn-primary', _depGraphAddMode);
    if (status) {
      status.textContent = _depGraphAddMode ? 'לחץ על מוזמן ראשון בתרשים' : '';
      status.style.display = _depGraphAddMode ? 'inline' : 'none';
    }
    _renderDepGraph();
  }

  function _renderDepGraph() {
    const wrap = document.getElementById('depGraphCanvas');
    if (!wrap) return;
    const state = State.get();
    const deps  = state.guestDependencies || [];
    const allDepTypes = { ...CONFIG.DEPENDENCY_TYPES, ..._getCustomDepTypesMap() };
    const cats = CONFIG.DEPENDENCY_CATEGORIES || {};
    const allDT = allDepTypes;

    // Render controls bar (always re-render)
    const ctrlDiv = document.getElementById('depGraphControls');
    if (ctrlDiv) {
      ctrlDiv.innerHTML = `<div style="display:flex;gap:8px;align-items:center;padding:6px 10px;background:#f9f9f9;border-bottom:1px solid #e8edf0;flex-wrap:wrap">
        <span style="font-size:11px;color:#607d8b">תצוגה:</span>
        <button class="btn btn-sm dep-layout-btn ${_depGraphLayout === 'circle' ? 'btn-primary' : ''}" data-layout="circle">🔵 עיגול</button>
        <button class="btn btn-sm dep-layout-btn ${_depGraphLayout === 'alpha' ? 'btn-primary' : ''}" data-layout="alpha">🔤 אלפביתי</button>
        <button class="btn btn-sm dep-layout-btn ${_depGraphLayout === 'category' ? 'btn-primary' : ''}" data-layout="category">📊 לפי קטגוריה</button>
        <div style="flex:1"></div>
        <input type="text" id="depGraphSearch" class="input" placeholder="🔍 חיפוש מוזמן..." style="width:150px;font-size:12px;padding:3px 8px" value="${UI.escHtml(_depGraphSearch)}">
      </div>`;
      ctrlDiv.querySelectorAll('.dep-layout-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          _depGraphLayout = btn.dataset.layout;
          _renderDepGraph();
        });
      });
      const searchInput = ctrlDiv.querySelector('#depGraphSearch');
      if (searchInput) {
        searchInput.addEventListener('input', () => {
          clearTimeout(_depSearchTimer);
          _depSearchTimer = setTimeout(() => {
            _depGraphSearch = searchInput.value;
            _renderDepGraph();
          }, 200);
        });
      }
    }

    // Update graph-add-mode button state
    const addModeBtn = document.getElementById('btnDepGraphAddMode');
    if (addModeBtn) addModeBtn.classList.toggle('btn-primary', _depGraphAddMode);

    const guestMap = {};
    state.guests.forEach(g => { guestMap[g.id] = g; });

    // Collect all guest IDs: those in deps + all guests in add mode so every guest is clickable
    const depGuestIds = new Set(deps.flatMap(d => [d.guestA, d.guestB]).filter(id => guestMap[id]));
    const allGuestIds = state.guests.map(g => g.id);
    const guestIds = _depGraphAddMode
      ? allGuestIds
      : [...depGuestIds];

    if (!guestIds.length) {
      const msg = _depGraphAddMode
        ? 'אין מוזמנים ברשימה. הוסף מוזמנים תחילה.'
        : 'אין תלויות מוגדרות. עבור ללשונית "הוסף קשר" להוספה.';
      wrap.innerHTML = `<div style="text-align:center;padding:40px;color:#90a4ae;font-size:14px">${msg}</div>`;
      return;
    }

    const N = guestIds.length;
    const W = 700, H = _depGraphAddMode ? 480 : 420;

    // Sort by layout
    let orderedIds = [...guestIds];
    if (_depGraphLayout === 'alpha') {
      orderedIds.sort((a, b) => (guestMap[a]?.name || '').localeCompare(guestMap[b]?.name || '', 'he'));
    } else if (_depGraphLayout === 'category') {
      // Group by dominant category: look at all deps for each guest, find most common category
      const guestCat = {};
      orderedIds.forEach(id => {
        const myDeps = deps.filter(d => d.guestA === id || d.guestB === id);
        const catCount = {};
        myDeps.forEach(d => {
          const t = d.type || 'friends';
          const cat = allDT[t]?.category || 'other';
          catCount[cat] = (catCount[cat] || 0) + 1;
        });
        const best = Object.entries(catCount).sort((a, b) => b[1] - a[1])[0];
        guestCat[id] = best ? best[0] : 'other';
      });
      orderedIds.sort((a, b) => {
        const ca = guestCat[a] || 'other', cb = guestCat[b] || 'other';
        if (ca !== cb) return ca.localeCompare(cb);
        return (guestMap[a]?.name || '').localeCompare(guestMap[b]?.name || '', 'he');
      });
    }

    // Compute positions
    const positions = {};
    if (_depGraphLayout === 'category') {
      // Group ids by category
      const groups = {};
      orderedIds.forEach(id => {
        const myDeps = deps.filter(d => d.guestA === id || d.guestB === id);
        const catCount = {};
        myDeps.forEach(d => {
          const t = d.type || 'friends';
          const cat = allDT[t]?.category || 'other';
          catCount[cat] = (catCount[cat] || 0) + 1;
        });
        const best = Object.entries(catCount).sort((a, b) => b[1] - a[1])[0];
        const cat = best ? best[0] : 'other';
        if (!groups[cat]) groups[cat] = [];
        groups[cat].push(id);
      });
      const groupKeys = Object.keys(groups);
      const nGroups = groupKeys.length;
      groupKeys.forEach((catKey, gi) => {
        const groupAngle = (2 * Math.PI * gi) / nGroups;
        const clusterR = Math.min(W, H) * 0.28;
        const cx = W/2 + clusterR * Math.cos(groupAngle - Math.PI/2);
        const cy = H/2 + clusterR * Math.sin(groupAngle - Math.PI/2);
        const members = groups[catKey];
        members.forEach((id, mi) => {
          const localAngle = (2 * Math.PI * mi) / Math.max(members.length, 1);
          const localR = members.length > 1 ? Math.min(80, 25 * Math.sqrt(members.length)) : 0;
          positions[id] = {
            x: cx + localR * Math.cos(localAngle),
            y: cy + localR * Math.sin(localAngle)
          };
        });
      });
    } else {
      orderedIds.forEach((id, i) => {
        const angle = (2 * Math.PI * i) / orderedIds.length;
        const rx = W * (N > 20 ? 0.44 : 0.38);
        const ry = H * (N > 20 ? 0.44 : 0.38);
        positions[id] = {
          x: W/2 + rx * Math.cos(angle - Math.PI / 2),
          y: H/2 + ry * Math.sin(angle - Math.PI / 2)
        };
      });
    }

    // Search filtering
    const searchLower = _depGraphSearch.toLowerCase();
    const matchedIds = searchLower
      ? new Set(guestIds.filter(id => (guestMap[id]?.name || '').toLowerCase().includes(searchLower)))
      : null;

    let edges = deps.map(dep => {
      const def = allDepTypes[dep.type] || { color: '#90a4ae', label: dep.type || 'קשר', strength: 'preferred', icon: '🔗' };
      const pA = positions[dep.guestA];
      const pB = positions[dep.guestB];
      if (!pA || !pB) return '';
      const color = def.color || '#90a4ae';
      const dimmed = matchedIds && !matchedIds.has(dep.guestA) && !matchedIds.has(dep.guestB) ? 0.1 : 0.7;
      const dashArr = dep.strength === 'required' ? '' : dep.strength === 'forbidden' ? '6,3' : dep.strength === 'preferred' ? '4,2' : '2,3';
      return `<line x1="${pA.x.toFixed(1)}" y1="${pA.y.toFixed(1)}" x2="${pB.x.toFixed(1)}" y2="${pB.y.toFixed(1)}" stroke="${color}" stroke-width="2" ${dashArr ? `stroke-dasharray="${dashArr}"` : ''} opacity="${dimmed}"/>
        <text x="${((pA.x+pB.x)/2).toFixed(1)}" y="${((pA.y+pB.y)/2 - 4).toFixed(1)}" text-anchor="middle" font-size="10" fill="${color}" opacity="${dimmed}">${UI.escHtml(def.icon || '')} ${UI.escHtml(def.label || dep.type)}</text>`;
    }).join('');

    // Category cluster labels for category layout
    let clusterLabels = '';
    if (_depGraphLayout === 'category') {
      const groups = {};
      orderedIds.forEach(id => {
        const myDeps = deps.filter(d => d.guestA === id || d.guestB === id);
        const catCount = {};
        myDeps.forEach(d => {
          const t = d.type || 'friends';
          const cat = allDT[t]?.category || 'other';
          catCount[cat] = (catCount[cat] || 0) + 1;
        });
        const best = Object.entries(catCount).sort((a, b) => b[1] - a[1])[0];
        const cat = best ? best[0] : 'other';
        if (!groups[cat]) groups[cat] = [];
        groups[cat].push(id);
      });
      const groupKeys = Object.keys(groups);
      groupKeys.forEach((catKey, gi) => {
        const catDef = cats[catKey] || {};
        const groupAngle = (2 * Math.PI * gi) / groupKeys.length;
        const clusterR = Math.min(W, H) * 0.28;
        const cx = W/2 + clusterR * Math.cos(groupAngle - Math.PI/2);
        const cy = H/2 + clusterR * Math.sin(groupAngle - Math.PI/2);
        clusterLabels += `<text x="${cx.toFixed(1)}" y="${(cy - Math.min(80, 25 * Math.sqrt(groups[catKey].length)) - 8).toFixed(1)}" text-anchor="middle" font-size="11" fill="${_safeCssColor(catDef.color || '#607d8b')}" font-weight="600">${UI.escHtml(catDef.label || catKey)}</text>`;
      });
    }

    let nodes = guestIds.map(id => {
      const g = guestMap[id];
      const p = positions[id];
      if (!p) return '';
      const isFocus    = id === _depFocusGuest;
      const isSelected = id === _depGraphFirstId;
      const inDep      = depGuestIds.has(id);
      const isMatch    = !matchedIds || matchedIds.has(id);
      const r = (matchedIds && matchedIds.has(id)) ? (isFocus ? 20 : 16) : (isFocus ? 18 : (inDep ? 14 : 10));
      const fill = isSelected ? '#e53935'
                 : isFocus    ? '#1565c0'
                 : inDep      ? '#42A5F5'
                 : '#b0bec5';
      const strokeW = isSelected ? 3 : 2;
      const opacity = matchedIds && !isMatch ? 0.2 : 1;
      const nameSlice = (_depGraphAddMode && N > 15) ? 8 : 10;
      const name = (g.name || id).slice(0, nameSlice);
      const fontW = matchedIds && isMatch ? 'bold' : 'normal';
      return `<g class="dep-node${_depGraphAddMode ? ' dep-node-clickable' : ''}" data-guest-id="${id}" style="cursor:${_depGraphAddMode ? 'pointer' : 'default'};opacity:${opacity}">
        <circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${r}" fill="${fill}" stroke="#fff" stroke-width="${strokeW}"/>
        <text x="${p.x.toFixed(1)}" y="${(p.y + r + 12).toFixed(1)}" text-anchor="middle" font-size="${N > 20 ? 9 : 10}" fill="#333" font-weight="${fontW}">${UI.escHtml(name)}</text>
      </g>`;
    }).join('');

    // Legend
    const legendEl = document.getElementById('depGraphLegend');
    if (legendEl) {
      legendEl.innerHTML = Object.entries(allDepTypes).map(([k, v]) =>
        `<span class="dep-legend-item"><span class="dep-legend-color" style="background:${v.color}"></span>${UI.escHtml(v.icon || '')} ${UI.escHtml(v.label)}</span>`
      ).join('');
    }

    wrap.innerHTML = `<svg width="100%" viewBox="0 0 ${W} ${H}" style="max-height:${H}px">
      ${clusterLabels}${edges}${nodes}
    </svg>`;

    // Wire click handlers for add-mode node selection
    if (_depGraphAddMode) {
      wrap.querySelectorAll('.dep-node-clickable').forEach(node => {
        node.addEventListener('click', () => {
          const gid = node.dataset.guestId;
          if (!_depGraphFirstId) {
            _depGraphFirstId = gid;
            const status = document.getElementById('depGraphAddStatus');
            const gName = guestMap[gid]?.name || gid;
            if (status) status.textContent = 'נבחר: ' + gName + ' — כעת לחץ על מוזמן שני';
            _renderDepGraph();
          } else {
            if (gid === _depGraphFirstId) {
              _depGraphFirstId = null;
              const status = document.getElementById('depGraphAddStatus');
              if (status) status.textContent = 'לחץ על מוזמן ראשון בתרשים';
              _renderDepGraph();
              return;
            }
            // Show type-picker dialog
            _depGraphPickType(_depGraphFirstId, gid);
          }
        });
      });
    }
  }

  function _depGraphPickType(gidA, gidB) {
    const allDepTypes = { ...CONFIG.DEPENDENCY_TYPES, ..._getCustomDepTypesMap() };
    const guestMap = {};
    State.get().guests.forEach(g => { guestMap[g.id] = g; });
    const nameA = guestMap[gidA]?.name || gidA;
    const nameB = guestMap[gidB]?.name || gidB;

    // Build a simple inline dialog overlay
    const existing = document.getElementById('_depTypePicker');
    if (existing) existing.remove();

    const opts = Object.entries(allDepTypes).map(([k, v]) =>
      `<option value="${k}">${v.icon || ''} ${v.label}</option>`
    ).join('');

    const div = document.createElement('div');
    div.id = '_depTypePicker';
    div.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:10000;display:flex;align-items:center;justify-content:center';
    div.innerHTML = `<div style="background:#fff;border-radius:10px;padding:20px 24px;max-width:360px;width:92%;box-shadow:0 8px 32px rgba(0,0,0,.3)">
      <h3 style="margin:0 0 12px;font-size:15px">הוסף קשר: ${UI.escHtml(nameA)} ↔ ${UI.escHtml(nameB)}</h3>
      <label style="font-size:12px;color:#607d8b;display:block;margin-bottom:4px">סוג קשר</label>
      <select id="_depTypePickerSelect" class="input" style="width:100%;margin-bottom:14px">${opts}</select>
      <div style="display:flex;gap:8px;justify-content:flex-end">
        <button class="btn btn-ghost" id="_depTypePickerCancel">ביטול</button>
        <button class="btn btn-primary" id="_depTypePickerConfirm">הוסף</button>
      </div>
    </div>`;
    document.body.appendChild(div);

    // Auto-remove picker if the parent modal closes via any mechanism (ESC, backdrop, etc.)
    const _depModal = document.getElementById('modalGuestDependencies');
    let _pickObs = null;
    if (_depModal) {
      _pickObs = new MutationObserver(() => {
        if (!_depModal.classList.contains('active')) {
          div.remove(); _pickObs.disconnect();
          _depGraphFirstId = null;
        }
      });
      _pickObs.observe(_depModal, { attributes: true, attributeFilter: ['class'] });
    }

    const _closePicker = () => { if (_pickObs) _pickObs.disconnect(); div.remove(); };

    document.getElementById('_depTypePickerConfirm').onclick = () => {
      const type = document.getElementById('_depTypePickerSelect').value;
      const def  = allDepTypes[type] || {};
      State.addDependency({ guestA: gidA, guestB: gidB, type, strength: def.strength || 'preferred' });
      _closePicker();
      _depGraphAddMode = false;
      _depGraphFirstId = null;
      const btn = document.getElementById('btnDepGraphAddMode');
      const status = document.getElementById('depGraphAddStatus');
      if (btn) btn.classList.remove('btn-primary');
      if (status) { status.textContent = ''; status.style.display = 'none'; }
      _renderDepGraph();
      _renderDepTable();
      UI.toast('קשר נוסף ✓', 'success', 1500);
    };
    document.getElementById('_depTypePickerCancel').onclick = () => {
      _closePicker();
      _depGraphFirstId = null;
      const status = document.getElementById('depGraphAddStatus');
      if (status) status.textContent = 'לחץ על מוזמן ראשון בתרשים';
      _renderDepGraph();
    };
    div.addEventListener('click', e => { if (e.target === div) document.getElementById('_depTypePickerCancel').click(); });
  }

  function _renderDepTable() {
    const body = document.getElementById('depTableBody');
    if (!body) return;
    const state = State.get();
    const deps  = state.guestDependencies || [];
    const guestMap = {};
    state.guests.forEach(g => { guestMap[g.id] = g; });
    const allDepTypes = { ...CONFIG.DEPENDENCY_TYPES, ..._getCustomDepTypesMap() };

    if (!deps.length) {
      body.innerHTML = '<p style="color:#90a4ae;font-size:13px;padding:8px 0">אין תלויות מוגדרות עדיין. השתמש בלשונית "הוסף קשר".</p>';
      return;
    }

    const depTypeOpts = Object.entries(allDepTypes).map(([k, v]) =>
      `<option value="${k}">${v.icon || ''} ${v.label}</option>`
    ).join('');

    body.innerHTML = `<table style="width:100%;border-collapse:collapse;font-size:13px">
      <thead><tr style="background:#f5f5f5;font-weight:600">
        <th style="padding:6px 8px;text-align:right">מוזמן א</th>
        <th style="padding:6px 8px;text-align:right">מוזמן ב</th>
        <th style="padding:6px 8px;text-align:right">סוג קשר</th>
        <th style="padding:6px 8px"></th>
      </tr></thead>
      <tbody>
        ${deps.map(dep => {
          const gA = guestMap[dep.guestA];
          const gB = guestMap[dep.guestB];
          if (!gA || !gB) return '';
          const def = allDepTypes[dep.type] || { label: dep.type || 'קשר', color: '#90a4ae', icon: '🔗' };
          return `<tr style="border-bottom:1px solid #f0f0f0" data-dep-row="${dep.id}">
            <td style="padding:6px 8px">${UI.escHtml(gA.name)}</td>
            <td style="padding:6px 8px">${UI.escHtml(gB.name)}</td>
            <td style="padding:6px 8px">
              <span class="dep-type-display" data-dep-id="${dep.id}" style="color:${def.color};cursor:pointer" title="לחץ לעריכת סוג">${UI.escHtml(def.icon||'')} ${UI.escHtml(def.label)}</span>
              <select class="dep-type-edit input" data-dep-id="${dep.id}" style="display:none;width:120px;font-size:12px;padding:2px 4px">
                ${depTypeOpts}
              </select>
            </td>
            <td style="padding:6px 8px;text-align:center;white-space:nowrap">
              <button class="btn btn-sm" style="padding:2px 6px;color:#e53935;border:1px solid #e53935" data-remove-dep="${dep.id}" title="מחק קשר זה">✕</button>
            </td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>`;

    // Wire inline type editing
    body.querySelectorAll('.dep-type-display').forEach(span => {
      span.addEventListener('click', () => {
        const depId = span.dataset.depId;
        const sel = body.querySelector(`.dep-type-edit[data-dep-id="${depId}"]`);
        if (!sel) return;
        const dep = (State.get().guestDependencies || []).find(d => d.id === depId);
        if (dep) sel.value = dep.type;
        span.style.display = 'none';
        sel.style.display = '';
        sel.focus();
      });
    });
    body.querySelectorAll('.dep-type-edit').forEach(sel => {
      sel.addEventListener('change', () => {
        const depId = sel.dataset.depId;
        const type  = sel.value;
        const def   = allDepTypes[type] || {};
        State.updateDependency(depId, { type, strength: def.strength || 'preferred' });
        _renderDepTable();
        _renderDepGraph();
      });
      sel.addEventListener('blur', () => {
        const span = body.querySelector(`.dep-type-display[data-dep-id="${sel.dataset.depId}"]`);
        if (span) span.style.display = '';
        sel.style.display = 'none';
      });
    });

    body.querySelectorAll('[data-remove-dep]').forEach(btn => {
      btn.addEventListener('click', () => {
        if (UI.confirmDialog('למחוק קשר זה?')) {
          State.removeDependency(btn.dataset.removeDep);
          _renderDepTable();
          _renderDepGraph();
        }
      });
    });
  }

  /* ─────────────────── INFERENCE ENGINE ─────────────────── */

  // Only allow safe hex color values in inline styles (guards against CSS injection via imported JSON)
  function _safeCssColor(c) {
    return (typeof c === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(c)) ? c : '#90a4ae';
  }

  function _getActiveInferenceRules() {
    const stored = State.get().settings?.inferenceRules;
    if (Array.isArray(stored)) return stored;
    return Array.isArray(CONFIG.DEFAULT_INFERENCE_RULES) ? CONFIG.DEFAULT_INFERENCE_RULES : [];
  }

  function _inferReason(catAB, catBC, viaName, rule) {
    const catDef = CONFIG.DEPENDENCY_CATEGORIES || {};
    const labelAB = catDef[catAB]?.label || catAB;
    const labelBC = catDef[catBC]?.label || catBC;
    if (catAB === catBC) {
      if (catAB === 'family') return `שניהם קשורים משפחתית דרך ${viaName}`;
      if (catAB === 'friends') return `${viaName} הוא חבר/ה של שניהם`;
      if (catAB === 'colleagues') return `${viaName} הוא עמית/ה של שניהם`;
    }
    return `דרך ${viaName} (${labelAB} + ${labelBC})`;
  }

  // Build suggestions by transitivity: if A-B have rel typeAB and B-C have typeBC,
  // infer a candidate relationship A-C based on rule table.
  function _computeInferenceSuggestions(focusGuestId) {
    const state = State.get();
    const deps = state.guestDependencies || [];
    const guests = state.guests.filter(g => !g.splitOf);
    if (!deps.length || guests.length < 3) return [];

    const allDT = { ...CONFIG.DEPENDENCY_TYPES, ..._getCustomDepTypesMap() };
    const rules = _getActiveInferenceRules().filter(r => r.enabled !== false);
    if (!rules.length) return [];

    const guestMap = {};
    guests.forEach(g => { guestMap[g.id] = g; });

    // Build adjacency with category: guestId → [{id, type, category}]
    const adj = {};
    deps.forEach(dep => {
      const t = dep.type || 'friends';
      const cat = allDT[t]?.category || 'friends';
      if (!adj[dep.guestA]) adj[dep.guestA] = [];
      if (!adj[dep.guestB]) adj[dep.guestB] = [];
      adj[dep.guestA].push({ id: dep.guestB, type: t, category: cat });
      adj[dep.guestB].push({ id: dep.guestA, type: t, category: cat });
    });

    const existingPairs = new Set(deps.map(d => [d.guestA, d.guestB].sort().join('|')));

    const seen = new Set();
    const suggestions = [];
    const focusIds = focusGuestId ? [focusGuestId] : guests.map(g => g.id);

    focusIds.forEach(gA => {
      (adj[gA] || []).forEach(({ id: gB, type: typeAB, category: catAB }) => {
        (adj[gB] || []).forEach(({ id: gC, type: typeBC, category: catBC }) => {
          if (gC === gA || !guestMap[gC]) return;
          const pairKey = [gA, gC].sort().join('|');
          if (existingPairs.has(pairKey) || seen.has(pairKey)) return;

          // Find matching rule
          const rule = rules.find(r => r.fromCat === catAB && r.toCat === catBC)
                    || rules.find(r => r.fromCat === catBC && r.toCat === catAB);
          if (!rule) return;

          seen.add(pairKey);
          const viaName = guestMap[gB]?.name || '';
          suggestions.push({
            guestA: gA, guestB: gC, via: gB,
            catAB, catBC,
            suggestedType: rule.resultType,
            confidence: rule.weight,
            reason: _inferReason(catAB, catBC, viaName, rule)
          });
        });
      });
    });

    return suggestions.sort((a, b) => b.confidence - a.confidence);
  }

  // Render inference suggestions into a container element.
  // Called whenever Guest A changes in the Add tab.
  function _renderInferenceSuggestionsPanel(guestId, containerEl) {
    if (!containerEl) return;
    if (!guestId) {
      containerEl.innerHTML = '<p style="font-size:11px;color:#b0bec5;text-align:center;padding:10px 0">בחר מוזמן א׳<br>לראיית הצעות</p>';
      return;
    }

    const guestMap = {};
    State.get().guests.forEach(g => { guestMap[g.id] = g; });
    const gAName      = guestMap[guestId]?.name || '';
    const suggestions = _computeInferenceSuggestions(guestId).slice(0, 7);
    const allDT       = { ...CONFIG.DEPENDENCY_TYPES, ..._getCustomDepTypesMap() };

    if (!suggestions.length) {
      containerEl.innerHTML = `<p style="font-size:11px;color:#b0bec5;text-align:center;padding:10px 0">אין הצעות<br>עבור ${UI.escHtml(gAName)}</p>`;
      return;
    }

    containerEl.innerHTML = suggestions.map((s, i) => {
      const gBName  = guestMap[s.guestB]?.name || '';
      const typeInf = allDT[s.suggestedType] || {};
      return `<div class="inference-row" style="padding:7px 0;border-bottom:1px solid #f0f0f0">
        <div style="font-size:12px;font-weight:600;margin-bottom:2px">${UI.escHtml(gBName)}</div>
        <div style="font-size:11px;color:#607d8b;margin-bottom:4px">${UI.escHtml(s.reason)}</div>
        <div style="display:flex;align-items:center;gap:5px;flex-wrap:wrap">
          <span style="background:${_safeCssColor(typeInf.color)};color:#fff;font-size:10px;padding:1px 6px;border-radius:8px;white-space:nowrap">${UI.escHtml(typeInf.icon||'')} ${UI.escHtml(typeInf.label||'')}</span>
          <button class="btn btn-sm btn-primary" data-inf-add="${i}" style="padding:1px 7px;font-size:11px">הוסף ✓</button>
          <button class="btn btn-sm" data-inf-skip="${i}" style="padding:1px 5px;font-size:11px;color:#90a4ae">✕</button>
        </div>
      </div>`;
    }).join('');

    containerEl.querySelectorAll('[data-inf-add]').forEach(btn => {
      const i = parseInt(btn.dataset.infAdd);
      btn.addEventListener('click', () => {
        const s = suggestions[i];
        if (!s || btn.disabled) return;
        btn.disabled = true;
        const def = allDT[s.suggestedType] || {};
        State.addDependency({ guestA: s.guestA, guestB: s.guestB, type: s.suggestedType, strength: def.strength || 'preferred' });
        UI.toast('קשר נוסף ✓', 'success', 1400);
        _renderInferenceSuggestionsPanel(guestId, containerEl);
      });
    });
    containerEl.querySelectorAll('[data-inf-skip]').forEach(btn => {
      btn.addEventListener('click', () => btn.closest('.inference-row').remove());
    });
  }

  function _renderDepSuggest() {
    const body = document.getElementById('depSuggestBody');
    if (!body) return;
    const state = State.get();
    const guests = state.guests.filter(g => !g.splitOf);
    const existingPairs = new Set((state.guestDependencies || []).map(d => [d.guestA, d.guestB].sort().join('|')));
    const allDT = { ...CONFIG.DEPENDENCY_TYPES, ..._getCustomDepTypesMap() };
    const guestMap = {};
    guests.forEach(g => { guestMap[g.id] = g; });

    // --- Inference-based suggestions section ---
    const inferSuggestions = _computeInferenceSuggestions(null).slice(0, 10);
    let inferHtml = '';
    if (inferSuggestions.length) {
      inferHtml = `<div style="margin-bottom:16px">
        <div style="font-size:13px;font-weight:700;color:#33691e;margin-bottom:8px;padding-bottom:6px;border-bottom:2px solid #c5e1a5">🔗 הצעות מבוססות-היסק</div>
        ${inferSuggestions.map((s, idx) => {
          const gAName  = guestMap[s.guestA]?.name || '';
          const gBName  = guestMap[s.guestB]?.name || '';
          const typeInf = allDT[s.suggestedType] || {};
          return `<div class="dep-suggest-row dep-infer-row" data-infer-idx="${idx}" style="display:flex;align-items:center;gap:8px;padding:8px;border-bottom:1px solid #f0f0f0;background:#fafffe">
            <span style="flex:1;font-size:13px">
              <strong>${UI.escHtml(gAName)}</strong> + <strong>${UI.escHtml(gBName)}</strong>
              <span style="display:block;font-size:11px;color:#607d8b;margin-top:2px">${UI.escHtml(s.reason)}</span>
            </span>
            <span style="background:${_safeCssColor(typeInf.color)};color:#fff;font-size:10px;padding:1px 6px;border-radius:8px;white-space:nowrap;flex-shrink:0">${UI.escHtml(typeInf.icon||'')} ${UI.escHtml(typeInf.label||'')}</span>
            <button class="btn btn-sm btn-primary" style="padding:3px 8px;flex-shrink:0" data-infer-accept="${idx}">✓</button>
            <button class="btn btn-sm" style="padding:3px 6px;color:#90a4ae;flex-shrink:0" data-infer-reject="${idx}">✕</button>
          </div>`;
        }).join('')}
      </div>`;
    }

    // --- Tag-based suggestions section ---
    const suggestions = [];
    for (let i = 0; i < guests.length; i++) {
      for (let j = i + 1; j < guests.length; j++) {
        const gA = guests[i], gB = guests[j];
        const pairKey = [gA.id, gB.id].sort().join('|');
        if (existingPairs.has(pairKey)) continue;
        const tagsA = new Set(gA.tags || []);
        const common = (gB.tags || []).filter(t => tagsA.has(t));
        if (common.length >= 1) {
          suggestions.push({ gA, gB, common });
        }
      }
    }

    let tagHtml = '';
    if (suggestions.length) {
      tagHtml = `<div>
        <div style="font-size:13px;font-weight:700;color:#455a64;margin-bottom:8px;padding-bottom:6px;border-bottom:2px solid #e8edf0">🏷 הצעות לפי תגיות משותפות</div>
        ${suggestions.slice(0, 30).map((s, idx) =>
          `<div class="dep-suggest-row" data-idx="${idx}" style="display:flex;align-items:center;gap:10px;padding:8px;border-bottom:1px solid #f0f0f0">
            <span style="flex:1;font-size:13px"><strong>${UI.escHtml(s.gA.name)}</strong> + <strong>${UI.escHtml(s.gB.name)}</strong>
              <span style="font-size:11px;color:#90a4ae;margin-right:6px">תגיות משותפות: ${s.common.map(t => UI.escHtml(t)).join(', ')}</span>
            </span>
            <select class="input" style="width:130px;padding:3px 6px;font-size:12px" data-suggest-type="${idx}">
              ${Object.entries(allDT).map(([k, v]) =>
                `<option value="${k}" ${k === 'friends' ? 'selected' : ''}>${UI.escHtml(v.icon||'')} ${UI.escHtml(v.label)}</option>`
              ).join('')}
            </select>
            <button class="btn btn-sm btn-primary" style="padding:3px 10px" data-suggest-accept="${idx}">✓</button>
            <button class="btn btn-sm" style="padding:3px 8px;color:#90a4ae" data-suggest-reject="${idx}">✕</button>
          </div>`
        ).join('')}
      </div>`;
    }

    if (!inferHtml && !tagHtml) {
      body.innerHTML = '<p style="color:#90a4ae;font-size:13px">אין הצעות חדשות — כל הזוגות עם תגיות משותפות כבר מוגדרים, או שאין מוזמנים עם תגיות משותפות.</p>';
      return;
    }

    body.innerHTML = inferHtml + tagHtml;

    // Wire inference accept/reject buttons
    body.querySelectorAll('[data-infer-accept]').forEach(btn => {
      const idx = parseInt(btn.dataset.inferAccept);
      btn.addEventListener('click', () => {
        const s = inferSuggestions[idx];
        if (!s) return;
        const def = allDT[s.suggestedType] || {};
        State.addDependency({ guestA: s.guestA, guestB: s.guestB, type: s.suggestedType, strength: def.strength || 'preferred' });
        _renderDepSuggest();
        if (_depActiveTab === 'table') _renderDepTable();
        if (_depActiveTab === 'graph') _renderDepGraph();
        UI.toast(`קשר נוסף: ${guestMap[s.guestA]?.name || ''} ↔ ${guestMap[s.guestB]?.name || ''}`, 'success', 1600);
      });
    });
    body.querySelectorAll('[data-infer-reject]').forEach(btn => {
      btn.addEventListener('click', () => btn.closest('.dep-infer-row').remove());
    });

    // Wire tag-based accept/reject buttons
    body.querySelectorAll('[data-suggest-accept]').forEach(btn => {
      const idx = parseInt(btn.dataset.suggestAccept);
      btn.addEventListener('click', () => {
        const s = suggestions[idx];
        const typeEl = body.querySelector(`[data-suggest-type="${idx}"]`);
        const type = typeEl ? typeEl.value : 'friends';
        const def = (CONFIG.DEPENDENCY_TYPES[type] || _getCustomDepTypesMap()[type] || {});
        State.addDependency({ guestA: s.gA.id, guestB: s.gB.id, type, strength: def.strength || 'preferred' });
        _renderDepSuggest();
        if (_depActiveTab === 'table') _renderDepTable();
        if (_depActiveTab === 'graph') _renderDepGraph();
        UI.toast(`קשר נוסף: ${s.gA.name} ↔ ${s.gB.name}`, 'success', 1600);
      });
    });
    body.querySelectorAll('[data-suggest-reject]').forEach(btn => {
      btn.addEventListener('click', () => {
        btn.closest('.dep-suggest-row').style.display = 'none';
      });
    });
  }

  function _getCustomDepTypesMap() {
    const custom = State.get().settings?.autoAssign?.customDependencyTypes || [];
    const map = {};
    custom.forEach(c => { map[c.id] = c; });
    return map;
  }

  // Keep _renderDepAddForm as a no-op (it was wired to the old "btnAddDependency" which is gone)
  function _renderDepAddForm() {}

  function _renderDepAddView() {
    const wrap = document.getElementById('depAddViewBody');
    if (!wrap) return;
    const guests = State.get().guests.filter(g => !g.splitOf);
    const allDepTypes = { ...CONFIG.DEPENDENCY_TYPES, ..._getCustomDepTypesMap() };

    const typeOpts = Object.entries(allDepTypes).map(([k, v]) =>
      `<option value="${k}">${v.icon || ''} ${v.label}</option>`
    ).join('');

    const guestOpts = guests.map(g =>
      `<option value="${g.id}">${UI.escHtml(g.name)}</option>`
    ).join('');

    wrap.innerHTML = `
      <div style="display:flex;gap:16px;align-items:flex-start">
        <div style="flex:1;min-width:0">
          <p style="font-size:12px;color:#607d8b;margin-bottom:12px">בחר מוזמן א׳, לאחר מכן סמן מוזמנים ב׳ (אפשר מרובים) וקבע סוג קשר לכל אחד.</p>
          <!-- Guest A selector with search -->
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
            <div>
              <label class="form-label" style="font-size:12px">מוזמן א׳ (מקור)</label>
              <input type="text" id="depAddSearchA" class="input" placeholder="חפש מוזמן..." style="width:100%;margin-bottom:4px" autocomplete="off">
              <select id="depAddGuestA" class="input" style="width:100%;height:120px" size="6">
                ${guestOpts}
              </select>
            </div>
            <div>
              <label class="form-label" style="font-size:12px">סוג קשר ברירת מחדל</label>
              <select id="depAddTypeDefault" class="input" style="width:100%;margin-bottom:4px">${typeOpts}</select>
              <p style="font-size:11px;color:#90a4ae;margin:4px 0">ניתן לשנות סוג לכל מוזמן ב׳ בנפרד למטה.</p>
            </div>
          </div>
          <!-- Guest B multi-select with search -->
          <div style="margin-bottom:10px">
            <label class="form-label" style="font-size:12px">מוזמנים ב׳ (ניתן לבחור מרובים)</label>
            <input type="text" id="depAddSearchB" class="input" placeholder="חפש מוזמן..." style="width:100%;margin-bottom:4px" autocomplete="off">
            <div id="depAddGuestBList" class="dep-multi-list"></div>
          </div>
          <!-- Selected pairs preview -->
          <div id="depAddPairsPreview" style="margin-bottom:10px;display:none">
            <label class="form-label" style="font-size:12px">תצוגה מקדימה של הקשרים להוספה</label>
            <div id="depAddPairsBody" style="max-height:150px;overflow-y:auto;border:1px solid #e0e0e0;border-radius:6px;padding:6px"></div>
          </div>
          <div style="display:flex;gap:8px">
            <button class="btn btn-primary" id="btnConfirmAddDepBulk">הוסף קשרים</button>
            <button class="btn btn-ghost" id="btnClearDepAddForm">נקה</button>
          </div>
        </div>
        <aside id="depAddInferencePanel" style="width:220px;flex-shrink:0;background:#f9fbe7;border-radius:8px;padding:12px;border:1px solid #c5e1a5;max-height:460px;overflow-y:auto">
          <div style="font-size:12px;font-weight:700;color:#33691e;margin-bottom:8px;border-bottom:1px solid #c5e1a5;padding-bottom:6px">💡 הצעות חכמות</div>
          <div id="depAddInferencePanelBody"></div>
        </aside>
      </div>`;

    // Build multi-select guest B list
    function _rebuildGuestBList(filter) {
      const listEl = document.getElementById('depAddGuestBList');
      if (!listEl) return;
      const selA = document.getElementById('depAddGuestA')?.value;
      const typeOpts2 = Object.entries(allDepTypes).map(([k, v]) =>
        `<option value="${k}">${v.icon || ''} ${v.label}</option>`
      ).join('');
      const lf       = filter.toLowerCase();
      const filtered = lf
        ? guests.filter(g => g.id !== selA && g.name.toLowerCase().includes(lf))
        : guests.filter(g => g.id !== selA);
      if (!filtered.length) { listEl.innerHTML = '<p style="color:#90a4ae;font-size:12px;padding:4px">אין תוצאות</p>'; return; }
      listEl.innerHTML = filtered.map(g =>
        `<label class="dep-multi-row" style="display:flex;align-items:center;gap:8px;padding:5px 6px;border-bottom:1px solid #f0f0f0;cursor:pointer">
          <input type="checkbox" class="dep-b-check" value="${g.id}" style="flex-shrink:0">
          <span style="flex:1;font-size:13px">${UI.escHtml(g.name)}</span>
          <select class="dep-b-type input" data-guest-id="${g.id}" style="width:110px;font-size:11px;padding:2px 4px">${typeOpts2}</select>
        </label>`
      ).join('');
      // Set default type on each row
      listEl.querySelectorAll('.dep-b-type').forEach(sel => {
        const defType = document.getElementById('depAddTypeDefault')?.value || 'friends';
        sel.value = defType;
      });
    }
    _rebuildGuestBList('');
    _renderInferenceSuggestionsPanel(null, document.getElementById('depAddInferencePanelBody'));

    // Sync default type to all rows
    document.getElementById('depAddTypeDefault')?.addEventListener('change', () => {
      const defType = document.getElementById('depAddTypeDefault')?.value || 'friends';
      wrap.querySelectorAll('.dep-b-type').forEach(sel => { sel.value = defType; });
    });

    // Search A
    document.getElementById('depAddSearchA')?.addEventListener('input', e => {
      const q = e.target.value.trim().toLowerCase();
      const selA = document.getElementById('depAddGuestA');
      if (!selA) return;
      Array.from(selA.options).forEach(opt => {
        opt.style.display = !q || opt.text.toLowerCase().includes(q) ? '' : 'none';
      });
    });

    // Search B
    document.getElementById('depAddSearchB')?.addEventListener('input', e => {
      _rebuildGuestBList(e.target.value.trim());
    });

    // When guest A changes, rebuild B list to exclude A and refresh inference panel
    document.getElementById('depAddGuestA')?.addEventListener('change', () => {
      _rebuildGuestBList(document.getElementById('depAddSearchB')?.value.trim() || '');
      _renderInferenceSuggestionsPanel(
        document.getElementById('depAddGuestA')?.value || null,
        document.getElementById('depAddInferencePanelBody')
      );
    });

    // Confirm bulk add
    document.getElementById('btnConfirmAddDepBulk')?.addEventListener('click', () => {
      const gA = document.getElementById('depAddGuestA')?.value;
      if (!gA) { UI.toast('נא לבחור מוזמן א׳', 'warning'); return; }
      const checked = [...wrap.querySelectorAll('.dep-b-check:checked')];
      if (!checked.length) { UI.toast('נא לסמן לפחות מוזמן ב׳ אחד', 'warning'); return; }
      let added = 0;
      const existingPairs = new Set(
        (State.get().guestDependencies || []).map(d => [d.guestA, d.guestB].sort().join('|'))
      );
      checked.forEach(chk => {
        const gB   = chk.value;
        const type = wrap.querySelector(`.dep-b-type[data-guest-id="${gB}"]`)?.value || 'friends';
        const def  = allDepTypes[type] || {};
        const key  = [gA, gB].sort().join('|');
        if (gA === gB || existingPairs.has(key)) return;
        State.addDependency({ guestA: gA, guestB: gB, type, strength: def.strength || 'preferred' });
        existingPairs.add(key);
        added++;
      });
      if (added) {
        UI.toast(added + ' קשרים נוספו ✓', 'success', 1800);
        _renderDepTable();
        _renderDepGraph();
        _renderInferenceSuggestionsPanel(
          document.getElementById('depAddGuestA')?.value || null,
          document.getElementById('depAddInferencePanelBody')
        );
        // Uncheck all
        wrap.querySelectorAll('.dep-b-check:checked').forEach(c => { c.checked = false; });
      } else {
        UI.toast('לא נוספו קשרים חדשים (כבר קיימים?)', 'info', 2000);
      }
    });

    // Clear form
    document.getElementById('btnClearDepAddForm')?.addEventListener('click', () => {
      const selA = document.getElementById('depAddGuestA');
      if (selA) selA.selectedIndex = 0;
      wrap.querySelectorAll('.dep-b-check:checked').forEach(c => { c.checked = false; });
      const sA = document.getElementById('depAddSearchA');
      const sB = document.getElementById('depAddSearchB');
      if (sA) sA.value = '';
      if (sB) sB.value = '';
      _rebuildGuestBList('');
      _renderInferenceSuggestionsPanel(null, document.getElementById('depAddInferencePanelBody'));
    });
  }

  // Derive display direction/level from a custom dep type (supports both old and new format)
  function _cdtDirection(t) {
    if (t.isPositive != null) return !!t.isPositive;
    return t.strength === 'required' || t.strength === 'preferred';
  }
  function _cdtLevel(t) {
    if (t.significanceLevel != null) return Math.min(5, Math.max(1, t.significanceLevel | 0));
    if (t.strength === 'required' || t.strength === 'forbidden') return 5;
    return 3;
  }
  // Derive legacy strength from isPositive + level (for backward compat with depScore fallback)
  function _cdtStrength(isPositive, level) {
    if (isPositive) return level >= 5 ? 'required' : 'preferred';
    return level >= 5 ? 'forbidden' : 'avoid';
  }

  function _renderDepTypesView() {
    const body = document.getElementById('depTypesBody');
    if (!body) return;
    const custom = State.get().settings?.autoAssign?.customDependencyTypes || [];

    const LEVEL_LABELS = ['', '★ מינימלי', '★★ נמוך', '★★★ בינוני', '★★★★ גבוה', '★★★★★ קריטי'];

    let listHtml = '';
    if (!custom.length) {
      listHtml = '<p style="color:#90a4ae;font-size:13px;margin-bottom:10px">לא הוגדרו סוגי קשרים מותאמים עדיין.</p>';
    } else {
      listHtml = `<table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:10px">
        <thead><tr style="background:#f5f5f5">
          <th style="padding:5px 8px;text-align:right">שם</th>
          <th style="padding:5px 8px;text-align:center">אייקון</th>
          <th style="padding:5px 8px;text-align:center">כיוון</th>
          <th style="padding:5px 8px;text-align:center">משמעות</th>
          <th style="padding:5px 8px;text-align:center">צבע</th>
          <th></th>
        </tr></thead>
        <tbody>${custom.map((t, i) => {
          const dir   = _cdtDirection(t);
          const level = _cdtLevel(t);
          return `<tr style="border-bottom:1px solid #f0f0f0">
            <td style="padding:5px 8px">${UI.escHtml(t.label)}</td>
            <td style="padding:5px 8px;text-align:center">${UI.escHtml(t.icon||'')}</td>
            <td style="padding:5px 8px;text-align:center">${dir ? '✅ ביחד' : '❌ בנפרד'}</td>
            <td style="padding:5px 8px;text-align:center" title="${LEVEL_LABELS[level]}">${'★'.repeat(level)}${'☆'.repeat(5-level)}</td>
            <td style="padding:5px 8px;text-align:center"><span style="display:inline-block;width:20px;height:20px;background:${t.color};border-radius:3px;border:1px solid #ddd"></span></td>
            <td style="padding:5px 8px;text-align:center"><button class="btn btn-sm" style="color:#e53935;border:1px solid #e53935;padding:1px 7px" data-del-cdt="${i}">✕</button></td>
          </tr>`;
        }).join('')}</tbody>
      </table>`;
    }

    // Built-in types grouped by category
    const cats = CONFIG.DEPENDENCY_CATEGORIES || {};
    const builtIn = CONFIG.DEPENDENCY_TYPES || {};
    const grouped = {};
    Object.entries(builtIn).forEach(([k, v]) => {
      const cat = v.category || 'other';
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push({ key: k, ...v });
    });
    const builtInHtml = Object.entries(grouped).map(([catKey, types]) => {
      const catDef = cats[catKey] || {};
      const catColor = _safeCssColor(catDef.color || '#90a4ae');
      return `<div style="margin-bottom:8px">
        <div style="font-size:11px;font-weight:600;color:#607d8b;margin-bottom:4px;padding:2px 6px;background:#f5f5f5;border-radius:4px">
          <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${catColor};margin-inline-end:4px"></span>${UI.escHtml(catDef.label || catKey)}
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:4px;padding-inline-start:14px">
          ${types.map(t => `<span style="display:inline-flex;align-items:center;gap:3px;padding:2px 8px;border-radius:10px;background:${_safeCssColor(t.color || '#90a4ae')}22;border:1px solid ${_safeCssColor(t.color || '#90a4ae')}66;font-size:12px">${UI.escHtml(t.icon || '')} ${UI.escHtml(t.label || t.key)}</span>`).join('')}
        </div>
      </div>`;
    }).join('');
    const catSelectOpts = Object.entries(cats).map(([k, v]) =>
      `<option value="${k}">${UI.escHtml(v.label || k)}</option>`
    ).join('');

    body.innerHTML = `
      <div style="margin-bottom:14px">
        <p style="font-size:13px;font-weight:600;margin:0 0 8px">סוגי קשרים מובנים</p>
        ${builtInHtml || '<p style="color:#90a4ae;font-size:12px">לא הוגדרו קטגוריות.</p>'}
      </div>
      <hr style="border:none;border-top:1px solid #e0e0e0;margin:12px 0">
    ` + listHtml + `
      <div style="background:#f9f9f9;border:1px solid #e0e0e0;border-radius:8px;padding:12px">
        <p style="font-size:13px;font-weight:600;margin:0 0 10px">הוסף סוג קשר חדש</p>

        <!-- Row 1: name + icon + color -->
        <div style="display:grid;grid-template-columns:1fr 60px 70px;gap:8px;margin-bottom:10px">
          <div>
            <label class="form-label" style="font-size:11px">שם הקשר</label>
            <input type="text" id="depNewTypeName" class="input" placeholder="למשל: שכנים" style="width:100%">
          </div>
          <div>
            <label class="form-label" style="font-size:11px">אייקון</label>
            <input type="text" id="depNewTypeIcon" class="input" placeholder="🏠" style="width:100%;text-align:center" maxlength="4">
          </div>
          <div>
            <label class="form-label" style="font-size:11px">צבע</label>
            <input type="color" id="depNewTypeColor" class="input" value="#42A5F5" style="width:100%;height:34px;padding:2px 3px">
          </div>
        </div>

        <!-- Row 1b: category -->
        ${catSelectOpts ? `<div style="margin-bottom:10px">
          <label class="form-label" style="font-size:11px">קטגוריה</label>
          <select id="depNewTypeCategory" class="input" style="width:200px">
            <option value="">— ללא קטגוריה —</option>
            ${catSelectOpts}
          </select>
        </div>` : ''}

        <!-- Row 2: direction + significance -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:10px">
          <div>
            <label class="form-label" style="font-size:11px">כיוון הקשר</label>
            <div style="display:flex;gap:6px">
              <button class="btn dep-dir-btn ${_newTypePositive ? 'btn-primary' : 'btn-ghost'}" data-positive="true" style="flex:1;font-size:12px">✅ ביחד</button>
              <button class="btn dep-dir-btn ${_newTypePositive ? 'btn-ghost' : 'btn-primary'}" data-positive="false" style="flex:1;font-size:12px">❌ בנפרד</button>
            </div>
            <p style="font-size:10px;color:#90a4ae;margin:4px 0 0">האם לנסות לשבץ את שני המוזמנים לאותו שולחן</p>
          </div>
          <div>
            <label class="form-label" style="font-size:11px">רמת משמעות</label>
            <select id="depNewTypeLevel" class="input" style="width:100%">
              <option value="1">★☆☆☆☆ — מינימלי</option>
              <option value="2">★★☆☆☆ — נמוך</option>
              <option value="3" selected>★★★☆☆ — בינוני</option>
              <option value="4">★★★★☆ — גבוה</option>
              <option value="5">★★★★★ — קריטי (כלל חובה)</option>
            </select>
            <p style="font-size:10px;color:#90a4ae;margin:4px 0 0">רמה 5 = כלל דווקאי (חובה / אסור בהחלט)</p>
          </div>
        </div>

        <button class="btn btn-primary btn-sm" id="btnConfirmAddDepType">+ הוסף סוג קשר</button>
      </div>`;

    // Wire direction toggle buttons (state lives in module-level _newTypePositive)
    body.querySelectorAll('.dep-dir-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        _newTypePositive = btn.dataset.positive === 'true';
        body.querySelectorAll('.dep-dir-btn').forEach(b => {
          b.className = 'btn dep-dir-btn ' + (b.dataset.positive === String(_newTypePositive) ? 'btn-primary' : 'btn-ghost');
        });
      });
    });

    body.querySelectorAll('[data-del-cdt]').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.delCdt);
        const s   = State.get().settings;
        const arr = [...(s.autoAssign.customDependencyTypes || [])];
        arr.splice(idx, 1);
        State.setSetting('autoAssign', { ...s.autoAssign, customDependencyTypes: arr });
        _renderDepTypesView();
        UI.toast('סוג הקשר נמחק', 'info', 1500);
      });
    });

    document.getElementById('btnConfirmAddDepType')?.addEventListener('click', () => {
      const label = document.getElementById('depNewTypeName')?.value.trim();
      if (!label) { UI.toast('נא להזין שם', 'warning'); return; }
      const icon              = document.getElementById('depNewTypeIcon')?.value.trim() || '🔗';
      const color             = document.getElementById('depNewTypeColor')?.value || '#42A5F5';
      const category          = document.getElementById('depNewTypeCategory')?.value || '';
      const significanceLevel = parseInt(document.getElementById('depNewTypeLevel')?.value || '3');
      const isPositive        = _newTypePositive;
      const strength          = _cdtStrength(isPositive, significanceLevel);
      const s = State.get().settings;
      if (!s.autoAssign) s.autoAssign = {};
      if (!s.autoAssign.customDependencyTypes) s.autoAssign.customDependencyTypes = [];
      const newArr = [...s.autoAssign.customDependencyTypes,
        { id: 'cdt_' + Date.now(), label, icon, color, category, isPositive, significanceLevel, strength }];
      State.setSetting('autoAssign', { ...s.autoAssign, customDependencyTypes: newArr });
      _renderDepTypesView();
      UI.toast('סוג קשר נוסף ✓', 'success', 1500);
    });
  }

  function _renderDepInferRules() {
    const bodyEl = document.getElementById('depInferRulesBody');
    if (!bodyEl) return;

    const cats = CONFIG.DEPENDENCY_CATEGORIES || {};
    const allDT = { ...CONFIG.DEPENDENCY_TYPES, ..._getCustomDepTypesMap() };
    const activeRules = _getActiveInferenceRules();
    const isCustom = Array.isArray(State.get().settings?.inferenceRules);

    const catOpts = Object.entries(cats).map(([k, v]) =>
      `<option value="${k}">${UI.escHtml(v.icon || '')} ${UI.escHtml(v.label || k)}</option>`
    ).join('');
    const typeOpts = Object.entries(allDT).map(([k, v]) =>
      `<option value="${k}">${UI.escHtml(v.icon || '')} ${UI.escHtml(v.label || k)}</option>`
    ).join('');

    const rulesHtml = activeRules.map((rule, i) => {
      const fromCatDef  = cats[rule.fromCat] || {};
      const toCatDef    = cats[rule.toCat]   || {};
      const resultDef   = allDT[rule.resultType] || {};
      const resultColor = _safeCssColor(resultDef.color || '#90a4ae');
      return `<tr class="ir-row" data-rule-idx="${i}" style="border-bottom:1px solid #f0f0f0;${rule.enabled === false ? 'opacity:0.5' : ''}">
        <td style="padding:6px 8px;text-align:center">
          <input type="checkbox" class="ir-enabled" data-idx="${i}" ${rule.enabled !== false ? 'checked' : ''} title="הפעל/כבה כלל זה">
        </td>
        <td style="padding:6px 8px">
          <span style="display:inline-flex;align-items:center;gap:3px;padding:2px 8px;border-radius:10px;background:${_safeCssColor(fromCatDef.color || '#90a4ae')}22;border:1px solid ${_safeCssColor(fromCatDef.color || '#90a4ae')}66;font-size:12px">${UI.escHtml(fromCatDef.icon || '')} ${UI.escHtml(fromCatDef.label || rule.fromCat)}</span>
        </td>
        <td style="padding:6px 8px;text-align:center;color:#90a4ae">+</td>
        <td style="padding:6px 8px">
          <span style="display:inline-flex;align-items:center;gap:3px;padding:2px 8px;border-radius:10px;background:${_safeCssColor(toCatDef.color || '#90a4ae')}22;border:1px solid ${_safeCssColor(toCatDef.color || '#90a4ae')}66;font-size:12px">${UI.escHtml(toCatDef.icon || '')} ${UI.escHtml(toCatDef.label || rule.toCat)}</span>
        </td>
        <td style="padding:6px 8px;text-align:center;color:#37474f">→</td>
        <td style="padding:6px 8px">
          <span style="background:${resultColor};color:#fff;font-size:11px;padding:2px 8px;border-radius:8px;white-space:nowrap">${UI.escHtml(resultDef.icon || '')} ${UI.escHtml(resultDef.label || rule.resultType)}</span>
        </td>
        <td style="padding:6px 8px;text-align:center">
          <span style="font-size:12px;color:#607d8b" title="משקל הצעה (0-1)">${typeof rule.weight === 'number' ? rule.weight.toFixed(1) : '—'}</span>
        </td>
        <td style="padding:6px 4px;text-align:center;white-space:nowrap">
          <button class="btn btn-sm ir-del" data-idx="${i}" style="padding:1px 6px;color:#e53935;border:1px solid #e53935" title="מחק כלל">✕</button>
        </td>
      </tr>`;
    }).join('');

    bodyEl.innerHTML = `
      <div style="margin-bottom:12px">
        <p style="font-size:13px;font-weight:700;margin:0 0 4px">⚙️ כללי היסק — הסקה אוטומטית של קשרים</p>
        <p style="font-size:12px;color:#607d8b;margin:0 0 10px">כאשר מוזמן A קשור ל-B, ו-B קשור ל-C, המערכת מציעה קשר בין A ל-C בהתאם לכללים הבאים.</p>
        ${!isCustom ? `<div style="display:flex;justify-content:flex-end;margin-bottom:8px">
          <button class="btn btn-sm btn-ghost" id="btnIrResetDefault" style="font-size:11px">↺ שחזר כללי ברירת מחדל</button>
        </div>` : `<div style="display:flex;justify-content:flex-end;margin-bottom:8px">
          <button class="btn btn-sm btn-ghost" id="btnIrResetDefault" style="font-size:11px">↺ שחזר כללי ברירת מחדל</button>
        </div>`}
      </div>
      <div style="overflow-x:auto;margin-bottom:16px">
        <table style="width:100%;border-collapse:collapse;font-size:13px">
          <thead><tr style="background:#f5f5f5;font-weight:600">
            <th style="padding:6px 8px;text-align:center" title="הפעל/כבה">✓</th>
            <th style="padding:6px 8px;text-align:right">קטגוריה א</th>
            <th></th>
            <th style="padding:6px 8px;text-align:right">קטגוריה ב</th>
            <th></th>
            <th style="padding:6px 8px;text-align:right">סוג קשר מוצע</th>
            <th style="padding:6px 8px;text-align:center" title="משקל (0=חלש, 1=חזק)">משקל</th>
            <th></th>
          </tr></thead>
          <tbody id="irRulesBody">
            ${rulesHtml || '<tr><td colspan="8" style="padding:10px;color:#90a4ae;text-align:center">אין כללים מוגדרים</td></tr>'}
          </tbody>
        </table>
      </div>
      <div style="background:#f9f9f9;border:1px solid #e0e0e0;border-radius:8px;padding:12px">
        <p style="font-size:13px;font-weight:600;margin:0 0 10px">+ הוסף כלל היסק חדש</p>
        <div style="display:grid;grid-template-columns:1fr auto 1fr auto 1fr auto 80px;gap:8px;align-items:end;margin-bottom:10px">
          <div>
            <label class="form-label" style="font-size:11px">קטגוריה א</label>
            <select id="irFromCat" class="input" style="width:100%">
              <option value="">— בחר —</option>${catOpts}
            </select>
          </div>
          <span style="padding-bottom:8px;color:#90a4ae;font-size:16px">+</span>
          <div>
            <label class="form-label" style="font-size:11px">קטגוריה ב</label>
            <select id="irToCat" class="input" style="width:100%">
              <option value="">— בחר —</option>${catOpts}
            </select>
          </div>
          <span style="padding-bottom:8px;color:#37474f;font-size:16px">→</span>
          <div>
            <label class="form-label" style="font-size:11px">סוג קשר מוצע</label>
            <select id="irResultType" class="input" style="width:100%">
              ${typeOpts}
            </select>
          </div>
          <div>
            <label class="form-label" style="font-size:11px">משקל</label>
            <input type="number" id="irWeight" class="input" value="0.5" min="0.1" max="1" step="0.1" style="width:70px">
          </div>
          <div>
            <button class="btn btn-primary btn-sm" id="btnIrAdd" style="width:100%">+ הוסף</button>
          </div>
        </div>
      </div>`;

    // Wire reset to defaults
    bodyEl.querySelector('#btnIrResetDefault')?.addEventListener('click', () => {
      if (!UI.confirmDialog('לאפס את כל הכללים לברירת המחדל?')) return;
      State.saveInferenceRules(null);
      _renderDepInferRules();
      UI.toast('הכללים אופסו לברירת מחדל', 'info', 1800);
    });

    // Wire enable/disable toggles
    bodyEl.querySelectorAll('.ir-enabled').forEach(chk => {
      chk.addEventListener('change', () => {
        const idx = parseInt(chk.dataset.idx);
        const rules = _getActiveInferenceRules().map((r, i) =>
          i === idx ? { ...r, enabled: chk.checked } : { ...r }
        );
        State.saveInferenceRules(rules);
        _renderDepInferRules();
      });
    });

    // Wire delete buttons
    bodyEl.querySelectorAll('.ir-del').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.idx);
        const rules = _getActiveInferenceRules().filter((_, i) => i !== idx);
        State.saveInferenceRules(rules);
        _renderDepInferRules();
        UI.toast('הכלל נמחק', 'info', 1500);
      });
    });

    // Wire add rule
    bodyEl.querySelector('#btnIrAdd')?.addEventListener('click', () => {
      const fromCat    = bodyEl.querySelector('#irFromCat')?.value;
      const toCat      = bodyEl.querySelector('#irToCat')?.value;
      const resultType = bodyEl.querySelector('#irResultType')?.value;
      const weight     = parseFloat(bodyEl.querySelector('#irWeight')?.value || '0.5');
      if (!fromCat || !toCat || !resultType) {
        UI.toast('נא לבחור קטגוריות וסוג קשר', 'warning'); return;
      }
      const rules = [..._getActiveInferenceRules(), {
        id: 'ir_' + Date.now(), fromCat, toCat, resultType,
        weight: Math.max(0.1, Math.min(1, weight)), enabled: true
      }];
      State.saveInferenceRules(rules);
      _renderDepInferRules();
      UI.toast('כלל נוסף ✓', 'success', 1500);
    });
  }

  function _printDependencies() {
    const state = State.get();
    const deps  = state.guestDependencies || [];
    const guestMap = {};
    state.guests.forEach(g => { guestMap[g.id] = g; });
    const allDepTypes = { ...CONFIG.DEPENDENCY_TYPES, ..._getCustomDepTypesMap() };

    // Build a simple print page with the dep graph SVG + table
    const graphEl = document.getElementById('depGraphCanvas');
    const svgHtml = graphEl ? graphEl.innerHTML : '';
    const eventName = state.event?.name || 'אירוע';

    const rows = deps.map(dep => {
      const gA = guestMap[dep.guestA];
      const gB = guestMap[dep.guestB];
      if (!gA || !gB) return '';
      const def = allDepTypes[dep.type] || { label: dep.type || 'קשר', color: '#90a4ae', icon: '🔗' };
      return `<tr>
        <td style="padding:5px 8px;border-bottom:1px solid #e0e0e0">${UI.escHtml(gA.name)}</td>
        <td style="padding:5px 8px;border-bottom:1px solid #e0e0e0">${UI.escHtml(gB.name)}</td>
        <td style="padding:5px 8px;border-bottom:1px solid #e0e0e0;color:${def.color}">${UI.escHtml(def.icon||'')} ${UI.escHtml(def.label)}</td>
      </tr>`;
    }).join('');

    const printArea = document.getElementById('printListArea') || document.body;
    const prev = printArea.innerHTML;
    printArea.innerHTML = `
      <div style="padding:16px;font-family:Arial,sans-serif;direction:rtl">
        <h2 style="margin:0 0 8px;font-size:18px">${UI.escHtml(eventName)} — תרשים תלויות</h2>
        <div style="margin-bottom:16px">${svgHtml}</div>
        <table style="width:100%;border-collapse:collapse;font-size:13px">
          <thead><tr style="background:#f5f5f5;font-weight:600">
            <th style="padding:6px 8px;text-align:right">מוזמן א</th>
            <th style="padding:6px 8px;text-align:right">מוזמן ב</th>
            <th style="padding:6px 8px;text-align:right">סוג קשר</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
    document.body.dataset.printMode = 'list';
    window.print();
    setTimeout(() => {
      printArea.innerHTML = prev;
      delete document.body.dataset.printMode;
    }, 500);
  }

  /* ═══════════════════ AUTO-ASSIGN SETTINGS ═══════════════════ */

  function openAutoAssignSettings() {
    const s = State.get().settings.autoAssign || {};

    const setChk = (id, val) => { const el = document.getElementById(id); if (el) el.checked = !!val; };
    setChk('aaSettingRespectDeps',      s.respectDependencies !== false);
    setChk('aaSettingAllowSplit',        s.allowSplit !== false);
    setChk('aaSettingKeepExisting',      !!s.keepExisting);
    setChk('aaSettingRespectProximity',  s.respectProximity !== false);
    setChk('aaSettingCreateTables',      !!s.createTables);

    _renderAATableTypesList();
    _renderAACustomDepTypesList();
    UI.openModal('modalAutoAssignSettings');
  }

  function _renderAATableTypesList() {
    const el = document.getElementById('aaTableTypesList');
    if (!el) return;
    const types = State.get().settings?.autoAssign?.tableTypes || [];
    if (!types.length) { el.innerHTML = '<p style="color:#90a4ae;font-size:12px">לא הוגדרו סוגי שולחנות.</p>'; return; }
    el.innerHTML = `<table style="width:100%;border-collapse:collapse;font-size:12px;margin-bottom:4px">
      <thead><tr style="background:#f5f5f5">
        <th style="padding:4px 6px;text-align:right">שם</th>
        <th style="padding:4px 6px;text-align:center">מקס׳ שולחנות</th>
        <th style="padding:4px 6px;text-align:center">מקס׳ מושבים</th>
        <th style="padding:4px 6px;text-align:center">מינ׳ תפוסה לפני פיצול</th>
        <th></th>
      </tr></thead>
      <tbody>${types.map((t, i) => `<tr style="border-bottom:1px solid #f0f0f0">
        <td style="padding:4px 6px">${UI.escHtml(t.name)}</td>
        <td style="padding:4px 6px;text-align:center">${t.maxCount || '—'}</td>
        <td style="padding:4px 6px;text-align:center">${t.maxSeats || '—'}</td>
        <td style="padding:4px 6px;text-align:center">${t.minOccupancyBeforeSplit || 0}%</td>
        <td style="padding:4px 6px;text-align:center"><button class="btn btn-sm" style="color:#e53935;border:1px solid #e53935;padding:1px 6px" data-remove-ttype="${i}">✕</button></td>
      </tr>`).join('')}</tbody>
    </table>`;
    el.querySelectorAll('[data-remove-ttype]').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.removeTtype);
        const s = State.get().settings;
        s.autoAssign.tableTypes.splice(idx, 1);
        State.setSetting('autoAssign', s.autoAssign);
        _renderAATableTypesList();
      });
    });
  }

  function _renderAACustomDepTypesList() {
    const el = document.getElementById('aaCustomDepTypesList');
    if (!el) return;
    const types = State.get().settings?.autoAssign?.customDependencyTypes || [];
    if (!types.length) { el.innerHTML = '<p style="color:#90a4ae;font-size:12px">לא הוגדרו סוגי תלויות מותאמים.</p>'; return; }
    const STRENGTH_LABELS = { required: 'חובה', preferred: 'מועדף', avoid: 'הימנע', forbidden: 'אסור' };
    el.innerHTML = `<table style="width:100%;border-collapse:collapse;font-size:12px;margin-bottom:4px">
      <thead><tr style="background:#f5f5f5">
        <th style="padding:4px 6px;text-align:right">שם</th>
        <th style="padding:4px 6px;text-align:center">אייקון</th>
        <th style="padding:4px 6px;text-align:center">עוצמה</th>
        <th style="padding:4px 6px;text-align:center">צבע</th>
        <th></th>
      </tr></thead>
      <tbody>${types.map((t, i) => `<tr style="border-bottom:1px solid #f0f0f0">
        <td style="padding:4px 6px">${UI.escHtml(t.label)}</td>
        <td style="padding:4px 6px;text-align:center">${UI.escHtml(t.icon||'')}</td>
        <td style="padding:4px 6px;text-align:center">${STRENGTH_LABELS[t.strength] || t.strength}</td>
        <td style="padding:4px 6px;text-align:center"><span style="display:inline-block;width:18px;height:18px;background:${t.color};border-radius:3px"></span></td>
        <td style="padding:4px 6px;text-align:center"><button class="btn btn-sm" style="color:#e53935;border:1px solid #e53935;padding:1px 6px" data-remove-cdt="${i}">✕</button></td>
      </tr>`).join('')}</tbody>
    </table>`;
    el.querySelectorAll('[data-remove-cdt]').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.removeCdt);
        const s = State.get().settings;
        s.autoAssign.customDependencyTypes.splice(idx, 1);
        State.setSetting('autoAssign', s.autoAssign);
        _renderAACustomDepTypesList();
      });
    });
  }

  function _saveAutoAssignSettings() {
    const s = State.get().settings.autoAssign || {};
    s.respectDependencies = document.getElementById('aaSettingRespectDeps')?.checked !== false;
    s.allowSplit          = document.getElementById('aaSettingAllowSplit')?.checked !== false;
    s.keepExisting        = !!document.getElementById('aaSettingKeepExisting')?.checked;
    s.respectProximity    = document.getElementById('aaSettingRespectProximity')?.checked !== false;
    s.createTables        = !!document.getElementById('aaSettingCreateTables')?.checked;
    State.setSetting('autoAssign', s);
    UI.closeModal('modalAutoAssignSettings');
    UI.toast('הגדרות שיבוץ נשמרו ✓', 'success', 1800);
  }

  return {
    init,
    openAddTable, openEditTable,
    openEditItem, openAddGuest, openEditGuest,
    openAddShape, openSettings, openAutoAssign,
    openFindTable, openItemDetails, openAddGuestToTable,
    openPrintCards, openPrintDiagram, openBulkEdit, openAlignItems,
    handleGuestDrop, updateEventHeader,
    renderTagsManager, renderPresetManager, renderTablePresets,
    renderEventsManager, showAutoAssignResult,
    renderLayoutDropdown, openSaveLayout,
    openNormalizeSizes,
    openGuestDependencies, openAutoAssignSettings,
    openAutoAssignAsLayout
  };
})();
