'use strict';

const Guests = (() => {
  let _searchText     = '';
  let _filterTags     = new Set();
  let _tagFilterMode  = 'or';      // 'or' | 'and'
  let _filterAssigned = null;      // null=all, true=only assigned, false=only unassigned
  let _filterTableNum = '';        // '' = no filter, else table number string
  let _filterProximity = null;     // null=all | proximity key | 'none'
  let _sortMode       = 'default'; // default | nameAsc | nameDesc | seatedFirst | unseatedFirst | custom | nearDanceFirst | farDanceFirst | tableNumAsc | tableNumDesc
  let _groupMode      = 'none';    // none | byTag | byTable | byProximity
  let _collapsed      = new Set();
  let _customOrder    = [];        // guest IDs in user-defined display order
  let _batching       = false;

  function startBatch() { _batching = true; }
  function endBatch()   { _batching = false; render(); }

  /* ── Filter + Sort helpers ── */

  function _applyFilters(guests) {
    const search = _searchText.toLowerCase();
    return guests.filter(g => {
      if (search && !g.name.toLowerCase().includes(search)) return false;
      if (_filterTags.size > 0) {
        const gTags = g.tags || [];
        if (_tagFilterMode === 'and') {
          if (![..._filterTags].every(t => gTags.includes(t))) return false;
        } else {
          if (!gTags.some(t => _filterTags.has(t))) return false;
        }
      }
      if (_filterAssigned === true  && !g.tableId) return false;
      if (_filterAssigned === false &&  g.tableId) return false;
      if (_filterTableNum) {
        const tbl = g.tableId ? State.getItem(g.tableId) : null;
        if (!tbl || String(tbl.number) !== _filterTableNum) return false;
      }
      if (_filterProximity !== null) {
        const prox = g.proximity || [];
        if (_filterProximity === 'none') {
          if (prox.length > 0) return false;
        } else {
          if (!prox.includes(_filterProximity)) return false;
        }
      }
      return true;
    });
  }

  function _applySort(guests) {
    const arr = [...guests];
    switch (_sortMode) {
      case 'nameAsc':       return arr.sort((a, b) => a.name.localeCompare(b.name, 'he'));
      case 'nameDesc':      return arr.sort((a, b) => b.name.localeCompare(a.name, 'he'));
      case 'seatedFirst':   return arr.sort((a, b) => (b.tableId ? 1 : 0) - (a.tableId ? 1 : 0));
      case 'unseatedFirst': return arr.sort((a, b) => (a.tableId ? 1 : 0) - (b.tableId ? 1 : 0));
      case 'nearDanceFirst': return arr.sort((a, b) => {
        const aH = (a.proximity || []).includes('nearDance') ? 1 : 0;
        const bH = (b.proximity || []).includes('nearDance') ? 1 : 0;
        return bH - aH;
      });
      case 'farDanceFirst': return arr.sort((a, b) => {
        const aH = (a.proximity || []).includes('farDance') ? 1 : 0;
        const bH = (b.proximity || []).includes('farDance') ? 1 : 0;
        return bH - aH;
      });
      case 'tableNumAsc': return arr.sort((a, b) => {
        const nA = a.tableId ? (State.getItem(a.tableId)?.number ?? 0) : 0;
        const nB = b.tableId ? (State.getItem(b.tableId)?.number ?? 0) : 0;
        return nA !== nB ? nA - nB : a.name.localeCompare(b.name, 'he');
      });
      case 'tableNumDesc': return arr.sort((a, b) => {
        const nA = a.tableId ? (State.getItem(a.tableId)?.number ?? 0) : 0;
        const nB = b.tableId ? (State.getItem(b.tableId)?.number ?? 0) : 0;
        return nA !== nB ? nB - nA : a.name.localeCompare(b.name, 'he');
      });
      case 'custom': {
        if (!_customOrder.length) return arr;
        const idx = new Map(_customOrder.map((id, i) => [id, i]));
        return arr.sort((a, b) => (idx.get(a.id) ?? 999999) - (idx.get(b.id) ?? 999999));
      }
      default: return arr;
    }
  }

  /* ── Main render ── */

  function render() {
    if (_batching) return;
    const listEl = document.getElementById('guestsList');
    if (!listEl) return;
    const state    = State.get();
    let filtered   = _applyFilters(state.guests);
    filtered       = _applySort(filtered);

    if (!filtered.length) {
      listEl.innerHTML = `<div class="empty-list">${state.guests.length ? 'לא נמצאו תוצאות' : 'אין מוזמנים עדיין'}</div>`;
      _updateClearBtn();
      return;
    }

    if (_groupMode === 'byTag')              _renderByTag(listEl, filtered, state);
    else if (_groupMode === 'byTable')       _renderByTable(listEl, filtered, state);
    else if (_groupMode === 'byProximity')   _renderByProximity(listEl, filtered, state);
    else _renderFlat(listEl, filtered, state);

    _updateClearBtn();
  }

  function _renderFlat(listEl, filtered, state) {
    listEl.innerHTML = filtered.map(g => buildGuestCard(g, state)).join('');
    _bindCardEvents(filtered, listEl);
  }

  function _renderByTag(listEl, filtered, state) {
    const tagMap = {};
    const seen   = [];
    filtered.forEach(g => {
      (g.tags || []).forEach(t => {
        if (!tagMap[t]) { tagMap[t] = []; seen.push(t); }
        tagMap[t].push(g);
      });
    });
    const untagged = filtered.filter(g => !(g.tags || []).length);

    let html = '';
    [...seen, '__untagged'].forEach(key => {
      const grp = key === '__untagged' ? untagged : (tagMap[key] || []);
      if (!grp.length) return;
      const lbl      = key === '__untagged' ? 'ללא תגיות' : key;
      const collapsed = _collapsed.has('tag:' + key);
      html += _groupSection('tag:' + key, lbl, grp.length, collapsed,
        grp.map(g => buildGuestCard(g, state)).join(''));
    });
    listEl.innerHTML = html;
    _bindGroupToggle(listEl);
    _bindCardEvents(filtered, listEl);
  }

  function _renderByTable(listEl, filtered, state) {
    const tableMap = {};
    const unassigned = [];
    filtered.forEach(g => {
      if (g.tableId) {
        if (!tableMap[g.tableId]) tableMap[g.tableId] = [];
        tableMap[g.tableId].push(g);
      } else {
        unassigned.push(g);
      }
    });

    const sortedIds = Object.keys(tableMap).sort((a, b) => {
      const na = State.getItem(a)?.number ?? 999;
      const nb = State.getItem(b)?.number ?? 999;
      return na - nb;
    });

    let html = '';
    sortedIds.forEach(tid => {
      const tbl = State.getItem(tid);
      const lbl = tbl
        ? `שולחן ${tbl.number}${tbl.label ? ' — ' + tbl.label : ''}`
        : 'שולחן ?';
      const collapsed = _collapsed.has('table:' + tid);
      html += _groupSection('table:' + tid, lbl, tableMap[tid].length, collapsed,
        tableMap[tid].map(g => buildGuestCard(g, state)).join(''));
    });
    if (unassigned.length) {
      const collapsed = _collapsed.has('table:__unassigned');
      html += _groupSection('table:__unassigned', 'לא שובצו', unassigned.length, collapsed,
        unassigned.map(g => buildGuestCard(g, state)).join(''));
    }
    listEl.innerHTML = html;
    _bindGroupToggle(listEl);
    _bindCardEvents(filtered, listEl);
  }

  function _renderByProximity(listEl, filtered, state) {
    const proxKeys = Object.keys(CONFIG.PROXIMITY);
    const groups = {};
    proxKeys.forEach(k => { groups[k] = []; });
    const noPreference = [];

    filtered.forEach(g => {
      const prox = g.proximity || [];
      if (prox.length === 0) {
        noPreference.push(g);
      } else {
        let hasKnown = false;
        prox.forEach(k => {
          if (groups[k]) { groups[k].push(g); hasKnown = true; }
        });
        if (!hasKnown) noPreference.push(g);
      }
    });

    let html = '';
    proxKeys.forEach(key => {
      const grp = groups[key];
      if (!grp.length) return;
      const cfg = CONFIG.PROXIMITY[key];
      const lbl = `${cfg.icon} ${cfg.label}`;
      const collapsed = _collapsed.has('prox:' + key);
      html += _groupSection('prox:' + key, lbl, grp.length, collapsed,
        grp.map(g => buildGuestCard(g, state)).join(''));
    });
    if (noPreference.length) {
      const collapsed = _collapsed.has('prox:__none');
      html += _groupSection('prox:__none', 'ללא העדפה', noPreference.length, collapsed,
        noPreference.map(g => buildGuestCard(g, state)).join(''));
    }
    listEl.innerHTML = html;
    _bindGroupToggle(listEl);
    _bindCardEvents(filtered, listEl);
  }

  function _groupSection(key, label, count, collapsed, bodyHtml) {
    const safeKey = UI.escHtml(key);
    return `<div class="guest-group-section${collapsed ? ' collapsed' : ''}" data-group-key="${safeKey}">
      <div class="guest-group-header" data-toggle-group="${safeKey}">
        <span>${UI.escHtml(label)}<span class="guest-group-count">(${count})</span></span>
        <span class="guest-group-toggle"></span>
      </div>
      <div class="guest-group-body">${bodyHtml}</div>
    </div>`;
  }

  function _bindGroupToggle(listEl) {
    listEl.querySelectorAll('[data-toggle-group]').forEach(btn => {
      btn.addEventListener('click', () => {
        const key     = btn.dataset.toggleGroup;
        const section = listEl.querySelector(`[data-group-key="${CSS.escape(key)}"]`);
        if (!section) return;
        if (_collapsed.has(key)) { _collapsed.delete(key); section.classList.remove('collapsed'); }
        else                     { _collapsed.add(key);    section.classList.add('collapsed'); }
      });
    });
  }

  function _bindCardEvents(filtered, listEl) {
    filtered.forEach(g => {
      // Use querySelectorAll so all occurrences (e.g. multi-tag groups) are wired
      listEl.querySelectorAll(`[data-guest-id="${g.id}"]`).forEach(el => {
        Drag.bindGuestDrag(el, g.id);
        el.querySelector('.btn-edit-guest')?.addEventListener('click', e => {
          e.stopPropagation(); Modals.openEditGuest(g.id);
        });
        el.querySelector('.btn-remove-guest')?.addEventListener('click', e => {
          e.stopPropagation();
          if (UI.confirmDialog(`למחוק את "${g.name}"?`)) State.removeGuest(g.id);
        });
        el.querySelector('.btn-unassign-guest')?.addEventListener('click', e => {
          e.stopPropagation(); State.assignGuest(g.id, null);
        });
        el.querySelector('.btn-find-table')?.addEventListener('click', e => {
          e.stopPropagation(); Modals.openFindTable(g.id);
        });
        el.querySelector('.btn-dep-guest')?.addEventListener('click', e => {
          e.stopPropagation(); Modals.openGuestDependencies(g.id);
        });

        // Drag reorder: draggable is off by default; handle pointerdown enables it
        const handle = el.querySelector('.guest-reorder-handle');
        if (handle) {
          handle.addEventListener('pointerdown', e => {
            e.stopPropagation();
            el.draggable = true;
          });
          el.addEventListener('dragstart', e => {
            e.dataTransfer.setData('application/guest-reorder', g.id);
            e.dataTransfer.effectAllowed = 'move';
            setTimeout(() => el.classList.add('drag-source'), 0);
          });
          el.addEventListener('dragend', () => {
            el.draggable = false;
            el.classList.remove('drag-source');
          });
          el.addEventListener('dragover', e => {
            if (!e.dataTransfer.types.includes('application/guest-reorder')) return;
            e.preventDefault();
            el.classList.add('drag-over');
          });
          el.addEventListener('dragleave', () => el.classList.remove('drag-over'));
          el.addEventListener('drop', e => {
            e.preventDefault();
            el.classList.remove('drag-over');
            const srcId = e.dataTransfer.getData('application/guest-reorder');
            if (!srcId || srcId === g.id) return;
            _moveGuestBefore(srcId, g.id);
          });
        }
      });
    });
  }

  function _moveGuestBefore(srcId, targetId) {
    // Ensure custom order is seeded from current state
    if (!_customOrder.length) {
      _customOrder = State.get().guests.map(g => g.id);
    }
    const from = _customOrder.indexOf(srcId);
    if (from === -1) _customOrder.push(srcId);
    else _customOrder.splice(from, 1);
    let to = _customOrder.indexOf(targetId);
    if (to === -1) to = _customOrder.length;
    _customOrder.splice(to, 0, srcId);
    _sortMode = 'custom';
    _updateSortUI();
    render();
  }

  /* ── Build guest card HTML ── */
  function buildGuestCard(g, state) {
    const table    = g.tableId ? State.getItem(g.tableId) : null;
    const tableNum = table?.number ?? '?';
    const tableClr = (table?.color && /^#[0-9a-fA-F]{3,8}$/.test(table.color)) ? table.color : null;
    const tags     = (g.tags || []).map(t => UI.tagBadge(t)).join('');
    const prox     = (g.proximity || [])
      .map(k => CONFIG.PROXIMITY[k]
        ? `<span class="prox-badge" title="${CONFIG.PROXIMITY[k].label}">${CONFIG.PROXIMITY[k].icon}</span>` : '')
      .join('');
    const splitBadge = g.splitOf
      ? `<span class="split-badge" title="כרטיס זה נוצר מפיצול">⛓ פוצל</span>` : '';
    const badgeStyle = tableClr ? ` style="background:${tableClr}"` : '';
    const assigned = g.tableId
      ? `<span class="guest-table-badge"${badgeStyle} title="לחץ על הכרטיס למעבר לשולחן">שולחן ${tableNum}${table?.label ? ' — ' + UI.escHtml(table.label) : ''}</span>` : '';
    const unassignBtn = g.tableId
      ? `<button class="btn-icon-xs btn-unassign-guest" title="הסר שיבוץ">✕</button>` : '';
    const colorStyle = tableClr ? `border-inline-end: 4px solid ${tableClr};` : '';
    return `
<div data-guest-id="${g.id}" class="guest-card ${g.tableId ? 'assigned' : ''}" draggable="false" style="${colorStyle}">
  <div class="guest-card-header">
    <span class="guest-reorder-handle" title="גרור לסידור מחדש">⠿</span>
    <span class="guest-name">${UI.escHtml(g.name)} ${prox}${splitBadge}</span>
    <div class="guest-actions">
      ${unassignBtn}
      <button class="btn-icon-xs btn-find-table"   title="מצא שולחן פנוי עבור מוזמן זה">🔍</button>
      <button class="btn-icon-xs btn-dep-guest"    title="קשרים ותלויות של המוזמן">🔗</button>
      <button class="btn-icon-xs btn-edit-guest"   title="עריכת פרטי המוזמן">✏️</button>
      <button class="btn-icon-xs btn-remove-guest" title="מחיקת המוזמן מהרשימה">🗑</button>
    </div>
  </div>
  <div class="guest-card-body">
    <span class="guest-count">👥 ${g.adults} מבוגרים${g.children ? ` + ${g.children} ילדים` : ''}</span>
    ${assigned}
  </div>
  ${tags ? `<div class="guest-tags">${tags}</div>` : ''}
  ${g.notes ? `<div class="guest-notes">${UI.escHtml(g.notes)}</div>` : ''}
</div>`;
  }

  /* ── Tag filter bar ── */
  function renderTagFilter() {
    const bar = document.getElementById('tagsFilter');
    if (!bar) return;
    const tags = State.get().tags;

    const tagBtns = tags.map(t => {
      const color  = UI.tagColor(t);
      const active = _filterTags.has(t);
      return `<button class="tag-filter-btn ${active ? 'active' : ''}" data-tag="${UI.escHtml(t)}"
        style="color:${color};border-color:${color}${active ? ';background:' + color + '22' : ''}">${UI.escHtml(t)}</button>`;
    }).join('');

    // AND/OR mode toggle — shown only when 2+ tags are selected
    const modeBtns = _filterTags.size >= 2 ? `
      <button class="tag-mode-btn ${_tagFilterMode === 'or'  ? 'active' : ''}" data-tag-mode="or"  title="הצג מוזמנים עם לפחות אחת מהתגיות הנבחרות">OR</button>
      <button class="tag-mode-btn ${_tagFilterMode === 'and' ? 'active' : ''}" data-tag-mode="and" title="הצג מוזמנים עם כל התגיות הנבחרות">AND</button>
    ` : '';

    bar.innerHTML = tagBtns + modeBtns;

    bar.querySelectorAll('.tag-filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const tag = btn.dataset.tag;
        _filterTags.has(tag) ? _filterTags.delete(tag) : _filterTags.add(tag);
        if (_filterTags.size < 2) _tagFilterMode = 'or';
        renderTagFilter();
        render();
      });
    });
    bar.querySelectorAll('.tag-mode-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        _tagFilterMode = btn.dataset.tagMode;
        renderTagFilter();
        render();
      });
    });
  }

  /* ── Guest controls (sort / filter / group) ── */

  function renderControls() {
    const wrap = document.getElementById('guestsControls');
    if (!wrap) return;

    const proxFilterBtns = Object.entries(CONFIG.PROXIMITY).map(([key, cfg]) =>
      `<button class="btn-xs-filter ${_filterProximity === key ? 'active' : ''}" data-proximity="${key}" title="${cfg.label}">${cfg.icon} ${cfg.label}</button>`
    ).join('');

    wrap.innerHTML = `
      <div class="guests-controls-row">
        <span class="guests-controls-label">סדר:</span>
        <button class="btn-xs-filter ${_sortMode==='default'?'active':''}"            data-sort="default">כברירה</button>
        <button class="btn-xs-filter ${_sortMode==='nameAsc'?'active':''}"            data-sort="nameAsc">א–ת</button>
        <button class="btn-xs-filter ${_sortMode==='tableNumAsc'?'active':''}"        data-sort="tableNumAsc"  title="מיון לפי מספר שולחן עולה — ללא שיבוץ בהתחלה">שולחן ↑</button>
        <button class="btn-xs-filter ${_sortMode==='tableNumDesc'?'active':''}"       data-sort="tableNumDesc" title="מיון לפי מספר שולחן יורד — ללא שיבוץ בסוף">שולחן ↓</button>
        <button class="btn-xs-filter ${_sortMode==='seatedFirst'?'active-success active':''}"    data-sort="seatedFirst">משובצים ↑</button>
        <button class="btn-xs-filter ${_sortMode==='unseatedFirst'?'active-warning active':''}"  data-sort="unseatedFirst">לא שובצו ↑</button>
        <button class="btn-xs-filter ${_sortMode==='nearDanceFirst'?'active':''}"     data-sort="nearDanceFirst" title="קרובי רחבה ראשונים">🕺↑</button>
        <button class="btn-xs-filter ${_sortMode==='farDanceFirst'?'active':''}"      data-sort="farDanceFirst"  title="רחוקי רחבה ראשונים">🤫↑</button>
      </div>
      <div class="guests-controls-row">
        <span class="guests-controls-label">קבץ:</span>
        <button class="btn-xs-filter ${_groupMode==='none'?'active':''}"           data-group="none">ללא</button>
        <button class="btn-xs-filter ${_groupMode==='byTag'?'active':''}"          data-group="byTag">לפי תגית</button>
        <button class="btn-xs-filter ${_groupMode==='byTable'?'active':''}"        data-group="byTable">לפי שולחן</button>
        <button class="btn-xs-filter ${_groupMode==='byProximity'?'active':''}"    data-group="byProximity">לפי רחבה</button>
      </div>
      <div class="guests-controls-row">
        <span class="guests-controls-label">סינון:</span>
        <button class="btn-xs-filter ${_filterAssigned===null?'active':''}"  data-assigned="null">הכל</button>
        <button class="btn-xs-filter ${_filterAssigned===true?'active-success active':''}"  data-assigned="true">שובץ</button>
        <button class="btn-xs-filter ${_filterAssigned===false?'active-warning active':''}" data-assigned="false">לא שובץ</button>
        <input class="filter-table-input" id="filterTableNum" type="number" min="1" placeholder="שולחן #" value="${_filterTableNum}" title="סנן לפי מספר שולחן">
        <button class="btn-clear-filters${(_filterAssigned!==null||_filterTableNum||_filterTags.size>0||_searchText||_filterProximity!==null)?' visible':''}" id="btnClearFilters" title="נקה סינונים">✕ נקה</button>
      </div>
      <div class="guests-controls-row">
        <span class="guests-controls-label">רחבה:</span>
        <button class="btn-xs-filter ${_filterProximity===null?'active':''}"           data-proximity="null">הכל</button>
        ${proxFilterBtns}
        <button class="btn-xs-filter ${_filterProximity==='none'?'active-warning active':''}" data-proximity="none">ללא העדפה</button>
      </div>`;

    wrap.querySelectorAll('[data-sort]').forEach(btn => {
      btn.addEventListener('click', () => {
        _sortMode = btn.dataset.sort;
        if (_sortMode !== 'custom') _customOrder = [];
        renderControls();
        render();
      });
    });
    wrap.querySelectorAll('[data-group]').forEach(btn => {
      btn.addEventListener('click', () => {
        _groupMode = btn.dataset.group;
        renderControls();
        render();
      });
    });
    wrap.querySelectorAll('[data-assigned]').forEach(btn => {
      btn.addEventListener('click', () => {
        const v = btn.dataset.assigned;
        _filterAssigned = v === 'null' ? null : v === 'true';
        renderControls();
        render();
      });
    });
    wrap.querySelectorAll('[data-proximity]').forEach(btn => {
      btn.addEventListener('click', () => {
        const v = btn.dataset.proximity;
        _filterProximity = v === 'null' ? null : v;
        renderControls();
        render();
      });
    });
    const tblInput = wrap.querySelector('#filterTableNum');
    if (tblInput) {
      tblInput.addEventListener('input', () => {
        _filterTableNum = tblInput.value.trim();
        _updateClearBtn();
        render();
      });
    }
    const clearBtn = wrap.querySelector('#btnClearFilters');
    if (clearBtn) {
      clearBtn.addEventListener('click', clearFilters);
    }
  }

  function clearFilters() {
    _filterAssigned  = null;
    _filterTableNum  = '';
    _filterTags.clear();
    _tagFilterMode   = 'or';
    _filterProximity = null;
    _searchText = '';
    const inp = document.getElementById('guestSearch');
    if (inp) inp.value = '';
    renderTagFilter();
    renderControls();
    render();
    _updateClearBtn(); // ensure indicators clear immediately even if render() is batching
  }

  function _updateClearBtn() {
    const hasFilter = _filterAssigned !== null || _filterTableNum || _filterTags.size > 0 || _searchText || _filterProximity !== null;

    // Clear button inside controls panel
    const btn = document.getElementById('btnClearFilters');
    if (btn) btn.classList.toggle('visible', !!hasFilter);

    // Toggle button: orange indicator when any filter is active
    const toggleBtn = document.getElementById('btnToggleFilters');
    if (toggleBtn) toggleBtn.classList.toggle('filter-active', !!hasFilter);

    // Active-filter banner: visible only when filter area is collapsed AND has active filters
    const area    = document.getElementById('guestsFiltersArea');
    const bar     = document.getElementById('filterActiveBar');
    const textEl  = document.getElementById('filterActiveText');
    if (bar && area && textEl) {
      const showBar = !!hasFilter && area.classList.contains('collapsed');
      bar.classList.toggle('visible', showBar);
      if (showBar) {
        const parts = [];
        if (_searchText) parts.push(`"${_searchText.slice(0, 10)}${_searchText.length > 10 ? '…' : ''}"`);
        if (_filterTags.size > 0) parts.push(`${_filterTags.size} תגית${_filterTags.size > 1 ? 'ות' : ''}`);
        if (_filterAssigned !== null) parts.push(_filterAssigned ? 'שובצו' : 'לא שובצו');
        if (_filterProximity === 'none') parts.push('ללא העדפה');
        else if (_filterProximity && CONFIG.PROXIMITY[_filterProximity]) parts.push(CONFIG.PROXIMITY[_filterProximity].icon);
        if (_filterTableNum) parts.push(`שולחן ${_filterTableNum}`);
        textEl.textContent = `🔍 פילטר פעיל${parts.length ? ': ' + parts.join(', ') : ''}`;
      }
    }
  }

  function _updateSortUI() {
    const wrap = document.getElementById('guestsControls');
    if (!wrap) return;
    wrap.querySelectorAll('[data-sort]').forEach(btn => {
      const mode = btn.dataset.sort;
      btn.className = 'btn-xs-filter';
      if (mode === _sortMode) {
        if (mode === 'seatedFirst')   btn.classList.add('active', 'active-success');
        else if (mode === 'unseatedFirst') btn.classList.add('active', 'active-warning');
        else btn.classList.add('active');
      }
    });
  }

  /* ── Collapse toggle for filters area ── */
  function _initToggleFilters() {
    const btn  = document.getElementById('btnToggleFilters');
    const area = document.getElementById('guestsFiltersArea');
    if (!btn || !area) return;
    btn.addEventListener('click', () => {
      const collapsed = area.classList.toggle('collapsed');
      btn.textContent = collapsed ? '▼' : '▲';
      btn.classList.toggle('collapsed-state', collapsed);
      btn.title = collapsed ? 'הצג פילטרים ותגיות' : 'הסתר פילטרים ותגיות';
      _updateClearBtn(); // refresh banner visibility on collapse/expand
    });
  }

  /* ── Search ── */
  function initSearch() {
    const inp = document.getElementById('guestSearch');
    if (!inp) return;
    inp.addEventListener('input', () => {
      _searchText = inp.value;
      _updateClearBtn();
      render();
    });
  }

  /* ── State listeners ── */
  State.on('guestAdded',    () => { _ensureCustomOrder(); render(); });
  State.on('guestUpdated',  render);
  State.on('guestRemoved',  render);
  State.on('guestAssigned', render);
  State.on('itemRemoved',   render);
  State.on('itemUpdated',   render);  // table number/label change → update group headers + badges
  State.on('tagsChanged',   () => { renderTagFilter(); renderControls(); render(); });
  State.on('dataLoaded',    () => { _customOrder = []; renderTagFilter(); renderControls(); render(); });

  function _ensureCustomOrder() {
    if (_sortMode === 'custom' && _customOrder.length) {
      const newGuests = State.get().guests.filter(g => !_customOrder.includes(g.id));
      newGuests.forEach(g => _customOrder.push(g.id));
    }
  }

  function init() {
    initSearch();
    _initToggleFilters();
    const barClear = document.getElementById('btnClearFiltersBar');
    if (barClear) barClear.addEventListener('click', clearFilters);
    renderTagFilter();
    renderControls();
    render();
  }

  return { init, render, renderTagFilter, renderControls, startBatch, endBatch };
})();
