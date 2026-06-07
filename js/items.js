'use strict';

const Items = (() => {
  const room = () => document.getElementById('canvasRoom');

  /* ═══════════════════════════════ ADD ITEMS ═══════════════════════════════ */

  function addTable(opts = {}) {
    const shape   = opts.shape   || State.get().settings.defaultShape;
    const seats   = opts.seats   || 10;
    const sz      = CONFIG.TABLE_SIZES[shape] || CONFIG.TABLE_SIZES.circle;
    const number  = opts.number  != null ? opts.number : State.nextTableNumber();
    // State.addItem emits 'itemAdded' → the listener below calls renderItem.
    return State.addItem({
      type: 'table', shape,
      seats, number,
      locked: false,
      label: opts.label || '',
      color: opts.color || null,
      x: opts.x || 400, y: opts.y || 300,
      width: opts.width || sz.width,
      height: opts.height || sz.height
    });
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
    if (typeof sz === 'object' && !sz.width) sz = { width: sz, height: sz };
    // State.addItem emits 'itemAdded' → the listener below calls renderItem.
    return State.addItem({
      type,
      shape: opts.shape || 'rectangle',
      label: opts.label || label,
      color: color,
      borderColor: opts.borderColor || '#999',
      x: opts.x || 600, y: opts.y || 400,
      width: opts.width   || (typeof sz === 'object' ? sz.width  : sz),
      height: opts.height || (typeof sz === 'object' ? sz.height : sz)
    });
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
      rh.title = 'שנה גודל';
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
      svgInner += `<text x="${cx}" y="${cy - 7}" text-anchor="middle" dominant-baseline="middle" font-size="15" font-weight="700" fill="#333">${item.number || ''}</text>`;
      if (item.label) svgInner += `<text x="${cx}" y="${cy + 9}" text-anchor="middle" dominant-baseline="middle" font-size="9" fill="#555">${UI.escHtml(item.label)}</text>`;
      if (guestNames) svgInner += `<text x="${cx}" y="${cy + 20}" text-anchor="middle" font-size="7" fill="#666">${guestNames}</text>`;
      svgInner += `<text x="${cx}" y="${cy - 20}" text-anchor="middle" font-size="8" fill="#777">${occupancy}/${item.seats}</text>`;
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
      svgInner += `<text x="${cx}" y="${cy - 6}" text-anchor="middle" dominant-baseline="middle" font-size="14" font-weight="700" fill="#333">${item.number || ''}</text>`;
      if (item.label) svgInner += `<text x="${cx}" y="${cy + 8}" text-anchor="middle" font-size="9" fill="#555">${UI.escHtml(item.label)}</text>`;
      if (guestNames) svgInner += `<text x="${cx}" y="${cy + 18}" text-anchor="middle" font-size="7" fill="#666">${guestNames}</text>`;
      svgInner += `<text x="${cx}" y="${cy - 18}" text-anchor="middle" font-size="8" fill="#777">${occupancy}/${item.seats}</text>`;
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
    const bg = item.color || CONFIG.COLORS.shape;
    const br = item.shape === 'circle' ? '50%' : (item.shape === 'square' ? '8px' : '8px');
    return `<div class="special-item-inner" style="background:${bg};border-radius:${br};border:1.5px solid ${item.borderColor||'#aaa'}">
      <span class="special-icon">${icon}</span>
      <span class="special-label">${UI.escHtml(item.label || item.type)}</span>
    </div>`;
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
    if (e.key === 'Escape') deselectAll();
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
    setTimeout(() => el.classList.remove('flash'), 1300);
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
