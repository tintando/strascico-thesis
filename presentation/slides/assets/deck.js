/* Night Feed viewer: loads slide fragments, sidebar rail, nav, themes,
   persistence, live reload. Slide order = /api/slides (filename sort), or the
   order the static build (deploy/build.mjs) baked into the page. */
(async function () {
  /* two stage sizes, same height: 4:3 narrows the thread, never the type.
     index.html stamps data-ratio before first paint; W follows it. */
  var RATIO_W = { '169': 1280, '43': 960 }, H = 720;
  function currentRatio() { return document.documentElement.dataset.ratio || '169'; }
  var W = RATIO_W[currentRatio()];
  var Q = new URLSearchParams(location.search);
  var PRINT = Q.has('print');
  /* ?nolive: don't open the SSE stream. Needed to screenshot the deck with
     headless Chrome: an open SSE request never lets the page go idle, so
     --virtual-time-budget hangs and no screenshot is written. ?print already
     returns before live reload; ?nolive is the escape hatch for the normal
     path, and the way to capture the non-default themes via ?theme= on the
     normal path (print ignores a persisted theme, but honours an explicit
     ?theme=: that is how export-pdf.sh renders all four). */
  var NOLIVE = Q.has('nolive');
  var stage = document.getElementById('stage');
  var stagewrap = document.getElementById('stagewrap');

  /* ---- load fragments ----
          The static build ships the slides inside #stage already, each still
          carrying its data-src; there is no server behind that deck, so it
          also gets no /api/slides and no live reload. Dev fetches, as ever. */
  var BAKED = !!stage.querySelector('.slide');
  /* the single-file portable copy (deploy/build.mjs --portable), opened from
     a USB stick over file://: baked like the static build, but with no server
     behind it at all, ever. */
  var PORTABLE = stage.hasAttribute('data-portable');
  if (!BAKED) {
    var list = await (await fetch('api/slides')).json();
    var frags = await Promise.all(list.map(function (p) {
      return fetch(p).then(function (r) {
        if (!r.ok) throw new Error(p + ' → HTTP ' + r.status);
        return r.text();
      });
    }));
    frags.forEach(function (html, n) {
      var t = document.createElement('template');
      t.innerHTML = html.trim();
      var s = t.content.querySelector('.slide');
      if (s) { s.dataset.src = list[n]; stage.appendChild(s); }
    });
  }
  var slides = Array.prototype.slice.call(stage.querySelectorAll('.slide'));
  var paths = slides.map(function (s) { return s.dataset.src; });

  /* ---- live clock: on every slide, the last timestamped .meta shows the
          current wall-clock time and each one above it steps back a minute.
          The static HH:MM in the fragments are placeholders. Only the text
          node holding the match is mutated (never innerHTML), so nothing
          re-renders and ambient CSS loops (typing dots, .pre.loop) never
          restart. ---- */
  var TIME_RE = /\b\d{1,2}:\d{2}\b/;
  var clockTargets = [];
  function collectClock(slide) {
    var found = [];
    Array.prototype.forEach.call(slide.querySelectorAll('.meta'), function (m) {
      /* walk childNodes so the <span class="tag-edited"> prefix is untouched */
      for (var n = m.firstChild; n; n = n.nextSibling) {
        if (n.nodeType === 3 && TIME_RE.test(n.data)) { found.push(n); break; }
      }
    });
    found.forEach(function (node, k) {
      clockTargets.push({ node: node, offset: found.length - 1 - k });
    });
  }
  function tickClock() {
    var now = Date.now();
    clockTargets.forEach(function (t) {
      var d = new Date(now - t.offset * 60000);
      var hhmm = ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
      var next = t.node.data.replace(TIME_RE, hhmm);
      if (next !== t.node.data) t.node.data = next;
    });
  }
  slides.forEach(collectClock);
  tickClock();

  /* ---- ?print: strip theme, stack everything, let print CSS paginate ----
          (timestamps were already stamped above, so the PDF carries
          export-time clocks; no interval needed for a static render) */
  /* "1,4-6" → Set{1,4,5,6} of 1-based positions; null = no valid selection */
  function parseSlideList(str, max) {
    if (!str) return null;
    var set = new Set();
    str.split(',').forEach(function (p) {
      var m = /^(\d+)(?:-(\d+))?$/.exec(p.trim());
      if (!m) return;
      for (var k = +m[1], end = +(m[2] || m[1]); k <= end && k <= max; k++) if (k >= 1) set.add(k);
    });
    return set.size ? set : null;
  }
  if (PRINT) {
    /* ?slides=1,4-6 prints only those (filename order); this is where the
       rail's export selection arrives */
    var only = parseSlideList(Q.get('slides'), slides.length);
    if (only) slides.forEach(function (s, n) { if (!only.has(n + 1)) s.remove(); });
    /* the persisted theme never rides into a PDF; an explicit ?theme= does,
       so the deck can be exported in all four (see export-pdf.sh --all) */
    if (!Q.get('theme')) delete document.documentElement.dataset.theme;
    document.documentElement.classList.add('print');
    /* @page can't follow an attribute selector, so ?ratio=43 sizes the
       paper here; the default 1280x720 stays in deck.css */
    if (currentRatio() === '43') {
      var pg = document.createElement('style');
      pg.textContent = '@page { size: 960px 720px; }';
      document.head.appendChild(pg);
    }
    /* Classic's wallpaper is a background-image on the slide, so it is only
       requested once the fragments have landed, which can be after headless
       Chrome has already snapshotted the page: the PDF then comes out on
       bare white. Request it here instead; the pending fetch is what holds
       --print-to-pdf back. Read from the computed style, so this follows the
       hashed (static build) and data: (portable) URLs too. */
    var printed = stage.querySelector('.slide');
    var bg = printed && getComputedStyle(printed).backgroundImage;
    var url = bg && /url\("?([^")]+)"?\)/.exec(bg);
    if (url) { var warm = new Image(); warm.src = url[1]; }
    /* ?pdf: pop the browser's print dialog once fonts have settled, so the
       export button is one click end to end */
    if (Q.has('pdf') && document.fonts) {
      document.fonts.ready.then(function () { setTimeout(function () { print(); }, 150); });
    }
    return;
  }

  /* re-tick on the minute boundary, and instantly when a backgrounded tab
     (where timers are throttled) becomes visible again */
  function armClock() {
    setTimeout(function () { tickClock(); armClock(); }, 60000 - (Date.now() % 60000) + 200);
  }
  armClock();
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) tickClock();
  });

  /* ---- live reload: server pushes on any file change; state survives via
          localStorage (nf.slide / nf.theme4). Skipped under automation: the
          open SSE request stalls headless Chrome's --virtual-time-budget. ---- */
  function liveReload() {
    if (navigator.webdriver || NOLIVE || BAKED) return;
    try {
      new EventSource('events').addEventListener('reload', function () { location.reload(); });
    } catch (e) {}
  }

  /* ---- theme: tdesktop's four embedded themes (settings-card names) ----
          no data-theme attribute = Tinted, the deck's Night Feed default */
  var THEMES = ['classic', 'day', 'tinted', 'night'];
  var themeBtns = Array.prototype.slice.call(document.querySelectorAll('#themes button'));
  function currentTheme() { return document.documentElement.dataset.theme || 'tinted'; }
  function syncThemeBtns() {
    themeBtns.forEach(function (b) {
      var on = b.dataset.t === currentTheme();
      b.classList.toggle('on', on);
      b.setAttribute('aria-pressed', String(on));
    });
  }
  function setTheme(t) {
    if (THEMES.indexOf(t) === -1) t = 'tinted';
    if (t === 'tinted') delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = t;
    try { localStorage.setItem('nf.theme4', t); } catch (e) {}
    syncThemeBtns();
  }
  function cycleTheme() {
    setTheme(THEMES[(THEMES.indexOf(currentTheme()) + 1) % THEMES.length]);
  }
  /* sync the buttons without persisting (a ?theme= preview stays a preview) */
  syncThemeBtns();
  themeBtns.forEach(function (b) {
    b.addEventListener('click', function () { setTheme(b.dataset.t); });
  });

  /* ---- aspect ratio: 16:9 (1280x720, default) or 4:3 (960x720) ----
          same pattern as the theme: attribute on <html>, nf.ratio persisted,
          ?ratio= previews without persisting */
  var ratioBtns = Array.prototype.slice.call(document.querySelectorAll('#ratio button'));
  function syncRatioBtns() {
    ratioBtns.forEach(function (b) {
      var on = b.dataset.r === currentRatio();
      b.classList.toggle('on', on);
      b.setAttribute('aria-pressed', String(on));
    });
  }
  function setRatio(r) {
    if (r === '43') document.documentElement.dataset.ratio = '43';
    else { r = '169'; delete document.documentElement.dataset.ratio; }
    W = RATIO_W[r];
    try { localStorage.setItem('nf.ratio', r); } catch (e) {}
    syncRatioBtns();
    reset(); /* refit the stage to the new slide width */
    scaleThumbs();
  }
  function toggleRatio() { setRatio(currentRatio() === '43' ? '169' : '43'); }
  syncRatioBtns();
  ratioBtns.forEach(function (b) {
    b.addEventListener('click', function () { setRatio(b.dataset.r); });
  });

  /* ---- PDF export selection: which slides ride along in ?print&slides= ----
          Remembered as DEselected filenames, so every slide, including a
          freshly added fragment, defaults to ticked, and the choice survives
          the constant live-reload refreshes while authoring. */
  var desel = new Set();
  try {
    JSON.parse(localStorage.getItem('nf.desel') || '[]').forEach(function (p) {
      if (paths.indexOf(p) !== -1) desel.add(p); /* prune renamed/removed files */
    });
  } catch (e) {}
  function saveSel() {
    try { localStorage.setItem('nf.desel', JSON.stringify(Array.from(desel))); } catch (e) {}
  }

  /* ---- empty deck: nothing to navigate, but keep reloading so the first
          fragment written into slides/slides/ shows up by itself ---- */
  if (!slides.length) {
    document.getElementById('export').hidden = true;
    stage.innerHTML =
      '<div class="empty"><b>No slides yet</b>' +
      '<span>drop a fragment in <code>slides/slides/NN-name.html</code></span>' +
      '<span>it appears here on save</span></div>';
    addEventListener('keydown', function (e) {
      if (e.key === 't' || e.key === 'T') { cycleTheme(); e.preventDefault(); }
    });
    liveReload();
    return;
  }

  /* ---- sidebar rail: one chat row per slide, with a live thumbnail ---- */
  var rowsBox = document.getElementById('rows');
  var rows = slides.map(function (s, n) {
    var row = document.createElement('button');
    row.className = 'row'; row.type = 'button';
    row.innerHTML =
      '<span class="head"><span class="num">' + (n + 1) + '</span>' +
      '<span class="txt"><b></b><small></small></span>' +
      '<span class="sel" role="checkbox" title="include in PDF export"></span></span>' +
      '<span class="thumb"></span>';
    row.querySelector('b').textContent = s.dataset.title || 'Slide ' + (n + 1);
    row.querySelector('small').textContent = s.dataset.summary || '';
    var clone = s.cloneNode(true);
    clone.classList.remove('current');
    clone.removeAttribute('style');
    collectClock(clone); /* thumbnails tick with the stage, never drift */
    row.querySelector('.thumb').appendChild(clone);
    row.addEventListener('click', function (e) {
      if (e.target.classList.contains('sel')) setSel(n, desel.has(s.dataset.src));
      else { show(n); if (narrow.matches) setRail(false); } /* the drawer covers the slide it just jumped to */
    });
    rowsBox.appendChild(row);
    return row;
  });
  /* a thumb only has a width once its rail is on screen; on a phone the rail
     starts as a closed drawer, so this runs again every time it opens */
  function scaleThumbs() {
    rows.forEach(function (row) {
      var t = row.querySelector('.thumb');
      if (t.clientWidth) t.firstElementChild.style.transform = 'scale(' + t.clientWidth / W + ')';
    });
  }

  /* ---- the rail: a layout column on a desktop, an overlay drawer on a phone.
          S and the hamburger both toggle it; which class does the work depends
          on which side of the CSS breakpoint we are on. ---- */
  var narrow = matchMedia('(max-width: 900px)');
  var scrim = document.getElementById('scrim');
  function railIsOpen() {
    return narrow.matches
      ? document.body.classList.contains('railopen')
      : !document.body.classList.contains('norail');
  }
  function setRail(open) {
    if (narrow.matches) document.body.classList.toggle('railopen', open);
    else document.body.classList.toggle('norail', !open);
    if (open) scaleThumbs();
    apply(); /* the desktop rail is a flex column: the stage just changed width */
  }
  function toggleRail() { setRail(!railIsOpen()); }
  document.getElementById('menu').addEventListener('click', toggleRail);
  scrim.addEventListener('click', function () { setRail(false); });

  /* ---- export controls: tick boxes on the rows, all/none + export below ---- */
  var exportBtn = document.getElementById('exportBtn');
  function syncSel() {
    var count = 0;
    slides.forEach(function (s, n) {
      var on = !desel.has(s.dataset.src);
      if (on) count++;
      var box = rows[n].querySelector('.sel');
      box.classList.toggle('on', on);
      box.setAttribute('aria-checked', String(on));
    });
    exportBtn.disabled = !count;
    exportBtn.textContent = '⎙ export PDF (' + count + '/' + slides.length + ')';
  }
  function setSel(n, on) {
    desel[on ? 'delete' : 'add'](slides[n].dataset.src);
    saveSel();
    syncSel();
  }
  document.getElementById('selAll').addEventListener('click', function () {
    desel.clear(); saveSel(); syncSel();
  });
  document.getElementById('selNone').addEventListener('click', function () {
    slides.forEach(function (s) { desel.add(s.dataset.src); }); saveSel(); syncSel();
  });
  exportBtn.addEventListener('click', function () {
    var picked = [];
    slides.forEach(function (s, n) { if (!desel.has(s.dataset.src)) picked.push(n + 1); });
    if (!picked.length) return;
    /* compress runs to "1,4-6" so the URL stays readable */
    var parts = [];
    for (var a = 0; a < picked.length;) {
      var b = a;
      while (b + 1 < picked.length && picked[b + 1] === picked[b] + 1) b++;
      parts.push(b > a ? picked[a] + '-' + picked[b] : String(picked[a]));
      a = b + 1;
    }
    open('?print&pdf' + (currentRatio() === '43' ? '&ratio=43' : '')
      + (picked.length === slides.length ? '' : '&slides=' + parts.join(',')), '_blank');
  });
  syncSel();

  /* ---- speaker notes: each .notes aside is the verbatim spoken script,
          square brackets wrapping what is not spoken, **bold** / *italic*
          as lightweight emphasis markers.
          N toggles a rehearsal panel above the stage, for everyone: the
          notes are public, and read-only in the viewer. The fragment file
          is the only place a script is written, so the deck needs no write
          endpoint, no shared secret and no server-side state. ---- */
  var notesBox = document.createElement('aside');
  notesBox.id = 'notes';
  /* scrolling a long script must not flip slides (the stage wheel handler) */
  notesBox.addEventListener('wheel', function (e) { e.stopPropagation(); });
  stagewrap.appendChild(notesBox);
  var notesOn = false;

  /* ---- lectern settings: panel height (the #ngrip drag handle) and script
          size (A- / A+). Both are per-machine reading comfort, not deck
          design, so they persist in localStorage rather than the session and
          drive one CSS variable each; the stage floor follows --notes-h, so
          every change refits the slide. ---- */
  var NH_MIN = 90, NFS_MIN = 11, NFS_MAX = 30;
  var notesH = 200, notesFS = 16;
  try {
    notesH = parseFloat(localStorage.getItem('nf.notesh')) || notesH;
    notesFS = parseFloat(localStorage.getItem('nf.notesfs')) || notesFS;
  } catch (e) {}
  function nhMax() { return Math.max(NH_MIN, innerHeight - 160); }
  function setNotesH(px, persist) {
    notesH = Math.round(Math.max(NH_MIN, Math.min(nhMax(), px)));
    document.documentElement.style.setProperty('--notes-h', notesH + 'px');
    if (persist) { try { localStorage.setItem('nf.notesh', String(notesH)); } catch (e) {} }
    if (notesOn) reset(); /* the stage ceiling moved */
  }
  function setNotesFS(px) {
    notesFS = Math.max(NFS_MIN, Math.min(NFS_MAX, px));
    document.documentElement.style.setProperty('--notes-fs', notesFS + 'px');
    try { localStorage.setItem('nf.notesfs', String(notesFS)); } catch (e) {}
  }
  document.documentElement.style.setProperty('--notes-h', notesH + 'px');
  document.documentElement.style.setProperty('--notes-fs', notesFS + 'px');
  var notesGrip = document.createElement('div');
  notesGrip.id = 'ngrip';
  notesGrip.title = 'drag to resize the script panel (double-click to reset)';
  stagewrap.appendChild(notesGrip);
  notesGrip.addEventListener('pointerdown', function (e) {
    var y0 = e.clientY, h0 = notesH;
    notesGrip.setPointerCapture(e.pointerId);
    document.body.classList.add('ngripping');
    function move(ev) { setNotesH(h0 + (ev.clientY - y0)); }
    function up() {
      notesGrip.removeEventListener('pointermove', move);
      notesGrip.removeEventListener('pointerup', up);
      document.body.classList.remove('ngripping');
      setNotesH(notesH, true);
    }
    notesGrip.addEventListener('pointermove', move);
    notesGrip.addEventListener('pointerup', up);
    e.preventDefault();
  });
  notesGrip.addEventListener('dblclick', function () { setNotesH(200, true); });
  /* per window (session, not local): the laptop window shows the script while
     the projector window stays clean, and each survives its own reloads */
  try { notesOn = sessionStorage.getItem('nf.notes') === '1'; } catch (e) {}
  if (Q.has('notes')) notesOn = true; /* preview flag, not persisted (the ?theme pattern) */
  var keysHint = document.querySelector('#rail footer .hint.keys');
  if (keysHint) keysHint.textContent = keysHint.textContent.replace('R ratio', 'R ratio · N notes');

  /* the fragment's own <aside class="notes"> is the whole story: baked into
     the static build, so the panel needs nothing fetched and nothing stored */
  function noteFor(slide) {
    var aside = slide.querySelector('.notes');
    return (aside ? aside.textContent : '').replace(/\s+/g, ' ').trim();
  }

  /* **bold** / *italic* markers -> real <b>/<i> nodes appended to parent */
  function renderInline(parent, text) {
    var re = /\*\*([^*]+)\*\*|\*([^*]+)\*/g, last = 0, m;
    while ((m = re.exec(text)) !== null) {
      if (m.index > last) parent.appendChild(document.createTextNode(text.slice(last, m.index)));
      var el = document.createElement(m[1] != null ? 'b' : 'i');
      el.textContent = m[1] != null ? m[1] : m[2];
      parent.appendChild(el);
      last = re.lastIndex;
    }
    if (last < text.length) parent.appendChild(document.createTextNode(text.slice(last)));
  }
  function noteButton(label, title, onClick) {
    var b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    b.title = title;
    b.addEventListener('click', onClick);
    return b;
  }
  function renderNotes() {
    document.body.classList.toggle('shownotes', notesOn);
    if (!notesOn) return;
    var slide = slides[i];
    var text = noteFor(slide);
    notesBox.textContent = '';
    var nhead = document.createElement('div');
    nhead.className = 'nhead';
    var head = document.createElement('b');
    head.textContent = 'visit ' + (i + 1) + ' of ' + slides.length + ' · ' +
      (slide.dataset.title || '') + ' · spoken script, [held back]';
    nhead.appendChild(head);
    nhead.appendChild(noteButton('A-', 'smaller script', function () { setNotesFS(notesFS - 1); }));
    nhead.appendChild(noteButton('A+', 'larger script', function () { setNotesFS(notesFS + 1); }));
    notesBox.appendChild(nhead);
    var p = document.createElement('p');
    var re = /\[[^\]]*\]/g, last = 0, m;
    while ((m = re.exec(text)) !== null) {
      if (m.index > last) renderInline(p, text.slice(last, m.index));
      var held = document.createElement('span');
      held.className = 'held';
      renderInline(held, m[0]);
      p.appendChild(held);
      last = re.lastIndex;
    }
    if (last < text.length) renderInline(p, text.slice(last));
    notesBox.appendChild(p);
  }
  function toggleNotes() {
    notesOn = !notesOn;
    try { sessionStorage.setItem('nf.notes', notesOn ? '1' : '0'); } catch (e) {}
    renderNotes();
    reset(); /* the stage ceiling moved; refit the slide */
  }

  /* ---- navigation ----
          no on-screen counter here: the slide header's own `visit N of M`
          is the deck's only progress indicator, by design */
  var i = 0;

  function show(n) {
    n = Math.max(0, Math.min(slides.length - 1, n));
    slides[i].classList.remove('current');
    rows[i].classList.remove('on');
    i = n;
    slides[i].classList.add('current');
    rows[i].classList.add('on');
    rows[i].scrollIntoView({ block: 'nearest' });
    history.replaceState(null, '', '#' + (i + 1));
    try { localStorage.setItem('nf.slide', String(i + 1)); } catch (e) {}
    renderNotes();
    reset(); /* every slide arrives fitted, whatever the last one was zoomed to */
  }

  /* ---- fit, zoom, pan ----
          A slide is authored at 1280x720 and scaled whole to the stage: zoom 1
          is that fitted scale. On a phone in portrait the fit is small (a 16:9
          slide across 393px is ~8px text), so the reader zooms in and pans,
          rather than being told to rotate. Pan is clamped to the scaled
          slide's overhang, so it can never be dragged off the stage. */
  var MAXZOOM = 4;
  var zoom = 1, panX = 0, panY = 0, fitScale = 1;
  function apply() {
    /* measure #stage, not the wrapper: the dev-only notes panel raises the
       stage floor (body.shownotes), and the slide must fit what is left */
    var r = stage.getBoundingClientRect();
    fitScale = Math.min(r.width / W, r.height / H);
    var s = fitScale * zoom;
    /* half of what sticks out past the stage on each side; 0 when fitted */
    var ox = Math.max(0, (W * s - r.width) / 2), oy = Math.max(0, (H * s - r.height) / 2);
    panX = Math.max(-ox, Math.min(ox, panX));
    panY = Math.max(-oy, Math.min(oy, panY));
    var t = 'translate(' + panX + 'px,' + panY + 'px) scale(' + s + ')';
    slides.forEach(function (el) { el.style.transform = t; });
  }
  function reset() { zoom = 1; panX = panY = 0; apply(); }
  /* zoom to z about a point given relative to the stage centre (which is where
     the slide's own centre sits): that point of the slide stays put */
  function zoomAbout(z, cx, cy) {
    z = Math.max(1, Math.min(MAXZOOM, z));
    var k = z / zoom;
    panX = cx - k * (cx - panX);
    panY = cy - k * (cy - panY);
    zoom = z;
    apply();
  }

  addEventListener('keydown', function (e) {
    /* typing in the notes textarea must not fire theme/ratio/notes/nav keys */
    if (e.target && (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT')) return;
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === ' ' || e.key === 'PageDown') show(i + 1);
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp' || e.key === 'PageUp') show(i - 1);
    else if (e.key === 'Home') show(0);
    else if (e.key === 'End') show(slides.length - 1);
    else if (e.key === 'f' || e.key === 'F') {
      document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen();
    } else if (e.key === 's' || e.key === 'S') {
      toggleRail();
    } else if (e.key === 't' || e.key === 'T') {
      cycleTheme();
    } else if (e.key === 'r' || e.key === 'R') {
      toggleRatio();
    } else if (e.key === 'n' || e.key === 'N') {
      toggleNotes();
    } else return;
    e.preventDefault();
  });
  /* wheel / trackpad on the stage only: the rail keeps its own scrolling */
  var acc = 0, locked = false, quiet, lastMag = 0, lastStep = 0;
  var MINSTEP = 60; /* ms; the fastest a wheel may flip slides */
  stagewrap.addEventListener('wheel', function (e) {
    e.preventDefault();
    var d = Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
    d *= e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? H : 1; // lines / pages → px
    var mag = Math.abs(d), now = Date.now();
    /* a trackpad flick keeps firing after the fingers lift, so one gesture must
       stay locked until its momentum tail goes quiet */
    clearTimeout(quiet);
    quiet = setTimeout(function () { locked = false; acc = 0; }, 140);
    /* but a momentum tail only ever decays: a delta that holds or grows is a
       fresh push (a mouse notch, which repeats at a constant size, always is),
       so it breaks the lock rather than waiting the tail out */
    if (locked && mag >= lastMag && now - lastStep >= MINSTEP) { locked = false; acc = 0; }
    lastMag = mag;
    if (locked) return;
    acc += d;
    if (Math.abs(acc) < 40) return;
    show(i + (acc > 0 ? 1 : -1));
    acc = 0; locked = true; lastStep = now;
  }, { passive: false });

  /* ---- touch, on the stage only (#stagewrap has touch-action: none, so the
          browser leaves these gestures to us):
            one finger, fitted   → swipe, same grammar as the wheel
            one finger, zoomed   → drag to pan (so the hud's ‹ › buttons are
                                   the only way to move on while zoomed in)
            two fingers          → pinch to zoom about the midpoint
            double tap           → toggle fitted / 2.5x at the tapped point
          The nav buttons under #hud do the rest. ---- */
  var SWIPE = 45, TAP_MS = 300, TAP_SLOP = 30;
  var drag = null, pinch = null, tapAt = 0, tapX = 0, tapY = 0;
  /* a touch as an offset from the stage centre, i.e. in the slide's own frame */
  function centred(t) {
    var r = stage.getBoundingClientRect(); /* same frame as apply()'s fit */
    return { x: t.clientX - (r.left + r.width / 2), y: t.clientY - (r.top + r.height / 2) };
  }
  function grip(e) {
    var a = centred(e.touches[0]), b = centred(e.touches[1]);
    return {
      d: Math.hypot(a.x - b.x, a.y - b.y) || 1,
      x: (a.x + b.x) / 2, y: (a.y + b.y) / 2
    };
  }
  stagewrap.addEventListener('touchstart', function (e) {
    if (e.touches.length >= 2) {
      pinch = grip(e); drag = null;
    } else {
      drag = { x: e.touches[0].clientX, y: e.touches[0].clientY, panX: panX, panY: panY, moved: false };
      pinch = null;
    }
  }, { passive: false });
  stagewrap.addEventListener('touchmove', function (e) {
    e.preventDefault();
    if (pinch && e.touches.length >= 2) {
      var g = grip(e);
      panX += g.x - pinch.x; panY += g.y - pinch.y; /* the midpoint drags the slide with it */
      zoomAbout(zoom * (g.d / pinch.d), g.x, g.y);
      pinch = g;
    } else if (drag && e.touches.length === 1) {
      var dx = e.touches[0].clientX - drag.x, dy = e.touches[0].clientY - drag.y;
      if (Math.abs(dx) > 6 || Math.abs(dy) > 6) drag.moved = true;
      if (zoom > 1) { panX = drag.panX + dx; panY = drag.panY + dy; apply(); }
    }
  }, { passive: false });
  stagewrap.addEventListener('touchend', function (e) {
    if (pinch) { if (e.touches.length < 2) pinch = null; return; }
    if (!drag || e.touches.length) return;
    var d = drag, t = e.changedTouches[0];
    drag = null;
    var dx = t.clientX - d.x, dy = t.clientY - d.y;
    if (zoom === 1 && (Math.abs(dx) >= SWIPE || Math.abs(dy) >= SWIPE)) {
      var along = Math.abs(dx) >= Math.abs(dy) ? dx : dy; /* dominant axis; left / up = next */
      show(i + (along < 0 ? 1 : -1));
      return;
    }
    if (d.moved) return; /* a pan, or a nudge too small to be either */
    var now = Date.now();
    if (now - tapAt < TAP_MS && Math.abs(t.clientX - tapX) < TAP_SLOP && Math.abs(t.clientY - tapY) < TAP_SLOP) {
      var p = centred(t);
      zoomAbout(zoom > 1 ? 1 : 2.5, p.x, p.y);
      tapAt = 0;
    } else { tapAt = now; tapX = t.clientX; tapY = t.clientY; }
  });

  document.getElementById('prev').addEventListener('click', function () { show(i - 1); });
  document.getElementById('next').addEventListener('click', function () { show(i + 1); });

  addEventListener('resize', function () {
    if (notesH > nhMax()) setNotesH(notesH); /* a shorter window shrinks the panel with it */
    reset();
    scaleThumbs();
  });
  document.addEventListener('fullscreenchange', function () {
    document.documentElement.classList.toggle('fs', !!document.fullscreenElement);
    reset();
  });
  addEventListener('hashchange', function () {
    var n = parseInt(location.hash.slice(1), 10);
    if (n) show(n - 1);
  });

  /* ---- follow mode: two windows of the same browser (laptop notes +
          projector fullscreen) stay on the same slide. show() writes
          nf.slide; the other window hears the storage event and follows.
          Symmetric and echo-free: rewriting an unchanged value fires no
          event. ---- */
  addEventListener('storage', function (e) {
    if (e.key === 'nf.slide') {
      var n = parseInt(e.newValue, 10);
      if (n && n - 1 !== i) show(n - 1);
    }
  });

  /* ---- offline: the published deck installs a service worker (built by
          deploy/build.mjs) so one online visit makes the venue's dead wifi
          survivable. Everything the deck needs is static, so the precache is
          the whole deck. Skipped under automation: the install's
          precache work stalls headless Chrome's --virtual-time-budget, the
          same way the SSE stream does. ---- */
  if (BAKED && !PORTABLE && !NOLIVE && !navigator.webdriver && 'serviceWorker' in navigator) {
    try { navigator.serviceWorker.register('sw.js'); } catch (e) {}
  }

  /* ---- start slide: URL hash wins, else last viewed, else 1 ---- */
  var start = parseInt(location.hash.slice(1), 10);
  if (!start) { try { start = parseInt(localStorage.getItem('nf.slide'), 10); } catch (e) {} }
  scaleThumbs();
  show((start || 1) - 1); /* show() fits the slide */

  liveReload();
})();
