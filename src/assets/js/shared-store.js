// /src/assets/js/shared-store.js
// Shared client-side record store using localStorage
// Keyed by DOI, supports create/read/update/list operations
// Versioned key to allow safe future migrations

const STORAGE_KEY = "constellation:records:v1";

function normalizeRecordForSave(record) {
  const r = { ...record };

  // Subjects: always store as array of strings
  if (!Array.isArray(r.subjects)) r.subjects = [];
  r.subjects = r.subjects.map((s) => String(s || "").trim()).filter(Boolean);

  // Keep a CSV string as a convenience/back-compat
  r.subjectsKeywords = r.subjects.join(", ");

  // Keywords: always store as array of strings
  if (!Array.isArray(r.keywords)) r.keywords = [];
  r.keywords = r.keywords.map((k) => String(k || "").trim()).filter(Boolean);

  return r;
}

function normalizeRecordForLoad(record) {
  if (!record) return record;
  const r = { ...record };

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

  return r;
}

/**
 * Get all saved records as an array
 * @returns {Array<Object>} All dataset records
 */
function getAllRecords() {
  try {
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

  const record = normalizeRecordForSave({
    doi,
    title: title.trim() || "Untitled Dataset",
    status: "Draft",
    createdAt: now,
    updatedAt: now,

    // Default empty fields (expand as your data model grows)
    description: "",
    datasetType: "",
    authors: [],

    // NEW
    subjects: [],
    subjectsKeywords: "",

    // Existing
    keywords: [],
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
  for (let i = 0; i < count; i++) {
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
