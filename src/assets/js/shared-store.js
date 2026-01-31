// /src/assets/js/shared-store.js
// Shared client-side record store using localStorage
// Keyed by DOI, supports create/read/update/list operations
// Versioned key to allow safe future migrations

import { createDefaultsFromSchema } from "./metadata-schema.js";

const STORAGE_KEY = "constellation:records:v2";
const LEGACY_STORAGE_KEYS = ["constellation:records:v1"];

// Demo tombstone records (seeded into the store if missing)
// These are safe to add because they use unique DOIs and do not overwrite existing records.
const DEMO_TOMBSTONES = [
  {
    doi: "10.13139/ORNLNCCS/1400999",
    title: "Tombstoned Dataset (Blackhole Demo)",
    status: "Tombstoned",
    createdAt: new Date(2023, 6, 18).toISOString(),
    updatedAt: new Date(2025, 8, 22).toISOString(),
    tombstone: {
      tombstonedAt: new Date(2025, 8, 22, 14, 10, 0).toISOString(),
      reason:
        "Withdrawn due to an issue discovered in the underlying source data. The dataset is no longer available for download.",
      replacementUrl: "https://doi.org/10.13139/ORNLNCCS/1401001",
      notes: "",
    },
  },
  {
    doi: "10.13139/ORNLNCCS/1400998",
    title: "Retired Benchmark Outputs (Tombstoned)",
    status: "Tombstoned",
    createdAt: new Date(2022, 2, 4).toISOString(),
    updatedAt: new Date(2024, 11, 3).toISOString(),
    tombstone: {
      tombstonedAt: new Date(2024, 11, 3, 9, 30, 0).toISOString(),
      reason:
        "Withdrawn at the request of the project team. A newer benchmark series supersedes these results.",
      replacementUrl: "10.13139/ORNLNCCS/1401002",
      notes: "",
    },
  },
];

// Idempotently seed tombstone demo records into the store (only if missing).
function seedDemoTombstonesIfMissing() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;

    const parsed = JSON.parse(raw);
    // Only seed when the store is in object format (keyed by DOI).
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return;

    let changed = false;
    DEMO_TOMBSTONES.forEach((t) => {
      if (!t || !t.doi) return;
      if (!parsed[t.doi]) {
        parsed[t.doi] = normalizeRecordForLoad(t);
        changed = true;
      }
    });

    if (changed) localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
  } catch (_) {
    // ignore
  }
}

function migrateLegacyStoreIfNeeded() {
  try {
    const existing = localStorage.getItem(STORAGE_KEY);
    if (existing) return;

    for (const key of LEGACY_STORAGE_KEYS) {
      const raw = localStorage.getItem(key);
      if (!raw) continue;

      const parsed = JSON.parse(raw);
      const store = {};

      if (!Array.isArray(parsed) && typeof parsed === "object" && parsed !== null) {
        Object.values(parsed).forEach((r) => {
          if (r && r.doi) store[r.doi] = normalizeRecordForLoad(r);
        });
      } else if (Array.isArray(parsed)) {
        parsed.forEach((r) => {
          if (r && r.doi) store[r.doi] = normalizeRecordForLoad(r);
        });
      }

      localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
      return;
    }
  } catch (e) {
    console.warn("Legacy store migration failed:", e);
  }
}

function normalizeRecordForSave(record) {
  const r = { ...record };

  // Ensure we always have the new structured fields (back/forward compatible)
  const defaults = createDefaultsFromSchema();
  r.fundingInfo = { ...defaults.fundingInfo, ...(r.fundingInfo || {}) };
  r.relatedWork = { ...defaults.relatedWork, ...(r.relatedWork || {}) };
  r.softwareNeeded = String(r.softwareNeeded || "");
  r.uploadedFiles = Array.isArray(r.uploadedFiles) ? r.uploadedFiles : [];
  r.authors = Array.isArray(r.authors) ? r.authors : [];

  // Tombstone metadata (only used when status is Tombstoned)
  r.tombstone = (r.tombstone && typeof r.tombstone === "object") ? r.tombstone : {};
  r.tombstone = {
    tombstonedAt: String(r.tombstone.tombstonedAt || ""),
    reason: String(r.tombstone.reason || ""),
    replacementUrl: String(r.tombstone.replacementUrl || ""),
    notes: String(r.tombstone.notes || ""),
  };

  // Subjects: always store as array of strings
  if (!Array.isArray(r.subjects)) r.subjects = [];
  r.subjects = r.subjects.map((s) => String(s || "").trim()).filter(Boolean);

  // Keep a CSV string as a convenience/back-compat
  r.subjectsKeywords = r.subjects.join(", ");

  // Keywords: always store as array of strings
  if (!Array.isArray(r.keywords)) r.keywords = [];
  r.keywords = r.keywords.map((k) => String(k || "").trim()).filter(Boolean);

  // Back-compat convenience: keep legacy funding blob (if present) in sync
  // Old demo fields: funding.funderName + funding.awardNumber
  r.funding = r.funding && typeof r.funding === "object" ? r.funding : { funderName: "", awardNumber: "" };
  if (!r.funding.funderName && r.fundingInfo.sponsoringOrganizations) {
    r.funding.funderName = r.fundingInfo.sponsoringOrganizations;
  }
  if (!r.funding.awardNumber && r.fundingInfo.doeContractNumber) {
    r.funding.awardNumber = r.fundingInfo.doeContractNumber;
  }

  return r;
}

function normalizeRecordForLoad(record) {
  if (!record) return record;
  const r = { ...record };

  const defaults = createDefaultsFromSchema();

  // Migrate legacy fields into new structure (non-destructive)
  // Funding: legacy r.funding -> r.fundingInfo
  if (!r.fundingInfo || typeof r.fundingInfo !== "object") r.fundingInfo = { ...defaults.fundingInfo };
  r.fundingInfo = { ...defaults.fundingInfo, ...r.fundingInfo };
  if (r.funding && typeof r.funding === "object") {
    if (!r.fundingInfo.sponsoringOrganizations && r.funding.funderName) {
      r.fundingInfo.sponsoringOrganizations = String(r.funding.funderName || "");
    }
    if (!r.fundingInfo.doeContractNumber && r.funding.awardNumber) {
      r.fundingInfo.doeContractNumber = String(r.funding.awardNumber || "");
    }
  }

  // Related: legacy relatedDoi/relatedUrl -> relatedWork (best-effort)
  if (!r.relatedWork || typeof r.relatedWork !== "object") r.relatedWork = { ...defaults.relatedWork };
  r.relatedWork = { ...defaults.relatedWork, ...r.relatedWork };

  // Software: legacy r.software -> r.softwareNeeded
  if (!r.softwareNeeded && r.software) r.softwareNeeded = String(r.software || "");

  // Uploads
  if (!Array.isArray(r.uploadedFiles)) r.uploadedFiles = [];

  // Tombstone metadata (best-effort default)
  if (!r.tombstone || typeof r.tombstone !== "object") r.tombstone = {};
  r.tombstone = {
    tombstonedAt: String(r.tombstone.tombstonedAt || ""),
    reason: String(r.tombstone.reason || ""),
    replacementUrl: String(r.tombstone.replacementUrl || ""),
    notes: String(r.tombstone.notes || ""),
  };

  // Back-compat: if subjects missing but subjectsKeywords exists, derive subjects[]
  if (!Array.isArray(r.subjects) || r.subjects.length === 0) {
    const csv = String(r.subjectsKeywords || "").trim();
    if (csv) {
      r.subjects = csv.split(",").map((s) => s.trim()).filter(Boolean);
    } else {
      r.subjects = Array.isArray(r.subjects) ? r.subjects : [];
    }
  }

  // Keywords always array
  if (!Array.isArray(r.keywords)) r.keywords = [];

  // Ensure defaults for new keys
  if (typeof r.softwareNeeded !== "string") r.softwareNeeded = "";

  return r;
}

/**
 * Get all saved records as an array
 * @returns {Array<Object>} All dataset records
 */
function getAllRecords() {
  try {
    migrateLegacyStoreIfNeeded();
    // Ensure demo tombstones exist even when you already have other demo records.
    seedDemoTombstonesIfMissing();
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);

    // Handle object format (preferred, keyed by DOI)
    if (!Array.isArray(parsed) && typeof parsed === "object" && parsed !== null) {
      return Object.values(parsed)
        .filter((r) => r && r.doi)
        .map(normalizeRecordForLoad);
    }

    // Handle legacy array format (one-time migration to object)
    if (Array.isArray(parsed)) {
      const migrated = {};
      parsed.forEach((r) => {
        if (r && r.doi) migrated[r.doi] = normalizeRecordForLoad(r);
      });
      localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated)); // Migrate once
      // Now that the store is object format, seed demo tombstones if missing.
      seedDemoTombstonesIfMissing();
      return Object.values(migrated);
    }

    return [];
  } catch (e) {
    console.error("Failed to load records from store:", e);
    return [];
  }
}

/**
 * Get a single record by DOI
 * @param {string} doi - The DOI to look up
 * @returns {Object|null} The record or null if not found
 */
function getRecord(doi) {
  if (!doi) return null;
  try {
    migrateLegacyStoreIfNeeded();
    // Ensure demo tombstones exist even when you already have other demo records.
    seedDemoTombstonesIfMissing();
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw);

    // Object format
    if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
      return normalizeRecordForLoad(parsed[doi] || null);
    }

    // Legacy array fallback
    if (Array.isArray(parsed)) {
      return normalizeRecordForLoad(parsed.find((r) => r && r.doi === doi) || null);
    }

    return null;
  } catch (e) {
    console.error("Failed to get record:", e);
    return null;
  }
}

/**
 * Save or update a record (overwrites if DOI already exists)
 * @param {Object} record - Dataset object with at least 'doi'
 * @returns {boolean} Success
 */
function saveRecord(record) {
  if (!record || !record.doi) {
    console.warn("Cannot save record without valid DOI");
    return false;
  }

  try {
    migrateLegacyStoreIfNeeded();
    // Ensure demo tombstones exist even when you already have other demo records.
    seedDemoTombstonesIfMissing();
    const raw = localStorage.getItem(STORAGE_KEY);
    const store = raw ? JSON.parse(raw) : {};

    const now = new Date().toISOString();
    const normalized = normalizeRecordForSave(record);

    store[record.doi] = {
      ...normalized,
      updatedAt: now,
      createdAt: record.createdAt || now,
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    return true;
  } catch (e) {
    console.error("Failed to save record:", e);
    return false;
  }
}

/**
 * Create a new draft record with a generated DOI
 * @param {string} [title="Untitled Dataset"] - Optional initial title
 * @returns {Object} The new draft record (already saved)
 */
function createNewDraft(title = "Untitled Dataset") {
  const suffix = Date.now().toString().slice(-7);
  const doi = `10.13139/ORNLNCCS/${suffix}`;

  const now = new Date().toISOString();

  const defaults = createDefaultsFromSchema();

  const record = normalizeRecordForSave({
    doi,
    // Schema defaults
    ...defaults,

    // Core record fields override defaults
    title: title.trim() || "Untitled Dataset",
    status: "Draft",
    createdAt: now,
    updatedAt: now,

    // Preserve older top-level keys used by some pages
    funding: { funderName: "", awardNumber: "" },
    related: [],
  });

  const saved = saveRecord(record);
  if (!saved) console.warn("Failed to save new draft");
  return record;
}

/**
 * Optional: Small deterministic fallback mocks when store is truly empty
 * @param {number} [count=5] - Number of mock records to generate
 * @returns {Array<Object>} Mock records
 */
function getMockFallback(count = 5) {
  const mocks = [];
  const n = Math.max(0, Number(count) || 0);

  // A couple of special “tombstoned” records (only used when the store is truly empty)
  // These are intentionally discoverable (they still have landing pages), but are not downloadable.
  const tombstones = [
    {
      doi: "10.13139/ORNLNCCS/1400999",
      title: "Tombstoned Dataset (Blackhole Demo)",
      status: "Tombstoned",
      createdAt: new Date(2023, 6, 18).toISOString(),
      updatedAt: new Date(2025, 8, 22).toISOString(),
      tombstone: {
        tombstonedAt: new Date(2025, 8, 22, 14, 10, 0).toISOString(),
        reason:
          "Withdrawn due to an issue discovered in the underlying source data. The dataset is no longer available for download.",
        replacementUrl: "https://doi.org/10.13139/ORNLNCCS/1401001",
        notes: "",
      },
    },
    {
      doi: "10.13139/ORNLNCCS/1400998",
      title: "Retired Benchmark Outputs (Tombstoned)",
      status: "Tombstoned",
      createdAt: new Date(2022, 2, 4).toISOString(),
      updatedAt: new Date(2024, 11, 3).toISOString(),
      tombstone: {
        tombstonedAt: new Date(2024, 11, 3, 9, 30, 0).toISOString(),
        reason: "Removed at the request of the data owner.",
        replacementUrl: "",
        notes: "",
      },
    },
  ];

  // If the caller asks for a very small set, prioritize 1 tombstone + a couple published mocks
  // so the UI can demonstrate the new state.
  const includeTombstones = n >= 2 ? 2 : n >= 1 ? 1 : 0;

  tombstones.slice(0, includeTombstones).forEach((r) => mocks.push(r));

  const remaining = Math.max(0, n - mocks.length);
  for (let i = 0; i < remaining; i++) {
    const suffix = 1400000 + i;
    mocks.push({
      doi: `10.13139/ORNLNCCS/${suffix}`,
      title: `Mock Dataset ${i + 1}`,
      status: "Published",
      createdAt: new Date(2024 + i, 0, 1).toISOString(),
      updatedAt: new Date(2024 + i, 0, 1).toISOString(),
    });
  }

  return mocks.map(normalizeRecordForLoad);
}

export { getAllRecords, getRecord, saveRecord, createNewDraft, getMockFallback };
