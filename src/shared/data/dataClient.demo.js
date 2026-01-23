// src/shared/data/dataClient.demo.js

import { getDemoDatasets, getDemoDatasetByDoi } from "../../assets/js/demo-datasets.js";
import { getAllRecords } from "../../assets/js/shared-store.js";

/**
 * Normalize demo/store records into the canonical model.
 * We treat demo as canonical, so normalization is light and defensive.
 */
function normalize(records) {
  return (Array.isArray(records) ? records : []).map((r) => ({
    doi: String(r.doi || "").trim(),
    title: String(r.title || "").trim(),
    description: String(r.description || "").trim(),
    subjects: Array.isArray(r.subjects) ? r.subjects.filter(Boolean) : [],
    keywords: Array.isArray(r.keywords) ? r.keywords.filter(Boolean) : [],
    publishedYear: Number.isFinite(r.publishedYear)
      ? r.publishedYear
      : (r.publishedYear == null ? null : Number(r.publishedYear) || null),
    fileTypes: Array.isArray(r.fileTypes) ? r.fileTypes.filter(Boolean) : [],
    status: r.status || "Draft",

    publishedAt: r.publishedAt,
    updatedAt: r.updatedAt,
    datasetSizeBytes: r.datasetSizeBytes ?? null,

    // Detail-only fields (optional)
    contributors: Array.isArray(r.contributors) ? r.contributors : (Array.isArray(r.authors) ? r.authors : undefined),
    funding: Array.isArray(r.funding) ? r.funding : undefined,
    relatedWorks: Array.isArray(r.relatedWorks) ? r.relatedWorks : (Array.isArray(r.relatedIdentifiers) ? r.relatedIdentifiers : undefined),
    acknowledgements: typeof r.acknowledgements === "string" ? r.acknowledgements : undefined,
  }));
}

function buildBuckets(values) {
  const m = new Map();
  values.forEach((v) => m.set(v, (m.get(v) || 0) + 1));

  return Array.from(m.entries())
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || String(a.value).localeCompare(String(b.value)));
}

function buildFacets(records) {
  const subjects = buildBuckets(records.flatMap((r) => r.subjects || []));
  const keywords = buildBuckets(records.flatMap((r) => r.keywords || []));
  const fileTypes = buildBuckets(records.flatMap((r) => r.fileTypes || []));
  const status = buildBuckets(records.map((r) => r.status).filter(Boolean));

  const yearMap = new Map();
  records.forEach((r) => {
    const y = r.publishedYear;
    if (Number.isFinite(y)) yearMap.set(y, (yearMap.get(y) || 0) + 1);
  });

  const years = Array.from(yearMap.entries())
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.value - a.value);

  return { subjects, keywords, years, fileTypes, status };
}

function applyFilters(records, params) {
  const q = (params.q || "").trim().toLowerCase();

  return records.filter((r) => {
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

    if (params.fileTypes?.length) {
      const set = new Set(r.fileTypes || []);
      if (!params.fileTypes.some((t) => set.has(t))) return false;
    }

    if (q) {
      const hay = `${r.title} ${r.description} ${(r.subjects || []).join(" ")} ${(r.keywords || []).join(" ")}`
        .toLowerCase();
      if (!hay.includes(q)) return false;
    }

    return true;
  });
}

function applySort(records, sort) {
  const s = sort || "relevance";
  const byTitle = (a, b) => String(a.title).localeCompare(String(b.title));

  const byYearDesc = (a, b) => (b.publishedYear || 0) - (a.publishedYear || 0) || byTitle(a, b);
  const byYearAsc = (a, b) => (a.publishedYear || 0) - (b.publishedYear || 0) || byTitle(a, b);

  const bySizeDesc = (a, b) => (b.datasetSizeBytes || 0) - (a.datasetSizeBytes || 0) || byYearDesc(a, b);
  const bySizeAsc = (a, b) => (a.datasetSizeBytes || 0) - (b.datasetSizeBytes || 0) || byYearAsc(a, b);

  if (s === "titleAsc") return [...records].sort(byTitle);
  if (s === "titleDesc") return [...records].sort((a, b) => byTitle(b, a));
  if (s === "yearAsc") return [...records].sort(byYearAsc);
  if (s === "yearDesc") return [...records].sort(byYearDesc);
  if (s === "sizeAsc") return [...records].sort(bySizeAsc);
  if (s === "sizeDesc") return [...records].sort(bySizeDesc);

  // "relevance" (demo): stable default
  return [...records].sort(byYearDesc);
}

function paginate(records, page = 1, perPage = 10) {
  const p = Math.max(1, Number(page) || 1);
  const pp = Math.max(1, Number(perPage) || 10);
  const total = records.length;
  const pageCount = Math.max(1, Math.ceil(total / pp));
  const clampedPage = Math.min(p, pageCount);
  const start = (clampedPage - 1) * pp;
  const end = start + pp;
  return { slice: records.slice(start, end), total, page: clampedPage, perPage: pp, pageCount };
}

export function createDemoClient() {
  return {
    async searchDatasets(params = {}, options = {}) {
      void options;
      const real = normalize(getAllRecords());
      const base = real.length ? real : normalize(getDemoDatasets());

      const filtered = applyFilters(base, params);
      const facets = buildFacets(filtered); // contextual facets

      const sorted = applySort(filtered, params.sort);
      const { slice, total, page, perPage, pageCount } = paginate(sorted, params.page, params.perPage);

      return { results: slice, total, page, perPage, pageCount, facets, queryEcho: params };
    },

    async getDatasetByDoi(doi, options = {}) {
      void options;
      const real = normalize(getAllRecords());
      const hit = real.find((r) => r.doi === doi);
      if (hit) return hit;

      const demo = getDemoDatasetByDoi(doi);
      return demo ? normalize([demo])[0] : null;
    },

    async getLatestPublished(limit = 4, options = {}) {
      void options;
      const realPublished = normalize(getAllRecords()).filter((r) => r.status === "Published");
      const base = realPublished.length
        ? realPublished
        : normalize(getDemoDatasets()).filter((r) => r.status === "Published");

      return base
        .sort((a, b) => (b.publishedYear || 0) - (a.publishedYear || 0))
        .slice(0, Math.max(1, Number(limit) || 4));
    },

    async getVocabularies(options = {}) {
      void options;
      const real = normalize(getAllRecords());
      const base = real.length ? real : normalize(getDemoDatasets());

      const uniq = (arr) => Array.from(new Set(arr)).sort((a, b) => String(a).localeCompare(String(b)));

      return {
        subjects: uniq(base.flatMap((r) => r.subjects || [])),
        fileTypes: uniq(base.flatMap((r) => r.fileTypes || [])),
        statuses: uniq(base.map((r) => r.status).filter(Boolean)),
      };
    },
  };
}
