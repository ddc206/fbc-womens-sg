// Builds monthly prayer groups of 2–3 people so nobody is grouped with
// someone they've already been with. Works in the browser (window.PrayerGroups)
// and in Node (module.exports) so it can be tested from the command line.
(function (root) {
  function shuffle(a) {
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function pairKey(a, b) { return a < b ? a + '\u0000' + b : b + '\u0000' + a; }

  function pairsIn(group) {
    var out = [];
    for (var i = 0; i < group.length; i++)
      for (var j = i + 1; j < group.length; j++) out.push(pairKey(group[i], group[j]));
    return out;
  }

  // How many groups of 2 and 3 to make for n people.
  // prefer 2 = mostly pairs, prefer 3 = mostly trios.
  function groupSizes(n, prefer) {
    if (n < 2) return null;
    var twos, threes;
    if (prefer === 3) {
      var r = n % 3;
      threes = r === 0 ? n / 3 : r === 1 ? (n - 4) / 3 : (n - 2) / 3;
      twos = (n - threes * 3) / 2;
    } else {
      threes = n % 2;
      twos = (n - threes * 3) / 2;
    }
    return { 2: twos, 3: threes };
  }

  // Backtracking search for one month with zero repeated pairs.
  function exactMonth(people, sizes, used, budget) {
    var counts = { 2: sizes[2], 3: sizes[3] };
    var groups = [];
    var nodes = 0;

    function fits(group, person) {
      for (var i = 0; i < group.length; i++) if (used.has(pairKey(group[i], person))) return false;
      return true;
    }

    function fill(rem) {
      if (!rem.length) return true;
      if (++nodes > budget) return false;
      var first = rem[0], rest = rem.slice(1);
      var options = shuffle([2, 3].filter(function (s) { return counts[s] > 0; }));
      for (var k = 0; k < options.length; k++) {
        var size = options[k];
        counts[size]--;
        if (pick([first], rest, size - 1, 0)) return true;
        counts[size]++;
        if (nodes > budget) return false;
      }
      return false;
    }

    function pick(group, rest, need, start) {
      if (need === 0) {
        groups.push(group);
        if (fill(rest.filter(function (p) { return group.indexOf(p) === -1; }))) return true;
        groups.pop();
        return false;
      }
      for (var i = start; i < rest.length; i++) {
        if (fits(group, rest[i]) && pick(group.concat([rest[i]]), rest, need - 1, i + 1)) return true;
        if (nodes > budget) return false;
      }
      return false;
    }

    return fill(shuffle(people.slice())) ? groups : null;
  }

  function repeatsIn(groups, used) {
    var out = [];
    groups.forEach(function (g) {
      pairsIn(g).forEach(function (k) { if (used.has(k)) out.push(k.split('\u0000')); });
    });
    return out;
  }

  // When a perfect month is impossible, find one with as few repeats as possible.
  function bestEffortMonth(people, sizes, used, tries) {
    var best = null, bestCost = Infinity;
    for (var t = 0; t < tries && bestCost > 0; t++) {
      var order = shuffle(people.slice()), groups = [], i = 0;
      var layout = shuffle([].concat(Array(sizes[2]).fill(2), Array(sizes[3]).fill(3)));
      layout.forEach(function (s) { groups.push(order.slice(i, i + s)); i += s; });
      var cost = repeatsIn(groups, used).length;
      // Hill-climb: swap two people between groups when it lowers the cost.
      for (var step = 0; step < 300 && cost > 0; step++) {
        var a = Math.floor(Math.random() * groups.length), b = Math.floor(Math.random() * groups.length);
        if (a === b) continue;
        var ia = Math.floor(Math.random() * groups[a].length), ib = Math.floor(Math.random() * groups[b].length);
        var tmp = groups[a][ia]; groups[a][ia] = groups[b][ib]; groups[b][ib] = tmp;
        var c = repeatsIn(groups, used).length;
        if (c <= cost) cost = c;
        else { groups[b][ib] = groups[a][ia]; groups[a][ia] = tmp; }
      }
      if (cost < bestCost) { bestCost = cost; best = groups.map(function (g) { return g.slice(); }); }
    }
    return best;
  }

  // names: array of strings; months: array of "YYYY-MM"; prefer: 2 or 3;
  // history: optional [{month, groups}] from earlier plans, whose pairs are off-limits.
  function plan(names, months, prefer, history) {
    var people = names.map(function (n) { return n.trim(); }).filter(Boolean);
    var seen = {};
    people.forEach(function (p) {
      var k = p.toLowerCase();
      if (seen[k]) throw new Error('"' + p + '" is listed twice.');
      seen[k] = true;
    });
    var sizes = groupSizes(people.length, prefer);
    if (!sizes) throw new Error('Add at least 2 people.');

    var baseUsed = new Set();
    (history || []).forEach(function (m) {
      m.groups.forEach(function (g) { pairsIn(g).forEach(function (k) { baseUsed.add(k); }); });
    });

    // Keep the plan whose first repeat comes latest, then with the fewest repeats.
    // Stop after ~1.5s so the page never hangs when repeats can't be avoided.
    var best = null, deadline = Date.now() + 1500;
    for (var attempt = 0; attempt < 40 && (attempt === 0 || Date.now() < deadline); attempt++) {
      var used = new Set(baseUsed), result = [], total = 0, first = months.length;
      for (var m = 0; m < months.length; m++) {
        var groups = null;
        for (var r = 0; r < 20 && !groups && (r === 0 || Date.now() < deadline); r++) groups = exactMonth(people, sizes, used, 4000);
        var repeats = [];
        if (!groups) {
          groups = bestEffortMonth(people, sizes, used, 60);
          repeats = repeatsIn(groups, used);
          total += repeats.length;
        }
        groups.forEach(function (g) { pairsIn(g).forEach(function (k) { used.add(k); }); });
        result.push({ month: months[m], groups: groups, repeats: repeats });
        if (repeats.length && first === months.length) first = m;
      }
      if (!best || first > best.firstRepeat || (first === best.firstRepeat && total < best.totalRepeats))
        best = { months: result, totalRepeats: total, firstRepeat: first };
      if (total === 0) break;
    }
    return best;
  }

  // Parses the YAML this tool produces (see toYaml) back into [{month, groups}].
  function parseYaml(text) {
    var months = [], current = null;
    text.split(/\r?\n/).forEach(function (line) {
      var m = line.match(/month:\s*"?(\d{4}-\d{2})"?/);
      if (m) { current = { month: m[1], groups: [] }; months.push(current); return; }
      var g = line.match(/^\s*-\s*(\[.*\])\s*$/);
      if (g && current) current.groups.push(JSON.parse(g[1]));
    });
    return months;
  }

  function toYaml(months) {
    return months.map(function (m) {
      return '- month: "' + m.month + '"\n  groups:\n' + m.groups.map(function (g) {
        return '    - ' + JSON.stringify(g);
      }).join('\n');
    }).join('\n');
  }

  var api = { plan: plan, groupSizes: groupSizes, parseYaml: parseYaml, toYaml: toYaml, pairsIn: pairsIn };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PrayerGroups = api;
})(this);
