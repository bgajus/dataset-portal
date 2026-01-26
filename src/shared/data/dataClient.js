// src/shared/data/dataClient.js
//
// Selects a data client implementation.
// - demo: uses local store + demo datasets
// - api: uses a backend API (DKAN/Drupal/etc.)

import { createDemoClient } from "./dataClient.demo.js";
import { createApiClient } from "./dataClient.api.js";

export function getDataClient() {
  const mode = (import.meta.env.VITE_DATA_MODE || "demo").toLowerCase();

  if (mode === "api") {
    // In dev, prefer using Vite proxy (same-origin). Leave baseUrl blank.
    // In other environments, you can set VITE_API_BASE_URL to a full origin.
    const baseUrl = import.meta.env.VITE_API_BASE_URL || "";
    return createApiClient({ baseUrl });
  }

  return createDemoClient();
}

// Convenience exports (pages can import these directly)
export async function searchDatasets(params, options) {
  return getDataClient().searchDatasets(params, options);
}

export async function getDatasetByDoi(doi, options) {
  return getDataClient().getDatasetByDoi(doi, options);
}

export async function getLatestPublished(limit = 4, options) {
  return getDataClient().getLatestPublished(limit, options);
}

export async function getVocabularies(options) {
  return getDataClient().getVocabularies(options);
}

// Auth + workflow read (API client may implement these; demo client can omit)
export async function getSession(options) {
  const client = getDataClient();
  if (typeof client.getSession !== "function") {
    return { isAuthenticated: false, user: null };
  }
  return client.getSession(options);
}

export async function getMyDatasets(params = {}, options) {
  const client = getDataClient();
  if (typeof client.getMyDatasets !== "function") {
    return { total: 0, results: [], _raw: null };
  }
  return client.getMyDatasets(params, options);
}
