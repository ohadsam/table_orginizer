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
    setText('statTotal',    s.totalGuests);
    setText('statSeated',   s.seatedGuests);
    setText('statPending',  s.pendingGuests);
    setText('statTables',   s.totalTables);
    setText('statAdults',   s.totalAdults);
    setText('statChildren', s.totalChildren);
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

  /* ── Storage warning (floating notification) ── */
  const _WARN_DISMISSED_KEY = 'sp_storage_warn_dismissed';
  const _WARN_TS_KEY        = 'sp_storage_warn_last';
  const _WARN_INTERVAL      = 4 * 60 * 60 * 1000; // 4 hours

  function showStorageWarning(force) {
    if (!force) {
      if (localStorage.getItem(_WARN_DISMISSED_KEY) === 'true') return;
      const last = parseInt(localStorage.getItem(_WARN_TS_KEY) || '0');
      if (Date.now() - last < _WARN_INTERVAL) return;
    }
    localStorage.setItem(_WARN_TS_KEY, String(Date.now()));
    document.getElementById('_storageWarn')?.remove();

    const div = document.createElement('div');
    div.id = '_storageWarn';
    div.className = 'storage-warning';
    div.innerHTML = `
      <div class="sw-header">
        <span class="sw-icon">💾</span>
        <strong class="sw-title">שמירה בדפדפן בלבד</strong>
        <button class="sw-close" title="סגור">✕</button>
      </div>
      <p class="sw-body">כל הנתונים נשמרים <strong>בדפדפן בלבד</strong>. ניקוי Cache של הדפדפן ימחק את כל הנתונים. מומלץ לייצא את הפרויקט (📦 → ייצוא פרויקט) מידי פעם לגיבוי חיצוני.</p>
      <label class="sw-no-more"><input type="checkbox" id="_swDismiss"> אל תציג הודעה זו שוב</label>`;
    document.body.appendChild(div);

    div.querySelector('.sw-close').addEventListener('click', () => {
      if (document.getElementById('_swDismiss')?.checked) {
        localStorage.setItem(_WARN_DISMISSED_KEY, 'true');
      }
      div.classList.add('sw-hiding');
      setTimeout(() => div.remove(), 300);
    });
  }

  /* ── Getting started tips (modal, one-time or forced) ── */
  const _GS_KEY = 'sp_gs_shown';

  function showGettingStarted(force) {
    if (!force && localStorage.getItem(_GS_KEY) === 'true') return;
    localStorage.setItem(_GS_KEY, 'true');
    setTimeout(() => openModal('modalGettingStarted'), 500);
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

  return { toast, openModal, closeModal, closeAllModals, updateStats, tagColor, tagBadge, escHtml, confirmDialog, initModals, initMobileSidebar, showStorageWarning, showGettingStarted };
})();
