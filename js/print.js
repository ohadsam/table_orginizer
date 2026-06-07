'use strict';

const Print = (() => {

  /* ── Build room diagram SVG for printing ── */
  function buildRoomDiagramSVG() {
    const items = State.get().items;
    if (!items.length) return { svg: '<p style="color:#999;text-align:center">אין פריטים לתצוגה</p>', landscape: false };

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    items.forEach(item => {
      minX = Math.min(minX, item.x - item.width  / 2);
      minY = Math.min(minY, item.y - item.height / 2);
      maxX = Math.max(maxX, item.x + item.width  / 2);
      maxY = Math.max(maxY, item.y + item.height / 2);
    });
    const pad = 30;
    minX -= pad; minY -= pad; maxX += pad; maxY += pad;
    const vbW = maxX - minX, vbH = maxY - minY;
    const landscape = (vbW / vbH) > 1.3;

    let body = '';
    items.forEach(item => {
      const lx = item.x - item.width  / 2 - minX;
      const ly = item.y - item.height / 2 - minY;
      const W  = item.width, H = item.height;
      body += `<g transform="translate(${lx.toFixed(1)},${ly.toFixed(1)})">`;

      if (item.type === 'table') {
        const occ = State.getTableOccupancy(item.id);
        const bg  = item.color || Items.tableColor(occ, item.seats);
        const guestNames = State.getTableGuests(item.id).map(g => UI.escHtml(g.name)).join(', ');
        const nameStr = guestNames.length > 45 ? guestNames.slice(0, 42) + '…' : guestNames;
        if (item.shape === 'circle') {
          const r = Math.min(W, H) / 2 - 5;
          const cx = W / 2, cy = H / 2;
          body += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${bg}" stroke="#888" stroke-width="1.5"/>`;
          body += `<text x="${cx}" y="${cy - 8}" text-anchor="middle" dominant-baseline="middle" font-size="14" font-weight="700" fill="#333">${item.number || ''}</text>`;
          body += `<text x="${cx}" y="${cy + 7}" text-anchor="middle" font-size="8" fill="#555">${occ}/${item.seats}</text>`;
          if (item.label) body += `<text x="${cx}" y="${cy + 19}" text-anchor="middle" font-size="7" fill="#666">${UI.escHtml(item.label)}</text>`;
          if (nameStr)   body += `<text x="${cx}" y="${cy + 29}" text-anchor="middle" font-size="6" fill="#888">${nameStr}</text>`;
        } else {
          const p = 3;
          body += `<rect x="${p}" y="${p}" width="${W - p * 2}" height="${H - p * 2}" rx="5" fill="${bg}" stroke="#888" stroke-width="1.5"/>`;
          const cx = W / 2, cy = H / 2;
          body += `<text x="${cx}" y="${cy - 8}" text-anchor="middle" dominant-baseline="middle" font-size="14" font-weight="700" fill="#333">${item.number || ''}</text>`;
          body += `<text x="${cx}" y="${cy + 7}" text-anchor="middle" font-size="8" fill="#555">${occ}/${item.seats}</text>`;
          if (item.label) body += `<text x="${cx}" y="${cy + 17}" text-anchor="middle" font-size="7" fill="#666">${UI.escHtml(item.label)}</text>`;
          if (nameStr)   body += `<text x="${cx}" y="${cy + 26}" text-anchor="middle" font-size="6" fill="#888">${nameStr}</text>`;
        }
        if (item.locked) body += `<text x="${W - 3}" y="14" text-anchor="end" font-size="11">🔒</text>`;
      } else {
        const bg   = item.color || CONFIG.COLORS[item.type] || CONFIG.COLORS.shape;
        const icons = { dancefloor: '🕺', dj: '🎵', door: '🚪' };
        const icon = icons[item.type] || '';
        const br   = item.shape === 'circle' ? Math.min(W, H) / 2 : 6;
        const lbl  = item.label || { dancefloor: 'רחבת ריקודים', dj: 'עמדת DJ', door: 'כניסה' }[item.type] || '';
        body += `<rect x="0" y="0" width="${W}" height="${H}" rx="${br}" fill="${bg}" stroke="#aaa" stroke-width="1.5"/>`;
        body += `<text x="${W / 2}" y="${H / 2 - 4}" text-anchor="middle" dominant-baseline="middle" font-size="14">${icon}</text>`;
        body += `<text x="${W / 2}" y="${H / 2 + 12}" text-anchor="middle" font-size="9" fill="#333">${UI.escHtml(lbl)}</text>`;
      }
      body += '</g>';
    });

    const svg = `<svg viewBox="0 0 ${vbW.toFixed(0)} ${vbH.toFixed(0)}" width="100%" style="max-height:500px;display:block" xmlns="http://www.w3.org/2000/svg">${body}</svg>`;
    return { svg, landscape };
  }

  /* ── Print seating plan ── */
  function printPlan() {
    const planArea = document.getElementById('printPlanArea');
    const state    = State.get();
    const tables   = State.getTables();

    const eventTitle = state.event.name || 'תוכנית הושבה';
    const eventType  = CONFIG.EVENT_TYPES[state.event.type] || '';
    const eventDate  = state.event.date ? new Date(state.event.date).toLocaleDateString('he-IL') : '';
    const venue      = state.event.venue || '';

    const tableCards = tables.map(t => {
      const guests  = State.getTableGuests(t.id);
      const occ     = State.getTableOccupancy(t.id);
      const guestList = guests.map(g => {
        const splitMark = g.splitOf ? ' <em style="color:#e65100;font-size:8pt">(פיצול)</em>' : '';
        return `<li>${UI.escHtml(g.name)}${splitMark} <small>(${g.adults}${g.children ? '+' + g.children : ''})</small></li>`;
      }).join('');
      const colorClass   = occ === 0 ? 'empty' : (occ <= t.seats ? 'ok' : 'over');
      const borderStyle  = t.color ? `border-color:${t.color};` : '';
      const headerStyle  = t.color ? `background:${t.color}22;` : '';
      return `
<div class="print-table-card ${colorClass}" style="${borderStyle}">
  <div class="print-table-header" style="${headerStyle}">
    <span class="print-table-num">שולחן ${t.number || '?'}</span>
    ${t.label ? `<span class="print-table-label"> — ${UI.escHtml(t.label)}</span>` : ''}
    <span class="print-table-occ">${occ}/${t.seats}</span>
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

  /* ── Shared: build sorted guest rows for the print guest-list table ── */
  function sortedGuests() {
    return [...State.get().guests].sort((a, b) => {
      const ta = a.tableId ? (State.getItem(a.tableId)?.number ?? 999) : 1000;
      const tb = b.tableId ? (State.getItem(b.tableId)?.number ?? 999) : 1000;
      return ta - tb || a.name.localeCompare(b.name, 'he');
    });
  }

  function buildGuestRows(sorted) {
    return sorted.map((g, i) => {
      const table      = g.tableId ? State.getItem(g.tableId) : null;
      const tableNum   = table?.number ?? '—';
      const tags       = (g.tags || []).join(', ');
      const colorStyle = table?.color ? `border-inline-end:4pt solid ${table.color};` : '';
      const splitMark  = g.splitOf ? ' <em style="color:#e65100;font-size:8pt">(פיצול)</em>' : '';
      return `<tr class="${i % 2 === 0 ? 'even' : 'odd'}" style="${colorStyle}">
        <td>${i + 1}</td>
        <td>${UI.escHtml(g.name)}${splitMark}</td>
        <td>${g.adults}</td>
        <td>${g.children}</td>
        <td>${g.total}</td>
        <td>${tags}</td>
        <td><strong>${tableNum}</strong></td>
      </tr>`;
    }).join('');
  }

  function buildGuestTableHTML(sorted) {
    const stats = State.getStats();
    return `<table class="print-guest-table">
  <thead>
    <tr><th>#</th><th>שם</th><th>מבוגרים</th><th>ילדים</th><th>סה"כ</th><th>תגיות</th><th>שולחן</th></tr>
  </thead>
  <tbody>${buildGuestRows(sorted)}</tbody>
  <tfoot>
    <tr class="totals-row">
      <td colspan="2"><strong>סה"כ</strong></td>
      <td>${sorted.reduce((s, g) => s + g.adults, 0)}</td>
      <td>${sorted.reduce((s, g) => s + g.children, 0)}</td>
      <td><strong>${stats.totalGuests}</strong></td>
      <td></td><td></td>
    </tr>
  </tfoot>
</table>`;
  }

  /* ── Print guest list ── */
  function printList() {
    const listArea = document.getElementById('printListArea');
    const state    = State.get();

    const eventTitle = state.event.name || 'רשימת מוזמנים';
    const eventDate  = state.event.date ? new Date(state.event.date).toLocaleDateString('he-IL') : '';

    const sorted = sortedGuests();
    const stats = State.getStats();

    listArea.innerHTML = `
<div class="print-header">
  <h1>${UI.escHtml(eventTitle)} — רשימת מוזמנים</h1>
  ${eventDate ? `<p class="print-meta">📅 ${UI.escHtml(eventDate)}</p>` : ''}
  <hr>
  ${buildStatsSummary()}
</div>
${buildGuestTableHTML(sorted)}`;

    triggerPrint('list');
  }

  /* ── Print all: diagram + guest list ── */
  function printAll() {
    const allArea  = document.getElementById('printAllArea');
    const state    = State.get();

    const eventTitle = state.event.name || 'תוכנית הושבה';
    const eventType  = CONFIG.EVENT_TYPES[state.event.type] || '';
    const eventDate  = state.event.date ? new Date(state.event.date).toLocaleDateString('he-IL') : '';
    const venue      = state.event.venue || '';

    const { svg, landscape } = buildRoomDiagramSVG();
    const sorted = sortedGuests();

    allArea.innerHTML = `
<div class="print-header">
  <h1>${UI.escHtml(eventTitle)}</h1>
  ${eventType ? `<p class="print-subtitle">${UI.escHtml(eventType)}</p>` : ''}
  ${eventDate ? `<p class="print-meta">📅 ${UI.escHtml(eventDate)}</p>` : ''}
  ${venue     ? `<p class="print-meta">📍 ${UI.escHtml(venue)}</p>` : ''}
  <hr>
  ${buildStatsSummary()}
</div>
<div class="print-room-diagram">
  <h2 class="print-section-title">תרשים האולם</h2>
  ${svg}
</div>
<div style="page-break-before:always"></div>
<div class="print-header">
  <h1>${UI.escHtml(eventTitle)} — רשימת מוזמנים</h1>
</div>
${buildGuestTableHTML(sorted)}`;

    // Inject top-level @page rule for landscape — nested @page inside selectors is invalid CSS
    let orientStyle = document.getElementById('_printOrientStyle');
    if (!orientStyle) {
      orientStyle = document.createElement('style');
      orientStyle.id = '_printOrientStyle';
      document.head.appendChild(orientStyle);
    }
    orientStyle.textContent = landscape
      ? '@page { size: A4 landscape; margin: 12mm 15mm; }'
      : '';

    document.body.dataset.printMode = 'all';
    window.print();
    setTimeout(() => {
      document.body.dataset.printMode = '';
      if (orientStyle) orientStyle.textContent = '';
    }, 2000);
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
    document.body.dataset.printMode = mode;
    window.print();
    setTimeout(() => { document.body.dataset.printMode = ''; }, 2000);
  }

  return { printPlan, printList, printAll };
})();
