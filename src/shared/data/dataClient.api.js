// src/shared/data/dataClient.api.js
//
// API client implementation.
// Supports:
// - DKAN catalog search (public): /api/1/search
// - DKAN dataset detail: /api/1/metastore/schemas/dataset/items/:id (fallbacks included)
// - Drupal JSON:API auth + "My Datasets" workflow read: /dkan-api/jsonapi/node/data
//
// Notes:
// - Uses credentials: "include" for future cookie-based auth.
// - For localhost dev, Basic Auth can be enabled via env vars and will be sent automatically.
// - Expects Vite proxy to forward /dkan-api/* to DKAN origin in dev.

import { getSession as getDrupalSession } from "./authClient.js";

function getBasicAuthHeader() {
  const user = (import.meta.env.VITE_DKAN_BASIC_AUTH_USER || "").trim();
  const pass = (import.meta.env.VITE_DKAN_BASIC_AUTH_PASS || "").trim();
  if (!user || !pass) return "";
  return `Basic ${btoa(`${user}:${pass}`)}`;
}

async function requestJson(url, options = {}) {
  const auth = getBasicAuthHeader();

  const res = await fetch(url, {
    credentials: "include",
    headers: {
      Accept: options.accept || "application/json",
      ...(auth ? { Authorization: auth } : {}),
      ...(options.headers || {}),
    },
    ...options,
  });

  const ct = res.headers.get("content-type") || "";
  const isJson = ct.includes("json");

  if (!res.ok) {
    const body = isJson ? await res.json().catch(() => null) : await res.text().catch(() => "");
    const msg =
      typeof body === "string"
        ? body
        : body?.errors?.[0]?.detail || body?.message || `HTTP ${res.status}`;
    throw new Error(`API ${res.status}: ${msg}`);
  }

  return isJson ? res.json() : null;
}

function toCanonicalFromDkanSearchResult(r) {
  const doi = r?.identifier || "";
  const title = r?.title || "Untitled Dataset";
  const description = r?.description || "";

  const subjects = Array.isArray(r?.theme) ? r.theme : [];
  const keywords = Array.isArray(r?.keyword) ? r.keyword : [];

  const publishedAt = r?.modified || r?.["%modified"] || "";
  const publisherName = r?.publisher?.name || "";

  return {
    doi,
    title,
    description,
    subjects,
    keywords,
    publisherName,
    publishedAt,
    status: "Published",
    _raw: r,
  };
}

function parseMetastoreJsonField(fieldJsonMetadata) {
  try {
    const obj =
      typeof fieldJsonMetadata === "string"
        ? JSON.parse(fieldJsonMetadata)
        : fieldJsonMetadata;

    if (!obj) return null;

    let data = obj.data;

    if (typeof data === "string") {
      const trimmed = data.trim();
      if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
        try {
          data = JSON.parse(trimmed);
        } catch {
          // keep as string
        }
      }
    }

    return { identifier: obj.identifier, data };
  } catch {
    return null;
  }
}

function toCanonicalFromJsonapiNode(node) {
  const attrs = node?.attributes || {};
  const rels = node?.relationships || {};

  const parsed = parseMetastoreJsonField(attrs.field_json_metadata);
  const identifier = parsed?.identifier || node?.id || "";
  const data = parsed?.data || {};

  const title = data?.title || attrs.title || "Untitled Dataset";
  const description = data?.description || "";

  const subjects = Array.isArray(data?.theme)
    ? data.theme
    : Array.isArray(data?.subjects)
      ? data.subjects
      : [];

  const keywords = Array.isArray(data?.keyword)
    ? data.keyword
    : Array.isArray(data?.keywords)
      ? data.keywords
      : [];

  const moderationState = attrs.moderation_state || "";
  const published = attrs.status === true;

  const status = moderationState || (published ? "published" : "draft");

  const owner = rels?.uid?.data?.id || "";
  const createdAt = attrs.created || "";
  const updatedAt = attrs.changed || "";

  return {
    doi: identifier,
    title,
    description,
    subjects,
    keywords,
    status: status ? status[0].toUpperCase() + status.slice(1) : "Draft",
    createdAt,
    updatedAt,
    ownerId: owner,
    _raw: { node, parsed },
  };
}

function buildJsonapiFilter({ userId, dataType, moderationState }) {
  const params = new URLSearchParams();

  if (dataType) {
    params.set("filter[dt][condition][path]", "field_data_type");
    params.set("filter[dt][condition][operator]", "=");
    params.set("filter[dt][condition][value]", dataType);
  }

  if (userId) {
    params.set("filter[uid][condition][path]", "uid.id");
    params.set("filter[uid][condition][operator]", "=");
    params.set("filter[uid][condition][value]", userId);
  }

  if (moderationState) {
    params.set("filter[ms][condition][path]", "moderation_state");
    params.set("filter[ms][condition][operator]", "=");
    params.set("filter[ms][condition][value]", moderationState);
  }

  return params;
}

export function createApiClient({ baseUrl = "" } = {}) {
  function url(path) {
    if (!baseUrl) return path;
    return `${baseUrl.replace(/\/$/, "")}${path.startsWith("/") ? "" : "/"}${path}`;
  }

  return {
    async getSession() {
      return getDrupalSession();
    },

    async searchDatasets(params = {}) {
      const p = new URLSearchParams();

      if (params.q) p.set("q", String(params.q));
      if (params.subject) p.set("theme", String(params.subject));
      if (params.keyword) p.set("keyword", String(params.keyword));

      if (params.sort) p.set("sort", String(params.sort));
      if (params.page) p.set("page", String(params.page));
      if (params.perPage) p.set("perPage", String(params.perPage));
      if (params.year) p.set("year", String(params.year));
      if (params.status) p.set("status", String(params.status));

      const raw = await requestJson(url(`/api/1/search?${p.toString()}`));

      const resultsObj = raw?.results || {};
      const results = Object.values(resultsObj).map(toCanonicalFromDkanSearchResult);
      const facets = Array.isArray(raw?.facets) ? raw.facets : [];

      return {
        total: Number(raw?.total || results.length || 0),
        results,
        facets,
        _raw: raw,
      };
    },

    async getDatasetByDoi(doi) {
      const id = String(doi || "").trim();
      if (!id) return null;

      try {
        const raw = await requestJson(
          url(`/api/1/metastore/schemas/dataset/items/${encodeURIComponent(id)}`)
        );

        return {
          doi: raw?.identifier || id,
          title: raw?.title || "Untitled Dataset",
          description: raw?.description || "",
          subjects: Array.isArray(raw?.theme) ? raw.theme : [],
          keywords: Array.isArray(raw?.keyword) ? raw.keyword : [],
          publisherName: raw?.publisher?.name || "",
          publishedAt: raw?.modified || raw?.["%modified"] || "",
          status: "Published",
          _raw: raw,
        };
      } catch {
        // fall through
      }

      try {
        const raw = await requestJson(url(`/api/1/dataset/${encodeURIComponent(id)}`));

        return {
          doi: raw?.identifier || id,
          title: raw?.title || "Untitled Dataset",
          description: raw?.description || "",
          subjects: Array.isArray(raw?.theme) ? raw.theme : [],
          keywords: Array.isArray(raw?.keyword) ? raw.keyword : [],
          publisherName: raw?.publisher?.name || "",
          publishedAt: raw?.modified || raw?.["%modified"] || "",
          status: "Published",
          _raw: raw,
        };
      } catch {
        return null;
      }
    },

    async getLatestPublished(limit = 4) {
      const raw = await requestJson(url(`/api/1/search`));
      const results = Object.values(raw?.results || {}).map(toCanonicalFromDkanSearchResult);

      results.sort((a, b) => {
        const da = new Date(a.publishedAt || 0).getTime();
        const db = new Date(b.publishedAt || 0).getTime();
        return db - da;
      });

      return results.slice(0, Number(limit) || 4);
    },

    async getVocabularies() {
      return { subjects: [], keywords: [] };
    },

    async getMyDatasets({ limit = 50, offset = 0, moderationState = "" } = {}) {
      const session = await getDrupalSession();
      if (!session.isAuthenticated || !session.user?.id) {
        return { total: 0, results: [], _raw: null };
      }

      const filters = buildJsonapiFilter({
        userId: session.user.id,
        dataType: "dataset",
        moderationState: moderationState || "",
      });

      const params = new URLSearchParams(filters);
      params.set("page[limit]", String(limit));
      params.set("page[offset]", String(offset));
      params.set("include", "uid");

      const raw = await requestJson(url(`/dkan-api/jsonapi/node/data?${params.toString()}`), {
        accept: "application/vnd.api+json",
      });

      const nodes = Array.isArray(raw?.data) ? raw.data : [];
      const results = nodes.map(toCanonicalFromJsonapiNode);

      return {
        total: results.length,
        results,
        _raw: raw,
      };
    },
  };
}
