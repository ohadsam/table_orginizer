'use strict';

const Print = (() => {

  /* ── Build room diagram SVG for printing ── */
  function buildRoomDiagramSVG() {
    const items = State.get().items;
    if (!items.length) return { svg: '<p style="color:#999;text-align:center">אין פריטים לתצוגה</p>' };

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

    const stt = State.get().settings;
    const numColor   = stt.fontNumberColor   || '#1a237e';
    const labelColor = stt.fontLabelColor    || '#37474f';
    const guestColor = stt.fontGuestColor    || '#546e7a';
    const occuColor  = stt.fontOccupancyColor || '#888888';

    let body = '';
    items.forEach(item => {
      const lx = item.x - item.width  / 2 - minX;
      const ly = item.y - item.height / 2 - minY;
      const W  = item.width, H = item.height;
      body += `<g transform="translate(${lx.toFixed(1)},${ly.toFixed(1)})">`;

      if (item.type === 'table') {
        const occ    = State.getTableOccupancy(item.id);
        const bg     = item.color || Items.tableColor(occ, item.seats);
        const guests = State.getTableGuests(item.id);

        // Per-table font sizes — same scale formula as buildTableSVG in items.js
        const scale   = Math.min(W, H) / 130;
        const numFont = item.fontSize || stt.fontNumberSize   || Math.max(10, Math.min(24, Math.round(15 * scale)));
        const lblFont = stt.fontLabelSize    || Math.max(7,  Math.min(14, Math.round(10 * scale)));
        const gstFont = stt.fontGuestSize    || Math.max(6,  Math.min(11, Math.round(8  * scale)));
        const occFont = stt.fontOccupancySize || Math.max(6, Math.min(9,  Math.round(7  * scale)));
        const lineH   = gstFont + 2.5;

        if (item.shape === 'circle') {
          const r = Math.min(W, H) / 2 - 5;
          const cx = W / 2, cy = H / 2;
          body += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${bg}" stroke="#888" stroke-width="1.5"/>`;
          body += `<text x="${cx}" y="${cy - r + occFont + 1}" text-anchor="middle" font-size="${occFont}" fill="${occuColor}">${occ}/${item.seats}</text>`;
          const numY = cy - (item.label ? numFont * 0.45 : numFont * 0.2);
          body += `<text x="${cx}" y="${numY}" text-anchor="middle" dominant-baseline="middle" font-size="${numFont}" font-weight="800" fill="${numColor}">${item.number || ''}</text>`;
          let textY;
          if (item.label) {
            textY = numY + numFont * 0.65 + lblFont * 0.35 + 3;
            body += `<text x="${cx}" y="${textY}" text-anchor="middle" dominant-baseline="middle" font-size="${lblFont}" font-weight="700" fill="${labelColor}">${UI.escHtml(item.label)}</text>`;
            textY += lblFont * 0.65 + 14;
          } else {
            textY = numY + numFont * 0.6 + 2;
          }
          const rawMaxG = Math.max(0, Math.floor((cy + r - 5 - textY) / lineH));
          const maxG = (guests.length > rawMaxG) ? Math.max(0, rawMaxG - 1) : rawMaxG;
          guests.slice(0, maxG).forEach(g => {
            const nm = g.name.length > 10 ? g.name.slice(0, 9) + '…' : g.name;
            body += `<text x="${cx}" y="${textY}" text-anchor="middle" font-size="${gstFont}" fill="${guestColor}">${UI.escHtml(nm)}</text>`;
            textY += lineH;
          });
          const extra = guests.length - maxG;
          if (extra > 0) body += `<text x="${cx}" y="${textY}" text-anchor="middle" font-size="${occFont}" fill="${occuColor}">+${extra}</text>`;
        } else {
          const p = 3;
          body += `<rect x="${p}" y="${p}" width="${W - p * 2}" height="${H - p * 2}" rx="5" fill="${bg}" stroke="#888" stroke-width="1.5"/>`;
          const cx = W / 2, cy = H / 2;
          body += `<text x="${cx}" y="${p + occFont + 1}" text-anchor="middle" font-size="${occFont}" fill="${occuColor}">${occ}/${item.seats}</text>`;
          const numY = cy - (item.label ? numFont * 0.45 : numFont * 0.2);
          body += `<text x="${cx}" y="${numY}" text-anchor="middle" dominant-baseline="middle" font-size="${numFont}" font-weight="800" fill="${numColor}">${item.number || ''}</text>`;
          let textY;
          if (item.label) {
            textY = numY + numFont * 0.65 + lblFont * 0.35 + 3;
            body += `<text x="${cx}" y="${textY}" text-anchor="middle" dominant-baseline="middle" font-size="${lblFont}" font-weight="700" fill="${labelColor}">${UI.escHtml(item.label)}</text>`;
            textY += lblFont * 0.65 + 14;
          } else {
            textY = numY + numFont * 0.6 + 2;
          }
          const availH = H - p - 4 - textY;
          const rawMaxG = Math.max(0, Math.floor(availH / lineH));
          const maxG = (guests.length > rawMaxG) ? Math.max(0, rawMaxG - 1) : rawMaxG;
          guests.slice(0, maxG).forEach(g => {
            const nm = g.name.length > 12 ? g.name.slice(0, 11) + '…' : g.name;
            body += `<text x="${cx}" y="${textY}" text-anchor="middle" font-size="${gstFont}" fill="${guestColor}">${UI.escHtml(nm)}</text>`;
            textY += lineH;
          });
          const extra = guests.length - maxG;
          if (extra > 0) body += `<text x="${cx}" y="${textY}" text-anchor="middle" font-size="${occFont}" fill="${occuColor}">+${extra}</text>`;
        }
        if (item.locked) body += `<text x="${W - 3}" y="14" text-anchor="end" font-size="11">🔒</text>`;
      } else {
        const bg      = item.color || CONFIG.COLORS[item.type] || CONFIG.COLORS.shape;
        const icons   = { dancefloor: '🕺', dj: '🎵', door: '🚪' };
        const icon    = icons[item.type] || '';
        const br      = item.shape === 'circle' ? Math.min(W, H) / 2 : 6;
        const lbl     = item.label || { dancefloor: 'רחבת ריקודים', dj: 'עמדת DJ', door: 'כניסה' }[item.type] || '';
        const icoSize = item.iconSize || 14;
        const lblSize = item.fontSize || 9;
        const lblColor = /^#[0-9a-fA-F]{3,8}$/.test(item.fontColor || '') ? item.fontColor : '#333';
        body += `<rect x="0" y="0" width="${W}" height="${H}" rx="${br}" fill="${bg}" stroke="#aaa" stroke-width="1.5"/>`;
        body += `<text x="${W / 2}" y="${H / 2 - 4}" text-anchor="middle" dominant-baseline="middle" font-size="${icoSize}">${icon}</text>`;
        body += `<text x="${W / 2}" y="${H / 2 + lblSize + 2}" text-anchor="middle" font-size="${lblSize}" fill="${lblColor}">${UI.escHtml(lbl)}</text>`;
      }
      body += '</g>';
    });

    // max-height:120mm keeps the diagram on the same page as the header (landscape A4 = ~186mm usable)
    const svg = `<svg viewBox="0 0 ${vbW.toFixed(0)} ${vbH.toFixed(0)}" width="100%" style="max-height:120mm;display:block" xmlns="http://www.w3.org/2000/svg">${body}</svg>`;
    return { svg };
  }

  /* ── Large table SVG for per-table detail page ── */
  function _buildTableVisualSVG(item, occ) {
    const W = item.width, H = item.height;
    const hasSpace = occ <= item.seats;
    const bgColor  = item.color || Items.tableColor(occ, item.seats);
    const R = CONFIG.SEAT_RADIUS;
    const stt = State.get().settings;
    const numColor   = stt.fontNumberColor   || '#1a237e';
    const labelColor = stt.fontLabelColor    || '#37474f';
    const guestColor = stt.fontGuestColor    || '#546e7a';
    const occuColor  = stt.fontOccupancyColor || '#888888';
    const numSize   = stt.fontNumberSize  || 22;
    const labelSize = stt.fontLabelSize   || 13;
    const guestSize = stt.fontGuestSize   || 10;
    const occuSize  = stt.fontOccupancySize || 9;
    const lineH = guestSize + 2.5;
    const guests = State.getTableGuests(item.id);
    let body = '';

    if (item.shape === 'circle') {
      const sR = Math.min(W, H) / 2 - R - 2;
      const r  = Math.max(10, sR - R - 4);
      const cx = W / 2, cy = H / 2;
      body += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${bgColor}" stroke="#888" stroke-width="1.5"/>`;
      for (let i = 0; i < item.seats; i++) {
        const ang  = (i / item.seats) * 2 * Math.PI - Math.PI / 2;
        const sx   = cx + sR * Math.cos(ang);
        const sy   = cy + sR * Math.sin(ang);
        const fill = i < occ
          ? (hasSpace ? CONFIG.COLORS.seatOccupied : CONFIG.COLORS.seatOver)
          : CONFIG.COLORS.seatEmpty;
        body += `<circle cx="${sx.toFixed(1)}" cy="${sy.toFixed(1)}" r="${R}" fill="${fill}" stroke="#fff" stroke-width="1.2"/>`;
      }
      body += `<text x="${cx}" y="${cy - r + occuSize + 1}" text-anchor="middle" font-size="${occuSize}" fill="${occuColor}">${occ}/${item.seats}</text>`;
      const numY = cy - (item.label ? numSize * 0.45 : numSize * 0.2);
      body += `<text x="${cx}" y="${numY}" text-anchor="middle" dominant-baseline="middle" font-size="${numSize}" font-weight="800" fill="${numColor}">${item.number || ''}</text>`;
      let textY;
      if (item.label) {
        textY = numY + numSize * 0.65 + labelSize * 0.35 + 3;
        body += `<text x="${cx}" y="${textY}" text-anchor="middle" dominant-baseline="middle" font-size="${labelSize}" font-weight="600" fill="${labelColor}">${UI.escHtml(item.label)}</text>`;
        textY += labelSize * 0.65 + 14;
      } else {
        textY = numY + numSize * 0.6 + 2;
      }
      const rawMaxG = Math.max(0, Math.floor((cy + r - 5 - textY) / lineH));
      const maxG = (guests.length > rawMaxG) ? Math.max(0, rawMaxG - 1) : rawMaxG;
      guests.slice(0, maxG).forEach(g => {
        const nm = g.name.length > 12 ? g.name.slice(0, 11) + '…' : g.name;
        body += `<text x="${cx}" y="${textY}" text-anchor="middle" font-size="${guestSize}" fill="${guestColor}">${UI.escHtml(nm)}</text>`;
        textY += lineH;
      });
      const extra = guests.length - maxG;
      if (extra > 0) body += `<text x="${cx}" y="${textY}" text-anchor="middle" font-size="${occuSize}" fill="${occuColor}">+${extra}</text>`;
    } else {
      const pad = R + 4;
      const rw = W - pad * 2, rh = H - pad * 2;
      body += `<rect x="${pad}" y="${pad}" width="${rw}" height="${rh}" rx="6" fill="${bgColor}" stroke="#888" stroke-width="1.5"/>`;
      const seats = Items.distributeRectSeats(item.seats, rw, rh);
      seats.forEach(([sx, sy], i) => {
        const fill = i < occ
          ? (hasSpace ? CONFIG.COLORS.seatOccupied : CONFIG.COLORS.seatOver)
          : CONFIG.COLORS.seatEmpty;
        body += `<circle cx="${(pad + sx).toFixed(1)}" cy="${(pad + sy).toFixed(1)}" r="${R}" fill="${fill}" stroke="#fff" stroke-width="1.2"/>`;
      });
      const cx = W / 2, cy = H / 2;
      body += `<text x="${cx}" y="${pad + occuSize + 1}" text-anchor="middle" font-size="${occuSize}" fill="${occuColor}">${occ}/${item.seats}</text>`;
      const numY = cy - (item.label ? numSize * 0.45 : numSize * 0.2);
      body += `<text x="${cx}" y="${numY}" text-anchor="middle" dominant-baseline="middle" font-size="${numSize}" font-weight="800" fill="${numColor}">${item.number || ''}</text>`;
      let textY;
      if (item.label) {
        textY = numY + numSize * 0.65 + labelSize * 0.35 + 3;
        body += `<text x="${cx}" y="${textY}" text-anchor="middle" dominant-baseline="middle" font-size="${labelSize}" font-weight="600" fill="${labelColor}">${UI.escHtml(item.label)}</text>`;
        textY += labelSize * 0.65 + 14;
      } else {
        textY = numY + numSize * 0.6 + 2;
      }
      const availH = H - pad - 4 - textY;
      const rawMaxG = Math.max(0, Math.floor(availH / lineH));
      const maxG = (guests.length > rawMaxG) ? Math.max(0, rawMaxG - 1) : rawMaxG;
      guests.slice(0, maxG).forEach(g => {
        const nm = g.name.length > 16 ? g.name.slice(0, 15) + '…' : g.name;
        body += `<text x="${cx}" y="${textY}" text-anchor="middle" font-size="${guestSize}" fill="${guestColor}">${UI.escHtml(nm)}</text>`;
        textY += lineH;
      });
      const extra = guests.length - maxG;
      if (extra > 0) body += `<text x="${cx}" y="${textY}" text-anchor="middle" font-size="${occuSize}" fill="${occuColor}">+${extra}</text>`;
    }
    if (item.locked) body += `<text x="${W - 4}" y="14" text-anchor="end" font-size="13">🔒</text>`;

    return `<svg viewBox="0 0 ${W} ${H}" width="100%" style="max-height:180pt;max-width:260pt;display:block;margin:0 auto" xmlns="http://www.w3.org/2000/svg">${body}</svg>`;
  }

  /* ── Print seating plan ── */
  function printPlan() {
    const planArea = document.getElementById('printPlanArea');
    const state    = State.get();
    const tables   = State.getTables();

    const eventTitle = state.event.name || 'תוכנית הושבה';
    const eventType  = CONFIG.EVENT_TYPES[state.event.type] || '';
    const eventDate  = state.event.date ? (() => { const [y,m,d] = state.event.date.split('-'); return new Date(+y,+m-1,+d).toLocaleDateString('he-IL'); })() : '';
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
      const tableLabel = table?.label  ?? '';
      const tags       = (g.tags || []).join(', ');
      const colorStyle = table?.color ? `border-inline-end:4pt solid ${table.color};` : '';
      const splitMark  = g.splitOf ? ' <em style="color:#e65100;font-size:8pt">(פיצול)</em>' : '';
      return `<tr class="${i % 2 === 0 ? 'even' : 'odd'}" style="${colorStyle}">
        <td>${i + 1}</td>
        <td>${UI.escHtml(g.name)}${splitMark}</td>
        <td>${g.adults}</td>
        <td>${g.children}</td>
        <td>${g.total}</td>
        <td>${UI.escHtml(tags)}</td>
        <td><strong>${tableNum}</strong></td>
        <td>${UI.escHtml(tableLabel)}</td>
      </tr>`;
    }).join('');
  }

  function buildGuestTableHTML(sorted) {
    const stats = State.getStats();
    return `<table class="print-guest-table">
  <thead>
    <tr><th>#</th><th>שם</th><th>מבוגרים</th><th>ילדים</th><th>סה"כ</th><th>תגיות</th><th>שולחן</th><th>תווית</th></tr>
  </thead>
  <tbody>${buildGuestRows(sorted)}</tbody>
  <tfoot>
    <tr class="totals-row">
      <td colspan="2"><strong>סה"כ</strong></td>
      <td>${sorted.reduce((s, g) => s + g.adults, 0)}</td>
      <td>${sorted.reduce((s, g) => s + g.children, 0)}</td>
      <td><strong>${stats.totalGuests}</strong></td>
      <td></td><td></td><td></td>
    </tr>
  </tfoot>
</table>`;
  }

  /* ── Print guest list ── */
  function printList() {
    const listArea = document.getElementById('printListArea');
    const state    = State.get();

    const eventTitle = state.event.name || 'רשימת מוזמנים';
    const eventDate  = state.event.date ? (() => { const [y,m,d] = state.event.date.split('-'); return new Date(+y,+m-1,+d).toLocaleDateString('he-IL'); })() : '';

    const sorted = sortedGuests();

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
    const eventDate  = state.event.date ? (() => { const [y,m,d] = state.event.date.split('-'); return new Date(+y,+m-1,+d).toLocaleDateString('he-IL'); })() : '';
    const venue      = state.event.venue || '';

    const { svg } = buildRoomDiagramSVG();
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
<div style="page-break-before:always">
  <div class="print-header">
    <h1>${UI.escHtml(eventTitle)} — רשימת מוזמנים</h1>
  </div>
  ${buildGuestTableHTML(sorted)}
</div>`;

    _injectLandscape();
    document.body.dataset.printMode = 'all';
    window.print();
    setTimeout(() => { document.body.dataset.printMode = ''; _clearLandscape(); }, 2000);
  }

  /* ── Print full: diagram + one page per table + guest list ── */
  function printFull() {
    const fullArea = document.getElementById('printFullArea');
    const state    = State.get();
    const tables   = State.getTables();

    const eventTitle = state.event.name || 'תוכנית הושבה';
    const eventType  = CONFIG.EVENT_TYPES[state.event.type] || '';
    const eventDate  = state.event.date
      ? (() => { const [y,m,d] = state.event.date.split('-'); return new Date(+y,+m-1,+d).toLocaleDateString('he-IL'); })()
      : '';
    const venue = state.event.venue || '';

    // Page 1 — event header + room diagram
    const { svg } = buildRoomDiagramSVG();
    let html = `
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
</div>`;

    // One page per table
    tables.forEach(t => {
      const guests     = State.getTableGuests(t.id);
      const occ        = State.getTableOccupancy(t.id);
      const colorClass = occ === 0 ? 'empty' : (occ <= t.seats ? 'ok' : 'over');
      const borderStyle = t.color ? `border-color:${t.color};` : '';
      const headerBg    = t.color ? `background:${t.color}22;` : '';
      const shapeHe     = { circle: 'עיגול', rectangle: 'מלבן', square: 'ריבוע' }[t.shape] || '';
      const colorSwatch = t.color
        ? `<span style="display:inline-block;width:10pt;height:10pt;background:${t.color};border:1pt solid #999;border-radius:2pt;vertical-align:middle;margin-inline-end:3pt"></span>`
        : '';

      const guestRows = guests.map((g, i) => {
        const tags      = (g.tags || []).join(', ');
        const splitMark = g.splitOf ? ' <em style="color:#e65100;font-size:8pt">(פיצול)</em>' : '';
        return `<tr class="${i % 2 === 0 ? 'even' : 'odd'}">
          <td>${i + 1}</td>
          <td>${UI.escHtml(g.name)}${splitMark}</td>
          <td>${g.adults}</td>
          <td>${g.children}</td>
          <td>${g.total}</td>
          <td>${UI.escHtml(tags)}</td>
          <td>${g.notes ? UI.escHtml(g.notes) : '—'}</td>
        </tr>`;
      }).join('');

      html += `
<div class="print-full-table-page ${colorClass}" style="page-break-before:always;${borderStyle}">
  <div class="print-full-table-header" style="${headerBg}">
    <div class="print-full-table-title">שולחן ${t.number || '?'}${t.label ? ' &mdash; ' + UI.escHtml(t.label) : ''}</div>
    <div class="print-full-table-meta">
      <span>${occ} / ${t.seats} מושבים</span>
      ${shapeHe ? `<span>&bull; צורה: ${shapeHe}</span>` : ''}
      <span>&bull; גודל: ${t.width}&times;${t.height}</span>
      ${t.color ? `<span>&bull; ${colorSwatch}צבע מותאם</span>` : ''}
      ${t.locked ? '<span class="print-locked">&bull; 🔒 נעול</span>' : ''}
    </div>
  </div>
  <div class="print-full-table-body">
    <div class="print-full-table-visual">${_buildTableVisualSVG(t, occ)}</div>
    <div class="print-full-table-guest-section">
      ${guests.length ? `
      <table class="print-full-guest-detail">
        <thead>
          <tr><th>#</th><th>שם</th><th>מבוגרים</th><th>ילדים</th><th>סה"כ</th><th>תגיות</th><th>הערות</th></tr>
        </thead>
        <tbody>${guestRows}</tbody>
        <tfoot>
          <tr class="totals-row">
            <td colspan="2"><strong>סה"כ שולחן</strong></td>
            <td>${guests.reduce((s, g) => s + g.adults, 0)}</td>
            <td>${guests.reduce((s, g) => s + g.children, 0)}</td>
            <td><strong>${occ}</strong></td>
            <td></td><td></td>
          </tr>
        </tfoot>
      </table>`
      : '<p class="print-empty-table">אין מוזמנים משובצים לשולחן זה</p>'}
    </div>
  </div>
</div>`;
    });

    // Final page — full guest list sorted by table then name
    const sorted = sortedGuests();
    html += `
<div style="page-break-before:always">
  <div class="print-header">
    <h1>${UI.escHtml(eventTitle)} — רשימת מוזמנים מלאה</h1>
    <hr>
    ${buildStatsSummary()}
  </div>
  ${buildGuestTableHTML(sorted)}
</div>`;

    fullArea.innerHTML = html;

    _injectLandscape();
    document.body.dataset.printMode = 'full';
    window.print();
    setTimeout(() => { document.body.dataset.printMode = ''; _clearLandscape(); }, 2000);
  }

  function _injectLandscape() {
    let s = document.getElementById('_printOrientStyle');
    if (!s) {
      s = document.createElement('style');
      s.id = '_printOrientStyle';
      document.head.appendChild(s);
    }
    s.textContent = '@page { size: A4 landscape; margin: 12mm 15mm; }';
  }

  function _clearLandscape() {
    const s = document.getElementById('_printOrientStyle');
    if (s) s.textContent = '';
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

  /* ── Seating cards (variable-size tent cards, default 8×8 cm) ── */
  function printCards(opts) {
    const {
      nameFont       = 'inherit',
      nameFontSize   = 16,
      nameColor      = '#111111',
      nameBold       = true,
      nameItalic     = false,
      tableFont      = 'inherit',
      tableFontSize  = 12,
      tableColor     = '#333333',
      tableBold      = false,
      tableItalic    = false,
      customText     = '',
      customFont     = 'inherit',
      customFontSize = 11,
      customColor    = '#333333',
      customBold     = false,
      customItalic   = false,
      bgImage        = null,
      cardSize       = 80,
      showLabel      = true,
      blankCount     = 0,
      blankOnly      = false
    } = opts || {};

    const safeCardSize  = Math.max(50, Math.min(120, parseInt(cardSize)  || 80));
    const safeBlankCount = Math.max(0, Math.min(100, parseInt(blankCount) || 0));
    const guests        = State.get().guests;
    const printGuests   = !blankOnly && guests.length > 0;

    if (!printGuests && safeBlankCount === 0) {
      UI.toast('אין מוזמנים ו/או כרטיסים ריקים להדפסה', 'info', 2000);
      return;
    }

    // Sort guest cards by table number then name
    const sorted = printGuests
      ? [...guests].sort((a, b) => {
          const ta = State.getItem(a.tableId), tb = State.getItem(b.tableId);
          const na = ta ? (ta.number ?? 9999) : 9999;
          const nb = tb ? (tb.number ?? 9999) : 9999;
          if (na !== nb) return na - nb;
          return (a.name || '').localeCompare(b.name || '', 'he');
        })
      : [];

    // Whitelist font to prevent CSS injection
    const SAFE_FONTS = new Set([
      'inherit',
      "'Arial',sans-serif",
      "'Helvetica Neue',Helvetica,sans-serif",
      "'Times New Roman',Times,serif",
      'Georgia,serif',
      "'Courier New',monospace",
      'Tahoma,sans-serif',
      'Verdana,sans-serif',
      "'Trebuchet MS',sans-serif",
      "'Segoe UI',sans-serif",
      'Calibri,sans-serif',
      'Impact,sans-serif',
      "'Comic Sans MS',cursive"
    ]);

    const safeNameFont  = SAFE_FONTS.has(nameFont)  ? nameFont  : 'inherit';
    const safeNameSize  = Math.max(6, Math.min(40, parseInt(nameFontSize)  || 16));
    const safeNameColor = /^#[0-9a-fA-F]{6}$/.test(nameColor)  ? nameColor  : '#111111';

    const safeTableFont  = SAFE_FONTS.has(tableFont)  ? tableFont  : 'inherit';
    const safeTableSize  = Math.max(6, Math.min(40, parseInt(tableFontSize) || 12));
    const safeTableColor = /^#[0-9a-fA-F]{6}$/.test(tableColor) ? tableColor : '#333333';

    const safeFont  = SAFE_FONTS.has(customFont) ? customFont : 'inherit';
    const safeSize  = Math.max(6, Math.min(28, parseInt(customFontSize) || 11));
    const safeColor = /^#[0-9a-fA-F]{6}$/.test(customColor) ? customColor : '#333333';

    const nameStyle  = `font-family:${safeNameFont};font-size:${safeNameSize}pt;color:${safeNameColor};` +
                       `font-weight:${nameBold ? '700' : '400'};${nameItalic ? 'font-style:italic;' : ''}`;
    const tableStyle = `font-family:${safeTableFont};font-size:${safeTableSize}pt;color:${safeTableColor};` +
                       `font-weight:${tableBold ? '700' : '400'};${tableItalic ? 'font-style:italic;' : ''}`;

    // Inject card dimensions (@media print scoped to avoid affecting screen)
    const sizeStyleEl = document.createElement('style');
    sizeStyleEl.textContent =
      `@media print{.seating-card{width:${safeCardSize}mm;height:${safeCardSize}mm;}` +
      `.sc-top{height:${safeCardSize / 2}mm;}}`;
    document.head.appendChild(sizeStyleEl);

    // Inject background image ONCE via <style> to avoid repeating large data URLs per card.
    // Escape ' and ) to prevent CSS injection.
    let bgStyleEl = null;
    if (bgImage && /^data:image\//.test(bgImage)) {
      const safeBg = bgImage.replace(/'/g, '%27').replace(/\)/g, '%29');
      bgStyleEl = document.createElement('style');
      bgStyleEl.textContent =
        `.sc-top{background-image:url('${safeBg}');background-size:cover;` +
        `background-position:center;background-repeat:no-repeat;` +
        `-webkit-print-color-adjust:exact;print-color-adjust:exact;}`;
      document.head.appendChild(bgStyleEl);
    }

    const boldPart   = customBold   ? 'font-weight:700;'    : '';
    const italicPart = customItalic ? 'font-style:italic;'  : '';
    const customStyle = `font-family:${safeFont};font-size:${safeSize}pt;color:${safeColor};${boldPart}${italicPart}`;
    const customRow  = customText
      ? `<div class="sc-custom" style="${customStyle}">${UI.escHtml(customText)}</div>`
      : '';

    // Guest cards
    const guestCards = sorted.map(g => {
      const table = State.getItem(g.tableId);
      let tableText = 'ללא שיבוץ';
      if (table) {
        tableText = `שולחן ${UI.escHtml(String(table.number ?? ''))}`;
        if (showLabel && table.label) tableText += ` — ${UI.escHtml(table.label)}`;
      }
      return `<div class="seating-card">
        <div class="sc-top"></div>
        <div class="sc-bottom">
          <div class="sc-name" style="${nameStyle}">${UI.escHtml(g.name || '')}</div>
          <div class="sc-table" style="${tableStyle}">${tableText}</div>
          ${customRow}
        </div>
      </div>`;
    }).join('');

    // Blank cards — placeholders instead of name/table
    const blankCard =
      `<div class="seating-card">
        <div class="sc-top"></div>
        <div class="sc-bottom">
          <div class="sc-placeholder">שם: _______________</div>
          <div class="sc-placeholder">שולחן: ____________</div>
          ${customRow}
        </div>
      </div>`;
    const blankCards = safeBlankCount > 0 ? blankCard.repeat(safeBlankCount) : '';

    const area = document.getElementById('printCardsArea');
    area.innerHTML = guestCards + blankCards;
    _injectCardsPage();
    document.body.dataset.printMode = 'cards';
    try {
      window.print();
    } finally {
      setTimeout(() => {
        document.body.dataset.printMode = '';
        area.innerHTML = '';
        sizeStyleEl.remove();
        if (bgStyleEl) bgStyleEl.remove();
        _clearLandscape();
      }, 2000);
    }
  }

  function _injectCardsPage() {
    let s = document.getElementById('_printOrientStyle');
    if (!s) { s = document.createElement('style'); s.id = '_printOrientStyle'; document.head.appendChild(s); }
    s.textContent = '@page { size: A4 portrait; margin: 8mm; }';
  }

  /* ── Tables-only room diagram SVG with seat circles ── */
  function buildRoomTablesOnlySVG() {
    const tables = State.get().items.filter(i => i.type === 'table');
    if (!tables.length) return { svg: '<p style="color:#999;text-align:center">אין שולחנות לתצוגה</p>' };

    const R       = CONFIG.SEAT_RADIUS;
    const seatPad = R * 2 + 10;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    tables.forEach(item => {
      minX = Math.min(minX, item.x - item.width  / 2 - seatPad);
      minY = Math.min(minY, item.y - item.height / 2 - seatPad);
      maxX = Math.max(maxX, item.x + item.width  / 2 + seatPad);
      maxY = Math.max(maxY, item.y + item.height / 2 + seatPad);
    });
    const vbW = maxX - minX, vbH = maxY - minY;

    const stt = State.get().settings;
    const numColor   = stt.fontNumberColor   || '#1a237e';
    const labelColor = stt.fontLabelColor    || '#37474f';
    const guestColor = stt.fontGuestColor    || '#546e7a';
    const occuColor  = stt.fontOccupancyColor || '#888888';

    let body = '';
    tables.forEach(item => {
      const lx = item.x - item.width  / 2 - minX;
      const ly = item.y - item.height / 2 - minY;
      const W  = item.width, H = item.height;
      const occ      = State.getTableOccupancy(item.id);
      const hasSpace = occ <= item.seats;
      const bg       = item.color || Items.tableColor(occ, item.seats);
      const guests   = State.getTableGuests(item.id);

      const scale   = Math.min(W, H) / 130;
      const numFont = item.fontSize || stt.fontNumberSize   || Math.max(10, Math.min(24, Math.round(15 * scale)));
      const lblFont = stt.fontLabelSize    || Math.max(7,  Math.min(14, Math.round(10 * scale)));
      const gstFont = stt.fontGuestSize    || Math.max(6,  Math.min(11, Math.round(8  * scale)));
      const occFont = stt.fontOccupancySize || Math.max(6, Math.min(9,  Math.round(7  * scale)));
      const lineH   = gstFont + 2.5;

      body += `<g transform="translate(${lx.toFixed(1)},${ly.toFixed(1)})">`;
      if (item.shape === 'circle') {
        const sR = Math.min(W, H) / 2 - R - 2;
        const r  = Math.max(10, sR - R - 4);
        const cx = W / 2, cy = H / 2;
        body += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${bg}" stroke="#888" stroke-width="1.5"/>`;
        for (let i = 0; i < item.seats; i++) {
          const ang  = (i / item.seats) * 2 * Math.PI - Math.PI / 2;
          const sx   = cx + sR * Math.cos(ang);
          const sy   = cy + sR * Math.sin(ang);
          const fill = i < occ ? (hasSpace ? CONFIG.COLORS.seatOccupied : CONFIG.COLORS.seatOver) : CONFIG.COLORS.seatEmpty;
          body += `<circle cx="${sx.toFixed(1)}" cy="${sy.toFixed(1)}" r="${R}" fill="${fill}" stroke="#fff" stroke-width="1.2"/>`;
        }
        body += `<text x="${cx}" y="${cy - r + occFont + 1}" text-anchor="middle" font-size="${occFont}" fill="${occuColor}">${occ}/${item.seats}</text>`;
        const numY = cy - (item.label ? numFont * 0.45 : numFont * 0.2);
        body += `<text x="${cx}" y="${numY}" text-anchor="middle" dominant-baseline="middle" font-size="${numFont}" font-weight="800" fill="${numColor}">${item.number || ''}</text>`;
        let textY;
        if (item.label) {
          textY = numY + numFont * 0.65 + lblFont * 0.35 + 3;
          body += `<text x="${cx}" y="${textY}" text-anchor="middle" dominant-baseline="middle" font-size="${lblFont}" font-weight="700" fill="${labelColor}">${UI.escHtml(item.label)}</text>`;
          textY += lblFont * 0.65 + 14;
        } else {
          textY = numY + numFont * 0.6 + 2;
        }
        const rawMaxG = Math.max(0, Math.floor((cy + r - 5 - textY) / lineH));
        const maxG = (guests.length > rawMaxG) ? Math.max(0, rawMaxG - 1) : rawMaxG;
        guests.slice(0, maxG).forEach(g => {
          const nm = g.name.length > 10 ? g.name.slice(0, 9) + '…' : g.name;
          body += `<text x="${cx}" y="${textY}" text-anchor="middle" font-size="${gstFont}" fill="${guestColor}">${UI.escHtml(nm)}</text>`;
          textY += lineH;
        });
        const extra = guests.length - maxG;
        if (extra > 0) body += `<text x="${cx}" y="${textY}" text-anchor="middle" font-size="${occFont}" fill="${occuColor}">+${extra}</text>`;
      } else {
        const pad = R + 4;
        const rw = W - pad * 2, rh = H - pad * 2;
        body += `<rect x="${pad}" y="${pad}" width="${rw}" height="${rh}" rx="5" fill="${bg}" stroke="#888" stroke-width="1.5"/>`;
        const seatsArr = Items.distributeRectSeats(item.seats, rw, rh);
        seatsArr.forEach(([sx, sy], i) => {
          const fill = i < occ ? (hasSpace ? CONFIG.COLORS.seatOccupied : CONFIG.COLORS.seatOver) : CONFIG.COLORS.seatEmpty;
          body += `<circle cx="${(pad + sx).toFixed(1)}" cy="${(pad + sy).toFixed(1)}" r="${R}" fill="${fill}" stroke="#fff" stroke-width="1.2"/>`;
        });
        const cx = W / 2, cy = H / 2;
        body += `<text x="${cx}" y="${pad + occFont + 1}" text-anchor="middle" font-size="${occFont}" fill="${occuColor}">${occ}/${item.seats}</text>`;
        const numY = cy - (item.label ? numFont * 0.45 : numFont * 0.2);
        body += `<text x="${cx}" y="${numY}" text-anchor="middle" dominant-baseline="middle" font-size="${numFont}" font-weight="800" fill="${numColor}">${item.number || ''}</text>`;
        let textY;
        if (item.label) {
          textY = numY + numFont * 0.65 + lblFont * 0.35 + 3;
          body += `<text x="${cx}" y="${textY}" text-anchor="middle" dominant-baseline="middle" font-size="${lblFont}" font-weight="700" fill="${labelColor}">${UI.escHtml(item.label)}</text>`;
          textY += lblFont * 0.65 + 14;
        } else {
          textY = numY + numFont * 0.6 + 2;
        }
        const availH  = H - pad - 4 - textY;
        const rawMaxG = Math.max(0, Math.floor(availH / lineH));
        const maxG    = (guests.length > rawMaxG) ? Math.max(0, rawMaxG - 1) : rawMaxG;
        guests.slice(0, maxG).forEach(g => {
          const nm = g.name.length > 12 ? g.name.slice(0, 11) + '…' : g.name;
          body += `<text x="${cx}" y="${textY}" text-anchor="middle" font-size="${gstFont}" fill="${guestColor}">${UI.escHtml(nm)}</text>`;
          textY += lineH;
        });
        const extra = guests.length - maxG;
        if (extra > 0) body += `<text x="${cx}" y="${textY}" text-anchor="middle" font-size="${occFont}" fill="${occuColor}">+${extra}</text>`;
      }
      if (item.locked)       body += `<text x="${W - 3}" y="14" text-anchor="end" font-size="11">🔒</text>`;
      if (item.numberLocked) body += `<text x="4" y="14" text-anchor="start" font-size="11" font-weight="700" fill="#7e57c2">#</text>`;
      body += '</g>';
    });

    return {
      svg: `<svg viewBox="0 0 ${vbW.toFixed(0)} ${vbH.toFixed(0)}" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">${body}</svg>`
    };
  }

  /* ── Print tables-only diagram (landscape, one page, with seat circles) ── */
  function printTablesDiagram() {
    const tables = State.get().items.filter(i => i.type === 'table');
    if (!tables.length) { UI.toast('אין שולחנות לתצוגה', 'info', 1800); return; }

    const state      = State.get();
    const eventTitle = state.event.name || 'תרשים שולחנות';
    const eventDate  = state.event.date
      ? (() => { const [y,m,d] = state.event.date.split('-'); return new Date(+y,+m-1,+d).toLocaleDateString('he-IL'); })()
      : '';

    const { svg } = buildRoomTablesOnlySVG();
    const area = document.getElementById('printTablesDiagramArea');
    area.innerHTML = `
<div class="print-header" style="margin-bottom:6pt;padding-bottom:5pt">
  <h1 style="font-size:16pt;margin-bottom:2pt">${UI.escHtml(eventTitle)} — תרשים שולחנות</h1>
  ${eventDate ? `<p class="print-meta">📅 ${UI.escHtml(eventDate)}</p>` : ''}
  ${buildStatsSummary()}
</div>
<div class="print-diagram-wrap">${svg}</div>`;

    _injectLandscape();
    document.body.dataset.printMode = 'diagram';
    try {
      window.print();
    } finally {
      setTimeout(() => {
        document.body.dataset.printMode = '';
        area.innerHTML = '';
        _clearLandscape();
      }, 2000);
    }
  }

  return { printPlan, printList, printAll, printFull, printTablesDiagram, printCards };
})();
