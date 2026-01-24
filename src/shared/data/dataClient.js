// src/shared/data/dataClient.js
//
// Selects a data client implementation.
// - demo: uses local store + demo datasets
// - api: uses a backend API (DKAN/etc.)

import { createDemoClient } from "./dataClient.demo.js";
import { createApiClient } from "./dataClient.api.js";

let _client = null;
let _clientMode = null;

function readBackendOverrideFromQuery() {
  try {
    const u = new URL(window.location.href);
    const v = (u.searchParams.get("backend") || "").trim().toLowerCase();
    return v || null;
  } catch {
    return null;
  }
}

function readBackendOverrideFromHash() {
  // Supports:
  //   /search#index=...&backend=demo
  //   /search#backend=demo
  const h = (window.location.hash || "").replace(/^#/, "");
  if (!h) return null;

  // If hash looks like a querystring, parse it
  const params = new URLSearchParams(h);
  const v = (params.get("backend") || "").trim().toLowerCase();
  return v || null;
}

function readBackendOverrideFromLocalStorage() {
  try {
    const v = (localStorage.getItem("dataBackend") || "").trim().toLowerCase();
    return v || null;
  } catch {
    return null;
  }
}

function getMode() {
  // Priority (highest → lowest):
  // 1) URL query param: ?backend=demo
  // 2) URL hash: #backend=demo  (won't be stripped by your search URL sync)
  // 3) localStorage: localStorage.setItem("dataBackend","demo")
  // 4) env default: VITE_DATA_MODE (requires restart)
  const qp = readBackendOverrideFromQuery();
  if (qp) return qp;

  const hash = readBackendOverrideFromHash();
  if (hash) return hash;

  const ls = readBackendOverrideFromLocalStorage();
  if (ls) return ls;

  return (import.meta.env.VITE_DATA_MODE || "demo").toLowerCase();
}

export function getDataClient() {
  const mode = getMode();

  // If mode changed at runtime, swap client (supports no-restart overrides)
  if (_client && _clientMode === mode) return _client;

  _clientMode = mode;

  if (mode === "api") {
    const baseUrl = import.meta.env.VITE_API_BASE_URL || "";
    _client = createApiClient({ baseUrl });
    return _client;
  }

  _client = createDemoClient();
  return _client;
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
