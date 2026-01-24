// src/shared/data/dataClient.dkan.js

function toYearFromIso(iso) {
  if (!iso) return null;
  const m = String(iso).match(/^(\d{4})/);
  return m ? Number(m[1]) : null;
}

function uniqSorted(arr) {
  return Array.from(new Set(arr.filter(Boolean))).sort((a, b) =>
    String(a).localeCompare(String(b))
  );
}

/**
 * DKAN search returns:
 * {
 *   total: "1",
 *   results: { "dkan_dataset/<uuid>": {...dataset...}, ... },
 *   facets: [{type,name,total}, ...]
 * }
 */
function normalizeSearchPayload(payload) {
  const resultsObj = payload?.results && typeof payload.results === "object" ? payload.results : {};
  const items = Object.entries(resultsObj).map(([key, d]) => {
    const id = d?.identifier || key.split("/").pop();

    // Map DKAN -> canonical
    const subjects = Array.isArray(d?.theme) ? d.theme : [];
    const keywords = Array.isArray(d?.keyword) ? d.keyword : [];

    const modified = d?.modified || d?.["%modified"] || null;
    const publishedYear = toYearFromIso(modified);

    return {
      // Canonical fields your UI expects
      doi: id, // For PoC: treat identifier as "doi-ish" stable id (we can map real DOI later)
      dkanId: id,
      title: d?.title || "",
      description: d?.description || "",
      subjects,
      keywords,
      publishedYear,
      publishedAt: modified,
      status: "Published", // public search endpoint is effectively published/public

      // Optional / future
      publisher: d?.publisher?.name || "",
      contactName: d?.contactPoint?.fn || "",
      contactEmail: d?.contactPoint?.hasEmail || "",
      accessLevel: d?.accessLevel || "public",

      // Pass-through so landing page can show more later if needed
      _raw: d,
    };
  });

  const facets = Array.isArray(payload?.facets) ? payload.facets : [];

  // Build facet buckets into the shape your search UI expects
  const facetBuckets = {
    subjects: [],
    keywords: [],
    years: [],
    fileTypes: [],
    status: [{ value: "Published", count: Number(payload?.total || 0) || items.length }],
  };

  const subjectsMap = new Map();
  const keywordsMap = new Map();

  for (const f of facets) {
    const type = f?.type;
    const name = f?.name;
    const total = Number(f?.total || 0);

    if (type === "theme") subjectsMap.set(name, total);
    if (type === "keyword") keywordsMap.set(name, total);
  }

  facetBuckets.subjects = Array.from(subjectsMap.entries())
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || String(a.value).localeCompare(String(b.value)));

  facetBuckets.keywords = Array.from(keywordsMap.entries())
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || String(a.value).localeCompare(String(b.value)));

  // Years we compute from items (DKAN facets didn’t return a year bucket)
  const yearMap = new Map();
  for (const it of items) {
    if (Number.isFinite(it.publishedYear)) {
      yearMap.set(it.publishedYear, (yearMap.get(it.publishedYear) || 0) + 1);
    }
  }
  facetBuckets.years = Array.from(yearMap.entries())
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.value - a.value);

  return { items, facetBuckets, total: Number(payload?.total || items.length) || items.length };
}

function applyClientFilters(items, params) {
  const q = (params.q || "").trim().toLowerCase();

  return items.filter((r) => {
    if (params.status?.length && !params.status.includes(r.status)) return false;

    if (params.subjects?.length) {
      const set = new Set(r.subjects || []);
      if (!params.subjects.some((s) => set.has(s))) return false;
    }

    if (params.keywords?.length) {
      const set = new Set(r.keywords || []);
      if (!params.keywords.some((k) => set.has(k))) return false;
    }

    if (params.years?.length) {
      if (!Number.isFinite(r.publishedYear) || !params.years.includes(r.publishedYear)) return false;
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
  const s = sort || "yearDesc";
  const byTitle = (a, b) => String(a.title).localeCompare(String(b.title));

  const byYearDesc = (a, b) => (b.publishedYear || 0) - (a.publishedYear || 0) || byTitle(a, b);
  const byYearAsc = (a, b) => (a.publishedYear || 0) - (b.publishedYear || 0) || byTitle(a, b);

  if (s === "titleAsc") return [...items].sort(byTitle);
  if (s === "titleDesc") return [...items].sort((a, b) => byTitle(b, a));
  if (s === "yearAsc") return [...items].sort(byYearAsc);
  if (s === "yearDesc") return [...items].sort(byYearDesc);

  // default
  return [...items].sort(byYearDesc);
}

function paginate(items, page = 1, perPage = 10) {
  const p = Math.max(1, Number(page) || 1);
  const pp = perPage === Infinity ? Infinity : Math.max(1, Number(perPage) || 10);

  const total = items.length;
  const pageCount = pp === Infinity ? 1 : Math.max(1, Math.ceil(total / pp));
  const clampedPage = Math.min(p, pageCount);

  const start = (clampedPage - 1) * (pp === Infinity ? total : pp);
  const end = pp === Infinity ? total : start + pp;

  return { slice: items.slice(start, end), total, page: clampedPage, perPage: pp, pageCount };
}

async function tryFetchJson(url) {
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) return null;
  return res.json();
}

export function createDkanClient() {
  return {
    async searchDatasets(params = {}, options = {}) {
      void options;

      // For PoC: call DKAN search once, then do client-side filtering/sorting/paging.
      // Later we can pass DKAN query params (q/theme/keyword) once confirmed.
      const payload = await tryFetchJson("/dkan-api/api/1/search");
      const { items, facetBuckets } = normalizeSearchPayload(payload || { total: "0", results: {}, facets: [] });

      const filtered = applyClientFilters(items, params);
      const sorted = applySort(filtered, params.sort);

      const { slice, total, page, perPage, pageCount } = paginate(sorted, params.page, params.perPage);

      // Rebuild facets based on filtered set to match your UI behavior
      const subjects = uniqSorted(filtered.flatMap((r) => r.subjects || []));
      const keywords = uniqSorted(filtered.flatMap((r) => r.keywords || []));
      const years = uniqSorted(filtered.map((r) => r.publishedYear).filter((y) => Number.isFinite(y))).sort((a,b)=>b-a);

      const facets = {
        subjects: subjects.map((v) => ({ value: v, count: filtered.filter((r) => (r.subjects||[]).includes(v)).length })),
        keywords: keywords.map((v) => ({ value: v, count: filtered.filter((r) => (r.keywords||[]).includes(v)).length })),
        years: years.map((v) => ({ value: v, count: filtered.filter((r) => r.publishedYear === v).length })),
        fileTypes: facetBuckets.fileTypes || [],
        status: facetBuckets.status || [{ value: "Published", count: total }],
      };

      return { results: slice, total, page, perPage, pageCount, facets, queryEcho: params };
    },

    async getDatasetByDoi(doi, options = {}) {
      void options;

      // DKAN identifier is your stable key from search: the UUID string
      const id = String(doi || "").trim();
      if (!id) return null;

      // Try common DKAN endpoints (varies by version/config)
      const candidates = [
        `/dkan-api/api/1/dataset/${encodeURIComponent(id)}`,
        `/dkan-api/api/1/metastore/schemas/dataset/items/${encodeURIComponent(id)}`,
      ];

      for (const url of candidates) {
        const data = await tryFetchJson(url);
        if (data) {
          const d = data?.data || data; // metastore sometimes wraps
          const modified = d?.modified || d?.["%modified"] || null;

          return {
            doi: id,
            dkanId: id,
            title: d?.title || "",
            description: d?.description || "",
            subjects: Array.isArray(d?.theme) ? d.theme : [],
            keywords: Array.isArray(d?.keyword) ? d.keyword : [],
            publishedYear: toYearFromIso(modified),
            publishedAt: modified,
            status: "Published",
            publisher: d?.publisher?.name || "",
            contactName: d?.contactPoint?.fn || "",
            contactEmail: d?.contactPoint?.hasEmail || "",
            accessLevel: d?.accessLevel || "public",
            _raw: d,
          };
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
      const r = await this.searchDatasets({ status: ["Published"], page: 1, perPage: Infinity });

      const subjects = uniqSorted((r.results || []).flatMap((x) => x.subjects || []));
      const keywords = uniqSorted((r.results || []).flatMap((x) => x.keywords || []));
      const years = uniqSorted((r.results || []).map((x) => x.publishedYear).filter((y) => Number.isFinite(y))).sort((a,b)=>b-a);

      return { subjects, keywords, years, statuses: ["Published"] };
    },
  };
}
