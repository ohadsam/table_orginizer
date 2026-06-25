'use strict';

const Items = (() => {
  const room = () => document.getElementById('canvasRoom');

  /* ═══════════════════════════════ ADD ITEMS ═══════════════════════════════ */

  /* ── Find a free canvas position (viewport-center → spiral outward) ── */
  function findFreePosition(w, h) {
    const { zoom, panX, panY } = State.get().canvas;
    const GAP  = 30;
    const hw   = w / 2, hh = h / 2;

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
    const visMaxX = (canvasAreaW - panX) / zoom;
    const visMaxY = (vpH         - panY) / zoom;
    const startX = Math.max(hw + GAP, Math.min((vCx - panX) / zoom, visMaxX - hw - GAP));
    const startY = Math.max(hh + GAP, Math.min((vCy - panY) / zoom, visMaxY - hh - GAP));

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

    const step = Math.max(w, h) + GAP;
    for (let radius = step; radius < 4000; radius += step) {
      for (let a = 0; a < Math.PI * 2; a += Math.PI / 6) {
        const cx = startX + radius * Math.cos(a);
        const cy = startY + radius * Math.sin(a);
        if (cx > hw && cy > hh && clear(cx, cy)) return { x: cx, y: cy };
      }
    }

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
      fontSize: opts.fontSize || null,
      x: pos.x, y: pos.y,
      width: w, height: h
    });
    setTimeout(() => flashItem(item.id), 50);
    return item;
  }

  function addSpecialItem(type, opts = {}) {
    let sz, label, color;
    switch (type) {
      case 'dancefloor': sz = CONFIG.DANCEFLOOR_SIZE;  label = 'רחבת ריקודים'; color = CONFIG.COLORS.dancefloor; break;
      case 'dj':         sz = CONFIG.DJ_SIZE;           label = 'עמדת DJ';       color = CONFIG.COLORS.dj;         break;
      case 'door':       sz = CONFIG.DOOR_SIZE;         label = 'כניסה';          color = CONFIG.COLORS.door;       break;
      case 'shape':      sz = CONFIG.SHAPE_SIZE;        label = opts.label || ''; color = opts.color || CONFIG.COLORS.shape; break;
      case 'stairs':     sz = CONFIG.STAIRS_SIZE;       label = 'מדרגות';         color = CONFIG.COLORS.stairs;     break;
      case 'elevator':   sz = CONFIG.ELEVATOR_SIZE;     label = 'מעלית';          color = CONFIG.COLORS.elevator;   break;
      case 'kitchen':    sz = CONFIG.KITCHEN_SIZE;      label = 'מטבח';           color = CONFIG.COLORS.kitchen;    break;
      case 'balcony':    sz = CONFIG.BALCONY_SIZE;      label = 'מרפסת';          color = CONFIG.COLORS.balcony;    break;
      case 'pool':       sz = CONFIG.POOL_SIZE;         label = 'בריכה';          color = CONFIG.COLORS.pool;       break;
      case 'waterfall':  sz = CONFIG.WATERFALL_SIZE;    label = 'מפל';            color = CONFIG.COLORS.waterfall;  break;
      case 'bar':        sz = CONFIG.BAR_SIZE;          label = 'בר';             color = CONFIG.COLORS.bar;        break;
      case 'stage':      sz = CONFIG.STAGE_SIZE;        label = 'במה';            color = CONFIG.COLORS.stage;      break;
      case 'photo':      sz = CONFIG.PHOTO_SIZE;        label = 'פינת צילום';     color = CONFIG.COLORS.photo;      break;
      case 'buffet':     sz = CONFIG.BUFFET_SIZE;       label = 'בופה';           color = CONFIG.COLORS.buffet;     break;
      case 'bathroom':   sz = CONFIG.BATHROOM_SIZE;     label = 'שירותים';        color = CONFIG.COLORS.bathroom;   break;
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

  /* ═══════════════════════════════ RENUMBER ═══════════════════════════════ */

  function renumberTables({ reversed = false } = {}) {
    const tables = State.getTables();
    if (!tables.length) { UI.toast('אין שולחנות למספור', 'info', 1800); return; }

    // Sort by visual position: top-to-bottom rows, then right-to-left within a row (RTL hall)
    const ROW_SNAP = 60;
    const allSorted = [...tables].sort((a, b) => {
      const rowDiff = a.y - b.y;
      if (Math.abs(rowDiff) > ROW_SNAP) return rowDiff;
      return b.x - a.x; // RTL: rightmost (larger x) gets lower number in each row
    });
    if (reversed) allSorted.reverse();

    // Locked-number tables keep their current number; renumber around them
    const lockedNums = new Set(
      allSorted.filter(t => t.numberLocked && t.number != null).map(t => t.number)
    );
    const unlocked = allSorted.filter(t => !t.numberLocked);

    // Assign sequential numbers 1, 2, 3... skipping any slots taken by locked tables
    const assigned = [];
    let n = 1;
    while (assigned.length < unlocked.length) {
      if (!lockedNums.has(n)) assigned.push(n);
      n++;
    }

    Guests.startBatch();
    unlocked.forEach((t, i) => {
      if (t.number !== assigned[i]) State.updateItem(t.id, { number: assigned[i] });
    });
    Guests.endBatch();

    const lockedCount = tables.length - unlocked.length;
    const note = lockedCount ? ` (${lockedCount} נעולים לא השתנו)` : '';
    UI.toast(`שולחנות מוספרו מחדש ✓${note}`, 'success', 2200);
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

      const content = document.createElement('div');
      content.className = 'item-content';
      el.appendChild(content);

      const rh = document.createElement('div');
      rh.className = 'resize-handle';
      rh.title = 'גרור לשינוי גודל הפריט';
      rh.textContent = '↔';
      el.appendChild(rh);

      Drag.bindItemDrag(el, item.id);
      Drag.bindResizeDrag(rh, item.id);
      el.addEventListener('click', e => {
        e.stopPropagation();
        if (e.ctrlKey || e.metaKey) toggleSelectItem(item.id);
        else selectItem(item.id);
      });
      el.addEventListener('dblclick', e => {
        e.stopPropagation();
        const cur = State.getItem(item.id);
        if (!cur) return;
        if (cur.type === 'table') Modals.openEditTable(item.id);
        else Modals.openEditItem(item.id);
      });

      // Hover tooltip (tables only)
      if (item.type === 'table') {
        el.addEventListener('mouseenter', e => {
          const cur = State.getItem(item.id);
          if (cur) _showTooltip(cur, e.clientX, e.clientY);
        });
        el.addEventListener('mousemove', e => {
          if (_tooltip && _tooltip.style.display !== 'none') _posTooltip(e.clientX, e.clientY);
        });
        el.addEventListener('mouseleave', _hideTooltip);
      }

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

      el.addEventListener('contextmenu', e => {
        e.preventDefault();
        e.stopPropagation();
        openCtxMenu(item.id, e.clientX, e.clientY);
      });
    }

    el.dataset.shape   = item.shape || '';
    el.style.left      = (item.x - item.width  / 2) + 'px';
    el.style.top       = (item.y - item.height / 2) + 'px';
    el.style.width     = item.width  + 'px';
    el.style.height    = item.height + 'px';
    el.style.transform = item.rotation ? `rotate(${item.rotation}deg)` : '';
    const rhEl = el.querySelector('.resize-handle');
    if (rhEl) rhEl.style.display = item.rotation ? 'none' : '';

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
    _selectedIds.clear();
    _selectedId = null;
    room().innerHTML = '';
    State.get().items.forEach(renderItem);
    _updateBulkEditBtn();
  }

  /* ── Hover tooltip ── */
  let _tooltip = null;

  function _getTooltip() {
    if (!_tooltip) {
      _tooltip = document.createElement('div');
      _tooltip.className = 'table-hover-tooltip';
      document.body.appendChild(_tooltip);
    }
    return _tooltip;
  }

  function _showTooltip(item, clientX, clientY) {
    const tip    = _getTooltip();
    const guests = State.getTableGuests(item.id);
    const occ    = State.getTableOccupancy(item.id);
    let html = `<div class="tooltip-title">שולחן ${item.number || '?'}${item.label ? ' — ' + UI.escHtml(item.label) : ''}</div>`;
    html += `<div class="tooltip-sub">${occ}/${item.seats} מושבים אוכלוסו</div>`;
    const proxStatus = _getTableProximityStatus(item);
    if (!guests.length) {
      html += `<div class="tooltip-empty">אין מוזמנים משובצים</div>`;
    } else {
      const MAX = 14;
      html += guests.slice(0, MAX).map(g => {
        const mm = _getGuestProximityMismatch(g, proxStatus);
        return `<div class="tooltip-guest-row${mm ? ' tooltip-guest-mismatch' : ''}">
          <span>${mm ? '⚠️ ' : ''}${UI.escHtml(g.name)}</span>
          <span class="tooltip-guest-count">${g.adults}${g.children ? '+' + g.children : ''}</span>
          ${mm ? `<div class="tooltip-mismatch-note">${mm.replace(UI.escHtml(g.name) + ' ', '')}</div>` : ''}
        </div>`;
      }).join('');
      if (guests.length > MAX)
        html += `<div class="tooltip-more">ועוד ${guests.length - MAX} נוספים…</div>`;
    }
    tip.innerHTML = html;
    tip.style.display = 'block';
    _posTooltip(clientX, clientY);
  }

  function _posTooltip(cx, cy) {
    const tip = _tooltip;
    if (!tip) return;
    const tw = tip.offsetWidth  || 200;
    const th = tip.offsetHeight || 100;
    let x = cx + 18, y = cy + 10;
    if (x + tw > window.innerWidth  - 8) x = cx - tw - 10;
    if (y + th > window.innerHeight - 8) y = cy - th - 8;
    tip.style.left = Math.max(4, x) + 'px';
    tip.style.top  = Math.max(4, y) + 'px';
  }

  function _hideTooltip() {
    if (_tooltip) _tooltip.style.display = 'none';
  }

  /* ── Central-item proximity helpers ── */
  // Distance threshold (edge-to-edge) below which a table is considered "near" central items
  const _NEAR_THRESHOLD = 380; // canvas px

  function _getCentralItems() {
    return State.get().items.filter(i => i.type === 'dancefloor' || i.isCentral);
  }

  // Returns {isNear: bool} or null if no central items exist
  function _getTableProximityStatus(table) {
    const central = _getCentralItems();
    if (!central.length) return null;
    // Minimum edge-to-edge distance to any central item
    const minDist = central.reduce((mn, c) => {
      const dx = Math.max(0, Math.abs(table.x - c.x) - (table.width / 2 + c.width  / 2));
      const dy = Math.max(0, Math.abs(table.y - c.y) - (table.height / 2 + c.height / 2));
      return Math.min(mn, Math.hypot(dx, dy));
    }, Infinity);
    return { isNear: minDist < _NEAR_THRESHOLD, dist: Math.round(minDist) };
  }

  // Returns a Hebrew description of the mismatch, or null if no mismatch
  function _getGuestProximityMismatch(guest, proxStatus) {
    if (!proxStatus) return null;
    const prox = guest.proximity || [];
    if (prox.includes('nearDance') && !proxStatus.isNear) return `${UI.escHtml(guest.name)} ביקש קרוב לרחבה אך ממוקם רחוק`;
    if (prox.includes('farDance')  &&  proxStatus.isNear) return `${UI.escHtml(guest.name)} ביקש רחוק מהרחבה אך ממוקם קרוב`;
    return null;
  }

  /* ── SVG table (with scaled fonts and guest rows) ── */
  function buildTableSVG(item) {
    const W = item.width, H = item.height;
    const textRot   = item.textRotation || 0;
    const guests    = State.getTableGuests(item.id);
    const occupancy = State.getTableOccupancy(item.id);
    const hasSpace  = occupancy <= item.seats;
    const bgColor   = item.color || tableColor(occupancy, item.seats);
    const R_seat    = CONFIG.SEAT_RADIUS;
    const minDim    = Math.min(W, H);

    // Proximity mismatch: compute once per table
    const proxStatus = _getTableProximityStatus(item);

    // Scaled font sizes (base calibrated at 130px table)
    const stt       = State.get().settings;
    const scale     = minDim / 130;
    const numFont   = item.fontSize      || stt.fontNumberSize    || Math.max(10, Math.min(24, Math.round(15 * scale)));
    const labelFont = item.fontLabelSize  || stt.fontLabelSize    || Math.max(7,  Math.min(14, Math.round(10 * scale)));
    const guestFont = item.fontGuestSize  || stt.fontGuestSize    || Math.max(6,  Math.min(11, Math.round(8  * scale)));
    const occuFont  = item.fontOccupancySize || stt.fontOccupancySize || Math.max(6, Math.min(9,  Math.round(7  * scale)));
    const numColor   = stt.fontNumberColor   || '#1a237e';
    const labelColor = stt.fontLabelColor    || '#37474f';
    const guestColor = stt.fontGuestColor    || '#546e7a';
    const occuColor  = stt.fontOccupancyColor || '#888888';
    const lineH      = guestFont + 2.5;

    // shapes: table body + seat circles; texts: all labels/numbers; badges: lock indicators
    let shapes = '', texts = '', badges = '';

    if (item.shape === 'circle') {
      const sR = Math.min(W, H) / 2 - R_seat - 2;
      const r  = Math.max(10, sR - R_seat - 4);
      const cx = W / 2, cy = H / 2;

      shapes += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${bgColor}" stroke="#888" stroke-width="1.5"/>`;
      for (let i = 0; i < item.seats; i++) {
        const ang  = (i / item.seats) * 2 * Math.PI - Math.PI / 2;
        const sx   = cx + sR * Math.cos(ang);
        const sy   = cy + sR * Math.sin(ang);
        const occupied = i < guests.length;
        const mismatch = occupied ? _getGuestProximityMismatch(guests[i], proxStatus) : null;
        const fill = mismatch ? CONFIG.COLORS.seatMismatch :
                     (i < occupancy ? (hasSpace ? CONFIG.COLORS.seatOccupied : CONFIG.COLORS.seatOver) : CONFIG.COLORS.seatEmpty);
        const stroke  = mismatch ? '#ff4500' : '#fff';
        const titleEl = mismatch ? `<title>⚠️ ${mismatch}</title>` : '';
        shapes += `<circle cx="${sx.toFixed(1)}" cy="${sy.toFixed(1)}" r="${R_seat}" fill="${fill}" stroke="${stroke}" stroke-width="${mismatch ? 2 : 1.2}">${titleEl}</circle>`;
      }

      texts += `<text x="${cx}" y="${cy - r + occuFont + 1}" text-anchor="middle" font-size="${occuFont}" fill="${occuColor}">${occupancy}/${item.seats}</text>`;
      const numY = cy - (item.label ? numFont * 0.45 : numFont * 0.2);
      texts += `<text x="${cx}" y="${numY}" text-anchor="middle" dominant-baseline="middle" font-size="${numFont}" font-weight="800" fill="${numColor}">${item.number || ''}</text>`;
      let textY;
      if (item.label) {
        textY = numY + numFont * 0.65 + labelFont * 0.35 + 3;
        texts += `<text x="${cx}" y="${textY}" text-anchor="middle" dominant-baseline="middle" font-size="${labelFont}" font-weight="600" fill="${labelColor}">${UI.escHtml(item.label)}</text>`;
        textY += labelFont * 0.65 + 14;
      } else {
        textY = numY + numFont * 0.6 + 2;
      }
      const rawMaxG = Math.max(0, Math.floor((cy + r - 5 - textY) / lineH));
      const maxG = (guests.length > rawMaxG) ? Math.max(0, rawMaxG - 1) : rawMaxG;
      guests.slice(0, maxG).forEach(g => {
        const nm = g.name.length > 12 ? g.name.slice(0, 11) + '…' : g.name;
        texts += `<text x="${cx}" y="${textY}" text-anchor="middle" font-size="${guestFont}" fill="${guestColor}">${UI.escHtml(nm)}</text>`;
        textY += lineH;
      });
      const extra = guests.length - maxG;
      if (extra > 0) texts += `<text x="${cx}" y="${textY}" text-anchor="middle" font-size="${occuFont}" fill="${occuColor}">+${extra}</text>`;

    } else {
      // Rectangle / square
      const pad = R_seat + 4;
      const rw  = W - pad * 2, rh = H - pad * 2;
      shapes += `<rect x="${pad}" y="${pad}" width="${rw}" height="${rh}" rx="6" fill="${bgColor}" stroke="#888" stroke-width="1.5"/>`;
      const seatsArr = distributeRectSeats(item.seats, rw, rh);
      let sIdx = 0;
      for (const [sx, sy] of seatsArr) {
        const occupied = sIdx < guests.length;
        const mismatch = occupied ? _getGuestProximityMismatch(guests[sIdx], proxStatus) : null;
        const fill = mismatch ? CONFIG.COLORS.seatMismatch :
                     (sIdx < occupancy ? (hasSpace ? CONFIG.COLORS.seatOccupied : CONFIG.COLORS.seatOver) : CONFIG.COLORS.seatEmpty);
        const stroke  = mismatch ? '#ff4500' : '#fff';
        const titleEl = mismatch ? `<title>⚠️ ${mismatch}</title>` : '';
        shapes += `<circle cx="${(pad + sx).toFixed(1)}" cy="${(pad + sy).toFixed(1)}" r="${R_seat}" fill="${fill}" stroke="${stroke}" stroke-width="${mismatch ? 2 : 1.2}">${titleEl}</circle>`;
        sIdx++;
      }
      const cx = W / 2, cy = H / 2;

      texts += `<text x="${cx}" y="${pad + occuFont + 1}" text-anchor="middle" font-size="${occuFont}" fill="${occuColor}">${occupancy}/${item.seats}</text>`;
      const numY = cy - (item.label ? numFont * 0.45 : numFont * 0.2);
      texts += `<text x="${cx}" y="${numY}" text-anchor="middle" dominant-baseline="middle" font-size="${numFont}" font-weight="800" fill="${numColor}">${item.number || ''}</text>`;
      let textY;
      if (item.label) {
        textY = numY + numFont * 0.65 + labelFont * 0.35 + 3;
        texts += `<text x="${cx}" y="${textY}" text-anchor="middle" dominant-baseline="middle" font-size="${labelFont}" font-weight="600" fill="${labelColor}">${UI.escHtml(item.label)}</text>`;
        textY += labelFont * 0.65 + 14;
      } else {
        textY = numY + numFont * 0.6 + 2;
      }
      const availH  = H - pad - 4 - textY;
      const rawMaxG = Math.max(0, Math.floor(availH / lineH));
      const maxG    = (guests.length > rawMaxG) ? Math.max(0, rawMaxG - 1) : rawMaxG;
      guests.slice(0, maxG).forEach(g => {
        const nm = g.name.length > 16 ? g.name.slice(0, 15) + '…' : g.name;
        texts += `<text x="${cx}" y="${textY}" text-anchor="middle" font-size="${guestFont}" fill="${guestColor}">${UI.escHtml(nm)}</text>`;
        textY += lineH;
      });
      const extra = guests.length - maxG;
      if (extra > 0) texts += `<text x="${cx}" y="${textY}" text-anchor="middle" font-size="${occuFont}" fill="${occuColor}">+${extra}</text>`;
    }

    if (item.locked)       badges += `<text x="${W - 4}" y="14" text-anchor="end" font-size="13">🔒</text>`;
    if (item.numberLocked) badges += `<text x="4" y="14" text-anchor="start" font-size="11" font-weight="700" fill="#7e57c2">#</text>`;

    const textGroup = textRot
      ? `<g transform="rotate(${textRot},${W / 2},${H / 2})">${texts}</g>`
      : texts;

    return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" overflow="visible" xmlns="http://www.w3.org/2000/svg">${shapes}${textGroup}${badges}</svg>`;
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
    for (let i = 0; i < topN;    i++) positions.push([(i + 1) * rw / (topN    + 1), -R - 1]);
    for (let i = 0; i < bottomN; i++) positions.push([(i + 1) * rw / (bottomN + 1), rh + R + 1]);
    for (let i = 0; i < leftN;   i++) positions.push([-R - 1, (i + 1) * rh / (leftN  + 1)]);
    for (let i = 0; i < rightN;  i++) positions.push([rw + R + 1, (i + 1) * rh / (rightN + 1)]);
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
    const icons = {
      dancefloor: '🕺', dj: '🎵', door: '🚪', shape: '⬛',
      stairs: '🪜', elevator: '🛗', kitchen: '🍳', balcony: '🌿',
      pool: '🏊', waterfall: '💧', bar: '🍹', stage: '🎤',
      photo: '📸', buffet: '🍽️', bathroom: '🚻'
    };
    const icon  = icons[item.type] || '⬛';
    const bg    = item.color || CONFIG.COLORS[item.type] || CONFIG.COLORS.shape;
    const br    = item.shape === 'circle' ? '50%' : '8px';
    const _safeHex = c => (c && /^#[0-9a-fA-F]{3,8}$/.test(c)) ? c : null;
    const fSize  = (item.fontSize  > 0) ? item.fontSize  : null;
    const fColor = _safeHex(item.fontColor);
    const iSize  = (item.iconSize  > 0) ? item.iconSize  : null;
    const tRot   = item.textRotation || 0;
    const lblStyle = [
      fSize ? `font-size:${fSize}px` : '',
      fColor ? `color:${fColor}` : '',
      tRot ? `transform:rotate(${tRot}deg);display:inline-block` : ''
    ].filter(Boolean).join(';');
    const iconStyle = iSize ? ` style="font-size:${iSize}px"` : '';
    const iconHtml  = item.hideIcon ? '' : `<span class="special-icon"${iconStyle}>${icon}</span>`;
    const centralBadge = item.isCentral ? `<span class="central-badge" title="פריט מרכזי — שיבוץ ופיזור מתחשבים במיקומו">⭐</span>` : '';
    return `<div class="special-item-inner" style="background:${bg};border-radius:${br};border:${item.isCentral ? '2px solid #ff8c00' : '1.5px solid ' + (item.borderColor||'#aaa')}">
      ${centralBadge}${iconHtml}<span class="special-label"${lblStyle ? ` style="${lblStyle}"` : ''}>${UI.escHtml(item.label || item.type)}</span>
    </div>`;
  }

  /* ── Item context menu ── */
  let _ctxItemId = null;
  let _ctxMenu   = null;

  function _buildCtxMenu() {
    const m = document.createElement('div');
    m.className = 'item-ctx-menu';
    m.innerHTML =
      `<button class="ctx-menu-btn" id="ctxDetails">📋&nbsp; פרטים מלאים</button>
       <hr class="ctx-menu-sep">
       <button class="ctx-menu-btn" id="ctxDuplicate">⧉&nbsp; שכפל</button>
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
       <div class="ctx-inline-row" id="ctxRotRow">
         <span class="ctx-row-lbl" title="סיבוב פריט">↻</span>
         <button id="ctxRotMinus" class="ctx-apply-btn ctx-rot-btn" title="-90°">↺</button>
         <input id="ctxRotInput" class="ctx-inline-input" type="number" min="0" max="359" style="width:46px" placeholder="0°">
         <button id="ctxRotPlus" class="ctx-apply-btn ctx-rot-btn" title="+90°">↻</button>
         <button id="ctxApplyRot" class="ctx-apply-btn" title="שמור">✓</button>
         <button id="ctxResetRot" class="ctx-apply-btn ctx-clear-btn" title="אפס">⊙</button>
       </div>
       <div class="ctx-inline-row" id="ctxTextRotRow">
         <span class="ctx-row-lbl" title="סיבוב טקסט">↺A</span>
         <select id="ctxTextRotSelect" class="ctx-inline-input" style="width:66px;padding:1px 2px">
           <option value="0">0°</option>
           <option value="90">90°</option>
           <option value="180">180°</option>
           <option value="270">270°</option>
         </select>
         <button id="ctxApplyTextRot" class="ctx-apply-btn" title="שמור סיבוב טקסט">✓</button>
       </div>
       <hr class="ctx-menu-sep" id="ctxFontSep">
       <div class="ctx-inline-row" id="ctxFontSizeRow">
         <span class="ctx-row-lbl" title="גודל גופן">Aa</span>
         <input id="ctxFontSizeInput" class="ctx-inline-input" type="number" min="6" max="72" placeholder="אוטומטי">
         <button id="ctxApplyFontSize" class="ctx-apply-btn" title="שמור גודל גופן">✓</button>
         <button id="ctxClearFontSize" class="ctx-apply-btn ctx-clear-btn" title="אפס">✕</button>
       </div>
       <div class="ctx-inline-row" id="ctxFontColorRow">
         <span class="ctx-row-lbl" title="צבע גופן">A</span>
         <input id="ctxFontColorInput" class="ctx-inline-color" type="color">
         <button id="ctxApplyFontColor" class="ctx-apply-btn" title="שמור צבע גופן">✓</button>
         <button id="ctxClearFontColor" class="ctx-apply-btn ctx-clear-btn" title="אפס צבע">✕</button>
       </div>
       <div class="ctx-inline-row" id="ctxIconSizeRow">
         <span class="ctx-row-lbl" title="גודל אייקון">🔡</span>
         <input id="ctxIconSizeInput" class="ctx-inline-input" type="number" min="8" max="120" placeholder="אוטומטי">
         <button id="ctxApplyIconSize" class="ctx-apply-btn" title="שמור גודל אייקון">✓</button>
         <button id="ctxClearIconSize" class="ctx-apply-btn ctx-clear-btn" title="אפס">✕</button>
       </div>
       <div class="ctx-inline-row" id="ctxHideIconRow">
         <span class="ctx-row-lbl" title="הצגת אייקון">👁</span>
         <label style="font-size:12px;cursor:pointer;flex:1"><input type="checkbox" id="ctxHideIconCheck"> הסתר אייקון</label>
         <button id="ctxApplyHideIcon" class="ctx-apply-btn" title="שמור">✓</button>
       </div>
       <div class="ctx-inline-row" id="ctxCentralRow">
         <span class="ctx-row-lbl" title="פריט מרכזי">⭐</span>
         <label style="font-size:12px;cursor:pointer;flex:1"><input type="checkbox" id="ctxCentralCheck"> פריט מרכזי לשיבוץ ופיזור</label>
         <button id="ctxApplyCentral" class="ctx-apply-btn" title="שמור">✓</button>
       </div>
       <button class="ctx-menu-btn ctx-save-all-btn" id="ctxSaveAll">✓&nbsp; שמור וסגור</button>
       <hr class="ctx-menu-sep" id="ctxBulkEditSep" style="display:none">
       <button class="ctx-menu-btn" id="ctxBulkEditBtn" style="display:none">✏️&nbsp; <span id="ctxBulkEditLabel">ערוך נבחרים</span></button>
       <hr class="ctx-menu-sep" id="ctxAlignSep" style="display:none">
       <button class="ctx-menu-btn" id="ctxAlignBtn" style="display:none">⊞&nbsp; יישר/פזר פריטים</button>
       <hr class="ctx-menu-sep">
       <button class="ctx-menu-btn ctx-danger" id="ctxDelete">🗑&nbsp; מחק</button>`;
    document.body.appendChild(m);

    // For non-table items the inline rows stay open so the user can tweak
    // multiple properties before clicking "שמור וסגור". Table items close immediately.
    const _closeIfTable = () => {
      const _it = State.getItem(_ctxItemId);
      if (!_it || _it.type === 'table') _closeCtxMenu();
    };

    m.querySelector('#ctxDetails').onclick = () => {
      if (_ctxItemId) Modals.openItemDetails(_ctxItemId);
      _closeCtxMenu();
    };

    m.querySelector('#ctxDuplicate').onclick = () => {
      if (_ctxItemId) {
        const copy = State.duplicateItem(_ctxItemId);
        if (copy) { selectItem(copy.id); UI.toast('הפריט שוכפל ✓', 'success', 1800); }
      }
      _closeCtxMenu();
    };

    m.querySelector('#ctxApplyText').onclick = _applyCtxText;
    m.querySelector('#ctxTextInput').addEventListener('keydown', e => { if (e.key === 'Enter') _applyCtxText(); });

    m.querySelector('#ctxApplyColor').onclick = () => {
      if (_ctxItemId) {
        State.updateItem(_ctxItemId, { color: m.querySelector('#ctxColorInput').value });
        if (State.getItem(_ctxItemId)?.type === 'table') Guests.render();
      }
      _closeIfTable();
    };

    m.querySelector('#ctxClearColor').onclick = () => {
      if (_ctxItemId) {
        State.updateItem(_ctxItemId, { color: null });
        if (State.getItem(_ctxItemId)?.type === 'table') Guests.render();
      }
      _closeIfTable();
    };

    // Rotation: +90/-90 keep menu open (iterative); input ✓ also keeps open
    m.querySelector('#ctxRotMinus').onclick = () => {
      if (!_ctxItemId) return;
      const cur = State.getItem(_ctxItemId);
      if (!cur) return;
      const newRot = ((cur.rotation || 0) - 90 + 360) % 360;
      State.updateItem(_ctxItemId, { rotation: newRot || null });
      m.querySelector('#ctxRotInput').value = newRot || '';
    };
    m.querySelector('#ctxRotPlus').onclick = () => {
      if (!_ctxItemId) return;
      const cur = State.getItem(_ctxItemId);
      if (!cur) return;
      const newRot = ((cur.rotation || 0) + 90) % 360;
      State.updateItem(_ctxItemId, { rotation: newRot || null });
      m.querySelector('#ctxRotInput').value = newRot || '';
    };
    m.querySelector('#ctxApplyRot').onclick = () => {
      if (!_ctxItemId) return;
      const v = parseInt(m.querySelector('#ctxRotInput').value);
      State.updateItem(_ctxItemId, { rotation: (!isNaN(v) && v > 0) ? (v % 360 || null) : null });
    };
    m.querySelector('#ctxResetRot').onclick = () => {
      if (_ctxItemId) State.updateItem(_ctxItemId, { rotation: null });
      m.querySelector('#ctxRotInput').value = '';
    };
    m.querySelector('#ctxApplyTextRot').onclick = () => {
      if (!_ctxItemId) return;
      const v = parseInt(m.querySelector('#ctxTextRotSelect').value) || 0;
      State.updateItem(_ctxItemId, { textRotation: v || null });
      _closeIfTable();
    };

    m.querySelector('#ctxApplyFontSize').onclick = () => {
      if (_ctxItemId) {
        const v = parseInt(m.querySelector('#ctxFontSizeInput').value);
        State.updateItem(_ctxItemId, { fontSize: (isNaN(v) || v < 1) ? null : v });
      }
      _closeIfTable();
    };
    m.querySelector('#ctxClearFontSize').onclick = () => {
      if (_ctxItemId) State.updateItem(_ctxItemId, { fontSize: null });
      _closeIfTable();
    };
    m.querySelector('#ctxApplyFontColor').onclick = () => {
      if (_ctxItemId) State.updateItem(_ctxItemId, { fontColor: m.querySelector('#ctxFontColorInput').value });
      _closeIfTable();
    };
    m.querySelector('#ctxClearFontColor').onclick = () => {
      if (_ctxItemId) State.updateItem(_ctxItemId, { fontColor: null });
      _closeIfTable();
    };
    m.querySelector('#ctxApplyIconSize').onclick = () => {
      if (_ctxItemId) {
        const v = parseInt(m.querySelector('#ctxIconSizeInput').value);
        State.updateItem(_ctxItemId, { iconSize: (isNaN(v) || v < 1) ? null : v });
      }
      _closeIfTable();
    };
    m.querySelector('#ctxClearIconSize').onclick = () => {
      if (_ctxItemId) State.updateItem(_ctxItemId, { iconSize: null });
      _closeIfTable();
    };
    m.querySelector('#ctxApplyHideIcon').onclick = () => {
      if (!_ctxItemId) return;
      const checked = m.querySelector('#ctxHideIconCheck').checked;
      State.updateItem(_ctxItemId, { hideIcon: checked || null });
      _closeIfTable();
    };
    m.querySelector('#ctxApplyCentral').onclick = () => {
      if (!_ctxItemId) return;
      const checked = m.querySelector('#ctxCentralCheck').checked;
      State.updateItem(_ctxItemId, { isCentral: checked || null });
      // Re-render all tables to update mismatch indicators
      renderAll();
      _closeIfTable();
    };
    m.querySelector('#ctxSaveAll').onclick = () => { _closeCtxMenu(); };

    m.querySelector('#ctxBulkEditBtn').onclick = () => {
      _closeCtxMenu();
      Modals.openBulkEdit();
    };

    m.querySelector('#ctxAlignBtn').onclick = () => {
      _closeCtxMenu();
      Modals.openAlignItems();
    };

    m.querySelector('#ctxDelete').onclick = () => {
      const id = _ctxItemId;
      if (!id) return;
      if (UI.confirmDialog('למחוק פריט זה?')) State.removeItem(id);
      _closeCtxMenu();
    };

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
    const cur = State.getItem(_ctxItemId);
    if (cur?.type === 'table') Guests.render();
    if (!cur || cur.type === 'table') _closeCtxMenu();
    // else: non-table item still exists → keep menu open
  }

  function openCtxMenu(id, viewX, viewY) {
    const item = State.getItem(id);
    if (!item) return;
    _ctxItemId = id;
    if (!_selectedIds.has(id)) selectItem(id);
    if (!_ctxMenu) _ctxMenu = _buildCtxMenu();
    document.getElementById('ctxTextInput').value = item.label || '';
    document.getElementById('ctxColorInput').value =
      item.color || (item.type === 'table' ? '#e3f2fd'
        : (CONFIG.COLORS[item.type] || CONFIG.COLORS.shape || '#cccccc'));
    // Non-table rows: font size/color, icon size, save-all button
    const isSpecial = item.type !== 'table';
    document.getElementById('ctxFontSep').style.display       = isSpecial ? '' : 'none';
    document.getElementById('ctxFontSizeRow').style.display   = isSpecial ? '' : 'none';
    document.getElementById('ctxFontColorRow').style.display  = isSpecial ? '' : 'none';
    document.getElementById('ctxIconSizeRow').style.display   = isSpecial ? '' : 'none';
    document.getElementById('ctxHideIconRow').style.display   = isSpecial ? '' : 'none';
    document.getElementById('ctxSaveAll').style.display       = isSpecial ? '' : 'none';
    // Central toggle: shown for non-table items (tables are not central reference points)
    document.getElementById('ctxCentralRow').style.display    = isSpecial ? '' : 'none';
    if (isSpecial) {
      document.getElementById('ctxFontSizeInput').value  = item.fontSize  || '';
      document.getElementById('ctxIconSizeInput').value  = item.iconSize  || '';
      const safeClr = (item.fontColor && /^#[0-9a-fA-F]{3,8}$/.test(item.fontColor)) ? item.fontColor : '#222222';
      document.getElementById('ctxFontColorInput').value = safeClr;
      document.getElementById('ctxHideIconCheck').checked = !!item.hideIcon;
      document.getElementById('ctxCentralCheck').checked  = !!item.isCentral;
    }
    // Rotation fields (all items)
    document.getElementById('ctxRotInput').value = item.rotation || '';
    document.getElementById('ctxTextRotSelect').value = String(item.textRotation || 0);
    // Bulk edit option (tables only, ≥2)
    const selTables = [..._selectedIds].filter(sid => State.getItem(sid)?.type === 'table');
    const showBulk  = selTables.length >= 2;
    document.getElementById('ctxBulkEditSep').style.display = showBulk ? '' : 'none';
    document.getElementById('ctxBulkEditBtn').style.display = showBulk ? '' : 'none';
    const lbl = document.getElementById('ctxBulkEditLabel');
    if (lbl) lbl.textContent = `ערוך ${selTables.length} שולחנות נבחרים`;
    // Alignment option (any items, ≥2)
    const showAlign = _selectedIds.size >= 2;
    document.getElementById('ctxAlignSep').style.display = showAlign ? '' : 'none';
    document.getElementById('ctxAlignBtn').style.display = showAlign ? '' : 'none';
    if (showAlign) document.getElementById('ctxAlignBtn').textContent = `⊞ יישר/פזר ${_selectedIds.size} פריטים`;
    _ctxMenu.style.display = 'block';
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

  /* ── Selection (single + multi via Ctrl+click) ── */
  let _selectedId = null;
  const _selectedIds = new Set();

  function _updateBulkEditBtn() {
    const btn      = document.getElementById('btnBulkEdit');
    const alignBtn = document.getElementById('btnAlign');
    if (alignBtn) alignBtn.style.display = _selectedIds.size >= 2 ? '' : 'none';
    if (!btn) return;
    const n = [..._selectedIds].filter(id => State.getItem(id)?.type === 'table').length;
    btn.style.display = n >= 1 ? '' : 'none';
    btn.title = `ערוך ${n} שולחן${n !== 1 ? 'ות' : ''} מסומן${n !== 1 ? 'ות' : ''} — Ctrl+לחיצה לסימון מרובה`;
  }

  function selectItem(id) {
    _selectedIds.forEach(sid => document.getElementById(sid)?.classList.remove('selected'));
    _selectedIds.clear();
    _selectedId = id;
    if (id) {
      _selectedIds.add(id);
      document.getElementById(id)?.classList.add('selected');
    }
    _updateBulkEditBtn();
  }

  function toggleSelectItem(id) {
    if (_selectedIds.has(id)) {
      _selectedIds.delete(id);
      document.getElementById(id)?.classList.remove('selected');
      _selectedId = _selectedIds.size > 0 ? [..._selectedIds].at(-1) : null;
    } else {
      _selectedIds.add(id);
      document.getElementById(id)?.classList.add('selected');
      _selectedId = id;
    }
    _updateBulkEditBtn();
  }

  function getSelected()    { return _selectedId; }
  function getSelectedIds() { return [..._selectedIds]; }
  function deselectAll() {
    _selectedIds.forEach(sid => document.getElementById(sid)?.classList.remove('selected'));
    _selectedIds.clear();
    _selectedId = null;
    _updateBulkEditBtn();
  }

  document.addEventListener('keydown', e => {
    if ((e.key === 'Delete' || e.key === 'Backspace') && _selectedIds.size > 0) {
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      const n   = _selectedIds.size;
      const msg = n > 1 ? `למחוק ${n} פריטים נבחרים?` : 'למחוק פריט זה?';
      if (UI.confirmDialog(msg)) {
        const toDelete = [..._selectedIds];
        _selectedIds.clear(); _selectedId = null;
        _updateBulkEditBtn();
        toDelete.forEach(id => State.removeItem(id));
      }
    }
    if (e.key === 'Escape') {
      _closeCtxMenu();
      if (!document.querySelector('.modal-overlay.active')) deselectAll();
    }
  });

  /* ── Drop highlight ── */
  function highlightTable(id, on) {
    document.querySelectorAll('.canvas-item.drop-target').forEach(e => e.classList.remove('drop-target'));
    if (on && id) document.getElementById(id)?.classList.add('drop-target');
  }

  /* ── Flash ── */
  function flashItem(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.remove('flash');
    void el.offsetWidth;
    el.classList.add('flash');
    setTimeout(() => el.classList.remove('flash'), 2500);
  }

  /* ── State sync ── */
  State.on('itemAdded',   item => renderItem(item));
  State.on('itemUpdated', item => refreshItem(item.id));
  State.on('itemRemoved', id   => {
    removeItemEl(id);
    if (_selectedIds.has(id)) {
      _selectedIds.delete(id);
      if (_selectedId === id) _selectedId = _selectedIds.size > 0 ? [..._selectedIds].at(-1) : null;
      _updateBulkEditBtn();
    }
  });
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
    selectItem, toggleSelectItem, getSelected, getSelectedIds, deselectAll,
    highlightTable, flashItem, tableColor,
    distributeRectSeats, renumberTables,
    buildTableSVG, openCtxMenu
  };
})();
