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

  /* ═══════════════════════════════ RENUMBER ═══════════════════════════════ */

  function renumberTables() {
    const tables = State.getTables();
    if (!tables.length) { UI.toast('אין שולחנות למספור', 'info', 1800); return; }

    // Sort by visual position: top-to-bottom rows, then right-to-left within a row (RTL hall)
    const ROW_SNAP = 60;
    const sorted = [...tables].sort((a, b) => {
      const rowDiff = a.y - b.y;
      if (Math.abs(rowDiff) > ROW_SNAP) return rowDiff;
      return b.x - a.x; // RTL: rightmost (larger x) gets lower number in each row
    });

    Guests.startBatch();
    sorted.forEach((t, i) => {
      if (t.number !== i + 1) State.updateItem(t.id, { number: i + 1 });
    });
    Guests.endBatch();

    UI.toast(`שולחנות מוספרו מחדש 1–${sorted.length} ✓`, 'success', 2000);
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
      el.addEventListener('click', e => { e.stopPropagation(); selectItem(item.id); });
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

    el.dataset.shape = item.shape || '';
    el.style.left    = (item.x - item.width  / 2) + 'px';
    el.style.top     = (item.y - item.height / 2) + 'px';
    el.style.width   = item.width  + 'px';
    el.style.height  = item.height + 'px';

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
    _selectedId = null;
    room().innerHTML = '';
    State.get().items.forEach(renderItem);
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
    if (!guests.length) {
      html += `<div class="tooltip-empty">אין מוזמנים משובצים</div>`;
    } else {
      const MAX = 14;
      html += guests.slice(0, MAX).map(g =>
        `<div class="tooltip-guest-row">
          <span>${UI.escHtml(g.name)}</span>
          <span class="tooltip-guest-count">${g.adults}${g.children ? '+' + g.children : ''}</span>
        </div>`
      ).join('');
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

  /* ── SVG table (with scaled fonts and guest rows) ── */
  function buildTableSVG(item) {
    const W = item.width, H = item.height;
    const guests    = State.getTableGuests(item.id);
    const occupancy = State.getTableOccupancy(item.id);
    const hasSpace  = occupancy <= item.seats;
    const bgColor   = item.color || tableColor(occupancy, item.seats);
    const R_seat    = CONFIG.SEAT_RADIUS;
    const minDim    = Math.min(W, H);

    // Scaled font sizes (base calibrated at 130px table)
    const stt       = State.get().settings;
    const scale     = minDim / 130;
    const numFont   = item.fontSize || stt.fontNumberSize   || Math.max(10, Math.min(24, Math.round(15 * scale)));
    const labelFont = stt.fontLabelSize    || Math.max(7,  Math.min(14, Math.round(10 * scale)));
    const guestFont = stt.fontGuestSize    || Math.max(6,  Math.min(11, Math.round(8  * scale)));
    const occuFont  = stt.fontOccupancySize || Math.max(6, Math.min(9,  Math.round(7  * scale)));
    const numColor   = stt.fontNumberColor   || '#1a237e';
    const labelColor = stt.fontLabelColor    || '#37474f';
    const guestColor = stt.fontGuestColor    || '#546e7a';
    const occuColor  = stt.fontOccupancyColor || '#888888';
    const lineH      = guestFont + 2.5;

    let svgInner = '';

    if (item.shape === 'circle') {
      const sR = Math.min(W, H) / 2 - R_seat - 2;
      const r  = Math.max(10, sR - R_seat - 4);
      const cx = W / 2, cy = H / 2;

      svgInner += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${bgColor}" stroke="#888" stroke-width="1.5"/>`;
      for (let i = 0; i < item.seats; i++) {
        const ang  = (i / item.seats) * 2 * Math.PI - Math.PI / 2;
        const sx   = cx + sR * Math.cos(ang);
        const sy   = cy + sR * Math.sin(ang);
        const fill = i < occupancy ? (hasSpace ? CONFIG.COLORS.seatOccupied : CONFIG.COLORS.seatOver) : CONFIG.COLORS.seatEmpty;
        svgInner += `<circle cx="${sx.toFixed(1)}" cy="${sy.toFixed(1)}" r="${R_seat}" fill="${fill}" stroke="#fff" stroke-width="1.2"/>`;
      }

      // Occupancy ratio (small, top of circle body)
      svgInner += `<text x="${cx}" y="${cy - r + occuFont + 1}" text-anchor="middle" font-size="${occuFont}" fill="${occuColor}">${occupancy}/${item.seats}</text>`;

      // Table number — large, bold, prominent
      const numY = cy - (item.label ? numFont * 0.45 : numFont * 0.2);
      svgInner += `<text x="${cx}" y="${numY}" text-anchor="middle" dominant-baseline="middle" font-size="${numFont}" font-weight="800" fill="${numColor}">${item.number || ''}</text>`;

      // Label below number (with visual gap)
      let textY;
      if (item.label) {
        textY = numY + numFont * 0.65 + labelFont * 0.35 + 3;
        svgInner += `<text x="${cx}" y="${textY}" text-anchor="middle" dominant-baseline="middle" font-size="${labelFont}" font-weight="600" fill="${labelColor}">${UI.escHtml(item.label)}</text>`;
        textY += labelFont * 0.65 + 14;
      } else {
        textY = numY + numFont * 0.6 + 2;
      }

      // Guest names — one per line; reserve one slot for overflow indicator if needed
      const rawMaxG = Math.max(0, Math.floor((cy + r - 5 - textY) / lineH));
      const maxG = (guests.length > rawMaxG) ? Math.max(0, rawMaxG - 1) : rawMaxG;
      guests.slice(0, maxG).forEach(g => {
        const nm = g.name.length > 12 ? g.name.slice(0, 11) + '…' : g.name;
        svgInner += `<text x="${cx}" y="${textY}" text-anchor="middle" font-size="${guestFont}" fill="${guestColor}">${UI.escHtml(nm)}</text>`;
        textY += lineH;
      });
      const extra = guests.length - maxG;
      if (extra > 0) svgInner += `<text x="${cx}" y="${textY}" text-anchor="middle" font-size="${occuFont}" fill="${occuColor}">+${extra}</text>`;

    } else {
      // Rectangle / square
      const pad = R_seat + 4;
      const rw  = W - pad * 2, rh = H - pad * 2;
      svgInner += `<rect x="${pad}" y="${pad}" width="${rw}" height="${rh}" rx="6" fill="${bgColor}" stroke="#888" stroke-width="1.5"/>`;
      const seatsArr = distributeRectSeats(item.seats, rw, rh);
      let sIdx = 0;
      for (const [sx, sy] of seatsArr) {
        const fill = sIdx < occupancy ? (hasSpace ? CONFIG.COLORS.seatOccupied : CONFIG.COLORS.seatOver) : CONFIG.COLORS.seatEmpty;
        svgInner += `<circle cx="${(pad + sx).toFixed(1)}" cy="${(pad + sy).toFixed(1)}" r="${R_seat}" fill="${fill}" stroke="#fff" stroke-width="1.2"/>`;
        sIdx++;
      }
      const cx = W / 2, cy = H / 2;

      // Occupancy (small, top of rect interior)
      svgInner += `<text x="${cx}" y="${pad + occuFont + 1}" text-anchor="middle" font-size="${occuFont}" fill="${occuColor}">${occupancy}/${item.seats}</text>`;

      // Table number — large, bold
      const numY = cy - (item.label ? numFont * 0.45 : numFont * 0.2);
      svgInner += `<text x="${cx}" y="${numY}" text-anchor="middle" dominant-baseline="middle" font-size="${numFont}" font-weight="800" fill="${numColor}">${item.number || ''}</text>`;

      // Label
      let textY;
      if (item.label) {
        textY = numY + numFont * 0.65 + labelFont * 0.35 + 3;
        svgInner += `<text x="${cx}" y="${textY}" text-anchor="middle" dominant-baseline="middle" font-size="${labelFont}" font-weight="600" fill="${labelColor}">${UI.escHtml(item.label)}</text>`;
        textY += labelFont * 0.65 + 14;
      } else {
        textY = numY + numFont * 0.6 + 2;
      }

      // Guest names — one per line; reserve one slot for overflow indicator if needed
      const availH  = H - pad - 4 - textY;
      const rawMaxG = Math.max(0, Math.floor(availH / lineH));
      const maxG    = (guests.length > rawMaxG) ? Math.max(0, rawMaxG - 1) : rawMaxG;
      guests.slice(0, maxG).forEach(g => {
        const nm = g.name.length > 16 ? g.name.slice(0, 15) + '…' : g.name;
        svgInner += `<text x="${cx}" y="${textY}" text-anchor="middle" font-size="${guestFont}" fill="${guestColor}">${UI.escHtml(nm)}</text>`;
        textY += lineH;
      });
      const extra = guests.length - maxG;
      if (extra > 0) svgInner += `<text x="${cx}" y="${textY}" text-anchor="middle" font-size="${occuFont}" fill="${occuColor}">+${extra}</text>`;
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
    const icons = { dancefloor: '🕺', dj: '🎵', door: '🚪' };
    const icon  = icons[item.type] || '⬛';
    const bg    = item.color || CONFIG.COLORS[item.type] || CONFIG.COLORS.shape;
    const br    = item.shape === 'circle' ? '50%' : '8px';
    const _safeHex = c => (c && /^#[0-9a-fA-F]{3,8}$/.test(c)) ? c : null;
    const fSize  = (item.fontSize  > 0) ? item.fontSize  : null;
    const fColor = _safeHex(item.fontColor);
    const iSize  = (item.iconSize  > 0) ? item.iconSize  : null;
    const lblStyle  = [fSize ? `font-size:${fSize}px` : '', fColor ? `color:${fColor}` : ''].filter(Boolean).join(';');
    const iconStyle = iSize ? ` style="font-size:${iSize}px"` : '';
    return `<div class="special-item-inner" style="background:${bg};border-radius:${br};border:1.5px solid ${item.borderColor||'#aaa'}">
      <span class="special-icon"${iconStyle}>${icon}</span>
      <span class="special-label"${lblStyle ? ` style="${lblStyle}"` : ''}>${UI.escHtml(item.label || item.type)}</span>
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
       <button class="ctx-menu-btn ctx-save-all-btn" id="ctxSaveAll">✓&nbsp; שמור וסגור</button>
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
    m.querySelector('#ctxSaveAll').onclick = () => { _closeCtxMenu(); };

    m.querySelector('#ctxDelete').onclick = () => {
      const id = _ctxItemId;
      if (!id) return;
      if (UI.confirmDialog('למחוק פריט זה?')) {
        State.removeItem(id);
        if (_selectedId === id) deselectAll();
      }
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
    selectItem(id);
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
    document.getElementById('ctxSaveAll').style.display       = isSpecial ? '' : 'none';
    if (isSpecial) {
      document.getElementById('ctxFontSizeInput').value  = item.fontSize  || '';
      document.getElementById('ctxIconSizeInput').value  = item.iconSize  || '';
      const safeClr = (item.fontColor && /^#[0-9a-fA-F]{3,8}$/.test(item.fontColor)) ? item.fontColor : '#222222';
      document.getElementById('ctxFontColorInput').value = safeClr;
    }
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
    highlightTable, flashItem, tableColor,
    distributeRectSeats, renumberTables,
    buildTableSVG, openCtxMenu
  };
})();
