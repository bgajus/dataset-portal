// src/shared/data/dataClient.api.js
//
// DKAN-backed API client (for local DKAN via Vite proxy).
// Expected DKAN endpoints (public):
//   - GET /api/1/search
//   - GET /api/1/dataset/{uuid}  (may or may not exist depending on DKAN config)
//   - GET /api/1/metastore/schemas/dataset/items/{uuid}  (common metastore detail)
//
// This file adapts DKAN responses into the portal's canonical dataset shape.

function toYearFromIso(iso) {
  if (!iso) return null;
  const m = String(iso).match(/^(\d{4})/);
  return m ? Number(m[1]) : null;
}

function uniqSorted(arr) {
  return Array.from(new Set((arr || []).filter(Boolean))).sort((a, b) =>
    String(a).localeCompare(String(b))
  );
}

async function requestJson(url, init = {}) {
  const res = await fetch(url, {
    ...init,
    headers: {
      Accept: "application/json",
      ...(init.headers || {}),
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`API ${res.status}: ${url}${text ? `\n${text}` : ""}`);
  }

  return res.json();
}

/**
 * Normalize DKAN /api/1/search payload:
 * {
 *   total: "1",
 *   results: { "dkan_dataset/<uuid>": { ... }, ... },
 *   facets: [{type,name,total}, ...]
 * }
 */
function normalizeDkanSearch(payload) {
  const resultsObj =
    payload?.results && typeof payload.results === "object" ? payload.results : {};

  const items = Object.entries(resultsObj).map(([key, d]) => {
    const id = d?.identifier || key.split("/").pop();
    const modified = d?.modified || d?.["%modified"] || null;

    const subjects = Array.isArray(d?.theme) ? d.theme : [];
    const keywords = Array.isArray(d?.keyword) ? d.keyword : [];

    return {
      // Canonical fields your UI already uses
      doi: id, // PoC: use DKAN identifier as stable id
      title: d?.title || "",
      description: d?.description || "",
      subjects,
      keywords,
      publishedYear: toYearFromIso(modified),
      status: "Published",

      // Helpful extras (optional in UI)
      publisher: d?.publisher?.name || "",
      contactName: d?.contactPoint?.fn || "",
      contactEmail: d?.contactPoint?.hasEmail || "",
      accessLevel: d?.accessLevel || "public",

      _raw: d,
    };
  });

  const facetsRaw = Array.isArray(payload?.facets) ? payload.facets : [];

  // DKAN facets are flat: [{type,name,total}]
  const subjectCounts = new Map();
  const keywordCounts = new Map();

  for (const f of facetsRaw) {
    const type = f?.type;
    const name = f?.name;
    const total = Number(f?.total || 0);

    if (!name) continue;

    if (type === "theme") subjectCounts.set(name, total);
    if (type === "keyword") keywordCounts.set(name, total);
  }

  // Published year doesn't come as a DKAN facet by default; derive from items
  const yearCounts = new Map();
  for (const it of items) {
    if (Number.isFinite(it.publishedYear)) {
      yearCounts.set(it.publishedYear, (yearCounts.get(it.publishedYear) || 0) + 1);
    }
  }

  const facets = {
    subjects: Array.from(subjectCounts.entries())
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => b.count - a.count || String(a.value).localeCompare(String(b.value))),
    keywords: Array.from(keywordCounts.entries())
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => b.count - a.count || String(a.value).localeCompare(String(b.value))),
    years: Array.from(yearCounts.entries())
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => b.value - a.value),
    // DKAN search doesn’t provide these for our PoC:
    fileTypes: [],
    status: [{ value: "Published", count: Number(payload?.total || items.length) || items.length }],
  };

  return {
    items,
    facets,
    total: Number(payload?.total || items.length) || items.length,
  };
}

function applyClientFilters(items, params) {
  const q = (params.q || "").trim().toLowerCase();
  const subjects = Array.isArray(params.subjects) ? params.subjects : [];
  const keywords = Array.isArray(params.keywords) ? params.keywords : [];
  const years = Array.isArray(params.years) ? params.years : [];
  const statuses = Array.isArray(params.status) ? params.status : [];

  return (items || []).filter((r) => {
    if (statuses.length && !statuses.includes(r.status)) return false;

    if (subjects.length) {
      const set = new Set(r.subjects || []);
      if (!subjects.some((s) => set.has(s))) return false;
    }

    if (keywords.length) {
      const set = new Set(r.keywords || []);
      if (!keywords.some((k) => set.has(k))) return false;
    }

    if (years.length) {
      if (!Number.isFinite(r.publishedYear) || !years.includes(r.publishedYear)) return false;
    }

    if (q) {
      const hay = `${r.title} ${r.description} ${(r.subjects || []).join(" ")} ${(r.keywords || []).join(" ")}`
        .toLowerCase();
      if (!hay.includes(q)) return false;
    }

    return true;
  });
}

function applySort(items, sort) {
  const s = sort || "relevance";

  // DKAN doesn't give a relevance score in this payload; fallback to title/year patterns.
  if (s === "yearDesc") {
    return [...items].sort(
      (a, b) => (b.publishedYear || 0) - (a.publishedYear || 0) || String(a.title).localeCompare(String(b.title))
    );
  }

  if (s === "yearAsc") {
    return [...items].sort(
      (a, b) => (a.publishedYear || 0) - (b.publishedYear || 0) || String(a.title).localeCompare(String(b.title))
    );
  }

  if (s === "titleAsc") return [...items].sort((a, b) => String(a.title).localeCompare(String(b.title)));
  if (s === "titleDesc") return [...items].sort((a, b) => String(b.title).localeCompare(String(a.title)));

  // "relevance" default (for now): year desc, then title
  return [...items].sort(
    (a, b) => (b.publishedYear || 0) - (a.publishedYear || 0) || String(a.title).localeCompare(String(b.title))
  );
}

function paginate(items, page = 1, perPage = 10) {
  const p = Math.max(1, Number(page) || 1);
  const pp = perPage === "All" ? Infinity : perPage === Infinity ? Infinity : Math.max(1, Number(perPage) || 10);

  const total = items.length;
  const pageCount = pp === Infinity ? 1 : Math.max(1, Math.ceil(total / pp));
  const clampedPage = Math.min(p, pageCount);

  const start = (clampedPage - 1) * (pp === Infinity ? total : pp);
  const end = pp === Infinity ? total : start + pp;

  return { slice: items.slice(start, end), total, page: clampedPage, perPage: pp, pageCount };
}

export function createApiClient({ baseUrl = "" } = {}) {
  // IMPORTANT:
  // - In dev, baseUrl should usually be "" so requests go to /api/... and Vite proxies to DKAN.
  // - If you set baseUrl to "http://dkan-local.ddev.site", you may hit CORS unless server allows it.

  const apiBase = (baseUrl || "").replace(/\/+$/, "");

  function url(path) {
    // Prefer calling /api/... so it works with either proxy you added.
    // If caller passes "/api/1/search" it will become "/api/1/search".
    const p = path.startsWith("/") ? path : `/${path}`;
    return apiBase ? `${apiBase}${p}` : p;
  }

  return {
    async searchDatasets(params = {}, options = {}) {
      void options;

      // Fetch once from DKAN, then filter/sort/page client-side for PoC.
      const payload = await requestJson(url("/api/1/search"));
      const { items, facets, total } = normalizeDkanSearch(payload);

      const filtered = applyClientFilters(items, params);
      const sorted = applySort(filtered, params.sort);

      const { slice, page, perPage, pageCount } = paginate(sorted, params.page, params.perPage);

      // Rebuild facets off filtered set so counts reflect active filtering (matches your UI expectations)
      const subjects = uniqSorted(filtered.flatMap((r) => r.subjects || []));
      const keywords = uniqSorted(filtered.flatMap((r) => r.keywords || []));
      const years = uniqSorted(filtered.map((r) => r.publishedYear).filter((y) => Number.isFinite(y))).sort((a, b) => b - a);

      const facetsFiltered = {
        subjects: subjects.map((v) => ({
          value: v,
          count: filtered.filter((r) => (r.subjects || []).includes(v)).length,
        })),
        keywords: keywords.map((v) => ({
          value: v,
          count: filtered.filter((r) => (r.keywords || []).includes(v)).length,
        })),
        years: years.map((v) => ({
          value: v,
          count: filtered.filter((r) => r.publishedYear === v).length,
        })),
        fileTypes: facets.fileTypes || [],
        status: [{ value: "Published", count: total }],
      };

      return {
        results: slice,
        total: filtered.length,
        page,
        perPage,
        pageCount,
        facets: facetsFiltered,
      };
    },

    async getDatasetByDoi(doi, options = {}) {
      void options;

      const id = String(doi || "").trim();
      if (!id) return null;

      const candidates = [
        url(`/api/1/dataset/${encodeURIComponent(id)}`),
        url(`/api/1/metastore/schemas/dataset/items/${encodeURIComponent(id)}`),
      ];

      for (const u of candidates) {
        try {
          const data = await requestJson(u);
          const d = data?.data || data;

          const modified = d?.modified || d?.["%modified"] || null;

          return {
            doi: id,
            title: d?.title || "",
            description: d?.description || "",
            subjects: Array.isArray(d?.theme) ? d.theme : [],
            keywords: Array.isArray(d?.keyword) ? d.keyword : [],
            publishedYear: toYearFromIso(modified),
            status: "Published",
            publisher: d?.publisher?.name || "",
            contactName: d?.contactPoint?.fn || "",
            contactEmail: d?.contactPoint?.hasEmail || "",
            accessLevel: d?.accessLevel || "public",
            _raw: d,
          };
        } catch (e) {
          // try next candidate
        }
      }

      return null;
    },

    async getLatestPublished(limit = 4, options = {}) {
      void options;
      const r = await this.searchDatasets({ status: ["Published"], sort: "yearDesc", page: 1, perPage: Infinity });
      return (r.results || []).slice(0, Math.max(1, Number(limit) || 4));
    },

    async getVocabularies(options = {}) {
      void options;

      // Derived from search for PoC; later can call dedicated endpoints if DKAN exposes them.
      const r = await this.searchDatasets({ status: ["Published"], page: 1, perPage: Infinity });

      const subjects = uniqSorted((r.results || []).flatMap((x) => x.subjects || []));
      const keywords = uniqSorted((r.results || []).flatMap((x) => x.keywords || []));
      const years = uniqSorted((r.results || []).map((x) => x.publishedYear).filter((y) => Number.isFinite(y))).sort((a, b) => b - a);

      return {
        subjects,
        keywords,
        years,
        statuses: ["Published"],
      };
    },
  };
}
