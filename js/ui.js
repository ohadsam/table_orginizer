'use strict';

const UI = (() => {
  /* ── Toast ── */
  function toast(message, type = 'info', duration = 3500) {
    const container = document.getElementById('toastContainer');
    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    el.innerHTML = message;
    container.appendChild(el);
    requestAnimationFrame(() => el.classList.add('visible'));
    setTimeout(() => {
      el.classList.remove('visible');
      setTimeout(() => el.remove(), 350);
    }, duration);
  }

  /* ── Modals ── */
  function openModal(id) {
    const el = document.getElementById(id);
    if (el) { el.classList.add('active'); el.querySelector('[autofocus]')?.focus(); }
  }
  function closeModal(id) {
    const el = document.getElementById(id);
    if (el) el.classList.remove('active');
  }
  function closeAllModals() {
    document.querySelectorAll('.modal-overlay.active').forEach(m => m.classList.remove('active'));
  }

  /* ── Stats ── */
  function updateStats() {
    const s = State.getStats();
    setText('statTotal',   s.totalGuests);
    setText('statSeated',  s.seatedGuests);
    setText('statPending', s.pendingGuests);
    setText('statTables',  s.totalTables);
  }

  function setText(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  }

  /* ── Tag helpers ── */
  function tagColor(tag) {
    const tags = State.get().tags;
    const idx = tags.indexOf(tag);
    return CONFIG.TAG_PALETTE[((idx < 0 ? 0 : idx) % CONFIG.TAG_PALETTE.length)];
  }

  function tagBadge(tag) {
    const color = tagColor(tag);
    return `<span class="tag-badge" style="background:${color}22;color:${color};border-color:${color}44">${escHtml(tag)}</span>`;
  }

  /* ── Util ── */
  function escHtml(str) {
    return String(str)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  }

  function confirmDialog(msg) {
    return window.confirm(msg);
  }

  /* ── Init modal close behaviour ── */
  function initModals() {
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
      overlay.addEventListener('pointerdown', e => {
        if (e.target === overlay) overlay.classList.remove('active');
      });
    });
    document.querySelectorAll('[data-close-modal]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.closeModal || btn.closest('.modal-overlay')?.id;
        if (id) closeModal(id);
      });
    });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') closeAllModals();
    });
  }

  /* ── Mobile sidebar toggle ── */
  function initMobileSidebar() {
    const toggle = document.getElementById('btnMobileSidebar');
    const sidebar = document.getElementById('sidebar');
    if (!toggle || !sidebar) return;
    toggle.addEventListener('click', () => {
      sidebar.classList.toggle('sidebar-open');
      toggle.textContent = sidebar.classList.contains('sidebar-open') ? '✕' : '☰';
    });
    // Close sidebar when clicking outside on mobile
    document.addEventListener('pointerdown', e => {
      if (window.innerWidth <= 768 && sidebar.classList.contains('sidebar-open')
          && !sidebar.contains(e.target) && e.target !== toggle) {
        sidebar.classList.remove('sidebar-open');
        toggle.textContent = '☰';
      }
    });
  }

  return { toast, openModal, closeModal, closeAllModals, updateStats, tagColor, tagBadge, escHtml, confirmDialog, initModals, initMobileSidebar };
})();
