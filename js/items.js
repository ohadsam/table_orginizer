'use strict';

const Items = (() => {
  const room = () => document.getElementById('canvasRoom');

  /* ═══════════════════════════════ ADD ITEMS ═══════════════════════════════ */

  /* ── Find a free canvas position (viewport-center → spiral outward) ── */
  function findFreePosition(w, h) {
    const { zoom, panX, panY } = State.get().canvas;
    const GAP  = 30;
    const hw   = w / 2, hh = h / 2;

    // Estimate viewport center in canvas coordinates, excluding sidebar overlap.
    const vpEl = document.getElementById('canvasViewport');
    const sbEl = document.getElementById('sidebar');
    const vpR  = vpEl ? vpEl.getBoundingClientRect() : null;
    const sbR  = sbEl ? sbEl.getBoundingClientRect() : null;
    const canvasAreaW = vpR
      ? (sbEl && window.getComputedStyle(sbEl).position === 'fixed'
          ? vpR.width
          : vpR.width - Math.max(0, vpR.right - (sbR ? sbR.left : window.innerWidth)))
      : window.innerWidth - (sbEl ? sbEl.offsetWidth : 290);
    const vpH  = vpR ? vpR.height : (window.innerHeight - 52);
    const vCx  = canvasAreaW / 2;
    const vCy  = vpH / 2;
    // Visible canvas bounds (right/bottom edge in canvas coords)
    const visMaxX = (canvasAreaW - panX) / zoom;
    const visMaxY = (vpH         - panY) / zoom;
    // Clamp ideal center to visible viewport; never below item half-size + GAP
    const startX = Math.max(hw + GAP, Math.min((vCx - panX) / zoom, visMaxX - hw - GAP));
    const startY = Math.max(hh + GAP, Math.min((vCy - panY) / zoom, visMaxY - hh - GAP));

    // Obstacles: bounding boxes of every existing item
    const obs = State.get().items.map(i => ({
      cx: i.x, cy: i.y, hw: i.width / 2, hh: i.height / 2
    }));

    function clear(cx, cy) {
      return !obs.some(o =>
        Math.abs(cx - o.cx) < hw + o.hw + GAP &&
        Math.abs(cy - o.cy) < hh + o.hh + GAP
      );
    }

    if (clear(startX, startY)) return { x: startX, y: startY };

    // Spiral outward in rings until a free spot is found
    const step = Math.max(w, h) + GAP;
    for (let radius = step; radius < 4000; radius += step) {
      for (let a = 0; a < Math.PI * 2; a += Math.PI / 6) {
        const cx = startX + radius * Math.cos(a);
        const cy = startY + radius * Math.sin(a);
        if (cx > hw && cy > hh && clear(cx, cy)) return { x: cx, y: cy };
      }
    }

    // Last-resort fallback: stack below all existing items
    const baseY = obs.reduce((m, o) => Math.max(m, o.cy + o.hh), startY);
    return { x: startX, y: baseY + hh + GAP };
  }

  function addTable(opts = {}) {
    const shape  = opts.shape  || State.get().settings.defaultShape;
    const seats  = opts.seats  ?? 10;
    const sz     = CONFIG.TABLE_SIZES[shape] || CONFIG.TABLE_SIZES.circle;
    const number = opts.number != null ? opts.number : State.nextTableNumber();
    const w      = opts.width  || sz.width;
    const h      = opts.height || sz.height;
    const pos    = (opts.x != null && opts.y != null) ? { x: opts.x, y: opts.y } : findFreePosition(w, h);
    const item   = State.addItem({
      type: 'table', shape,
      seats, number,
      locked: false,
      label: opts.label || '',
      color: opts.color || null,
      x: pos.x, y: pos.y,
      width: w, height: h
    });
    setTimeout(() => flashItem(item.id), 50);
    return item;
  }

  function addSpecialItem(type, opts = {}) {
    let sz, label, color;
    switch (type) {
      case 'dancefloor': sz = CONFIG.DANCEFLOOR_SIZE; label = 'רחבת ריקודים'; color = CONFIG.COLORS.dancefloor; break;
      case 'dj':         sz = CONFIG.DJ_SIZE;         label = 'עמדת DJ';       color = CONFIG.COLORS.dj;         break;
      case 'door':       sz = CONFIG.DOOR_SIZE;       label = 'כניסה';         color = CONFIG.COLORS.door;       break;
      case 'shape':      sz = CONFIG.SHAPE_SIZE;      label = opts.label || ''; color = opts.color || CONFIG.COLORS.shape; break;
      default: return;
    }
    if (typeof sz === 'number') sz = { width: sz, height: sz };
    const w   = opts.width   || (typeof sz === 'object' ? sz.width  : sz);
    const h   = opts.height  || (typeof sz === 'object' ? sz.height : sz);
    const pos = (opts.x != null && opts.y != null) ? { x: opts.x, y: opts.y } : findFreePosition(w, h);
    const item = State.addItem({
      type,
      shape: opts.shape || 'rectangle',
      label: opts.label || label,
      color: color,
      borderColor: opts.borderColor || '#999',
      x: pos.x, y: pos.y,
      width: w, height: h
    });
    setTimeout(() => flashItem(item.id), 50);
    return item;
  }

  /* ═══════════════════════════════ RENDER ═══════════════════════════════ */

  function renderItem(item) {
    let el = document.getElementById(item.id);
    if (!el) {
      el = document.createElement('div');
      el.id = item.id;
      el.className = 'canvas-item';
      el.dataset.type = item.type;
      room().appendChild(el);

      // Content area (SVG or special HTML)
      const content = document.createElement('div');
      content.className = 'item-content';
      el.appendChild(content);

      // Resize handle — created once
      const rh = document.createElement('div');
      rh.className = 'resize-handle';
      rh.title = 'גרור לשינוי גודל הפריט';
      rh.textContent = '↔';
      el.appendChild(rh);

      // Bind drag/resize/click ONCE
      Drag.bindItemDrag(el, item.id);
      Drag.bindResizeDrag(rh, item.id);
      el.addEventListener('click', e => { e.stopPropagation(); selectItem(item.id); });
      el.addEventListener('dblclick', e => {
        e.stopPropagation();
        const cur = State.getItem(item.id);
        if (!cur) return;
        if (cur.type === 'table') Modals.openEditTable(item.id);
        else Modals.openEditItem(item.id);
      });

      // Action button (⋮) — top-left corner, shown on hover/select
      const actionBtn = document.createElement('button');
      actionBtn.className = 'item-action-btn';
      actionBtn.title = 'פעולות (שכפל / מחק / צבע / טקסט)';
      actionBtn.textContent = '⋮';
      actionBtn.addEventListener('pointerdown', e => e.stopPropagation());
      actionBtn.addEventListener('click', e => {
        e.stopPropagation();
        const r = actionBtn.getBoundingClientRect();
        openCtxMenu(item.id, r.left, r.bottom + 4);
      });
      el.appendChild(actionBtn);

      // Right-click opens the same context menu
      el.addEventListener('contextmenu', e => {
        e.preventDefault();
        e.stopPropagation();
        openCtxMenu(item.id, e.clientX, e.clientY);
      });
    }

    el.dataset.shape = item.shape || '';
    el.style.left    = (item.x - item.width  / 2) + 'px';
    el.style.top     = (item.y - item.height / 2) + 'px';
    el.style.width   = item.width  + 'px';
    el.style.height  = item.height + 'px';

    // Update only the content div (keeps drag/resize handlers intact)
    const content = el.querySelector('.item-content');
    if (content) {
      content.innerHTML = item.type === 'table'
        ? buildTableSVG(item) : buildSpecialHTML(item);
    }
  }

  function refreshItem(id) {
    const item = State.getItem(id);
    if (!item) { removeItemEl(id); return; }
    renderItem(item);
  }

  function removeItemEl(id) {
    document.getElementById(id)?.remove();
  }

  function renderAll() {
    room().innerHTML = '';
    State.get().items.forEach(renderItem);
  }

  /* ── SVG table ── */
  function buildTableSVG(item) {
    const W = item.width, H = item.height;
    const guests     = State.getTableGuests(item.id);
    const occupancy  = State.getTableOccupancy(item.id);
    const hasSpace   = occupancy <= item.seats;
    const bgColor    = item.color || tableColor(occupancy, item.seats);
    const R_seat     = CONFIG.SEAT_RADIUS;

    let svgInner = '';
    let guestNames = guests.map(g => UI.escHtml(g.name)).join(', ');
    if (guestNames.length > 40) guestNames = guestNames.slice(0, 37) + '…';

    if (item.shape === 'circle') {
      const sR  = Math.min(W, H) / 2 - R_seat - 2;   // seat centres just inside SVG edge
      const r   = Math.max(10, sR - R_seat - 4);      // table body radius
      const cx  = W / 2, cy = H / 2;
      svgInner += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${bgColor}" stroke="#888" stroke-width="1.5"/>`;
      for (let i = 0; i < item.seats; i++) {
        const ang  = (i / item.seats) * 2 * Math.PI - Math.PI / 2;
        const sx   = cx + sR * Math.cos(ang);
        const sy   = cy + sR * Math.sin(ang);
        const fill = i < occupancy ? (hasSpace ? CONFIG.COLORS.seatOccupied : CONFIG.COLORS.seatOver) : CONFIG.COLORS.seatEmpty;
        svgInner += `<circle cx="${sx.toFixed(1)}" cy="${sy.toFixed(1)}" r="${R_seat}" fill="${fill}" stroke="#fff" stroke-width="1.2"/>`;
      }
      // Table number
      svgInner += `<text x="${cx}" y="${cy - 8}" text-anchor="middle" dominant-baseline="middle" font-size="15" font-weight="700" fill="#333">${item.number || ''}</text>`;
      // Seat count — clearly readable text
      svgInner += `<text x="${cx}" y="${cy + 10}" text-anchor="middle" dominant-baseline="middle" font-size="8" fill="#546e7a">${item.seats} מושבים</text>`;
      if (item.label) svgInner += `<text x="${cx}" y="${cy + 19}" text-anchor="middle" font-size="8" fill="#555">${UI.escHtml(item.label)}</text>`;
      if (guestNames) svgInner += `<text x="${cx}" y="${cy + (item.label ? 29 : 19)}" text-anchor="middle" font-size="7" fill="#666">${guestNames}</text>`;
      svgInner += `<text x="${cx}" y="${cy - 21}" text-anchor="middle" font-size="7" fill="#888">${occupancy}/${item.seats}</text>`;
    } else {
      // Rectangle / square
      const pad = R_seat + 4;
      const rw  = W - pad * 2, rh = H - pad * 2;
      svgInner += `<rect x="${pad}" y="${pad}" width="${rw}" height="${rh}" rx="6" fill="${bgColor}" stroke="#888" stroke-width="1.5"/>`;
      const seats = distributeRectSeats(item.seats, rw, rh);
      let sIdx = 0;
      for (const [sx, sy] of seats) {
        const fill = sIdx < occupancy ? (hasSpace ? CONFIG.COLORS.seatOccupied : CONFIG.COLORS.seatOver) : CONFIG.COLORS.seatEmpty;
        svgInner += `<circle cx="${(pad + sx).toFixed(1)}" cy="${(pad + sy).toFixed(1)}" r="${R_seat}" fill="${fill}" stroke="#fff" stroke-width="1.2"/>`;
        sIdx++;
      }
      const cx = W / 2, cy = H / 2;
      svgInner += `<text x="${cx}" y="${cy - 8}" text-anchor="middle" dominant-baseline="middle" font-size="14" font-weight="700" fill="#333">${item.number || ''}</text>`;
      // Seat count — clearly readable text
      svgInner += `<text x="${cx}" y="${cy + 9}" text-anchor="middle" dominant-baseline="middle" font-size="8" fill="#546e7a">${item.seats} מושבים</text>`;
      if (item.label) svgInner += `<text x="${cx}" y="${cy + 18}" text-anchor="middle" font-size="8" fill="#555">${UI.escHtml(item.label)}</text>`;
      if (guestNames) svgInner += `<text x="${cx}" y="${cy + (item.label ? 28 : 18)}" text-anchor="middle" font-size="7" fill="#666">${guestNames}</text>`;
      svgInner += `<text x="${cx}" y="${cy - 20}" text-anchor="middle" font-size="7" fill="#888">${occupancy}/${item.seats}</text>`;
    }

    if (item.locked) {
      svgInner += `<text x="${W - 4}" y="14" text-anchor="end" font-size="13">🔒</text>`;
    }

    return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" overflow="visible" xmlns="http://www.w3.org/2000/svg">${svgInner}</svg>`;
  }

  function distributeRectSeats(totalSeats, rw, rh) {
    const perimeter = 2 * (rw + rh);
    const topN    = Math.max(1, Math.round(totalSeats * rw / perimeter));
    const bottomN = Math.max(1, Math.round(totalSeats * rw / perimeter));
    let leftN = Math.max(1, Math.round(totalSeats * rh / perimeter));
    let rightN = totalSeats - topN - bottomN - leftN;
    if (rightN < 1) { rightN = 1; leftN = Math.max(1, totalSeats - topN - bottomN - rightN); }

    const positions = [];
    const R = CONFIG.SEAT_RADIUS;
    // top
    for (let i = 0; i < topN; i++) positions.push([(i + 1) * rw / (topN + 1), -R - 1]);
    // bottom
    for (let i = 0; i < bottomN; i++) positions.push([(i + 1) * rw / (bottomN + 1), rh + R + 1]);
    // left
    for (let i = 0; i < leftN; i++) positions.push([-R - 1, (i + 1) * rh / (leftN + 1)]);
    // right
    for (let i = 0; i < rightN; i++) positions.push([rw + R + 1, (i + 1) * rh / (rightN + 1)]);
    return positions;
  }

  function tableColor(occ, seats) {
    if (occ === 0) return CONFIG.COLORS.tableEmpty;
    if (occ < seats) return occ >= seats * 0.8 ? CONFIG.COLORS.tableFull : CONFIG.COLORS.tablePartial;
    if (occ === seats) return CONFIG.COLORS.tableFull;
    return CONFIG.COLORS.tableOver;
  }

  /* ── Special items ── */
  function buildSpecialHTML(item) {
    const icons = { dancefloor: '🕺', dj: '🎵', door: '🚪' };
    const icon = icons[item.type] || '⬛';
    const bg = item.color || CONFIG.COLORS[item.type] || CONFIG.COLORS.shape;
    const br = item.shape === 'circle' ? '50%' : (item.shape === 'square' ? '8px' : '8px');
    return `<div class="special-item-inner" style="background:${bg};border-radius:${br};border:1.5px solid ${item.borderColor||'#aaa'}">
      <span class="special-icon">${icon}</span>
      <span class="special-label">${UI.escHtml(item.label || item.type)}</span>
    </div>`;
  }

  /* ── Item context menu ── */
  let _ctxItemId = null;
  let _ctxMenu   = null;

  function _buildCtxMenu() {
    const m = document.createElement('div');
    m.className = 'item-ctx-menu';
    m.innerHTML =
      `<button class="ctx-menu-btn" id="ctxDuplicate">⧉&nbsp; שכפל</button>
       <hr class="ctx-menu-sep">
       <div class="ctx-inline-row">
         <span class="ctx-row-lbl" title="שנה טקסט">📝</span>
         <input id="ctxTextInput" class="ctx-inline-input" type="text" placeholder="תווית…">
         <button id="ctxApplyText" class="ctx-apply-btn" title="שמור טקסט">✓</button>
       </div>
       <div class="ctx-inline-row">
         <span class="ctx-row-lbl" title="שנה צבע">🎨</span>
         <input id="ctxColorInput" class="ctx-inline-color" type="color">
         <button id="ctxApplyColor" class="ctx-apply-btn" title="שמור צבע">✓</button>
         <button id="ctxClearColor" class="ctx-apply-btn ctx-clear-btn" title="הסר צבע מותאם">✕</button>
       </div>
       <hr class="ctx-menu-sep">
       <button class="ctx-menu-btn ctx-danger" id="ctxDelete">🗑&nbsp; מחק</button>`;
    document.body.appendChild(m);

    m.querySelector('#ctxDuplicate').onclick = () => {
      if (_ctxItemId) {
        const copy = State.duplicateItem(_ctxItemId);
        if (copy) { selectItem(copy.id); UI.toast('הפריט שוכפל ✓', 'success', 1800); }
      }
      _closeCtxMenu();
    };

    m.querySelector('#ctxApplyText').onclick = _applyCtxText;
    m.querySelector('#ctxTextInput').addEventListener('keydown', e => { if (e.key === 'Enter') _applyCtxText(); });

    // ✓ is the single commit point — avoids double-update / undo-stack pollution.
    m.querySelector('#ctxApplyColor').onclick = () => {
      if (_ctxItemId) {
        State.updateItem(_ctxItemId, { color: m.querySelector('#ctxColorInput').value });
        if (State.getItem(_ctxItemId)?.type === 'table') Guests.render();
      }
      _closeCtxMenu();
    };

    m.querySelector('#ctxClearColor').onclick = () => {
      if (_ctxItemId) {
        State.updateItem(_ctxItemId, { color: null });
        if (State.getItem(_ctxItemId)?.type === 'table') Guests.render();
      }
      _closeCtxMenu();
    };

    m.querySelector('#ctxDelete').onclick = () => {
      const id = _ctxItemId;
      if (!id) return;
      if (UI.confirmDialog('למחוק פריט זה?')) {
        State.removeItem(id);
        if (_selectedId === id) deselectAll();
      }
      _closeCtxMenu();
    };

    // Close on outside click (capture so it fires before any button handler)
    document.addEventListener('mousedown', e => {
      if (!_ctxMenu || _ctxMenu.style.display === 'none') return;
      if (_ctxMenu.contains(e.target)) return;
      if (e.target.closest('.item-action-btn')) return;
      _closeCtxMenu();
    }, true);

    return m;
  }

  function _applyCtxText() {
    if (!_ctxItemId) return;
    const val = document.getElementById('ctxTextInput').value.trim();
    State.updateItem(_ctxItemId, { label: val });
    if (State.getItem(_ctxItemId)?.type === 'table') Guests.render();
    _closeCtxMenu();
  }

  function openCtxMenu(id, viewX, viewY) {
    const item = State.getItem(id);
    if (!item) return;
    _ctxItemId = id;
    selectItem(id);
    if (!_ctxMenu) _ctxMenu = _buildCtxMenu();
    document.getElementById('ctxTextInput').value = item.label || '';
    document.getElementById('ctxColorInput').value =
      item.color || (item.type === 'table' ? '#e3f2fd'
        : (CONFIG.COLORS[item.type] || CONFIG.COLORS.shape || '#cccccc'));
    _ctxMenu.style.display = 'block';
    // Clamp to viewport
    const mw = _ctxMenu.offsetWidth  || 190;
    const mh = _ctxMenu.offsetHeight || 180;
    const x  = Math.min(viewX, window.innerWidth  - mw - 8);
    const y  = Math.min(viewY, window.innerHeight - mh - 8);
    _ctxMenu.style.left = Math.max(4, x) + 'px';
    _ctxMenu.style.top  = Math.max(4, y) + 'px';
  }

  function _closeCtxMenu() {
    if (_ctxMenu) _ctxMenu.style.display = 'none';
    _ctxItemId = null;
  }

  /* ── Selection ── */
  let _selectedId = null;
  function selectItem(id) {
    if (_selectedId) document.getElementById(_selectedId)?.classList.remove('selected');
    _selectedId = id;
    if (id) document.getElementById(id)?.classList.add('selected');
  }
  function getSelected() { return _selectedId; }
  function deselectAll() { selectItem(null); }

  document.addEventListener('keydown', e => {
    if ((e.key === 'Delete' || e.key === 'Backspace') && _selectedId) {
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (UI.confirmDialog('למחוק פריט זה?')) {
        State.removeItem(_selectedId);
        _selectedId = null;
      }
    }
    if (e.key === 'Escape') { _closeCtxMenu(); deselectAll(); }
  });

  /* ── Drop highlight ── */
  function highlightTable(id, on) {
    const el = id ? document.getElementById(id) : null;
    document.querySelectorAll('.canvas-item.drop-target').forEach(e => e.classList.remove('drop-target'));
    if (on && el) el.classList.add('drop-target');
  }

  /* ── Flash an item (used by "focus on table") ── */
  function flashItem(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.remove('flash');
    void el.offsetWidth;          // restart CSS animation
    el.classList.add('flash');
    setTimeout(() => el.classList.remove('flash'), 2500);
  }

  /* ── State sync ── */
  State.on('itemAdded',   item => renderItem(item));
  State.on('itemUpdated', item => refreshItem(item.id));
  State.on('itemRemoved', id   => removeItemEl(id));
  State.on('guestAssigned', ({ tableId, prevTableId }) => {
    if (tableId)     refreshItem(tableId);
    if (prevTableId) refreshItem(prevTableId);
  });
  State.on('guestUpdated', g => { if (g.tableId) refreshItem(g.tableId); });
  State.on('guestRemoved', ({ tableId }) => {
    if (tableId) refreshItem(tableId);
  });
  State.on('dataLoaded', renderAll);

  return {
    addTable, addSpecialItem,
    renderItem, refreshItem, renderAll, removeItemEl,
    selectItem, getSelected, deselectAll,
    highlightTable, flashItem, tableColor
  };
})();
