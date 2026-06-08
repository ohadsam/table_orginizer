'use strict';

const ItemNav = (() => {
  let _open  = false;
  let _panel, _list;
  let _tip   = null;

  /* ── Init ── */
  function init() {
    _panel = document.getElementById('itemNavPanel');
    _list  = document.getElementById('itemNavList');
    if (!_panel) return;

    document.getElementById('itemNavToggleBtn').addEventListener('click', _toggle);

    // Sync: full re-render on structural changes (add/update/remove/load)
    State.on('itemAdded',   _renderAll);
    State.on('itemUpdated', _renderAll);
    State.on('itemRemoved', _renderAll);
    State.on('dataLoaded',  _renderAll);

    // Sync: only refresh the color dot on guest assignment/edit changes
    State.on('guestAssigned', ({ tableId, prevTableId }) => {
      _refreshDot(tableId);
      _refreshDot(prevTableId);
    });
    State.on('guestRemoved',  ({ tableId }) => _refreshDot(tableId));
    State.on('guestUpdated',  (guest)       => _refreshDot(guest.tableId));

    _renderAll();
  }

  /* ── Panel toggle ── */
  function _toggle() {
    _open = !_open;
    _panel.classList.toggle('nav-open', _open);
    const btn = document.getElementById('itemNavToggleBtn');
    btn.textContent = _open ? '◀' : '▶';
    btn.title = _open ? 'סגור תפריט פריטים' : 'פתח תפריט פריטים';
  }

  /* ── Collapse (called by canvas before fitAll/focusOnItem) ── */
  function collapse() {
    if (!_open || !_panel) return;
    _open = false;
    _panel.classList.remove('nav-open');
    const btn = document.getElementById('itemNavToggleBtn');
    if (btn) { btn.textContent = '▶'; btn.title = 'פתח תפריט פריטים'; }
  }

  /* ── Render list ── */
  function _renderAll() {
    if (!_list) return;
    _hideTip();   // innerHTML removal doesn't fire mouseleave; dismiss manually
    _list.innerHTML = '';
    const items = [...State.get().items].sort((a, b) => {
      if (a.type === 'table' && b.type !== 'table') return -1;
      if (a.type !== 'table' && b.type === 'table') return  1;
      if (a.type === 'table') return (a.number || 0) - (b.number || 0);
      return 0;
    });
    items.forEach(item => _list.appendChild(_buildEl(item)));
  }

  /* Only update the color dot (cheap, no rebuild) */
  function _refreshDot(id) {
    if (!id || !_list) return;
    const item = State.getItem(id);
    if (!item) return;
    const el = _list.querySelector(`[data-nav-id="${CSS.escape(id)}"]`);
    if (el) el.querySelector('.nav-item-dot').style.background = _itemColor(item);
  }

  /* ── Build a list row element ── */
  function _buildEl(item) {
    const el = document.createElement('div');
    el.className = 'nav-item';
    el.dataset.navId   = item.id;
    el.dataset.navType = item.type;

    const dot = document.createElement('span');
    dot.className = 'nav-item-dot';
    dot.style.background = _itemColor(item);
    if (item.type === 'table' && item.shape === 'circle') dot.style.borderRadius = '50%';

    const lbl = document.createElement('span');
    lbl.className = 'nav-item-label';
    lbl.textContent = _itemLabel(item);

    el.appendChild(dot);
    el.appendChild(lbl);

    // Click → select on canvas + navigate
    el.addEventListener('click', e => {
      e.stopPropagation();
      Items.selectItem(item.id);
      Canvas.focusOnItem(item.id);
    });

    // Right-click → open context menu at cursor position
    el.addEventListener('contextmenu', e => {
      e.preventDefault();
      e.stopPropagation();
      Items.openCtxMenu(item.id, e.clientX, e.clientY);
    });

    // Hover tooltip
    el.addEventListener('mouseenter', e => _showTip(item, e));
    el.addEventListener('mousemove',  e => _moveTip(e));
    el.addEventListener('mouseleave', ()  => _hideTip());

    return el;
  }

  /* ── Helpers ── */
  function _itemColor(item) {
    if (item.type === 'table') {
      return item.color || Items.tableColor(State.getTableOccupancy(item.id), item.seats);
    }
    return item.color || CONFIG.COLORS[item.type] || CONFIG.COLORS.shape || '#aaa';
  }

  function _itemLabel(item) {
    if (item.type === 'table') {
      const num = item.number != null ? `שולחן ${item.number}` : 'שולחן';
      return item.label ? `${num} — ${item.label}` : num;
    }
    const defaults = { dancefloor: 'רחבת ריקודים', dj: 'עמדת DJ', door: 'כניסה', shape: 'צורה' };
    return item.label || defaults[item.type] || item.type;
  }

  /* ── Tooltip ── */
  function _getTip() {
    if (!_tip) {
      _tip = document.createElement('div');
      _tip.className = 'nav-item-tooltip';
      _tip.style.display = 'none';
      document.body.appendChild(_tip);
    }
    return _tip;
  }

  function _showTip(item, e) {
    const freshItem = State.getItem(item.id) || item;
    const tip = _getTip();
    tip.innerHTML = _tipHtml(freshItem);
    tip.style.display = 'block';
    _moveTip(e);
  }

  function _moveTip(e) {
    if (!_tip || _tip.style.display === 'none') return;
    const tw   = _tip.offsetWidth  || 190;
    const th   = _tip.offsetHeight || 130;
    const left = Math.max(8, Math.min(e.clientX + 18, window.innerWidth  - tw - 8));
    const top  = Math.max(8, Math.min(e.clientY - th / 2, window.innerHeight - th - 8));
    _tip.style.left = left + 'px';
    _tip.style.top  = top  + 'px';
  }

  function _hideTip() {
    if (_tip) _tip.style.display = 'none';
  }

  function _tipHtml(item) {
    const label = UI.escHtml(_itemLabel(item));
    if (item.type === 'table') {
      const occ    = State.getTableOccupancy(item.id);
      const maxDim = Math.max(item.width, item.height);
      const scale  = maxDim > 0 ? 140 / maxDim : 1;
      const tw     = Math.round(item.width  * scale);
      const th     = Math.round(item.height * scale);
      const svgStr = Items.buildTableSVG(item);
      return `<div class="nav-tip-svg" style="width:${tw}px;height:${th}px;overflow:hidden">
                <div style="transform:scale(${scale.toFixed(4)});transform-origin:0 0;display:inline-block;line-height:0">${svgStr}</div>
              </div>
              <div class="nav-tip-label">${label}</div>
              <div class="nav-tip-occ">${occ}/${item.seats} מושבים</div>`;
    }
    const icons = { dancefloor: '🕺', dj: '🎵', door: '🚪' };
    const icon  = icons[item.type] || '⬜';
    const color = _itemColor(item);
    return `<div class="nav-tip-special" style="background:${color}">${icon}</div>
            <div class="nav-tip-label">${label}</div>`;
  }

  return { init, collapse };
})();
