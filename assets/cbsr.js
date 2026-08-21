/* ============================================================================
   CBSR — shared site script
   No framework, no build step, no dependencies. Every block below is guarded on
   the presence of the element it drives, so one file serves every page and does
   nothing on the pages that do not carry that feature.

   Blocks, in order:
     0  canonical URL fallback for an unstamped copy opened from disk
     1  language: EN is the text in the HTML, 中文 lives in data-zh attributes
     2  the corridor layer: 132 directed edges and the 16 dated transitions
     3  the proof cards, the date scrubber and the corridor picker
     4  the embedded mapper, with two-way language sync
     5  the analysis index filter
     6  the maintainer application form
   ========================================================================= */
(function () {
  'use strict';

  /* your deployed mapper. The corridor picker stands in until it answers. */
  var MAPPER_URL = 'https://yunjiefanresearch-hub.github.io/cbsr-mapper/';

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return [].slice.call((r || document).querySelectorAll(s)); };

  /* ---- 0 ── an unstamped copy must never be seen holding a placeholder ---- */
  try {
    var here = window.location.href.replace(/[?#].*$/, '').replace(/[^\/]*$/, '');
    $$('meta[content*="__SITE_URL__"], link[href*="__SITE_URL__"], input[value*="__SITE_URL__"]')
      .forEach(function (t) {
        var a = t.hasAttribute('content') ? 'content' : (t.tagName === 'INPUT' ? 'value' : 'href');
        t.setAttribute(a, t.getAttribute(a).replace(/__SITE_URL__/g, here));
        if (t.tagName === 'INPUT') t.value = t.getAttribute('value');
      });
  } catch (e) {}

  /* ==================================================================== 1 ==
     Language.

     The original page kept every Chinese string in one array of CSS selectors.
     That worked for a single document and would not survive nine. Here the
     translation sits on the element it belongs to:

       <p data-zh="中文">English</p>
       <input data-zh-placeholder="中文" placeholder="English">

     English is whatever is already in the markup, cached on first paint, so a
     missing data-zh degrades to English rather than to an empty box.
     ===================================================================== */
  var lang = 'en';

  function attrsOf(el) {
    return el.getAttributeNames().filter(function (n) { return n.indexOf('data-zh-') === 0; })
      .map(function (n) { return n.slice(8); });
  }

  /* Two caches rather than one: innerHTML and attributes are read and written
     differently, and holding them together invites the bug where a translated
     placeholder overwrites a translated label. */
  var enHTML = new WeakMap();
  var enAttr = new WeakMap();

  function cache() {
    $$('[data-zh]').forEach(function (el) { enHTML.set(el, el.innerHTML); });
    $$('*').forEach(function (el) {
      var names = attrsOf(el);
      if (!names.length) return;
      var store = {};
      names.forEach(function (n) { store[n] = el.getAttribute(n) || ''; });
      enAttr.set(el, store);
    });
  }

  function paint(l) {
    $$('[data-zh]').forEach(function (el) {
      var en = enHTML.get(el);
      if (en === undefined) return;
      el.innerHTML = (l === 'zh') ? el.getAttribute('data-zh') : en;
    });
    $$('*').forEach(function (el) {
      var store = enAttr.get(el);
      if (!store) return;
      Object.keys(store).forEach(function (n) {
        el.setAttribute(n, (l === 'zh') ? (el.getAttribute('data-zh-' + n) || store[n]) : store[n]);
      });
    });
    var root = document.documentElement;
    root.lang = (l === 'zh') ? 'zh-Hans' : 'en';
    var t = root.getAttribute(l === 'zh' ? 'data-title-zh' : 'data-title-en');
    if (t) document.title = t;
  }

  function setLang(l, opts) {
    opts = opts || {};
    lang = (l === 'zh') ? 'zh' : 'en';
    paint(lang);
    $$('#langtog button').forEach(function (b) {
      b.classList.toggle('on', b.getAttribute('data-lang') === lang);
    });
    try { localStorage.setItem('cbsr-lang', lang); } catch (e) {}
    /* Anything the page generates rather than authors — corridor verdicts, the
       index count — cannot be reached by the attribute swap. Tell it to redraw. */
    try { window.dispatchEvent(new CustomEvent('cbsr-lang', { detail: lang })); } catch (e) {}
    if (opts.notifyFrame !== false) postToFrame(lang);
    /* Keep ?lang on internal links so a shared URL lands in the same language.
       The separator has to be decided from the CLEANED href, not the original: a link
       that already carried ?lang=zh still contains a "?" before the strip, and testing
       the original produced "corridors.html&lang=zh" on the second toggle. Any fragment
       is detached first and reattached last, so ?lang lands before #anchor. */
    $$('a[href]').forEach(function (a) {
      var h = a.getAttribute('href');
      if (!h || /^(https?:|mailto:|#|\/\/)/.test(h)) return;
      /* Only pages read ?lang. Appending it to a PDF changes nothing and makes the
         link in the address bar look like a tracking parameter. */
      if (!/(^|\/)[^/]*\.html($|[?#])/.test(h) && /\.[a-z0-9]+($|[?#])/i.test(h)) return;
      var hash = '', cut = h.indexOf('#');
      if (cut > -1) { hash = h.slice(cut); h = h.slice(0, cut); }
      var base = h.replace(/[?&]lang=(en|zh)/, '').replace(/\?$/, '');
      var q = (lang === 'zh') ? (base.indexOf('?') > -1 ? '&' : '?') + 'lang=zh' : '';
      a.setAttribute('href', base + q + hash);
    });
  }

  /* ==================================================================== 2 ==
     The corridor layer of CBSR v0.10.1: 132 directed edges over the twelve
     jurisdictions, and the 16 dated transitions that reclassify them. Held here
     rather than typed into each page, so every page that shows a verdict shows
     the same verdict.
     ===================================================================== */
  var EDGES = {"AE>BR":"II","AE>CH":"I","AE>CN":"blocked","AE>EU":"I","AE>HK":"I","AE>JP":"II","AE>KR":"pre_regime","AE>SG":"I","AE>TW":"T","AE>UK":"T","AE>US":"T","BR>AE":"II","BR>CH":"I","BR>CN":"blocked","BR>EU":"I","BR>HK":"I","BR>JP":"II","BR>KR":"pre_regime","BR>SG":"I","BR>TW":"T","BR>UK":"T","BR>US":"T","CH>AE":"II","CH>BR":"II","CH>CN":"blocked","CH>EU":"I","CH>HK":"I","CH>JP":"II","CH>KR":"pre_regime","CH>SG":"I","CH>TW":"T","CH>UK":"T","CH>US":"T","CN>AE":"III","CN>BR":"III","CN>CH":"III","CN>EU":"III","CN>HK":"III","CN>JP":"III","CN>KR":"pre_regime","CN>SG":"III","CN>TW":"III","CN>UK":"III","CN>US":"III","EU>AE":"II","EU>BR":"II","EU>CH":"I","EU>CN":"blocked","EU>HK":"I","EU>JP":"II","EU>KR":"pre_regime","EU>SG":"I","EU>TW":"T","EU>UK":"T","EU>US":"T","HK>AE":"II","HK>BR":"II","HK>CH":"I","HK>CN":"blocked","HK>EU":"I","HK>JP":"II","HK>KR":"pre_regime","HK>SG":"I","HK>TW":"T","HK>UK":"T","HK>US":"T","JP>AE":"II","JP>BR":"II","JP>CH":"I","JP>CN":"blocked","JP>EU":"I","JP>HK":"I","JP>KR":"pre_regime","JP>SG":"I","JP>TW":"T","JP>UK":"T","JP>US":"T","KR>AE":"III","KR>BR":"III","KR>CH":"III","KR>CN":"blocked","KR>EU":"III","KR>HK":"III","KR>JP":"III","KR>SG":"III","KR>TW":"III","KR>UK":"III","KR>US":"III","SG>AE":"II","SG>BR":"II","SG>CH":"I","SG>CN":"blocked","SG>EU":"I","SG>HK":"I","SG>JP":"II","SG>KR":"pre_regime","SG>TW":"T","SG>UK":"T","SG>US":"T","TW>AE":"III","TW>BR":"III","TW>CH":"III","TW>CN":"blocked","TW>EU":"III","TW>HK":"III","TW>JP":"III","TW>KR":"pre_regime","TW>SG":"III","TW>UK":"III","TW>US":"III","UK>AE":"II","UK>BR":"II","UK>CH":"I","UK>CN":"blocked","UK>EU":"I","UK>HK":"I","UK>JP":"II","UK>KR":"pre_regime","UK>SG":"I","UK>TW":"T","UK>US":"T","US>AE":"II","US>BR":"II","US>CH":"I","US>CN":"blocked","US>EU":"I","US>HK":"I","US>JP":"II","US>KR":"pre_regime","US>SG":"I","US>TW":"T","US>UK":"T"};
  var TRANS = [["AE>US","2027-01-18","II"],["BR>US","2027-01-18","II"],["CH>US","2027-01-18","II"],["EU>US","2027-01-18","II"],["HK>US","2027-01-18","II"],["JP>US","2027-01-18","II"],["SG>US","2027-01-18","II"],["UK>US","2027-01-18","II"],["AE>UK","2027-10-25","I"],["BR>UK","2027-10-25","I"],["CH>UK","2027-10-25","I"],["EU>UK","2027-10-25","I"],["HK>UK","2027-10-25","I"],["JP>UK","2027-10-25","I"],["SG>UK","2027-10-25","I"],["US>UK","2027-10-25","I"]];

  var HZ = [null, '2027-01-18', '2027-10-25'];
  var STOPS = {
    en: [{ t: 'today', s: '30 Jun 2026 snapshot' },
         { t: '18 Jan 2027', s: 'GENIUS Act §18 commences · outer cap' },
         { t: '25 Oct 2027', s: 'UK regime operative' }],
    zh: [{ t: '今天', s: '2026-06-30 快照' },
         { t: '2027-01-18', s: 'GENIUS 法案第 18 条生效 · 外层兜底' },
         { t: '2027-10-25', s: '英国制度生效' }]
  };
  var META = {
    en: {
      'I':  { label: 'Category I · clears', note: 'Dual authorization: each end is separately authorizable, and no equivalence step is required in this direction.', cls: 'clear' },
      'II': { label: 'Category II · gated', note: 'Entry turns on a recognition, equivalence, or comparability determination that is not generically granted.', cls: 'gate' },
      'T':  { label: 'Category T · in transition', note: 'The destination has adopted a comprehensive regime that is not yet operative. Nothing is barred here. Nothing is settled either. It resolves on commencement.', cls: 'transition' },
      'III':{ label: 'Category III · unresolved', note: 'The origin has no exportable, authorizable token, so the corridor reduces to partnership or coordination options.', cls: 'block' },
      'blocked':    { label: 'Blocked at destination', note: 'The destination prohibits issuance, so no positive trigger can complete an inbound corridor here.', cls: 'block' },
      'pre_regime': { label: 'Pre-regime', note: 'The destination has no stablecoin regime in force, so there is no inbound authorization to obtain and no gate to clear.', cls: 'transition' }
    },
    zh: {
      'I':  { label: '类别 I · 可清算', note: '双授权：两端各自可被授权，此方向无需等效步骤。', cls: 'clear' },
      'II': { label: '类别 II · 需过闸', note: '入境取决于一项承认、等效或可比性认定，而这并非通例给予。', cls: 'gate' },
      'T':  { label: '类别 T · 过渡中', note: '目的地已通过一套完整制度，但尚未生效。这里不是禁止，也尚未定论。它在生效日消解。', cls: 'transition' },
      'III':{ label: '类别 III · 未决', note: '起点没有可出口、可授权的代币，所以这条走廊退化为合作或协调选项。', cls: 'block' },
      'blocked':    { label: '在目的地受阻', note: '目的地禁止发行，因此没有任何正向触发能在此完成一条入境走廊。', cls: 'block' },
      'pre_regime': { label: '前制度期', note: '目的地尚无生效的稳定币制度，因此无入境授权可取得，也无闸口可过。', cls: 'transition' }
    }
  };
  var PICK = {
    en: { same: 'Same jurisdiction', hint: 'Pick two different endpoints to read a corridor.',
          pending: function (d) { return '→ changes on ' + d; },
          fired: function (d, w) { return '✓ changed on ' + d + ' · ' + w; },
          count: function (n) { return '<b>' + n + '</b> of 132 directed corridors reclassified'; },
          trig: { '2027-01-18': 'GENIUS Act §18', '2027-10-25': 'UK SI 2026/102' } },
    zh: { same: '同一法域', hint: '选择两个不同的端点来读一条走廊。',
          pending: function (d) { return '→ 将于 ' + d + ' 变更'; },
          fired: function (d, w) { return '✓ 已于 ' + d + ' 变更 · ' + w; },
          count: function (n) { return '132 条有向走廊中，<b>' + n + '</b> 条重新分类'; },
          trig: { '2027-01-18': 'GENIUS 法案第 18 条', '2027-10-25': '英国 SI 2026/102' } }
  };

  var asOfIdx = 0;
  function asOf() { return HZ[asOfIdx]; }
  function classFor(o, d) {
    if (o === d) return null;
    var k = o + '>' + d, c = EDGES[k];
    if (!c) return null;
    var a = asOf();
    for (var i = 0; i < TRANS.length; i++) if (TRANS[i][0] === k && a && TRANS[i][1] <= a) c = TRANS[i][2];
    return c;
  }
  function flipOn(o, d) {
    var k = o + '>' + d, a = asOf();
    for (var i = 0; i < TRANS.length; i++) if (TRANS[i][0] === k) return { dt: TRANS[i][1], fired: !!(a && TRANS[i][1] <= a) };
    return null;
  }
  function nReclassified() {
    var a = asOf(), n = 0;
    for (var i = 0; i < TRANS.length; i++) if (a && TRANS[i][1] <= a) n++;
    return n;
  }

  /* ==================================================================== 3 ==
     Proof cards, date scrubber, corridor picker.
     ===================================================================== */
  var SVG_STYLE = { 'I': ['#2E7D46', null], 'II': ['#B26B12', null], 'T': ['#8B8E84', '5 5'],
                    'III': ['#B23B36', null], 'blocked': ['#B23B36', null], 'pre_regime': ['#8B8E84', '5 5'] };

  function paintEdge(id, o, d) {
    var el = document.getElementById(id); if (!el) return;
    var s = SVG_STYLE[classFor(o, d)]; if (!s) return;
    el.setAttribute('stroke', s[0]);
    if (s[1]) el.setAttribute('stroke-dasharray', s[1]); else el.removeAttribute('stroke-dasharray');
  }

  function renderCard(pfx, o, d) {
    var c = classFor(o, d); if (!c) return;
    var m = META[lang][c], P = PICK[lang];
    var cls = document.getElementById(pfx + '-cls'); if (!cls) return;
    var dot = document.getElementById(pfx + '-dot'),
        note = document.getElementById(pfx + '-note'),
        st = document.getElementById(pfx + '-stamp');
    cls.textContent = m.label; cls.className = m.cls;
    dot.className = 'dot bg-' + m.cls; note.textContent = m.note;
    var f = flipOn(o, d);
    if (!st) return;
    if (!f) { st.textContent = ''; st.className = 'stamp'; }
    else if (f.fired) { st.textContent = P.fired(f.dt, P.trig[f.dt] || ''); st.className = 'stamp fired'; }
    else { st.textContent = P.pending(f.dt); st.className = 'stamp'; }
  }

  /* The scrubber's labels and its count belong to the date control, which appears on
     the home page beside the proof cards and on the corridors page beside the picker.
     Keeping them inside the proof-card guard left the corridors page with an unlabelled
     slider and an empty count, so they are drawn separately. */
  function renderScrub() {
    var box = document.getElementById('stops');
    if (box) {
      var s = STOPS[lang], out = '';
      for (var i = 0; i < 3; i++) out += '<div class="' + (i === asOfIdx ? 'on' : '') + '"><b>' + s[i].t + '</b>' + s[i].s + '</div>';
      box.innerHTML = out;
    }
    var cnt = document.getElementById('pcount');
    if (cnt) cnt.innerHTML = PICK[lang].count(nReclassified());
  }

  function renderProof() {
    renderScrub();
    if (!document.getElementById('f-cls')) return;
    renderCard('f', 'US', 'EU');
    renderCard('r', 'EU', 'US');
    paintEdge('e-eu-us', 'EU', 'US');
    paintEdge('e-us-uk', 'US', 'UK');
  }

  function renderPicker() {
    var orig = document.getElementById('orig'); if (!orig) return;
    var dest = document.getElementById('dest');
    var o = orig.value, d = dest.value;
    var vO = document.getElementById('v-o'), vD = document.getElementById('v-d'),
        vCls = document.getElementById('v-cls'), vNote = document.getElementById('v-note'),
        vDot = document.getElementById('v-dot'), vStamp = document.getElementById('v-stamp');
    vO.textContent = o; vD.textContent = d;
    var c = classFor(o, d);
    if (!c) {
      vCls.textContent = PICK[lang].same; vCls.className = '';
      vDot.className = 'dot bg-transition'; vNote.textContent = PICK[lang].hint;
      if (vStamp) { vStamp.textContent = ''; vStamp.className = 'stamp'; }
      return;
    }
    var m = META[lang][c];
    vCls.textContent = m.label; vCls.className = m.cls;
    vDot.className = 'dot bg-' + m.cls; vNote.textContent = m.note;
    if (vStamp) {
      var f = flipOn(o, d), P = PICK[lang];
      if (!f) { vStamp.textContent = ''; vStamp.className = 'stamp'; }
      else if (f.fired) { vStamp.textContent = P.fired(f.dt, P.trig[f.dt] || ''); vStamp.className = 'stamp fired'; }
      else { vStamp.textContent = P.pending(f.dt); vStamp.className = 'stamp'; }
    }
  }

  /* ==================================================================== 4 ==
     The embedded mapper. The built-in picker stays until the frame says it
     mounted, so the worst case is a smaller demo, never an empty rectangle.
     ===================================================================== */
  var frame = null, openLink = null, frameShown = false;
  var MAPPER_ORIGIN = '';
  try { MAPPER_ORIGIN = MAPPER_URL ? new URL(MAPPER_URL, window.location.href).origin : ''; } catch (e) {}
  var PIN_ORIGIN = /^https?:$/.test(window.location.protocol) ? MAPPER_ORIGIN : '';

  function langUrl(l) { return MAPPER_URL + (MAPPER_URL.indexOf('?') > -1 ? '&' : '?') + 'lang=' + l; }

  function revealFrame() {
    if (frameShown) return; frameShown = true;
    var box = $('#embed'), cap = $('#embed-cap'), prev = $('#preview');
    if (box) box.hidden = false;
    if (cap) cap.hidden = false;
    if (prev) prev.hidden = true;
  }

  function postToFrame(l) {
    try {
      if (frame && frame.contentWindow) {
        frame.contentWindow.postMessage({ type: 'cbsr-lang', lang: l },
          (frame.hasAttribute('srcdoc') ? '*' : PIN_ORIGIN) || '*');
      }
    } catch (e) {}
  }

  window.addEventListener('message', function (e) {
    var selfEmbedded = e.origin === 'null' && frame && frame.hasAttribute('srcdoc');
    if (PIN_ORIGIN && !selfEmbedded && e.origin !== PIN_ORIGIN) return;
    var d = e.data; if (!d) return;
    if (d.type === 'cbsr-ready') { revealFrame(); postToFrame(lang); return; }
    if (d.type === 'cbsr-lang' && (d.lang === 'zh' || d.lang === 'en')) {
      if (d.lang !== lang) setLang(d.lang, { notifyFrame: false });
    }
  });

  /* ==================================================================== 5 ==
     The analysis index filter. Client-side, over text already in the DOM, so
     with scripting off the full list simply stays.
     ===================================================================== */
  function wireIndex() {
    var q = $('#idxq'), out = $('#idxn');
    if (!q || !out) return;
    var list = $('.idx');
    var items = $$('.idx .idx-item');
    var empty = document.createElement('li');
    empty.className = 'idx-empty'; empty.hidden = true;
    if (list) list.appendChild(empty);
    function run() {
      var term = q.value.trim().toLowerCase().replace(/\u00a7/g, '');
      var n = 0;
      items.forEach(function (li) {
        var hit = !term || li.textContent.toLowerCase().replace(/\u00a7/g, '').indexOf(term) > -1;
        li.hidden = !hit; if (hit) n++;
      });
      empty.hidden = n !== 0;
      empty.textContent = lang === 'zh' ? '没有匹配的分析。' : 'No analysis matches that.';
      out.textContent = lang === 'zh' ? (n + ' / ' + items.length + ' 篇') : (n + ' of ' + items.length);
    }
    q.addEventListener('input', run);
    window.addEventListener('cbsr-lang', run);
    run();
  }

  /* ==================================================================== 6 ==
     The maintainer application form.

     It posts to a form relay set in FORM_ENDPOINT below, which delivers to the
     maintainer's inbox without this repo running a server. Two things are worth
     knowing about the design:

       · The honeypot field is named for a plausible target and hidden off-canvas.
         A submission that fills it is dropped client-side and never posted.
       · If no endpoint is configured, or the relay is unreachable, the button
         falls back to composing the same application as an email, field labels
         and all, so an applicant is never left with nowhere to send it.
     ===================================================================== */
  var FORM_ENDPOINT = 'https://formsubmit.co/yunjiefan.research@gmail.com';
  var FORM_TO = 'yunjiefan.research@gmail.com';

  function wireForm() {
    var form = $('#apply'); if (!form) return;
    if (FORM_ENDPOINT) form.setAttribute('action', FORM_ENDPOINT);

    /* Build the same application as plain text, for the mailto fallback and for
       an applicant who would simply rather send it themselves. */
    function asText() {
      var lines = [];
      $$('fieldset', form).forEach(function (fs) {
        var legend = $('legend', fs);
        lines.push('== ' + (legend ? legend.textContent.trim() : '') + ' ==');
        $$('.f, .declare', fs).forEach(function (f) {
          /* A declaration is one checkbox whose label IS the statement. Printing
             the sentence as both the field name and its value reads as a stutter,
             so it becomes "statement: yes" instead. */
          if (f.classList.contains('declare')) {
            var box = $('input[type=checkbox]', f);
            var l = box && box.closest('label');
            if (l) lines.push(l.textContent.trim() + ': ' + (box.checked ? 'yes' : 'no'));
            return;
          }
          var lab = $('label, .flab', f);
          var name = lab ? lab.textContent.replace(/\s*required\s*$/i, '').replace(/\s*必填\s*$/, '').trim() : '';
          var val = '';
          var single = $('input[type=text],input[type=email],input[type=url],select,textarea', f);
          if (single) val = single.value.trim();
          var boxes = $$('input[type=checkbox]', f).filter(function (b) { return b.checked; });
          if (boxes.length) {
            val = boxes.map(function (b) {
              var l2 = b.closest('label');
              return l2 ? l2.textContent.trim() : b.value;
            }).join('; ');
          }
          if (name || val) lines.push(name + ': ' + val);
        });
        lines.push('');
      });
      return lines.join('\n');
    }

    form.addEventListener('submit', function (e) {
      var pot = $('input[name="_honey"]', form);
      if (pot && pot.value) { e.preventDefault(); return; }
      if (!FORM_ENDPOINT) {
        e.preventDefault();
        window.location.href = 'mailto:' + FORM_TO
          + '?subject=' + encodeURIComponent('CBSR jurisdiction maintainer — application')
          + '&body=' + encodeURIComponent(asText());
      }
    });

    var alt = $('#apply-mailto');
    if (alt) {
      alt.addEventListener('click', function (e) {
        e.preventDefault();
        window.location.href = 'mailto:' + FORM_TO
          + '?subject=' + encodeURIComponent('CBSR jurisdiction maintainer — application')
          + '&body=' + encodeURIComponent(asText());
      });
    }
  }

  /* ======================================================================= */
  function boot() {
    cache();

    /* mark the current page in the nav */
    var file = (window.location.pathname.split('/').pop() || 'index.html').toLowerCase();
    $$('.nav a[href]').forEach(function (a) {
      var h = (a.getAttribute('href') || '').split(/[?#]/)[0].toLowerCase();
      if (h && h === file) a.classList.add('on');
    });

    var tog = $('#langtog');
    if (tog) tog.addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (b) setLang(b.getAttribute('data-lang'), { notifyFrame: true });
    });

    var slider = document.getElementById('asof');
    if (slider) slider.addEventListener('input', function () {
      asOfIdx = parseInt(slider.value, 10) || 0;
      renderProof(); renderPicker();
    });

    var orig = document.getElementById('orig');
    if (orig) {
      orig.addEventListener('change', renderPicker);
      document.getElementById('dest').addEventListener('change', renderPicker);
    }

    frame = document.getElementById('mapframe');
    openLink = document.getElementById('embed-open');

    var initial = 'en';
    try {
      var q = new URLSearchParams(window.location.search).get('lang');
      if (q === 'zh' || q === 'en') initial = q;
      else { var s = localStorage.getItem('cbsr-lang'); if (s === 'zh' || s === 'en') initial = s; }
    } catch (e) {}

    if (frame && MAPPER_URL) {
      frame.src = langUrl(initial);
      frame.addEventListener('load', function () { postToFrame(lang); });
    }
    if (openLink && MAPPER_URL) openLink.href = langUrl(initial);

    window.addEventListener('cbsr-lang', function () {
      renderProof(); renderPicker();
      if (openLink && MAPPER_URL) openLink.href = langUrl(lang);
    });

    wireIndex();
    wireForm();
    setLang(initial, { notifyFrame: false });
    renderProof(); renderPicker();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
