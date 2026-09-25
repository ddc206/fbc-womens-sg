// Reads the schedule from _data/schedule.yml (embedded in each page) and fills in the
// #next-meeting, #schedule-table and #meeting-info elements.
(function () {
  var SITE = window.SITE || {};

  function pad(n) { return (n < 10 ? '0' : '') + n; }

  function toRow(r) {
    var parts = r.date.split('-'); // YYYY-MM-DD
    var date = new Date(+parts[0], +parts[1] - 1, +parts[2]);
    return { date: date, slug: r.date, type: r.type || '', topic: r.topic || '' };
  }

  var schedulePromise;
  function loadSchedule() {
    if (!schedulePromise) {
      var rows = (SITE.schedule || []).map(toRow).sort(function (a, b) { return a.date - b.date; });
      // Number meetings in date order, skipping off weeks, so adding or
      // removing a date renumbers everything after it.
      var n = 0;
      rows.forEach(function (r) { r.number = isOff(r) ? null : ++n; });
      schedulePromise = Promise.resolve(rows);
    }
    return schedulePromise;
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function isOff(row) { return /no meeting/i.test(row.type); }
  function hasPage(row) { return (SITE.meetingPages || []).indexOf(row.slug) !== -1; }
  function pageUrl(row) { return SITE.baseurl + '/meetings/' + row.slug + '/'; }
  function longDate(d) { return d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }); }
  function shortDate(d) { return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }); }
  function today() { var t = new Date(); return new Date(t.getFullYear(), t.getMonth(), t.getDate()); }

  function details(row) {
    var items = [];
    if (row.topic) items.push('<li><strong>Topic:</strong> ' + esc(row.topic) + '</li>');
    return items.length ? '<ul class="details">' + items.join('') + '</ul>' : '';
  }

  // A blank type is still a meeting.
  function badge(row) {
    return '<span class="badge' + (isOff(row) ? ' off' : '') + '">' + esc(row.type || 'Meeting') + '</span>';
  }

  function loadError(el) {
    el.innerHTML = '<p class="muted">Couldn’t load the schedule right now. Try refreshing in a bit!</p>';
  }

  function renderNextMeeting(el) {
    loadSchedule().then(function (rows) {
      var t = today();
      var next = rows.filter(function (r) { return r.date >= t && !isOff(r); })[0];
      if (!next) { el.innerHTML = '<p>No upcoming meetings on the calendar yet. Stay tuned!</p>'; return; }
      var days = Math.round((next.date - t) / 86400000);
      var when = days === 0 ? 'tonight!' : days === 1 ? 'tomorrow' : 'in ' + days + ' days';
      var weekday = next.date.toLocaleDateString(undefined, { weekday: 'long' });
      var meta = [weekday, SITE.meetingTime, SITE.meetingPlace].filter(Boolean)
        .map(function (m) { return '<span>' + esc(m) + '</span>'; }).join('<span class="dot">·</span>');
      el.innerHTML =
        '<p class="eyebrow">Next time we meet · ' + when + '</p>' +
        '<h2 class="nm-date">' + esc(next.date.toLocaleDateString(undefined, { month: 'long', day: 'numeric' })) + '</h2>' +
        '<p class="nm-meta">' + meta + '</p>' +
        '<div class="nm-about">' + badge(next) +
          (next.topic ? '<p class="nm-topic">' + esc(next.topic) + '</p>' : '') + '</div>' +
        (hasPage(next) ? '<a class="button" href="' + pageUrl(next) + '">See what we’re covering →</a>' : '');
    }).catch(function () { loadError(el); });
  }

  function renderScheduleTable(el) {
    loadSchedule().then(function (rows) {
      var t = today();
      var body = rows.map(function (r) {
        var cls = [r.date < t ? 'past' : '', isOff(r) ? 'off' : ''].join(' ').trim();
        var link = hasPage(r) ? '<a href="' + pageUrl(r) + '">Details →</a>' : '';
        return '<tr' + (cls ? ' class="' + cls + '"' : '') + '>' +
          '<td class="num">' + (r.number || '') + '</td>' +
          '<td data-label="Date">' + esc(shortDate(r.date)) + '</td>' +
          '<td data-label="Type">' + badge(r) + '</td>' +
          '<td data-label="Topic">' + esc(r.topic) + '</td>' +
          '<td>' + link + '</td></tr>';
      }).join('');
      el.innerHTML = '<table class="schedule"><thead><tr><th>#</th><th>Date</th><th>Type</th><th>Topic</th><th></th></tr></thead><tbody>' + body + '</tbody></table>';
    }).catch(function () { loadError(el); });
  }

  function renderMeetingInfo(el) {
    loadSchedule().then(function (rows) {
      var row = rows.filter(function (r) { return r.slug === el.dataset.date; })[0];
      el.innerHTML = row ? (row.number ? '<p class="eyebrow">Meeting ' + row.number + '</p>' : '') + badge(row) + details(row) : '';
    }).catch(function () { el.innerHTML = ''; });
  }

  var next = document.getElementById('next-meeting');
  if (next) renderNextMeeting(next);
  var table = document.getElementById('schedule-table');
  if (table) renderScheduleTable(table);
  var info = document.getElementById('meeting-info');
  if (info) renderMeetingInfo(info);
})();
