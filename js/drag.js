'use strict';

const Drag = (() => {
  // ── canvas item drag ──
  function bindItemDrag(el, itemId) {
    let dragging = false;
    let startPt;
    let startPos;

    el.addEventListener('pointerdown', e => {
      if (e.target.classList.contains('resize-handle')) return; // handled by resize
      e.stopPropagation();
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      const item = State.getItem(itemId);
      if (!item) return;
      dragging = true;
      startPt  = Canvas.viewportToCanvas(e.clientX, e.clientY);
      startPos = { x: item.x, y: item.y };
      el.setPointerCapture(e.pointerId);
      el.classList.add('dragging');
      Items.selectItem(itemId);
    });

    el.addEventListener('pointermove', e => {
      if (!dragging) return;
      e.stopPropagation();
      const pt = Canvas.viewportToCanvas(e.clientX, e.clientY);
      const dx = pt.x - startPt.x;
      const dy = pt.y - startPt.y;
      let nx = Canvas.snapToGrid(startPos.x + dx);
      let ny = Canvas.snapToGrid(startPos.y + dy);
      nx = Math.max(0, Math.min(CONFIG.CANVAS_WIDTH,  nx));
      ny = Math.max(0, Math.min(CONFIG.CANVAS_HEIGHT, ny));
      // Live visual update (no state write yet — too frequent)
      const item = State.getItem(itemId);
      if (!item) return;
      el.style.left = (nx - item.width  / 2) + 'px';
      el.style.top  = (ny - item.height / 2) + 'px';
    });

    el.addEventListener('pointerup', e => {
      if (!dragging) return;
      dragging = false;
      el.classList.remove('dragging');
      const item = State.getItem(itemId);
      if (!item) return;
      const pt = Canvas.viewportToCanvas(e.clientX, e.clientY);
      const dx = pt.x - startPt.x;
      const dy = pt.y - startPt.y;
      let nx = Canvas.snapToGrid(startPos.x + dx);
      let ny = Canvas.snapToGrid(startPos.y + dy);
      nx = Math.max(0, Math.min(CONFIG.CANVAS_WIDTH,  nx));
      ny = Math.max(0, Math.min(CONFIG.CANVAS_HEIGHT, ny));
      State.updateItem(itemId, { x: nx, y: ny });
    });

    el.addEventListener('pointercancel', () => {
      if (!dragging) return;
      dragging = false;
      el.classList.remove('dragging');
      Items.refreshItem(itemId); // restore visual
    });
  }

  // ── resize handle drag ──
  function bindResizeDrag(handle, itemId) {
    let resizing = false;
    let startPt, startW, startH;

    handle.addEventListener('pointerdown', e => {
      e.stopPropagation();
      resizing = true;
      const item = State.getItem(itemId);
      if (!item) return;
      startPt = Canvas.viewportToCanvas(e.clientX, e.clientY);
      startW  = item.width;
      startH  = item.height;
      handle.setPointerCapture(e.pointerId);
    });

    handle.addEventListener('pointermove', e => {
      if (!resizing) return;
      e.stopPropagation();
      const pt = Canvas.viewportToCanvas(e.clientX, e.clientY);
      const item = State.getItem(itemId);
      if (!item) return;
      const dw = (pt.x - startPt.x) * 2;
      const dh = (pt.y - startPt.y) * 2;
      const nw = Math.max(60,  startW + dw);
      const nh = Math.max(60, startH + dh);
      const el = document.getElementById(itemId);
      if (el) { el.style.width = nw + 'px'; el.style.height = nh + 'px'; }
    });

    handle.addEventListener('pointerup', e => {
      if (!resizing) return;
      resizing = false;
      const pt = Canvas.viewportToCanvas(e.clientX, e.clientY);
      const item = State.getItem(itemId);
      if (!item) return;
      const dw = (pt.x - startPt.x) * 2;
      const dh = (pt.y - startPt.y) * 2;
      const nw = Math.max(60, startW + dw);
      const nh = Math.max(60, startH + dh);
      State.updateItem(itemId, { width: nw, height: nh });
    });

    handle.addEventListener('pointercancel', () => {
      resizing = false;
      Items.refreshItem(itemId);
    });
  }

  // ── guest card drag (sidebar → canvas) ──
  let ghostEl   = null;
  let dragGuest = null;
  let hoveredId = null;

  function bindGuestDrag(el, guestId) {
    el.addEventListener('pointerdown', e => {
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      const guest = State.getGuest(guestId);
      if (!guest) return;
      dragGuest = guest;
      ghostEl = document.createElement('div');
      ghostEl.className = 'guest-ghost';
      ghostEl.innerHTML = `<strong>${UI.escHtml(guest.name)}</strong><br><small>${guest.total} אנשים</small>`;
      document.body.appendChild(ghostEl);
      moveGhost(e.clientX, e.clientY);
      document.addEventListener('pointermove', onDragGuestMove);
      document.addEventListener('pointerup',   onDragGuestUp);
      document.addEventListener('pointercancel', cancelGuestDrag);
      e.preventDefault();
    });
  }

  function moveGhost(cx, cy) {
    if (!ghostEl) return;
    ghostEl.style.left = (cx + 12) + 'px';
    ghostEl.style.top  = (cy - 20) + 'px';
  }

  function onDragGuestMove(e) {
    if (!ghostEl) return;
    moveGhost(e.clientX, e.clientY);
    const table = Canvas.getTableUnder(e.clientX, e.clientY);
    if (table && table.id !== hoveredId) {
      Items.highlightTable(hoveredId, false);
      hoveredId = table.id;
      Items.highlightTable(hoveredId, true);
    } else if (!table && hoveredId) {
      Items.highlightTable(hoveredId, false);
      hoveredId = null;
    }
  }

  function onDragGuestUp(e) {
    document.removeEventListener('pointermove', onDragGuestMove);
    document.removeEventListener('pointerup',   onDragGuestUp);
    document.removeEventListener('pointercancel', cancelGuestDrag);

    if (ghostEl) { ghostEl.remove(); ghostEl = null; }
    if (!dragGuest) return;

    const table = Canvas.getTableUnder(e.clientX, e.clientY);
    Items.highlightTable(hoveredId, false);
    hoveredId = null;

    if (table) {
      Modals.handleGuestDrop(dragGuest.id, table.id);
    }
    dragGuest = null;
  }

  function cancelGuestDrag() {
    document.removeEventListener('pointermove', onDragGuestMove);
    document.removeEventListener('pointerup',   onDragGuestUp);
    document.removeEventListener('pointercancel', cancelGuestDrag);
    if (ghostEl) { ghostEl.remove(); ghostEl = null; }
    if (hoveredId) { Items.highlightTable(hoveredId, false); hoveredId = null; }
    dragGuest = null;
  }

  return { bindItemDrag, bindResizeDrag, bindGuestDrag };
})();
