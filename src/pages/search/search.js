// /src/pages/search/search.js
// Search page - rewired to dataClient (canonical model)
// Preserves:
// - URL state persistence + back/forward
// - Filter chips
// - Facet "show 6 + see more/less"
// - Pagination + per-page
// - Sorting
// - Mobile filter drawer + Apply/Clear
// - Contributors popover

import { searchDatasets } from "/src/shared/data/dataClient.js";

(() => {
  // ──────────────────────────────────────────────────────────────
  // DOM selectors (match index.html)
  // ──────────────────────────────────────────────────────────────
  const qEl = document.getElementById("q");
  const clearSearchBtn = document.getElementById("clearSearch");
  const searchGoBtn = document.getElementById("searchGo");

  const resultsEl = document.getElementById("results");
  const emptyEl = document.getElementById("empty");
  const emptyClear = document.getElementById("emptyClear");

  const chipsEl = document.getElementById("chips");
  const metaEl = document.getElementById("meta");
  const sortEl = document.getElementById("sort");

  const pagingRow = document.getElementById("pagingRow");
  const perPageEl = document.getElementById("perPage");
  const pager = document.getElementById("pager");
  const pagerList = document.getElementById("pagerList");

  const yearListEl = document.getElementById("yearList");
  const catListEl = document.getElementById("catList"); // subjects
  const keywordListEl = document.getElementById("keywordList");
  const typeListEl = document.getElementById("typeList");

  const yearListM = document.getElementById("yearListM");
  const catListM = document.getElementById("catListM");
  const keywordListM = document.getElementById("keywordListM");
  const typeListM = document.getElementById("typeListM");

  const openFiltersBtn = document.getElementById("openFilters");
  const filterDrawer = document.getElementById("filterDrawer");
  const filterBackdrop = document.getElementById("filterBackdrop");
  const closeFiltersBtn = document.getElementById("closeFilters");
  const clearBtnMobile = document.getElementById("clearBtnMobile");
  const applyFiltersMobile = document.getElementById("applyFiltersMobile");
  const clearBtn = document.getElementById("clearBtn");

  const pop = document.getElementById("popover");
  const popTitle = document.getElementById("popTitle");
  const popClose = document.getElementById("popClose");
  const popSearch = document.getElementById("popSearch");
  const popMeta = document.getElementById("popMeta");
  const popList = document.getElementById("popList");
  const popViewRecord = document.getElementById("popViewRecord");
  const backdrop = document.getElementById("backdrop");

  // ──────────────────────────────────────────────────────────────
  // State
  // ──────────────────────────────────────────────────────────────
  const state = {
    q: "",
    years: new Set(), // stored as strings in URL ("2024")
    subjects: new Set(),
    types: new Set(),
    keywords: new Set(),
    sort: "relevance",
    perPage: 10,
    page: 1,
  };

  // Track “See more / less” expansion state for long facet lists
  const facetExpanded = new Set();

  // Popover state
  let activeContribs = [];
  let lastFocus = null;

  // Prevent URL write during popstate hydration
  let suppressUrlSync = false;

  // Last fetched results (for popover lookup)
  let lastResultRows = [];

  // ──────────────────────────────────────────────────────────────
  // Utilities
  // ──────────────────────────────────────────────────────────────
  function escapeHtml(str) {
    return String(str || "").replace(/[&<>"']/g, (s) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }[s]));
  }

  function clamp(v, a, b) {
    return Math.max(a, Math.min(b, v));
  }

  function syncSearchClearVisibility() {
    if (!qEl || !clearSearchBtn) return;
    const val = (qEl.value || "").trim();
    clearSearchBtn.hidden = val.length === 0;
  }

  function toYearNumberSet(yearStrings) {
    const out = new Set();
    (yearStrings || []).forEach((y) => {
      const n = Number(String(y || "").trim());
      if (Number.isFinite(n)) out.add(n);
    });
    return out;
  }

  function fromYearNumbersToStrings(yearNumbers) {
    return (yearNumbers || []).map((n) => String(n));
  }

  function mapSortToClient(value) {
    // UI: relevance, dateDesc/dateAsc, sizeDesc/sizeAsc, titleAsc/titleDesc
    // dataClient: relevance, yearDesc/yearAsc, sizeDesc/sizeAsc, titleAsc/titleDesc
    if (value === "dateDesc") return "yearDesc";
    if (value === "dateAsc") return "yearAsc";
    return value || "relevance";
  }

  function mapSortToUi(value) {
    if (value === "yearDesc") return "dateDesc";
    if (value === "yearAsc") return "dateAsc";
    return value || "relevance";
  }

  function formatShortDate(iso) {
    if (!iso) return "—";
    const d = new Date(String(iso).includes("T") ? iso : `${iso}T00:00:00`);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  }

  function parseSizeGBFromLabel(label) {
    const m = String(label || "").match(/([0-9]+(?:\.[0-9]+)?)/);
    if (!m) return 0;
    const n = Number(m[1]);
    return Number.isFinite(n) ? n : 0;
  }

  function bytesToGB(bytes) {
    const b = Number(bytes);
    if (!Number.isFinite(b) || b <= 0) return 0;
    return Math.round((b / (1024 ** 3)) * 10) / 10; // 1 decimal
  }

  function firstNonEmpty(arr) {
    return (Array.isArray(arr) ? arr : []).map((x) => String(x || "").trim()).find(Boolean) || "";
  }

  function contributorName(p) {
    // Supports both canonical and legacy-ish contributor objects
    const first =
      String(p?.first || p?.firstName || "").trim();
    const last =
      String(p?.last || p?.lastName || "").trim();
    const name =
      String(p?.name || "").trim();

    if (last || first) return `${last}${last && first ? ", " : ""}${first}`;
    if (name) return name;
    return "Contributor";
  }

  // Convert canonical dataset to the lightweight shape this UI expects
  function toRow(ds) {
    const doi = String(ds?.doi || "").trim();
    const title = String(ds?.title || "Untitled").trim();
    const description = String(ds?.description || "").trim();

    const subjects = Array.isArray(ds?.subjects) ? ds.subjects : [];
    const keywords = Array.isArray(ds?.keywords) ? ds.keywords : [];
    const fileTypes = Array.isArray(ds?.fileTypes) ? ds.fileTypes : [];

    const primarySubject = firstNonEmpty(subjects) || "Unspecified";
    const fileType = String(ds?.datasetType || "").trim() || firstNonEmpty(fileTypes) || "Unknown";

    // Prefer publishedYear for "Published Year" facet, but UI displays a date label.
    const dateISO = (() => {
      // If we have an ISO date, use it. Otherwise create Jan 01 from publishedYear.
      const iso = String(ds?.publishedAt || ds?.createdAt || ds?.updatedAt || "").trim();
      if (iso) return iso.slice(0, 10);
      const y = Number(ds?.publishedYear);
      return Number.isFinite(y) ? `${y}-01-01` : "";
    })();

    const dateLabel = formatShortDate(dateISO);

    // Dataset files: prefer uploadedFiles count; size from bytes if present; fallback to label parsing.
    const count = Array.isArray(ds?.uploadedFiles) ? ds.uploadedFiles.length : 0;
    const sizeGB =
      Number.isFinite(ds?.datasetSizeBytes)
        ? bytesToGB(ds.datasetSizeBytes)
        : parseSizeGBFromLabel(ds?.datasetSizeLabel);

    const contributors = Array.isArray(ds?.contributors)
      ? ds.contributors
      : (Array.isArray(ds?.authors) ? ds.authors : []);

    return {
      id: doi || ds?.id || crypto.randomUUID(),
      doi,
      title,
      description,
      subject: primarySubject,
      fileType,
      dateISO: dateISO || "",
      dateLabel,
      datasetFiles: { count, sizeGB },
      keywords: keywords.map((k) => String(k || "").trim()).filter(Boolean),
      contributors: contributors.map((p) => ({
        first: p?.first || p?.firstName || "",
        last: p?.last || p?.lastName || "",
        name: p?.name || "",
        affil: p?.affil || p?.affiliation || "",
      })),
      landingUrl: `/src/pages/dataset/index.html?doi=${encodeURIComponent(doi)}`,
      _raw: ds,
    };
  }

  // ──────────────────────────────────────────────────────────────
  // URL state
  // ──────────────────────────────────────────────────────────────
  function readUrlParams() {
    const params = new URLSearchParams(window.location.search);

    const q = (params.get("q") || "").trim();

    const yearAll = params.getAll("year").map((s) => (s || "").trim()).filter(Boolean);
    const yearSingle = (params.get("year") || "").trim();
    const years = yearAll.length
      ? yearAll
      : (yearSingle ? yearSingle.split(",").map((s) => s.trim()).filter(Boolean) : []);

    const subjectAll = params.getAll("subject").map((s) => (s || "").trim()).filter(Boolean);
    const subjectAlias = (params.get("category") || "").trim(); // legacy alias
    const subjectsParam = subjectAll.length ? subjectAll : [];
    if (subjectAlias) subjectsParam.push(subjectAlias);

    const typeAll = params.getAll("type").map((s) => (s || "").trim()).filter(Boolean);
    const typeSingle = (params.get("type") || "").trim();
    const types = typeAll.length
      ? typeAll
      : (typeSingle ? typeSingle.split(",").map((s) => s.trim()).filter(Boolean) : []);

    const keywordAll = params.getAll("keyword").map((s) => (s || "").trim()).filter(Boolean);
    const keywordSingle = (params.get("keyword") || "").trim();
    const keywords = keywordAll.length
      ? keywordAll
      : (keywordSingle ? keywordSingle.split(",").map((s) => s.trim()).filter(Boolean) : []);

    const sort = (params.get("sort") || "").trim();
    const perPage = (params.get("perPage") || "").trim();
    const page = (params.get("page") || "").trim();

    return { q, years, subjects: subjectsParam, types, keywords, sort, perPage, page };
  }

  function applyUrlParams() {
    const { q, years, subjects: sub, types, keywords, sort, perPage, page } = readUrlParams();

    state.q = "";
    state.years.clear();
    state.subjects.clear();
    state.types.clear();
    state.keywords.clear();
    state.sort = "relevance";
    state.perPage = 10;
    state.page = 1;

    if (q) {
      state.q = q;
      qEl.value = q;
    } else {
      qEl.value = "";
    }

    (years || []).forEach((y) => {
      const yy = String(y || "").trim();
      if (yy) state.years.add(yy);
    });

    (sub || []).forEach((s) => {
      const ss = String(s || "").trim();
      if (ss) state.subjects.add(ss);
    });

    (types || []).forEach((t) => {
      const tt = String(t || "").trim();
      if (tt) state.types.add(tt);
    });

    (keywords || []).forEach((k) => {
      const kk = String(k || "").trim();
      if (kk) state.keywords.add(kk);
    });

    if (sort) {
      state.sort = sort;
      if (sortEl) sortEl.value = sort;
    } else {
      if (sortEl) sortEl.value = "relevance";
    }

    if (perPage) {
      const v = perPage.toLowerCase();
      state.perPage = (v === "all") ? Infinity : Number(perPage);
      if (perPageEl) perPageEl.value = (v === "all") ? "all" : String(Number(perPage) || 10);
    } else {
      state.perPage = 10;
      if (perPageEl) perPageEl.value = "10";
    }

    if (page) {
      const p = Number(page);
      if (Number.isFinite(p) && p >= 1) state.page = Math.floor(p);
    } else {
      state.page = 1;
    }

    syncSearchClearVisibility();
  }

  function stateToSearchParams() {
    const params = new URLSearchParams();

    const q = (state.q || "").trim();
    if (q) params.set("q", q);

    Array.from(state.years)
      .sort((a, b) => String(b).localeCompare(String(a)))
      .forEach((y) => params.append("year", y));

    Array.from(state.subjects)
      .sort((a, b) => String(a).localeCompare(String(b)))
      .forEach((s) => params.append("subject", s));

    Array.from(state.types)
      .sort((a, b) => String(a).localeCompare(String(b)))
      .forEach((t) => params.append("type", t));

    Array.from(state.keywords)
      .sort((a, b) => String(a).localeCompare(String(b)))
      .forEach((k) => params.append("keyword", k));

    if (state.sort && state.sort !== "relevance") params.set("sort", state.sort);

    if (state.perPage === Infinity) params.set("perPage", "all");
    else if (state.perPage && state.perPage !== 10) params.set("perPage", String(state.perPage));

    if (state.page && state.page !== 1) params.set("page", String(state.page));

    return params;
  }

  function syncUrlFromState(mode = "replace") {
    if (suppressUrlSync) return;
    const params = stateToSearchParams();
    const qs = params.toString();
    const url = qs ? `${window.location.pathname}?${qs}` : window.location.pathname;

    const current = window.location.pathname + window.location.search;
    if (current === url) return;

    if (mode === "push") window.history.pushState({}, "", url);
    else window.history.replaceState({}, "", url);
  }

  // ──────────────────────────────────────────────────────────────
  // Facets rendering (USWDS checkbox lists + show 6 toggle)
  // ──────────────────────────────────────────────────────────────
  function renderFacetUSWDS(listEl, values, selectedSet, onChange, sortMode) {
    let sorted = values.slice();

    if (sortMode === "yearDesc") sorted.sort((a, b) => Number(b.value) - Number(a.value));
    else sorted.sort((a, b) => String(a.value).localeCompare(String(b.value)));

    listEl.innerHTML = sorted
      .map(({ value, count }, idx) => {
        const id = `${listEl.id}-${idx}-${value}`.replace(/\s+/g, "-");
        const checked = selectedSet.has(String(value)) ? "checked" : "";
        return `
        <div class="usa-checkbox margin-bottom-1">
          <input class="usa-checkbox__input" id="${escapeHtml(id)}" type="checkbox" value="${escapeHtml(String(value))}" ${checked}>
          <label class="usa-checkbox__label" for="${escapeHtml(id)}">
            ${escapeHtml(String(value))} <span class="text-base">(${count})</span>
          </label>
        </div>
      `;
      })
      .join("");

    listEl.querySelectorAll('input[type="checkbox"]').forEach((cb) => {
      cb.addEventListener("change", (e) => onChange(e.target.value, e.target.checked));
    });
  }

  function applyFacetLimit(listEl, key, limit) {
    if (!listEl) return;

    const expanded = facetExpanded.has(key);

    const items = Array.from(listEl.querySelectorAll(".usa-checkbox"));
    const needsToggle = items.length > limit;

    items.forEach((el, idx) => {
      if (!needsToggle) {
        el.classList.remove("facetHidden");
        return;
      }
      const hide = !expanded && idx >= limit;
      el.classList.toggle("facetHidden", hide);
    });

    let wrap = listEl.parentElement?.querySelector(`[data-facet-toggle="${key}"]`);
    if (needsToggle) {
      if (!wrap) {
        wrap = document.createElement("div");
        wrap.className = "facetToggleWrap";
        wrap.setAttribute("data-facet-toggle", key);

        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "usa-button usa-button--unstyled facetToggle";
        btn.setAttribute("aria-expanded", expanded ? "true" : "false");
        btn.textContent = expanded ? "See less" : "See more";

        btn.addEventListener("click", () => {
          if (facetExpanded.has(key)) facetExpanded.delete(key);
          else facetExpanded.add(key);
          // Re-apply limit without rebuilding counts (fast + stable)
          applyFacetLimit(listEl, key, limit);
          const btn2 = wrap.querySelector("button");
          if (btn2) {
            btn2.setAttribute("aria-expanded", facetExpanded.has(key) ? "true" : "false");
            btn2.textContent = facetExpanded.has(key) ? "See less" : "See more";
          }
        });

        wrap.appendChild(btn);
        listEl.insertAdjacentElement("afterend", wrap);
      } else {
        const btn = wrap.querySelector("button");
        if (btn) {
          btn.setAttribute("aria-expanded", expanded ? "true" : "false");
          btn.textContent = expanded ? "See less" : "See more";
        }
      }
    } else {
      if (wrap) wrap.remove();
    }
  }

  function renderFacetUSWDSLimited(listEl, values, selectedSet, onChange, sortMode, opts) {
    renderFacetUSWDS(listEl, values, selectedSet, onChange, sortMode);
    const limit = (opts && Number(opts.limit)) || 6;
    const key = (opts && opts.key) || listEl?.id || "facet";
    applyFacetLimit(listEl, key, limit);
  }

  // ──────────────────────────────────────────────────────────────
  // Chips
  // ──────────────────────────────────────────────────────────────
  function renderChips() {
    const chips = [];
    state.years.forEach((v) => chips.push({ key: `year:${v}`, label: `${v}` }));
    state.subjects.forEach((v) => chips.push({ key: `subject:${v}`, label: `${v}` }));
    state.types.forEach((v) => chips.push({ key: `type:${v}`, label: `${v}` }));
    state.keywords.forEach((v) => chips.push({ key: `keyword:${v}`, label: `${v}` }));

    chipsEl.innerHTML = chips.length
      ? chips
          .map(
            (c) => `
          <span class="chip">
            ${escapeHtml(c.label)}
            <button type="button" aria-label="Remove ${escapeHtml(c.label)}" data-remove="${escapeHtml(c.key)}">×</button>
          </span>
        `
          )
          .join("")
      : `<span class="usa-hint">No filters applied.</span>`;
  }

  chipsEl.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-remove]");
    if (!btn) return;
    const key = btn.getAttribute("data-remove");
    const [type, val] = key.split(":");

    if (type === "year") state.years.delete(val);
    if (type === "subject") state.subjects.delete(val);
    if (type === "type") state.types.delete(val);
    if (type === "keyword") state.keywords.delete(val);

    state.page = 1;
    renderFacets();
    update({ history: "push" });
  });

  // ──────────────────────────────────────────────────────────────
  // Results rendering + pagination
  // ──────────────────────────────────────────────────────────────
  function contributorsSummaryHTML(result) {
    const contributors = result.contributors || [];
    const topN = 3;
    const topPeople = contributors.slice(0, topN);
    const remaining = Math.max(0, contributors.length - topPeople.length);

    const names = topPeople
      .map((p) => {
        const nm = contributorName(p);
        return `<span class="name" title="${escapeHtml(nm)}">${escapeHtml(nm)}</span>`;
      })
      .join(`<span class="sep">,</span> `);

    const more = remaining
      ? ` <span class="sep">,</span>
          <button
            class="morePill"
            type="button"
            data-action="open-pop"
            data-result-id="${escapeHtml(result.id)}"
            aria-label="View all contributors for ${escapeHtml(result.title)}"
          >+${remaining}</button>`
      : "";

    return `<div class="contribSummary">${names}${more}</div>`;
  }

  function getPerPage() {
    return state.perPage === Infinity ? Infinity : Number(state.perPage);
  }

  function renderPager(pageCount) {
    // Match prior behavior: hide entire row when no paging is needed, except when perPage=All
    pagingRow.hidden = (pageCount <= 1 && getPerPage() !== Infinity);

    if (getPerPage() === Infinity) {
      pager.hidden = true;
      pagerList.innerHTML = "";
      pagingRow.hidden = false;
      return;
    }

    if (pageCount <= 1) {
      pager.hidden = true;
      pagerList.innerHTML = "";
      return;
    }

    pager.hidden = false;

    const current = state.page;
    const totalPages = pageCount;

    const items = [];
    const addPage = (p) => items.push({ type: "page", p });
    const addEllipsis = () => items.push({ type: "ellipsis" });

    const windowSize = 1;
    const pages = new Set([1, totalPages]);
    for (let p = current - windowSize; p <= current + windowSize; p++) {
      if (p >= 1 && p <= totalPages) pages.add(p);
    }
    const sorted = [...pages].sort((a, b) => a - b);

    let prev = null;
    for (const p of sorted) {
      if (prev !== null && p - prev > 1) addEllipsis();
      addPage(p);
      prev = p;
    }

    pagerList.innerHTML = `
      <li class="usa-pagination__item usa-pagination__arrow">
        <a
          class="usa-pagination__link usa-pagination__previous-page"
          href="#"
          aria-label="Previous page"
          data-page="${current - 1}"
          ${current === 1 ? 'aria-disabled="true" tabindex="-1"' : ""}
        >
          <span class="usa-pagination__link-text">Previous</span>
        </a>
      </li>

      ${items
        .map((it) => {
          if (it.type === "ellipsis") {
            return `
              <li class="usa-pagination__item usa-pagination__overflow" role="presentation">
                <span>…</span>
              </li>
            `;
          }
          const isCurrent = it.p === current;
          return `
            <li class="usa-pagination__item usa-pagination__page-no">
              <a
                class="usa-pagination__button ${isCurrent ? "usa-current" : ""}"
                href="#"
                aria-label="Page ${it.p}"
                ${isCurrent ? 'aria-current="page"' : ""}
                data-page="${it.p}"
              >${it.p}</a>
            </li>
          `;
        })
        .join("")}

      <li class="usa-pagination__item usa-pagination__arrow">
        <a
          class="usa-pagination__link usa-pagination__next-page"
          href="#"
          aria-label="Next page"
          data-page="${current + 1}"
          ${current === totalPages ? 'aria-disabled="true" tabindex="-1"' : ""}
        >
          <span class="usa-pagination__link-text">Next</span>
        </a>
      </li>
    `;
  }

  pager.addEventListener("click", (e) => {
    const a = e.target.closest("a[data-page]");
    if (!a) return;
    e.preventDefault();
    if (a.getAttribute("aria-disabled") === "true") return;

    const nextPage = Number(a.getAttribute("data-page"));
    if (Number.isNaN(nextPage)) return;

    state.page = nextPage;
    update({ history: "push" });
  });

  function renderResults(rows, responseMeta) {
    const q = state.q.trim();
    const per = getPerPage();

    const total = Number(responseMeta?.total || rows.length);
    const page = Number(responseMeta?.page || 1);
    const perPage = per === Infinity ? total : Number(responseMeta?.perPage || per);
    const start = total ? (page - 1) * perPage + 1 : 0;
    const end = total ? Math.min(total, (page - 1) * perPage + rows.length) : 0;

    if (total === 0) {
      metaEl.innerHTML = q
        ? `We found <strong>0</strong> records for “${escapeHtml(q)}”.`
        : `We found <strong>0</strong> records.`;
    } else if (per !== Infinity) {
      metaEl.innerHTML = q
        ? `Showing <strong>${start}–${end}</strong> of <strong>${total}</strong> records for “${escapeHtml(q)}”.`
        : `Showing <strong>${start}–${end}</strong> of <strong>${total}</strong> records.`;
    } else {
      metaEl.innerHTML = q
        ? `We found <strong>${total}</strong> records for “${escapeHtml(q)}”.`
        : `We found <strong>${total}</strong> records.`;
    }

    resultsEl.innerHTML = rows
      .map(
        (r) => `
      <article class="resultCard">
        <div class="resultGrid">
          <div>
            <h3 class="resultTitle margin-0">
              <a class="usa-link" href="${escapeHtml(r.landingUrl)}">${escapeHtml(r.title || "Untitled")}</a>
            </h3>
            <div class="resultDoi">${escapeHtml(r.doi)}</div>
            ${contributorsSummaryHTML(r)}
          </div>

          <div>
            <div class="metaLabel">Subject</div>
            <div class="metaValue">${escapeHtml(r.subject || "—")}</div>
          </div>

          <div>
            <div class="metaLabel">Dataset Files</div>
            <div class="metaValue">
              ${escapeHtml(String(r.datasetFiles.count || 0))}
              <span class="text-base">(${escapeHtml(String(r.datasetFiles.sizeGB || 0))} GB)</span>
            </div>
          </div>

          <div>
            <div class="metaLabel">Published Date</div>
            <div class="metaValue">${escapeHtml(r.dateLabel || "—")}</div>
          </div>

          <div class="resultActions">
            <button class="iconBtn" type="button" aria-label="Save record">☆</button>
          </div>
        </div>
      </article>
    `
      )
      .join("");

    emptyEl.hidden = total !== 0;
  }

  // ──────────────────────────────────────────────────────────────
  // Facets (use dataClient facets, but with "q-only" base like your previous UX)
  // ──────────────────────────────────────────────────────────────
  async function renderFacets() {
    // Build facets based on q only (not selected facets), matching old behavior.
    const q = state.q.trim();

    const facetParams = {
      q,
      // Published-only for public search
      status: ["Published"],
      // No other filters
      subjects: [],
      keywords: [],
      fileTypes: [],
      years: [],
      // cheap request (pagination irrelevant for facets)
      page: 1,
      perPage: 1,
      sort: "relevance",
    };

    let facetResp;
    try {
      facetResp = await searchDatasets(facetParams);
    } catch (e) {
      console.warn("search: facets fetch failed", e);
      facetResp = { facets: { years: [], subjects: [], keywords: [], fileTypes: [] } };
    }

    const facets = facetResp?.facets || {};

    // Years come as numbers in the demo client; UI expects strings.
    const years = (facets.years || []).map((x) => ({
      value: String(x.value),
      count: x.count,
    }));

    const subs = (facets.subjects || []).map((x) => ({ value: String(x.value), count: x.count }));
    const keys = (facets.keywords || []).map((x) => ({ value: String(x.value), count: x.count }));
    const types = (facets.fileTypes || []).map((x) => ({ value: String(x.value), count: x.count }));

    // Ensure selected values still appear even if not present in q-only facets
    Array.from(state.years).forEach((y) => {
      if (!years.some((x) => x.value === y)) years.push({ value: y, count: 0 });
    });
    Array.from(state.subjects).forEach((s) => {
      if (!subs.some((x) => x.value === s)) subs.push({ value: s, count: 0 });
    });
    Array.from(state.keywords).forEach((k) => {
      if (!keys.some((x) => x.value === k)) keys.push({ value: k, count: 0 });
    });
    Array.from(state.types).forEach((t) => {
      if (!types.some((x) => x.value === t)) types.push({ value: t, count: 0 });
    });

    const onYear = (val, checked) => {
      checked ? state.years.add(val) : state.years.delete(val);
      state.page = 1;
      update({ history: "push" });
    };
    const onSub = (val, checked) => {
      checked ? state.subjects.add(val) : state.subjects.delete(val);
      state.page = 1;
      update({ history: "push" });
    };
    const onType = (val, checked) => {
      checked ? state.types.add(val) : state.types.delete(val);
      state.page = 1;
      update({ history: "push" });
    };
    const onKey = (val, checked) => {
      checked ? state.keywords.add(val) : state.keywords.delete(val);
      state.page = 1;
      update({ history: "push" });
    };

    renderFacetUSWDSLimited(yearListEl, years, state.years, onYear, "yearDesc", { limit: 6, key: "year-d" });
    renderFacetUSWDSLimited(catListEl, subs, state.subjects, onSub, undefined, { limit: 6, key: "subject-d" });
    if (keywordListEl) renderFacetUSWDSLimited(keywordListEl, keys, state.keywords, onKey, undefined, { limit: 6, key: "keyword-d" });
    renderFacetUSWDSLimited(typeListEl, types, state.types, onType, undefined, { limit: 6, key: "type-d" });

    renderFacetUSWDSLimited(yearListM, years, state.years, onYear, "yearDesc", { limit: 6, key: "year-m" });
    renderFacetUSWDSLimited(catListM, subs, state.subjects, onSub, undefined, { limit: 6, key: "subject-m" });
    if (keywordListM) renderFacetUSWDSLimited(keywordListM, keys, state.keywords, onKey, undefined, { limit: 6, key: "keyword-m" });
    renderFacetUSWDSLimited(typeListM, types, state.types, onType, undefined, { limit: 6, key: "type-m" });
  }

  function syncFacetCheckboxes() {
    const sync = (rootId, selectedSet) => {
      const root = document.getElementById(rootId);
      if (!root) return;
      root.querySelectorAll('input[type="checkbox"]').forEach((cb) => {
        cb.checked = selectedSet.has(cb.value);
      });
    };

    sync("yearList", state.years);
    sync("catList", state.subjects);
    sync("keywordList", state.keywords);
    sync("typeList", state.types);

    sync("yearListM", state.years);
    sync("catListM", state.subjects);
    sync("keywordListM", state.keywords);
    sync("typeListM", state.types);
  }

  // ──────────────────────────────────────────────────────────────
  // Section toggles (accordion-like)
  // ──────────────────────────────────────────────────────────────
  function wireSectionToggles(root) {
    root.querySelectorAll(".filterSection").forEach((section) => {
      const btn = section.querySelector(".filterHeader");
      if (!btn) return;
      btn.addEventListener("click", () => {
        const expanded = btn.getAttribute("aria-expanded") === "true";
        btn.setAttribute("aria-expanded", String(!expanded));
        section.classList.toggle("is-collapsed", expanded);
      });
    });
  }

  // ──────────────────────────────────────────────────────────────
  // Popover
  // ──────────────────────────────────────────────────────────────
  function renderPopList(list, q) {
    const query = q.trim().toLowerCase();
    const rows = !query
      ? list
      : list.filter((p) => `${contributorName(p)} ${p.affil || ""}`.toLowerCase().includes(query));

    popMeta.textContent = `${rows.length} of ${list.length} shown`;

    popList.innerHTML = rows
      .map((p) => {
        const nm = contributorName(p);
        const aff = String(p.affil || "").trim();
        return `
          <div class="contrib-row" title="${escapeHtml(nm)} — ${escapeHtml(aff)}">
            <div class="nm">${escapeHtml(nm)}</div>
            <div class="aff">${escapeHtml(aff || "—")}</div>
          </div>
        `;
      })
      .join("");
  }

  function openPopoverForResult(resultId, anchorEl) {
    const r = lastResultRows.find((x) => x.id === resultId);
    if (!r) return;

    activeContribs = r.contributors || [];
    lastFocus = anchorEl;

    popTitle.textContent = `Contributors (${activeContribs.length})`;
    popViewRecord.href = r.landingUrl;
    popSearch.value = "";
    renderPopList(activeContribs, "");

    pop.hidden = false;
    pop.setAttribute("aria-hidden", "false");
    backdrop.hidden = false;

    const rect = anchorEl.getBoundingClientRect();
    const pad = 10;
    const pr = pop.getBoundingClientRect();

    let popTop = Math.min(rect.bottom + 8, window.innerHeight - pr.height - pad);
    popTop = Math.max(pad, popTop);

    let popLeft = Math.min(rect.left, window.innerWidth - pr.width - pad);
    popLeft = Math.max(pad, popLeft);

    pop.style.top = `${popTop}px`;
    pop.style.left = `${popLeft}px`;

    setTimeout(() => popSearch.focus(), 0);
  }

  function closePopover() {
    pop.hidden = true;
    pop.setAttribute("aria-hidden", "true");
    backdrop.hidden = true;
    activeContribs = [];
    if (lastFocus && typeof lastFocus.focus === "function") lastFocus.focus();
  }

  // ──────────────────────────────────────────────────────────────
  // Mobile drawer
  // ──────────────────────────────────────────────────────────────
  let lastDrawerFocus = null;

  function openDrawer() {
    lastDrawerFocus = document.activeElement;
    filterDrawer.hidden = false;
    filterBackdrop.hidden = false;
    openFiltersBtn.setAttribute("aria-expanded", "true");
    document.body.style.overflow = "hidden";
    setTimeout(() => {
      const first = filterDrawer.querySelector("button, input, select, a");
      if (first) first.focus();
    }, 0);
  }

  function closeDrawer() {
    filterDrawer.hidden = true;
    filterBackdrop.hidden = true;
    openFiltersBtn.setAttribute("aria-expanded", "false");
    document.body.style.overflow = "";
    if (lastDrawerFocus && typeof lastDrawerFocus.focus === "function") lastDrawerFocus.focus();
  }

  // ──────────────────────────────────────────────────────────────
  // Data fetch + render
  // ──────────────────────────────────────────────────────────────
  async function update(opts = {}) {
    // Build query params for dataClient
    const q = state.q.trim();

    const yearsNum = Array.from(toYearNumberSet(Array.from(state.years)));
    const perPage = state.perPage === Infinity ? 100000 : Number(state.perPage || 10);

    const params = {
      q,
      status: ["Published"], // public search
      years: yearsNum,
      subjects: Array.from(state.subjects),
      keywords: Array.from(state.keywords),
      fileTypes: Array.from(state.types),
      sort: mapSortToClient(state.sort),
      page: state.page,
      perPage,
    };

    let resp;
    try {
      resp = await searchDatasets(params);
    } catch (e) {
      console.error("search: searchDatasets failed", e);
      resp = { results: [], total: 0, page: 1, perPage: perPage, pageCount: 1 };
    }

    // Keep UI dropdown synced (especially when URL had yearAsc/yearDesc variants in older links)
    if (sortEl) sortEl.value = mapSortToUi(state.sort);

    // Convert to UI rows
    const rows = (resp.results || []).map(toRow);

    // Save for popover lookup
    lastResultRows = rows.slice();

    // Render
    renderResults(rows, resp);
    renderChips();
    renderPager(Number(resp.pageCount || 1));

    if (!pop.hidden) closePopover();

    syncUrlFromState(opts.history || "replace");
  }

  function clearAll() {
    state.q = "";
    state.years.clear();
    state.subjects.clear();
    state.types.clear();
    state.keywords.clear();
    state.page = 1;

    qEl.value = "";
    syncSearchClearVisibility();

    renderFacets().then(() => {
      syncFacetCheckboxes();
      update({ history: "push" });
    });
  }

  // ──────────────────────────────────────────────────────────────
  // Event wiring
  // ──────────────────────────────────────────────────────────────
  let t = null;

  qEl.addEventListener("input", () => {
    clearTimeout(t);
    const val = qEl.value || "";
    syncSearchClearVisibility();

    t = setTimeout(() => {
      state.q = val;
      state.page = 1;

      renderFacets().then(() => {
        syncFacetCheckboxes();
        update();
      });
    }, 140);
  });

  clearSearchBtn.addEventListener("click", () => {
    qEl.value = "";
    state.q = "";
    state.page = 1;

    syncSearchClearVisibility();

    renderFacets().then(() => {
      syncFacetCheckboxes();
      update({ history: "push" });
    });

    qEl.focus();
  });

  if (searchGoBtn) {
    searchGoBtn.addEventListener("click", () => {
      if (qEl) qEl.focus();
    });
  }

  sortEl.addEventListener("change", () => {
    state.sort = sortEl.value;
    state.page = 1;
    update({ history: "push" });
  });

  perPageEl.addEventListener("change", () => {
    const v = perPageEl.value;
    state.perPage = (v === "all") ? Infinity : Number(v);
    state.page = 1;
    update({ history: "push" });
  });

  if (clearBtn) clearBtn.addEventListener("click", clearAll);
  if (emptyClear) emptyClear.addEventListener("click", clearAll);

  if (openFiltersBtn) openFiltersBtn.addEventListener("click", openDrawer);
  if (closeFiltersBtn) closeFiltersBtn.addEventListener("click", closeDrawer);
  if (filterBackdrop) filterBackdrop.addEventListener("click", closeDrawer);

  if (clearBtnMobile) clearBtnMobile.addEventListener("click", clearAll);
  if (applyFiltersMobile) applyFiltersMobile.addEventListener("click", closeDrawer);

  resultsEl.addEventListener("click", (e) => {
    const btn = e.target.closest('button[data-action="open-pop"]');
    if (!btn) return;
    openPopoverForResult(btn.getAttribute("data-result-id"), btn);
  });

  popClose.addEventListener("click", closePopover);
  backdrop.addEventListener("click", closePopover);

  popSearch.addEventListener("input", () => {
    if (!activeContribs.length) return;
    renderPopList(activeContribs, popSearch.value);
  });

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (!pop.hidden) {
      closePopover();
      return;
    }
    if (!filterDrawer.hidden) {
      closeDrawer();
      return;
    }
  });

  // Facet checkbox changes are delegated inside renderFacetUSWDS via onChange handlers.

  // ──────────────────────────────────────────────────────────────
  // Init
  // ──────────────────────────────────────────────────────────────
  async function init() {
    qEl.value = "";
    state.q = "";
    syncSearchClearVisibility();

    perPageEl.value = "10";
    state.perPage = 10;

    // Hydrate from URL
    applyUrlParams();

    // Normalize older links that might have yearAsc/yearDesc in sort
    // (we keep UI values dateAsc/dateDesc)
    if (state.sort === "yearAsc") state.sort = "dateAsc";
    if (state.sort === "yearDesc") state.sort = "dateDesc";
    if (sortEl) sortEl.value = state.sort;

    window.addEventListener("popstate", async () => {
      suppressUrlSync = true;
      applyUrlParams();
      await renderFacets();
      syncFacetCheckboxes();
      await update();
      suppressUrlSync = false;
    });

    wireSectionToggles(document);

    await renderFacets();
    syncFacetCheckboxes();
    await update();
  }

  init();
})();
