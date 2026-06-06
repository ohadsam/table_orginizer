'use strict';

const AutoAssign = (() => {

  function run({ allowSplit = true, keepExisting = false }) {
    const state  = State.get();
    let tables   = State.getTables().slice();
    let guests   = state.guests.slice();

    if (!tables.length) { UI.toast('אין שולחנות להושיב בהם', 'warning'); return; }

    // Unassign guests if not keeping
    if (!keepExisting) {
      guests.forEach(g => { if (g.tableId) State.assignGuest(g.id, null); });
    }

    // Work with unassigned guests only
    const unassigned = keepExisting
      ? guests.filter(g => !g.tableId)
      : guests.slice();

    if (!unassigned.length) { UI.toast('כל המוזמנים כבר משובצים', 'info'); return; }

    // Build available capacity map
    const capacity = {};
    tables.forEach(t => {
      capacity[t.id] = t.seats - (keepExisting ? State.getTableOccupancy(t.id) : 0);
    });

    // Group guests by tags for affinity
    const grouped = groupByAffinity(unassigned);
    let assigned = 0;
    let failed   = 0;

    for (const group of grouped) {
      const result = assignGroup(group, tables, capacity, allowSplit);
      assigned += result.assigned;
      failed   += result.failed;
    }

    const msg = `שיבוץ הושלם: ${assigned} מוזמנים שובצו` + (failed ? `, ${failed} לא שובצו (אין מקום)` : '');
    UI.toast(msg, failed ? 'warning' : 'success', 5000);
  }

  function groupByAffinity(guests) {
    // Sort: guests with same tags go together, larger groups first
    const tagGroups = {};
    guests.forEach(g => {
      const key = (g.tags || []).sort().join('|') || '__none__';
      (tagGroups[key] || (tagGroups[key] = [])).push(g);
    });
    return Object.values(tagGroups).sort((a, b) => {
      const sa = a.reduce((s, g) => s + g.total, 0);
      const sb = b.reduce((s, g) => s + g.total, 0);
      return sb - sa;
    });
  }

  function assignGroup(group, tables, capacity, allowSplit) {
    let assigned = 0, failed = 0;

    // Sort guests in group: larger first
    group.sort((a, b) => b.total - a.total);

    for (const guest of group) {
      if (guest.tableId) continue; // already assigned

      // Find table with enough space
      const fit = findBestTable(guest.total, tables, capacity);
      if (fit) {
        State.assignGuest(guest.id, fit.id);
        capacity[fit.id] -= guest.total;
        assigned += guest.total;
      } else if (allowSplit) {
        // Try to split across tables
        const splitResult = trySplit(guest, tables, capacity);
        if (splitResult) {
          assigned += guest.total;
        } else {
          failed += guest.total;
        }
      } else {
        // Put in best available even if overflow
        const best = tables
          .filter(t => capacity[t.id] > 0)
          .sort((a, b) => capacity[b.id] - capacity[a.id])[0];
        if (best) {
          State.assignGuest(guest.id, best.id);
          capacity[best.id] -= guest.total;
          assigned += guest.total;
        } else {
          failed += guest.total;
        }
      }
    }
    return { assigned, failed };
  }

  function findBestTable(size, tables, capacity) {
    // Best fit: smallest table that still fits
    return tables
      .filter(t => capacity[t.id] >= size)
      .sort((a, b) => capacity[a.id] - capacity[b.id])[0] || null;
  }

  function trySplit(guest, tables, capacity) {
    // Can't really split a single group card into multiple tables in our model
    // Instead, find the table with the most remaining seats and assign there
    const best = tables
      .filter(t => capacity[t.id] > 0)
      .sort((a, b) => capacity[b.id] - capacity[a.id])[0];
    if (!best) return false;
    State.assignGuest(guest.id, best.id);
    capacity[best.id] -= guest.total;
    return true;
  }

  return { run };
})();
