/* ============================================================================
   cbsr-live.js — bind every published figure to the register, not to the HTML.

   THE PROBLEM THIS REMOVES
   ------------------------
   At v0.10.1 the site carried hand-typed figures: "v0.10.1" in three places,
   "152" in five, "46 — citable as binding law" in four, "Dateline 30 June
   2026" in two. The register moved to v0.11.0 and retracted the headline
   number — `decision_ready_citable_subset.count` is 0, and 46 is only the
   count of STRUCTURAL CANDIDATES — but the site kept publishing 46 as
   "citable as binding law".

   For a project whose whole claim is evidence discipline, that is the one
   defect that cannot be shipped. Patching the numbers by hand would fix this
   instance and guarantee the next one. So: no figure lives in the markup.

   HOW TO USE
   ----------
   Mark any element whose text is a register figure:

     <dd data-live="decision_ready">—</dd>
     <span data-live="version">—</span>
     <span data-live="as_of">—</span>

   Optional formatting:

     data-live-format="date"     2026-08-20 -> 20 August 2026
     data-live-prefix="v"        renders v0.11.0
     data-live-fallback="…"      shown if the fetch fails (defaults to markup)

   The text already in the element is the build-time fallback and is shown
   unchanged if the register cannot be reached. A stale-but-labelled figure is
   acceptable; an unlabelled wrong one is not — so when the fetch fails the
   page is marked `data-cbsr-live="offline"` and any [data-live-stamp] element
   says so.

   Keys resolve against api/meta.json, plus a small derived set. Anything not
   in the map is left alone rather than blanked.
   ========================================================================= */
(function () {
  'use strict';

  /* Point this at the deployed register's api/ directory. Same-origin by
     default so a copy served from the register repo needs no configuration. */
  var REGISTER_API =
    (typeof window !== 'undefined' && window.__CBSR_REGISTER_API__) ||
    'https://yunjiefanresearch-hub.github.io/cross-border-stablecoin-register/api';

  var $$ = function (sel) {
    return Array.prototype.slice.call(document.querySelectorAll(sel));
  };

  var MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  function formatDate(iso, lang) {
    if (typeof iso !== 'string' || iso.length < 10) return iso;
    var y = iso.slice(0, 4), m = parseInt(iso.slice(5, 7), 10), d = parseInt(iso.slice(8, 10), 10);
    if (!m || !d) return iso;
    if ((lang || '').indexOf('zh') === 0) return y + ' 年 ' + m + ' 月 ' + d + ' 日';
    return d + ' ' + MONTHS[m - 1] + ' ' + y;
  }

  /* Build the key -> value map from meta.json. Every derived key is a plain
     restatement of a published field; nothing is computed into a new claim. */
  function buildValues(meta) {
    var d = (meta && meta.data) || {};
    var review = d.review_coverage || {};
    var ready = d.citable_count != null ? d.citable_count : 0;
    var structural = d.structural_candidate_count != null
      ? d.structural_candidate_count
      : (d.structural_citable_candidates != null ? d.structural_citable_candidates : 0);

    return {
      version: d.version || meta.version,
      as_of: meta.generated || d.as_of_base,
      as_of_base: d.as_of_base,
      records: d.record_count,
      jurisdictions: Array.isArray(d.jurisdictions) ? d.jurisdictions.length : null,

      /* The two numbers that must always travel together. */
      decision_ready: ready,
      structural_candidates: structural,

      /* Review and source census — the reason decision_ready is what it is. */
      official_source: review.official_source,
      primary_reviewed: review.primary_reviewer_present,
      second_reviewed: review.second_reviewer_present,
      reconciled: review.reconciled,
      authored_corridors: d.authored_corridors
    };
  }

  function apply(values, lang) {
    $$('[data-live]').forEach(function (el) {
      var key = el.getAttribute('data-live');
      if (!(key in values)) return;
      var value = values[key];
      if (value === null || value === undefined) return;
      if (el.getAttribute('data-live-format') === 'date') value = formatDate(value, lang);
      var prefix = el.getAttribute('data-live-prefix') || '';
      el.textContent = prefix + value;
      el.setAttribute('data-live-state', 'bound');
    });
  }

  function markOffline() {
    document.documentElement.setAttribute('data-cbsr-live', 'offline');
    $$('[data-live-stamp]').forEach(function (el) {
      var lang = document.documentElement.getAttribute('lang') || 'en';
      el.textContent = lang.indexOf('zh') === 0
        ? '构建期快照 — 未能连上登记册，以下数字可能已过期'
        : 'build-time snapshot — the register could not be reached, figures may be stale';
      el.setAttribute('data-live-state', 'offline');
    });
  }

  function markLive(values, lang) {
    document.documentElement.setAttribute('data-cbsr-live', 'live');
    $$('[data-live-stamp]').forEach(function (el) {
      el.textContent = (lang.indexOf('zh') === 0 ? '实时读取自登记册 · ' : 'read live from the register · ')
        + 'v' + values.version + ' · ' + formatDate(values.as_of, lang);
      el.setAttribute('data-live-state', 'live');
    });
  }

  /* ------------------------------------------------------------ worklist --
     maintain.html asks people to become named reviewers. Asking is not enough:
     a prospective contributor needs to see a specific, bounded, finishable task
     with their own eyes. The register already computes exactly that list, so
     the page renders it rather than describing it.

     This is also what OpenSSF `small_tasks` (Gold) asks for, but the reason it
     is here is that `review_stage.reconciled = 0` is the single constraint
     holding decision_ready at zero, and this list is how that number moves. */
  function renderWorklist(lang) {
    var list = document.getElementById('wl-list');
    var state = document.getElementById('wl-state');
    var count = document.getElementById('wl-count');
    if (!list || !state) return;

    var zh = lang.indexOf('zh') === 0;

    fetch(REGISTER_API.replace(/\/+$/, '') + '/verification-worklist.json', { cache: 'no-cache' })
      .then(function (r) {
        if (!r.ok) throw new Error('worklist ' + r.status);
        return r.json();
      })
      .then(function (payload) {
        var rows = (payload && (payload.data || payload)) || [];
        if (rows.items) rows = rows.items;
        if (rows.worklist) rows = rows.worklist;
        if (!Array.isArray(rows) || !rows.length) throw new Error('worklist is empty');

        list.textContent = '';
        rows.slice(0, 60).forEach(function (row) {
          var li = document.createElement('li');

          var cell = document.createElement('span');
          cell.className = 'wl-cell';
          cell.textContent = (row.jurisdiction || row.jur || '??') + ' · ' + (row.dimension || '');
          li.appendChild(cell);

          var what = document.createElement('span');
          what.className = 'wl-what';
          what.textContent =
            row.instrument_label_local || row.requirement_summary || row.id || '';
          li.appendChild(what);

          var need = document.createElement('span');
          need.className = 'wl-need';
          need.textContent =
            row.missing || row.needs || (row.url ? '' : (zh ? '缺官方来源 URL' : 'needs official URL'));
          li.appendChild(need);

          list.appendChild(li);
        });

        if (count) count.textContent = rows.length + (zh ? ' 格' : ' cells');
        state.textContent = zh
          ? '直接读自登记册的 verification_worklist。认领一格请开 issue。'
          : 'Read live from the register\u2019s verification worklist. Open an issue to claim a cell.';
      })
      .catch(function () {
        state.textContent = zh
          ? '暂时读不到工作清单。仓库里的 analysis/verification_worklist.json 是同一份数据。'
          : 'The worklist could not be read just now. analysis/verification_worklist.json in the repository holds the same data.';
        if (count) count.textContent = '\u2014';
      });
  }

  function run() {
    var lang = document.documentElement.getAttribute('lang') || 'en';

    if (typeof fetch !== 'function') { markOffline(); return; }

    renderWorklist(lang);
    window.addEventListener('cbsr-lang', function (e) {
      renderWorklist((e && e.detail) || document.documentElement.getAttribute('lang') || 'en');
    });

    fetch(REGISTER_API.replace(/\/+$/, '') + '/meta.json', { cache: 'no-cache' })
      .then(function (r) {
        if (!r.ok) throw new Error('meta.json ' + r.status);
        return r.json();
      })
      .then(function (meta) {
        var values = buildValues(meta);
        if (values.version == null) throw new Error('meta.json carries no version');
        apply(values, lang);
        markLive(values, lang);
        /* Re-apply after a language switch. cbsr.js caches each [data-zh]
           element's original innerHTML at load and restores it on every toggle,
           so a bound figure would be reverted to its build-time fallback the
           first time the reader switches to Chinese. The site already emits
           `cbsr-lang` on window for exactly this class of generated content
           (corridor verdicts, the index count); the figures join that group. */
        window.addEventListener('cbsr-lang', function (e) {
          var next = (e && e.detail) || document.documentElement.getAttribute('lang') || 'en';
          apply(values, next);
          markLive(values, next);
        });
      })
      .catch(function () { markOffline(); });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }
})();
