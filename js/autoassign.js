'use strict';

const AutoAssign = (() => {

  /* ── landmark geometry for proximity scoring ── */
  function landmarkCenters(type) {
    return State.get().items
      .filter(i => i.type === type)
      .map(i => ({ x: i.x, y: i.y }));
  }
  function nearestDist(table, centers) {
    if (!centers || !centers.length) return null;
    return Math.min(...centers.map(c => Math.hypot(table.x - c.x, table.y - c.y)));
  }

  // Higher score = better match for the guest's proximity preferences.
  function makeScorer(prefs, landmarks) {
    if (!prefs || !prefs.length) return () => 0;
    return table => {
      let score = 0;
      prefs.forEach(key => {
        const def = CONFIG.PROXIMITY[key];
        if (!def) return;
        const centers = landmarks[def.target];
        const d = nearestDist(table, centers);
        if (d == null) return;                 // no such landmark on the board
        score += (def.want === 'near' ? -d : d);
      });
      return score;
    };
  }

  /* ── main entry ── */
  function run({ allowSplit = true, keepExisting = false, respectProximity = true }) {
    const state  = State.get();
    const tables = State.getTables().slice();
    const guests = state.guests.slice();

    if (!tables.length) { UI.toast('אין שולחנות להושיב בהם', 'warning'); return; }

    // Unassign non-locked guests when starting fresh; locked tables keep their guests.
    if (!keepExisting) {
      guests.forEach(g => {
        if (!g.tableId) return;
        const t = State.getItem(g.tableId);
        if (!(t && t.locked)) State.assignGuest(g.id, null);
      });
    }

    // Remaining capacity per table (locked tables accept nothing new).
    const capacity = {};
    tables.forEach(t => {
      capacity[t.id] = t.locked ? 0 : Math.max(0, t.seats - State.getTableOccupancy(t.id));
    });

    const landmarks = {
      dancefloor: respectProximity ? landmarkCenters('dancefloor') : [],
      door:       respectProximity ? landmarkCenters('door')       : []
    };

    // Only place guests that are currently unassigned.
    const pending = guests.filter(g => !g.tableId);
    if (!pending.length) { UI.toast('כל המוזמנים כבר משובצים', 'info'); return; }

    const grouped = groupByAffinity(pending);
    let assigned = 0, failed = 0;

    for (const group of grouped) {
      const res = assignGroup(group, tables, capacity, allowSplit, landmarks, respectProximity);
      assigned += res.assigned;
      failed   += res.failed;
    }

    const msg = `שיבוץ הושלם: ${assigned} מוזמנים שובצו`
      + (failed ? `, ${failed} לא שובצו (אין מקום פנוי)` : '');
    UI.toast(msg, failed ? 'warning' : 'success', 5000);
  }

  /* ── group guests sharing the same tag-set, biggest groups first ── */
  function groupByAffinity(guests) {
    const tagGroups = {};
    guests.forEach(g => {
      const key = [...(g.tags || [])].sort().join('|') || '__none__';  // copy → no state mutation
      (tagGroups[key] || (tagGroups[key] = [])).push(g);
    });
    return Object.values(tagGroups).sort((a, b) =>
      sumTotal(b) - sumTotal(a)
    );
  }
  const sumTotal = arr => arr.reduce((s, g) => s + g.total, 0);

  /* ── place every guest in a group ── */
  function assignGroup(group, tables, capacity, allowSplit, landmarks, respectProximity) {
    let assigned = 0, failed = 0;
    group.sort((a, b) => b.total - a.total);   // larger families first

    for (const guest of group) {
      if (guest.tableId) continue;
      const scorer = respectProximity
        ? makeScorer(guest.proximity, landmarks)
        : () => 0;

      const fit = findBestTable(guest.total, tables, capacity, scorer);
      if (fit) {
        State.assignGuest(guest.id, fit.id);
        capacity[fit.id] -= guest.total;
        assigned += guest.total;
        continue;
      }

      if (allowSplit) {
        const r = placeWithSplit(guest, tables, capacity, scorer);
        assigned += r.placed;
        failed   += r.leftover;
      } else {
        // No split: drop the whole group into the most spacious table (may overflow).
        const best = mostSpacious(tables, capacity);
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

  // Best fit among tables that can hold the whole group; proximity score breaks ties.
  function findBestTable(size, tables, capacity, scorer) {
    const candidates = tables.filter(t => capacity[t.id] >= size);
    if (!candidates.length) return null;
    return candidates.sort((a, b) => {
      const sd = scorer(b) - scorer(a);          // higher score first
      if (Math.abs(sd) > 1e-6) return sd;
      return capacity[a.id] - capacity[b.id];    // then tightest fit
    })[0];
  }

  function mostSpacious(tables, capacity) {
    return tables
      .filter(t => capacity[t.id] > 0)
      .sort((a, b) => capacity[b.id] - capacity[a.id])[0] || null;
  }

  /* ── true split: distribute one family across several tables, creating sibling cards ── */
  function placeWithSplit(guest, tables, capacity, scorer) {
    const origTotal = guest.total;          // capture before updateGuest mutates it
    let remaining  = guest.total;
    let remAdults  = guest.adults;
    let first      = true;

    while (remaining > 0) {
      const cand = tables
        .filter(t => capacity[t.id] > 0)
        .sort((a, b) => {
          const sd = scorer(b) - scorer(a);
          if (Math.abs(sd) > 1e-6) return sd;
          return capacity[b.id] - capacity[a.id];  // most room first when splitting
        })[0];
      if (!cand) break;

      const take   = Math.min(capacity[cand.id], remaining);
      const aTake  = Math.min(remAdults, take);
      const cTake  = take - aTake;

      if (first) {
        State.updateGuest(guest.id, { adults: aTake, children: cTake });
        State.assignGuest(guest.id, cand.id);
        first = false;
      } else {
        const child = State.addGuest({
          name:      guest.name + ' (המשך)',
          adults:    aTake,
          children:  cTake,
          tags:      [...(guest.tags || [])],
          proximity: [...(guest.proximity || [])],
          notes:     guest.notes || '',
          splitOf:   guest.id
        });
        State.assignGuest(child.id, cand.id);
      }

      capacity[cand.id] -= take;
      remaining -= take;
      remAdults -= aTake;
    }

    return { placed: origTotal - remaining, leftover: remaining };
  }

  return { run };
})();
