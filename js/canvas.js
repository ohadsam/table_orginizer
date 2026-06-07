'use strict';

const Canvas = (() => {
  let viewport, room;
  let zoom, panX, panY;
  let isPanning = false;
  let panStart = { x: 0, y: 0 };

  function init() {
    viewport = document.getElementById('canvasViewport');
    room     = document.getElementById('canvasRoom');

    const saved = State.get().canvas;
    zoom = saved.zoom;
    panX = saved.panX;
    panY = saved.panY;

    applyTransform();
    bindViewportEvents();
    bindZoomButtons();

    // Grid toggle
    document.getElementById('btnToggleGrid')?.addEventListener('click', () => {
      const s = State.get().settings;
      State.setSetting('showGrid', !s.showGrid);
      applyGrid();
    });
    applyGrid();
  }

  /* ── Transform ── */
  function applyTransform() {
    room.style.transform = `translate(${panX}px,${panY}px) scale(${zoom})`;
    document.getElementById('zoomLevel').textContent = Math.round(zoom * 100) + '%';
    State.setCanvasView(zoom, panX, panY);
  }

  function applyGrid() {
    const show = State.get().settings.showGrid;
    room.classList.toggle('show-grid', show);
  }

  /* ── Zoom ── */
  function setZoom(newZoom, cx, cy) {
    newZoom = Math.max(CONFIG.MIN_ZOOM, Math.min(CONFIG.MAX_ZOOM, newZoom));
    if (cx !== undefined && cy !== undefined) {
      const ratio = newZoom / zoom;
      panX = cx - ratio * (cx - panX);
      panY = cy - ratio * (cy - panY);
    }
    zoom = newZoom;
    applyTransform();
  }

  function bindZoomButtons() {
    document.getElementById('btnZoomIn')?.addEventListener('click', () => {
      const vr = viewport.getBoundingClientRect();
      setZoom(zoom + CONFIG.ZOOM_STEP, vr.width / 2, vr.height / 2);
    });
    document.getElementById('btnZoomOut')?.addEventListener('click', () => {
      const vr = viewport.getBoundingClientRect();
      setZoom(zoom - CONFIG.ZOOM_STEP, vr.width / 2, vr.height / 2);
    });
    document.getElementById('btnZoomFit')?.addEventListener('click', fitAll);
    document.getElementById('btnZoomReset')?.addEventListener('click', () => {
      zoom = 0.6; panX = 40; panY = 40; applyTransform();
    });
  }

  /* ── Effective canvas width (excludes any visible sidebar overlap) ── */
  function _canvasAreaW(vr) {
    vr = vr || viewport.getBoundingClientRect();
    const sb = document.getElementById('sidebar');
    if (!sb) return vr.width;
    const sbR = sb.getBoundingClientRect();
    return vr.width - Math.max(0, vr.right - sbR.left);
  }

  function fitAll() {
    const items = State.get().items;
    if (!items.length) { zoom = 0.6; panX = 40; panY = 40; applyTransform(); return; }
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    items.forEach(it => {
      minX = Math.min(minX, it.x - it.width / 2);
      minY = Math.min(minY, it.y - it.height / 2);
      maxX = Math.max(maxX, it.x + it.width / 2);
      maxY = Math.max(maxY, it.y + it.height / 2);
    });
    const pad    = 60;
    const vr     = viewport.getBoundingClientRect();
    const availW = _canvasAreaW(vr);
    const availH = vr.height;
    const fitW = (availW - pad * 2) / (maxX - minX || 1);
    const fitH = (availH - pad * 2) / (maxY - minY || 1);
    zoom = Math.max(CONFIG.MIN_ZOOM, Math.min(CONFIG.MAX_ZOOM, Math.min(fitW, fitH)));
    const contentW = (maxX - minX) * zoom;
    const contentH = (maxY - minY) * zoom;
    panX = (availW - contentW) / 2 - minX * zoom;
    panY = (availH - contentH) / 2 - minY * zoom;
    applyTransform();
  }

  /* ── Pan ── */
  function bindViewportEvents() {
    // Wheel zoom
    viewport.addEventListener('wheel', e => {
      e.preventDefault();
      const vr = viewport.getBoundingClientRect();
      const delta = e.deltaY > 0 ? -CONFIG.ZOOM_STEP : CONFIG.ZOOM_STEP;
      setZoom(zoom + delta, e.clientX - vr.left, e.clientY - vr.top);
    }, { passive: false });

    // Pan start (only on blank canvas — items stop propagation)
    viewport.addEventListener('pointerdown', e => {
      if (e.target !== viewport && e.target !== room) return;
      if (e.button === 1 || e.button === 0) {
        isPanning = true;
        panStart = { x: e.clientX - panX, y: e.clientY - panY };
        viewport.setPointerCapture(e.pointerId);
        viewport.style.cursor = 'grabbing';
      }
    });
    viewport.addEventListener('pointermove', e => {
      if (!isPanning) return;
      panX = e.clientX - panStart.x;
      panY = e.clientY - panStart.y;
      applyTransform();
    });
    viewport.addEventListener('pointerup', () => {
      isPanning = false;
      viewport.style.cursor = 'grab';
    });
    viewport.addEventListener('pointercancel', () => {
      isPanning = false;
      viewport.style.cursor = 'grab';
    });

    // Pinch-to-zoom (touch)
    let lastDist = 0;
    viewport.addEventListener('touchstart', e => {
      if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        lastDist = Math.hypot(dx, dy);
      }
    }, { passive: true });
    viewport.addEventListener('touchmove', e => {
      if (e.touches.length === 2) {
        e.preventDefault();
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const dist = Math.hypot(dx, dy);
        if (lastDist > 0) {
          const cx = (e.touches[0].clientX + e.touches[1].clientX) / 2;
          const cy = (e.touches[0].clientY + e.touches[1].clientY) / 2;
          const vr = viewport.getBoundingClientRect();
          setZoom(zoom * (dist / lastDist), cx - vr.left, cy - vr.top);
        }
        lastDist = dist;
      }
    }, { passive: false });
    viewport.addEventListener('touchend', () => { lastDist = 0; });
  }

  /* ── Coordinate helpers ── */
  function viewportToCanvas(clientX, clientY) {
    const vr = viewport.getBoundingClientRect();
    return {
      x: (clientX - vr.left - panX) / zoom,
      y: (clientY - vr.top  - panY) / zoom
    };
  }
  function canvasToViewport(cx, cy) {
    const vr = viewport.getBoundingClientRect();
    return {
      x: cx * zoom + panX + vr.left,
      y: cy * zoom + panY + vr.top
    };
  }

  /* ── Drop zone detection ── */
  function getTableUnder(clientX, clientY) {
    const pt = viewportToCanvas(clientX, clientY);
    return State.getTables().find(t => {
      const hw = t.width / 2 + 20, hh = t.height / 2 + 20;
      return Math.abs(pt.x - t.x) < hw && Math.abs(pt.y - t.y) < hh;
    }) || null;
  }

  function snapToGrid(val) {
    const g = CONFIG.GRID_SIZE;
    return State.get().settings.showGrid ? Math.round(val / g) * g : val;
  }

  /* ── Center the viewport on a specific item and flash it ── */
  function focusOnItem(id) {
    const it = State.getItem(id);
    if (!it) return;
    const vr = viewport.getBoundingClientRect();
    zoom = Math.max(0.6, Math.min(CONFIG.MAX_ZOOM, zoom));
    panX = _canvasAreaW(vr) / 2 - it.x * zoom;
    panY = vr.height        / 2 - it.y * zoom;
    applyTransform();
    Items.flashItem(id);
  }

  /* ── Jump to the table a guest is seated at ── */
  function focusGuestTable(guestId) {
    const g = State.getGuest(guestId);
    if (!g) return;
    if (!g.tableId) { UI.toast('המוזמן עדיין לא שובץ לשולחן', 'info', 1800); return; }
    focusOnItem(g.tableId);
  }

  return { init, applyTransform, setZoom, fitAll, viewportToCanvas, canvasToViewport,
           getTableUnder, snapToGrid, focusOnItem, focusGuestTable };
})();
