'use strict';

const Guests = (() => {
  let _searchText = '';
  let _filterTags = new Set();

  /* ── Render guest list ── */
  function render() {
    const listEl = document.getElementById('guestsList');
    if (!listEl) return;
    const state   = State.get();
    const guests  = state.guests;
    const search  = _searchText.toLowerCase();

    const filtered = guests.filter(g => {
      if (search && !g.name.toLowerCase().includes(search)) return false;
      if (_filterTags.size > 0 && !(g.tags || []).some(t => _filterTags.has(t))) return false;
      return true;
    });

    if (!filtered.length) {
      listEl.innerHTML = `<div class="empty-list">${guests.length ? 'לא נמצאו תוצאות' : 'אין מוזמנים עדיין'}</div>`;
      return;
    }

    listEl.innerHTML = filtered.map(g => buildGuestCard(g, state)).join('');
    filtered.forEach(g => {
      const el = document.getElementById('gc_' + g.id);
      if (!el) return;
      Drag.bindGuestDrag(el, g.id);
      el.querySelector('.btn-edit-guest')?.addEventListener('click', e => {
        e.stopPropagation();
        Modals.openEditGuest(g.id);
      });
      el.querySelector('.btn-remove-guest')?.addEventListener('click', e => {
        e.stopPropagation();
        if (UI.confirmDialog(`למחוק את "${g.name}"?`)) {
          State.removeGuest(g.id);
        }
      });
      el.querySelector('.btn-unassign-guest')?.addEventListener('click', e => {
        e.stopPropagation();
        State.assignGuest(g.id, null);
      });
    });
  }

  function buildGuestCard(g, state) {
    const table    = g.tableId ? State.getItem(g.tableId) : null;
    const tableNum = table?.number ?? '?';
    const tableClr = table?.color || null;
    const tags     = (g.tags || []).map(t => UI.tagBadge(t)).join('');
    const prox     = (g.proximity || [])
      .map(k => CONFIG.PROXIMITY[k] ? `<span class="prox-badge" title="${CONFIG.PROXIMITY[k].label}">${CONFIG.PROXIMITY[k].icon}</span>` : '')
      .join('');
    const splitBadge = g.splitOf
      ? `<span class="split-badge" title="כרטיס זה נוצר מפיצול">⛓ פוצל</span>` : '';
    const assigned = g.tableId
      ? `<span class="guest-table-badge" title="לחץ על הכרטיס למעבר לשולחן">שולחן ${tableNum}</span>` : '';
    const unassignBtn = g.tableId
      ? `<button class="btn-icon-xs btn-unassign-guest" title="הסר שיבוץ">✕</button>` : '';
    const colorStyle = tableClr
      ? `border-inline-end: 4px solid ${tableClr};`
      : '';
    return `
<div id="gc_${g.id}" class="guest-card ${g.tableId ? 'assigned' : ''}" draggable="false" style="${colorStyle}">
  <div class="guest-card-header">
    <span class="guest-name">${UI.escHtml(g.name)} ${prox}${splitBadge}</span>
    <div class="guest-actions">
      ${unassignBtn}
      <button class="btn-icon-xs btn-edit-guest"   title="עריכה">✏️</button>
      <button class="btn-icon-xs btn-remove-guest" title="מחיקה">🗑</button>
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
    bar.innerHTML = tags.map(t => {
      const color  = UI.tagColor(t);
      const active = _filterTags.has(t);
      return `<button class="tag-filter-btn ${active ? 'active' : ''}" data-tag="${UI.escHtml(t)}"
        style="color:${color};border-color:${color}${active?';background:'+color+'22':''}">${UI.escHtml(t)}</button>`;
    }).join('');
    bar.querySelectorAll('.tag-filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const tag = btn.dataset.tag;
        _filterTags.has(tag) ? _filterTags.delete(tag) : _filterTags.add(tag);
        renderTagFilter();
        render();
      });
    });
  }

  /* ── Search ── */
  function initSearch() {
    const inp = document.getElementById('guestSearch');
    if (!inp) return;
    inp.addEventListener('input', () => { _searchText = inp.value; render(); });
  }

  /* ── State listeners ── */
  State.on('guestAdded',    render);
  State.on('guestUpdated',  render);
  State.on('guestRemoved',  render);
  State.on('guestAssigned', render);
  State.on('itemRemoved',   render);   // table deleted → re-render displaced guests
  State.on('tagsChanged',   () => { renderTagFilter(); render(); });
  State.on('dataLoaded',    () => { renderTagFilter(); render(); });

  function init() {
    initSearch();
    renderTagFilter();
    render();
  }

  return { init, render, renderTagFilter };
})();
