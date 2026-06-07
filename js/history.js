'use strict';

/*
 * Undo / Redo via full-state snapshots.
 * Captures the PREVIOUS state on each change (debounced), so undo restores it.
 * Restoration is guarded so it doesn't pollute the history stacks.
 */
const History = (() => {
  const MAX = 50;
  let undoStack = [];
  let redoStack = [];
  let last      = null;     // serialized snapshot of the current committed state
  let restoring = false;
  let suspended = true;     // until init() runs (avoids capturing the initial load)
  let timer     = null;

  function snapshot() { return JSON.stringify(State.serialize()); }

  function init() {
    last = snapshot();
    suspended = false;
    State.on('change', scheduleCapture);
    State.on('eventSwitched', reset);
    updateButtons();
  }

  function scheduleCapture() {
    if (suspended || restoring) return;
    clearTimeout(timer);
    timer = setTimeout(capture, 350);
  }

  function capture() {
    if (suspended || restoring) return;
    const cur = snapshot();
    if (cur === last) return;          // nothing actually changed
    undoStack.push(last);
    if (undoStack.length > MAX) undoStack.shift();
    redoStack = [];
    last = cur;
    updateButtons();
  }

  function applySnapshot(json) {
    restoring = true;
    State.deserialize(JSON.parse(json));   // emits dataLoaded → full re-render
    restoring = false;
  }

  function undo() {
    clearTimeout(timer);
    capture();                 // flush any pending change first
    if (!undoStack.length) { UI.toast('אין פעולות לביטול', 'info', 1500); return; }
    redoStack.push(last);
    last = undoStack.pop();
    applySnapshot(last);
    updateButtons();
    UI.toast('בוטל ↩', 'info', 1200);
  }

  function redo() {
    clearTimeout(timer);
    capture();                 // flush any pending change first (mirrors undo)
    if (!redoStack.length) { UI.toast('אין פעולות לשחזור', 'info', 1500); return; }
    undoStack.push(last);
    last = redoStack.pop();
    applySnapshot(last);
    updateButtons();
    UI.toast('שוחזר ↪', 'info', 1200);
  }

  function updateButtons() {
    const u = document.getElementById('btnUndo');
    const r = document.getElementById('btnRedo');
    if (u) u.disabled = undoStack.length === 0;
    if (r) r.disabled = redoStack.length === 0;
  }

  function reset() {
    clearTimeout(timer);
    undoStack = [];
    redoStack = [];
    last = snapshot();
    updateButtons();
  }

  return { init, undo, redo, updateButtons, reset };
})();
