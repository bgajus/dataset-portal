// src/shared/data/dataClient.js
//
// Selects a data client implementation.
// - demo: uses local store + demo datasets
// - api: uses a backend API (Directus/DKAN/etc.)

import { createDemoClient } from "./dataClient.demo.js";
import { createApiClient } from "./dataClient.api.js";

export function getDataClient() {
  const mode = (import.meta.env.VITE_DATA_MODE || "demo").toLowerCase();

  if (mode === "api") {
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
