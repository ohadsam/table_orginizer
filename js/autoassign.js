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

    // Dance floor: compute center + radius for ring placement
    const dfs = existing.filter(i => i.type === 'dancefloor');
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
