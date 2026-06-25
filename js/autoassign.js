'use strict';

const AutoAssign = (() => {

  /* ── landmark geometry for proximity scoring ── */
  function landmarkCenters(type) {
    // For dancefloor, also include any isCentral items as equivalent reference points
    return State.get().items
      .filter(i => i.type === type || (type === 'dancefloor' && i.isCentral))
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

  /* ── auto-create tables: collision-free placement, ring around dance floor ── */
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

    const existing = State.get().items;
    const GAP = 50; // minimum edge-to-edge clearance

    // Store raw half-dims; GAP is added once inside collides()
    const obstacles = existing.map(i => ({
      cx: i.x, cy: i.y,
      hw: i.width  / 2,
      hh: i.height / 2
    }));

    const tw = width  / 2;
    const th = height / 2;

    // Overlap when edge-to-edge distance < GAP
    function collides(cx, cy, placed) {
      return [...obstacles, ...placed].some(r =>
        Math.abs(cx - r.cx) < tw + r.hw + GAP &&
        Math.abs(cy - r.cy) < th + r.hh + GAP
      );
    }

    // Room area: bounding box of existing items extended outward, with generous defaults
    let areaX = 100, areaY = 100, areaX2 = 1700, areaY2 = 1300;
    if (existing.length) {
      const xs = existing.flatMap(i => [i.x - i.width / 2, i.x + i.width / 2]);
      const ys = existing.flatMap(i => [i.y - i.height / 2, i.y + i.height / 2]);
      areaX  = Math.min(...xs) - 160;
      areaY  = Math.min(...ys) - 160;
      areaX2 = Math.max(...xs) + 160;
      areaY2 = Math.max(...ys) + 160;
      // Ensure minimum canvas size
      if (areaX2 - areaX < 1200) { const cx = (areaX + areaX2) / 2; areaX = cx - 600; areaX2 = cx + 600; }
      if (areaY2 - areaY < 900)  { const cy = (areaY + areaY2) / 2; areaY = cy - 450; areaY2 = cy + 450; }
    }

    // Central elements (dancefloor + isCentral items): compute center + radius for ring placement
    const dfs = existing.filter(i => i.type === 'dancefloor' || i.isCentral);
    const dfCx = dfs.length ? dfs.reduce((s, d) => s + d.x, 0) / dfs.length : (areaX + areaX2) / 2;
    const dfCy = dfs.length ? dfs.reduce((s, d) => s + d.y, 0) / dfs.length : (areaY + areaY2) / 2;
    const dfR  = dfs.length
      ? dfs.reduce((s, d) => s + Math.max(d.width, d.height) / 2, 0) / dfs.length
      : 0;
    const ringTarget = dfR + Math.max(width, height) / 2 + GAP * 1.5;

    // Generate grid candidates across the room area
    const stepX = width  + GAP;
    const stepY = height + GAP;
    const candidates = [];
    for (let cx = areaX + tw + GAP / 2; cx <= areaX2 - tw - GAP / 2; cx += stepX) {
      for (let cy = areaY + th + GAP / 2; cy <= areaY2 - th - GAP / 2; cy += stepY) {
        const dist  = Math.hypot(cx - dfCx, cy - dfCy);
        // Ring score (lower = better): prefer positions at ringTarget distance from dance floor
        const score = dfs.length ? Math.abs(dist - ringTarget) : 0;
        candidates.push({ cx, cy, score });
      }
    }

    // Sort: ring-closest first when dance floor present; else preserve grid order (natural spread)
    if (dfs.length) candidates.sort((a, b) => a.score - b.score);

    const placed = [];
    let created = 0;

    for (const c of candidates) {
      if (created >= numNew) break;
      if (!collides(c.cx, c.cy, placed)) {
        Items.addTable({ shape, seats, width, height, x: c.cx, y: c.cy });
        placed.push({ cx: c.cx, cy: c.cy, hw: tw, hh: th }); // raw half-dims; GAP added in collides()
        created++;
      }
    }

    // Fallback: if grid didn't fit all tables, stack below all current items (live state)
    if (created < numNew) {
      const liveItems = State.get().items;
      const baseY = liveItems.reduce((acc, i) => Math.max(acc, i.y + i.height / 2), areaY2 - 80) + GAP;
      const cols  = Math.min(numNew - created, 6);
      for (let i = 0; created < numNew; i++, created++) {
        Items.addTable({
          shape, seats, width, height,
          x: areaX + tw + GAP + (i % cols) * stepX,
          y: baseY + th + GAP + Math.floor(i / cols) * stepY
        });
      }
    }

    return created;
  }

  /* ── build dependency maps for constraint checking ── */
  function buildDepMaps(guestDependencies) {
    const forbidden  = {};  // guestId → Set of forbidden co-table guestIds
    const required   = {};  // guestId → Set of required co-table guestIds
    const preferred  = {};  // guestId → Set of preferred co-table guestIds
    const avoid      = {};  // guestId → Set of avoid co-table guestIds

    function add(map, a, b) {
      if (!map[a]) map[a] = new Set();
      if (!map[b]) map[b] = new Set();
      map[a].add(b); map[b].add(a);
    }

    (guestDependencies || []).forEach(dep => {
      const s = dep.strength;
      if (s === 'forbidden') { add(forbidden, dep.guestA, dep.guestB); }
      else if (s === 'required') { add(required, dep.guestA, dep.guestB); }
      else if (s === 'preferred') { add(preferred, dep.guestA, dep.guestB); }
      else if (s === 'avoid') { add(avoid, dep.guestA, dep.guestB); }
    });

    return { forbidden, required, preferred, avoid };
  }

  /* ── constraint score for placing guest at a specific table ── */
  function depScore(guestId, tableId, depMaps, tableGuests) {
    const occupants = new Set((tableGuests[tableId] || []).map(g => g.id));
    let score = 0;
    if (depMaps.preferred[guestId]) depMaps.preferred[guestId].forEach(id => { if (occupants.has(id)) score += 200; });
    if (depMaps.required[guestId])  depMaps.required[guestId].forEach(id =>  { if (occupants.has(id)) score += 500; });
    if (depMaps.avoid[guestId])     depMaps.avoid[guestId].forEach(id =>     { if (occupants.has(id)) score -= 300; });
    return score;
  }

  /* ── check hard constraints: forbidden pair at same table ── */
  function hasForbidden(guestId, tableId, depMaps, tableGuests) {
    if (!depMaps.forbidden[guestId]) return false;
    const occupants = new Set((tableGuests[tableId] || []).map(g => g.id));
    return [...depMaps.forbidden[guestId]].some(id => occupants.has(id));
  }

  /* ── Fisher-Yates shuffle (in-place) ── */
  function _shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  // (compact algorithm uses findBestTable with its own scorer)

  /* ── internal run core — shared by all algorithms ── */
  function _runCore(opts) {
    const { allowSplit, keepExisting, respectProximity, createTables, algorithm } = opts;
    const state  = State.get();
    const guests = state.guests.slice();
    let   tables = State.getTables().slice();

    const aaSettings = state.settings?.autoAssign || {};
    const respectDeps = aaSettings.respectDependencies !== false;

    if (!tables.length && !createTables) {
      return null; // caller shows toast
    }

    if (!keepExisting) {
      guests.forEach(g => {
        if (!g.tableId) return;
        const t = State.getItem(g.tableId);
        if (!(t && t.locked)) State.assignGuest(g.id, null);
      });
    }

    const pending = State.get().guests.filter(g => !g.tableId && !g.splitOf);
    if (!pending.length) return null;

    let tablesCreated = 0;
    if (createTables) {
      tablesCreated = autoCreateTables(pending);
      tables = State.getTables().slice();
    }

    if (!tables.length) return null;

    const capacity = {};
    tables.forEach(t => {
      capacity[t.id] = t.locked ? 0 : Math.max(0, t.seats - State.getTableOccupancy(t.id));
    });

    const landmarks = {
      dancefloor: respectProximity ? landmarkCenters('dancefloor') : [],
      door:       respectProximity ? landmarkCenters('door')       : []
    };

    const tableGuests = {};
    tables.forEach(t => { tableGuests[t.id] = State.getTableGuests(t.id); });

    const depMaps = respectDeps
      ? buildDepMaps(state.guestDependencies)
      : { forbidden: {}, required: {}, preferred: {}, avoid: {} };

    let ordered;
    if (algorithm === 'random-greedy') {
      ordered = _shuffle([...pending]);
    } else if (algorithm === 'compact') {
      ordered = [...pending].sort((a, b) => b.total - a.total);
    } else if (algorithm === 'round-robin') {
      ordered = _shuffle([...pending]);
    } else {
      // csp-greedy (default)
      ordered = sortByConstraints(pending, depMaps);
    }

    let assigned = 0, failed = 0, splitsCreated = 0;

    Guests.startBatch();
    try {
      if (algorithm === 'round-robin') {
        const result = _assignRoundRobin(ordered, tables, capacity, allowSplit, landmarks, respectProximity, depMaps, tableGuests);
        assigned      = result.assigned;
        failed        = result.failed;
        splitsCreated = result.splitsCreated;
      } else if (algorithm === 'compact') {
        for (const guest of ordered) {
          if (guest.tableId) continue;
          // Compact: prefer tables that are most occupied (fewest free seats after placing)
          // Score = depScore MINUS free space (so less free = higher score)
          const maxCap = Math.max(...tables.map(t => t.seats), 1);
          const scorer = g => depScore(guest.id, g.id, depMaps, tableGuests) + (maxCap - capacity[g.id]);
          const fit = findBestTable(guest.total, tables, capacity, scorer, guest.id, depMaps, tableGuests);
          if (fit) {
            State.assignGuest(guest.id, fit.id);
            capacity[fit.id] -= guest.total;
            if (!tableGuests[fit.id]) tableGuests[fit.id] = [];
            tableGuests[fit.id].push(guest);
            assigned += guest.total;
          } else if (allowSplit) {
            const r = placeWithSplit(guest, tables, capacity, scorer, depMaps, tableGuests);
            assigned      += r.placed;
            failed        += r.leftover;
            splitsCreated += r.splitsCreated;
          } else {
            failed += guest.total;
          }
        }
      } else {
        const grouped = groupByAffinity(ordered);
        for (const group of grouped) {
          const res = assignGroup(group, tables, capacity, allowSplit, landmarks, respectProximity, depMaps, tableGuests);
          assigned      += res.assigned;
          failed        += res.failed;
          splitsCreated += res.splitsCreated;
        }
      }
    } finally {
      Guests.endBatch();
    }

    return { assigned, failed, splitsCreated, tablesCreated };
  }

  function _assignRoundRobin(guests, tables, capacity, allowSplit, landmarks, respectProximity, depMaps, tableGuests) {
    // Distribute one guest at a time across tables in round-robin order
    const eligible = tables.filter(t => capacity[t.id] > 0);
    let tIdx = 0;
    let assigned = 0, failed = 0, splitsCreated = 0;

    for (const guest of guests) {
      if (guest.tableId) continue;
      // Find next table with enough space (wrapping around)
      let placed = false;
      for (let attempt = 0; attempt < eligible.length; attempt++) {
        const t = eligible[(tIdx + attempt) % eligible.length];
        if (capacity[t.id] >= guest.total && !hasForbidden(guest.id, t.id, depMaps, tableGuests)) {
          State.assignGuest(guest.id, t.id);
          capacity[t.id] -= guest.total;
          if (!tableGuests[t.id]) tableGuests[t.id] = [];
          tableGuests[t.id].push(guest);
          assigned += guest.total;
          tIdx = (tIdx + attempt + 1) % eligible.length;
          placed = true;
          break;
        }
      }
      if (!placed) {
        if (allowSplit) {
          const scorer = () => 0;
          const r = placeWithSplit(guest, tables, capacity, scorer, depMaps, tableGuests);
          assigned      += r.placed;
          failed        += r.leftover;
          splitsCreated += r.splitsCreated;
        } else {
          failed += guest.total;
        }
      }
    }
    return { assigned, failed, splitsCreated };
  }

  /* ── score a complete assignment: fewer unplaced = better; fewer splits = better ── */
  function _scoreResult(result) {
    if (!result) return -Infinity;
    return result.assigned - result.failed * 10 - result.splitsCreated * 2;
  }

  /* ── serialize current assignment for snapshot (includes split guest IDs) ── */
  function _snapshotAssignments() {
    return State.get().guests.map(g => ({ id: g.id, tableId: g.tableId || null, splitOf: g.splitOf || null }));
  }

  /* ── restore assignment snapshot: remove splits created since snap, restore tableIds ── */
  function _restoreAssignments(snap) {
    const snapIds = new Set(snap.map(s => s.id));
    Guests.startBatch();
    try {
      // Remove any split guests added after the snapshot
      State.get().guests.filter(g => g.splitOf && !snapIds.has(g.id))
        .forEach(g => State.removeGuest ? State.removeGuest(g.id) : State.assignGuest(g.id, null));
      // Unassign all remaining
      State.get().guests.forEach(g => { if (g.tableId) State.assignGuest(g.id, null); });
      // Restore original assignments
      snap.forEach(s => { if (s.tableId) State.assignGuest(s.id, s.tableId); });
    } finally {
      Guests.endBatch();
    }
  }

  /* ── reroll: run N iterations and keep best result ── */
  function reroll(opts, runs) {
    runs = Math.max(2, Math.min(10, runs || 5));
    const algs = ['csp-greedy', 'random-greedy', 'compact', 'round-robin'];

    // Pre-create tables once (not per-iteration) to avoid accumulating N×tables in state.
    // Unassign everyone first so autoCreateTables sees full free capacity.
    let tablesCreated = 0;
    if (opts.createTables) {
      Guests.startBatch();
      try { State.get().guests.forEach(g => { if (g.tableId) State.assignGuest(g.id, null); }); }
      finally { Guests.endBatch(); }
      const pending = State.get().guests.filter(g => !g.splitOf);
      if (pending.length) tablesCreated = autoCreateTables(pending);
    }

    // Snapshot with all guests unassigned — restored at the start of every iteration
    const snap0    = _snapshotAssignments();
    let bestResult = null;
    let bestScore  = -Infinity;
    let bestSnap   = null;

    for (let i = 0; i < runs; i++) {
      _restoreAssignments(snap0);          // clean slate before each attempt
      const alg    = algs[i % algs.length];
      const result = _runCore({ ...opts, createTables: false, keepExisting: false, algorithm: alg });
      if (!result) continue;
      const score = _scoreResult(result);
      if (score > bestScore) {
        bestScore  = score;
        bestResult = { ...result, tablesCreated, algorithm: alg };
        bestSnap   = _snapshotAssignments();
      }
    }

    // Apply best
    if (bestSnap) _restoreAssignments(bestSnap);
    return { ...(bestResult || { assigned: 0, failed: 0, splitsCreated: 0, tablesCreated: 0 }), runs, rerolled: true };
  }

  /* ── main entry — returns summary { assigned, failed, splitsCreated, tablesCreated } ── */
  function run(opts) {
    const { createTables, keepExisting } = opts;
    const tables = State.getTables();
    if (!tables.length && !createTables) {
      UI.toast('אין שולחנות להושיב בהם', 'warning');
      return { assigned: 0, failed: 0, splitsCreated: 0, tablesCreated: 0 };
    }
    const allGuests = State.get().guests.filter(g => !g.splitOf);
    if (!allGuests.length) {
      UI.toast('אין מוזמנים לשיבוץ', 'info');
      return { assigned: 0, failed: 0, splitsCreated: 0, tablesCreated: 0 };
    }
    // If keepExisting, check if there's anyone left to assign
    const pending = allGuests.filter(g => !g.tableId);
    if (keepExisting && !pending.length) {
      UI.toast('כל המוזמנים כבר משובצים', 'info');
      return { assigned: 0, failed: 0, splitsCreated: 0, tablesCreated: 0 };
    }
    return _runCore(opts) || { assigned: 0, failed: 0, splitsCreated: 0, tablesCreated: 0 };
  }

  /* ── sort most-constrained guests first (required/forbidden deps → more constrained) ── */
  function sortByConstraints(guests, depMaps) {
    return [...guests].sort((a, b) => {
      const cA = ((depMaps.required[a.id] || new Set()).size + (depMaps.forbidden[a.id] || new Set()).size);
      const cB = ((depMaps.required[b.id] || new Set()).size + (depMaps.forbidden[b.id] || new Set()).size);
      if (cB !== cA) return cB - cA;  // more constrained first
      return b.total - a.total;        // then larger groups first
    });
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
  function assignGroup(group, tables, capacity, allowSplit, landmarks, respectProximity, depMaps, tableGuests) {
    let assigned = 0, failed = 0, splitsCreated = 0;
    group.sort((a, b) => b.total - a.total);

    for (const guest of group) {
      if (guest.tableId) continue;
      const scorer = g => {
        const proxScore = respectProximity ? makeScorer(guest.proximity, landmarks)(g) : 0;
        const dScore    = depScore(guest.id, g.id, depMaps, tableGuests);
        return proxScore + dScore;
      };

      const fit = findBestTable(guest.total, tables, capacity, scorer, guest.id, depMaps, tableGuests);
      if (fit) {
        State.assignGuest(guest.id, fit.id);
        capacity[fit.id] -= guest.total;
        if (!tableGuests[fit.id]) tableGuests[fit.id] = [];
        tableGuests[fit.id].push(guest);
        assigned += guest.total;
        continue;
      }

      if (allowSplit) {
        const r = placeWithSplit(guest, tables, capacity, scorer, depMaps, tableGuests);
        assigned      += r.placed;
        failed        += r.leftover;
        splitsCreated += r.splitsCreated;
      } else {
        const best = mostSpacious(tables, capacity, guest.id, depMaps, tableGuests);
        if (best && capacity[best.id] >= guest.total) {
          State.assignGuest(guest.id, best.id);
          capacity[best.id] -= guest.total;
          if (!tableGuests[best.id]) tableGuests[best.id] = [];
          tableGuests[best.id].push(guest);
          assigned += guest.total;
        } else {
          failed += guest.total;
        }
      }
    }
    return { assigned, failed, splitsCreated };
  }

  function findBestTable(size, tables, capacity, scorer, guestId, depMaps, tableGuests) {
    // Filter: enough capacity AND no forbidden constraint
    const candidates = tables.filter(t =>
      capacity[t.id] >= size &&
      !hasForbidden(guestId, t.id, depMaps, tableGuests)
    );
    if (!candidates.length) return null;
    return candidates.sort((a, b) => {
      const sd = scorer(b) - scorer(a);
      if (Math.abs(sd) > 1e-6) return sd;
      return capacity[a.id] - capacity[b.id];   // tightest fit (prefer less waste)
    })[0];
  }

  function mostSpacious(tables, capacity, guestId, depMaps, tableGuests) {
    return tables
      .filter(t => capacity[t.id] > 0 && !hasForbidden(guestId, t.id, depMaps, tableGuests))
      .sort((a, b) => capacity[b.id] - capacity[a.id])[0] || null;
  }

  /* ── true split: distribute one family across several tables, creating sibling cards ── */
  function placeWithSplit(guest, tables, capacity, scorer, depMaps, tableGuests) {
    const origTotal = guest.total;
    let remaining  = guest.total;
    let remAdults  = guest.adults;
    let first      = true;
    let splitsCreated = 0;

    while (remaining > 0) {
      const cand = tables
        .filter(t => capacity[t.id] > 0 && !hasForbidden(guest.id, t.id, depMaps, tableGuests))
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
        if (!tableGuests[cand.id]) tableGuests[cand.id] = [];
        tableGuests[cand.id].push(guest);
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
        if (!tableGuests[cand.id]) tableGuests[cand.id] = [];
        tableGuests[cand.id].push(child);
      }

      capacity[cand.id] -= take;
      remaining -= take;
      remAdults -= aTake;
    }

    return { placed: origTotal - remaining, leftover: remaining, splitsCreated };
  }

  return { run, reroll };
})();
