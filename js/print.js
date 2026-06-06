'use strict';

const Print = (() => {

  /* ── Print seating plan ── */
  function printPlan() {
    const planArea = document.getElementById('printPlanArea');
    const state    = State.get();
    const tables   = State.getTables();

    const eventTitle = state.event.name || 'תוכנית הושבה';
    const eventType  = CONFIG.EVENT_TYPES[state.event.type] || '';
    const eventDate  = state.event.date ? new Date(state.event.date).toLocaleDateString('he-IL') : '';
    const venue      = state.event.venue || '';

    // Build table-by-table cards
    const tableCards = tables.map(t => {
      const guests = State.getTableGuests(t.id);
      const occ    = State.getTableOccupancy(t.id);
      const guestList = guests.map(g =>
        `<li>${UI.escHtml(g.name)} <small>(${g.adults} מבוגרים${g.children ? ` + ${g.children} ילדים` : ''})</small></li>`
      ).join('');
      const colorClass = occ === 0 ? 'empty' : (occ <= t.seats ? 'ok' : 'over');
      return `
<div class="print-table-card ${colorClass}">
  <div class="print-table-header">
    <span class="print-table-num">שולחן ${t.number || '?'}</span>
    ${t.label ? `<span class="print-table-label"> — ${UI.escHtml(t.label)}</span>` : ''}
    <span class="print-table-occ">${occ}/${t.seats} מושבים</span>
  </div>
  <ul class="print-guest-list">${guestList || '<li><em>ריק</em></li>'}</ul>
</div>`;
    }).join('');

    planArea.innerHTML = `
<div class="print-header">
  <h1>${UI.escHtml(eventTitle)}</h1>
  ${eventType ? `<p class="print-subtitle">${UI.escHtml(eventType)}</p>` : ''}
  ${eventDate ? `<p class="print-meta">📅 ${UI.escHtml(eventDate)}</p>` : ''}
  ${venue     ? `<p class="print-meta">📍 ${UI.escHtml(venue)}</p>` : ''}
  <hr>
  ${buildStatsSummary()}
</div>
<div class="print-tables-grid">${tableCards}</div>`;

    triggerPrint('plan');
  }

  /* ── Print guest list ── */
  function printList() {
    const listArea = document.getElementById('printListArea');
    const state    = State.get();

    const eventTitle = state.event.name || 'רשימת מוזמנים';
    const eventDate  = state.event.date ? new Date(state.event.date).toLocaleDateString('he-IL') : '';

    const sorted = [...state.guests].sort((a, b) => {
      const ta = a.tableId ? (State.getItem(a.tableId)?.number ?? 999) : 1000;
      const tb = b.tableId ? (State.getItem(b.tableId)?.number ?? 999) : 1000;
      return ta - tb || a.name.localeCompare(b.name, 'he');
    });

    const rows = sorted.map((g, i) => {
      const tableNum = g.tableId ? (State.getItem(g.tableId)?.number ?? '?') : '—';
      const tags     = (g.tags || []).join(', ');
      const rowClass = i % 2 === 0 ? 'even' : 'odd';
      return `<tr class="${rowClass}">
        <td>${i + 1}</td>
        <td>${UI.escHtml(g.name)}</td>
        <td>${g.adults}</td>
        <td>${g.children}</td>
        <td>${g.total}</td>
        <td>${tags}</td>
        <td><strong>${tableNum}</strong></td>
      </tr>`;
    }).join('');

    const stats = State.getStats();

    listArea.innerHTML = `
<div class="print-header">
  <h1>${UI.escHtml(eventTitle)} — רשימת מוזמנים</h1>
  ${eventDate ? `<p class="print-meta">📅 ${UI.escHtml(eventDate)}</p>` : ''}
  <hr>
  ${buildStatsSummary()}
</div>
<table class="print-guest-table">
  <thead>
    <tr>
      <th>#</th><th>שם</th><th>מבוגרים</th><th>ילדים</th><th>סה"כ</th><th>תגיות</th><th>שולחן</th>
    </tr>
  </thead>
  <tbody>${rows}</tbody>
  <tfoot>
    <tr class="totals-row">
      <td colspan="2"><strong>סה"כ</strong></td>
      <td>${sorted.reduce((s,g)=>s+g.adults,0)}</td>
      <td>${sorted.reduce((s,g)=>s+g.children,0)}</td>
      <td><strong>${stats.totalGuests}</strong></td>
      <td></td>
      <td></td>
    </tr>
  </tfoot>
</table>`;

    triggerPrint('list');
  }

  function buildStatsSummary() {
    const s = State.getStats();
    return `<div class="print-stats">
      <span>סה"כ מוזמנים: <strong>${s.totalGuests}</strong></span>
      <span>משובצים: <strong>${s.seatedGuests}</strong></span>
      <span>ממתינים: <strong>${s.pendingGuests}</strong></span>
      <span>שולחנות: <strong>${s.totalTables}</strong></span>
    </div>`;
  }

  function triggerPrint(mode) {
    // Set print mode on body so print CSS knows what to show
    document.body.dataset.printMode = mode;
    window.print();
    // Cleanup after dialog closes
    setTimeout(() => { document.body.dataset.printMode = ''; }, 2000);
  }

  return { printPlan, printList };
})();
