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

  function makeScorer(prefs, landmarks) {
    if (!prefs || !prefs.length) return () => 0;
    return table => {
      let score = 0;
      prefs.forEach(key => {
        const def = CONFIG.PROXIMITY[key];
        if (!def) return;
        const centers = landmarks[def.target];
        const d = nearestDist(table, centers);
        if (d == null) return;
        score += (def.want === 'near' ? -d : d);
      });
      return score;
    };
  }

  /* ── auto-create tables to cover the capacity deficit ── */
  function autoCreateTables(pending) {
    const totalGuests = pending.reduce((s, g) => s + g.total, 0);
    const freeCap = State.getTables()
      .filter(t => !t.locked)
      .reduce((s, t) => s + Math.max(0, t.seats - State.getTableOccupancy(t.id)), 0);
    const deficit = totalGuests - freeCap;
    if (deficit <= 0) return 0;

    const presets  = State.get().tablePresets || [];
    const settings = State.get().settings;
    const preset   = presets.length ? presets[0] : null;
    const seats    = preset?.seats  || settings.defaultFriendsSeats || 10;
    const shape    = preset?.shape  || settings.defaultShape || 'circle';
    const sz       = CONFIG.TABLE_SIZES[shape] || CONFIG.TABLE_SIZES.circle;
    const width    = preset?.width  || sz.width;
    const height   = preset?.height || sz.height;
    const numNew   = Math.ceil(deficit / seats);

    // Place below all existing items (reduce avoids Math.max(...[]) → -Infinity on empty)
    const baseY = State.get().items.reduce((acc, i) => Math.max(acc, i.y + i.height / 2), 220) + 80;
    const baseX = 350;
    const cols  = Math.min(numNew, 6);
    const gapX  = width + 50;
    const gapY  = height + 60;

    for (let i = 0; i < numNew; i++) {
      Items.addTable({
        shape, seats, width, height,
        x: baseX + (i % cols) * gapX,
        y: baseY + Math.floor(i / cols) * gapY
      });
    }
    return numNew;
  }

  /* ── main entry — returns summary { assigned, failed, splitsCreated, tablesCreated } ── */
  function run({ allowSplit = true, keepExisting = false, respectProximity = true, createTables = false }) {
    const guests = State.get().guests.slice();
    let   tables = State.getTables().slice();

    if (!tables.length && !createTables) {
      UI.toast('אין שולחנות להושיב בהם', 'warning');
      return { assigned: 0, failed: 0, splitsCreated: 0, tablesCreated: 0 };
    }

    // Unassign non-locked guests when starting fresh
    if (!keepExisting) {
      guests.forEach(g => {
        if (!g.tableId) return;
        const t = State.getItem(g.tableId);
        if (!(t && t.locked)) State.assignGuest(g.id, null);
      });
    }

    const pending = guests.filter(g => !g.tableId);
    if (!pending.length) {
      UI.toast('כל המוזמנים כבר משובצים', 'info');
      return { assigned: 0, failed: 0, splitsCreated: 0, tablesCreated: 0 };
    }

    let tablesCreated = 0;
    if (createTables) {
      tablesCreated = autoCreateTables(pending);
      tables = State.getTables().slice(); // refresh after creation
    }

    if (!tables.length) {
      UI.toast('אין שולחנות להושיב בהם', 'warning');
      return { assigned: 0, failed: 0, splitsCreated: 0, tablesCreated };
    }

    const capacity = {};
    tables.forEach(t => {
      capacity[t.id] = t.locked ? 0 : Math.max(0, t.seats - State.getTableOccupancy(t.id));
    });

    const landmarks = {
      dancefloor: respectProximity ? landmarkCenters('dancefloor') : [],
      door:       respectProximity ? landmarkCenters('door')       : []
    };

    const grouped = groupByAffinity(pending);
    let assigned = 0, failed = 0, splitsCreated = 0;

    for (const group of grouped) {
      const res = assignGroup(group, tables, capacity, allowSplit, landmarks, respectProximity);
      assigned      += res.assigned;
      failed        += res.failed;
      splitsCreated += res.splitsCreated;
    }

    return { assigned, failed, splitsCreated, tablesCreated };
  }

  /* ── group guests sharing the same tag-set, biggest groups first ── */
  function groupByAffinity(guests) {
    const tagGroups = {};
    guests.forEach(g => {
      const key = [...(g.tags || [])].sort().join('|') || '__none__';
      (tagGroups[key] || (tagGroups[key] = [])).push(g);
    });
    return Object.values(tagGroups).sort((a, b) => sumTotal(b) - sumTotal(a));
  }
  const sumTotal = arr => arr.reduce((s, g) => s + g.total, 0);

  /* ── place every guest in a group ── */
  function assignGroup(group, tables, capacity, allowSplit, landmarks, respectProximity) {
    let assigned = 0, failed = 0, splitsCreated = 0;
    group.sort((a, b) => b.total - a.total);

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
        assigned      += r.placed;
        failed        += r.leftover;
        splitsCreated += r.splitsCreated;
      } else {
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
    return { assigned, failed, splitsCreated };
  }

  function findBestTable(size, tables, capacity, scorer) {
    const candidates = tables.filter(t => capacity[t.id] >= size);
    if (!candidates.length) return null;
    return candidates.sort((a, b) => {
      const sd = scorer(b) - scorer(a);
      if (Math.abs(sd) > 1e-6) return sd;
      return capacity[a.id] - capacity[b.id];   // tightest fit
    })[0];
  }

  function mostSpacious(tables, capacity) {
    return tables
      .filter(t => capacity[t.id] > 0)
      .sort((a, b) => capacity[b.id] - capacity[a.id])[0] || null;
  }

  /* ── true split: distribute one family across several tables, creating sibling cards ── */
  function placeWithSplit(guest, tables, capacity, scorer) {
    const origTotal = guest.total;
    let remaining  = guest.total;
    let remAdults  = guest.adults;
    let first      = true;
    let splitsCreated = 0;

    while (remaining > 0) {
      const cand = tables
        .filter(t => capacity[t.id] > 0)
        .sort((a, b) => {
          const sd = scorer(b) - scorer(a);
          if (Math.abs(sd) > 1e-6) return sd;
          return capacity[b.id] - capacity[a.id];
        })[0];
      if (!cand) break;

      const take  = Math.min(capacity[cand.id], remaining);
      const aTake = Math.min(remAdults, take);
      const cTake = take - aTake;

      if (first) {
        State.updateGuest(guest.id, { adults: aTake, children: cTake });
        State.assignGuest(guest.id, cand.id);
        first = false;
      } else {
        splitsCreated++;
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

    return { placed: origTotal - remaining, leftover: remaining, splitsCreated };
  }

  return { run };
})();
