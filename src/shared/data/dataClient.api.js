// src/shared/data/dataClient.api.js
//
// Generic fetch-based client for a future API.
// Intentionally thin; mapping rules belong in the backend or a DKAN adapter.

export function createApiClient({ baseUrl }) {
  const apiBase = String(baseUrl || "").replace(/\/+$/, "");

  async function requestJson(path, { signal } = {}) {
    const res = await fetch(`${apiBase}${path}`, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal,
      credentials: "include", // compatible with Drupal cookie auth if needed
    });

    if (!res.ok) {
      throw new Error(`API ${res.status}: ${path}`);
    }

    return res.json();
  }

  return {
    async searchDatasets(params = {}, options = {}) {
      // Proposed querystring encoding (can be adjusted later to match DKAN):
      const qs = new URLSearchParams();
      if (params.q) qs.set("q", params.q);
      (params.subjects || []).forEach((v) => qs.append("subject", v));
      (params.keywords || []).forEach((v) => qs.append("keyword", v));
      (params.years || []).forEach((v) => qs.append("year", String(v)));
      (params.fileTypes || []).forEach((v) => qs.append("fileType", v));
      (params.status || []).forEach((v) => qs.append("status", v));
      if (params.sort) qs.set("sort", params.sort);
      if (params.page) qs.set("page", String(params.page));
      if (params.perPage) qs.set("perPage", String(params.perPage));

      return requestJson(`/datasets/search?${qs.toString()}`, options);
    },

    async getDatasetByDoi(doi, options = {}) {
      return requestJson(`/datasets/${encodeURIComponent(doi)}`, options);
    },

    async getLatestPublished(limit = 4, options = {}) {
      return requestJson(`/datasets/latest?limit=${encodeURIComponent(String(limit))}`, options);
    },

    async getVocabularies(options = {}) {
      return requestJson(`/vocabularies`, options);
    },
  };
}
