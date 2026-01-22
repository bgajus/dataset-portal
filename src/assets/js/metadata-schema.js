// /src/assets/js/metadata-schema.js
// Single source of truth for metadata sections + fields used by the Editor.
//
// Source: Constellation-metadata-form.docx
// Rules:
// - Fields must remain within their DOCX section.
// - You may reorder/group fields *within* a section for UX.

export const DATASET_TYPE_OPTIONS = [
  { value: "ND", label: "ND — Numeric Data" },
  { value: "AS", label: "AS — Animations/Simulations" },
  { value: "SM", label: "SM — Specialized Mix" },
  { value: "SW", label: "SW — Software" },
  { value: "IM", label: "IM — Interactive Maps/GIS Data" },
];

// Subjects (client-provided list you previously supplied)
export const SUBJECT_OPTIONS = [
  "Bioinformatics",
  "Climate",
  "Computational Fluid Dynamics",
  "Cybersecurity",
  "Energy Systems",
  "Environmental Monitoring",
  "Fusion",
  "Geospatial Analytics",
  "HPC Performance",
  "Machine Learning",
  "Materials Science",
  "Nuclear Energy",
  "Remote Sensing",
  "Robotics",
  "Transportation",
  "Urban Sensing",
];

// Demo keyword suggestions.
// In a real build, this should be populated from analytics (most-used keywords)
// or a controlled vocabulary service.
export const KEYWORD_SUGGESTIONS = [
  "machine learning",
  "deep learning",
  "artificial intelligence",
  "high performance computing",
  "HPC",
  "simulation",
  "computational fluid dynamics",
  "climate modeling",
  "remote sensing",
  "geospatial",
  "materials science",
  "bioinformatics",
  "cybersecurity",
  "fusion",
  "benchmarking",
  "performance",
  "visualization",
  "time series",
];

/**
 * Schema sections in the accordion order.
 * `required` indicates the section contributes required items to the global required counter.
 */
export const METADATA_SCHEMA = [
  {
    id: "upload",
    label: "Upload Files",
    required: true,
    kind: "special",
    // Special required rule handled in editor/store: must have >= 1 uploaded file.
  },
  {
    id: "description",
    label: "Description",
    required: true,
    kind: "fields",
    fields: [
      {
        key: "title",
        label: "Title",
        type: "text",
        required: true,
      },
      {
        key: "datasetType",
        label: "Dataset Type",
        type: "select",
        required: true,
        options: DATASET_TYPE_OPTIONS,
        placeholder: "Select a type",
      },
      {
        key: "description",
        label: "Description",
        type: "textarea",
        required: true,
        rows: 5,
      },
      {
        key: "softwareNeeded",
        label: "Software Needed",
        type: "text",
        required: false,
        hint: "List any software needed to use this dataset.",
      },
    ],
  },
  {
    id: "authors",
    label: "Authors",
    required: true,
    kind: "special",
    // Special required rule handled in editor/store: must have >= 1 author.
    authorRules: {
      minAuthors: 1,
      requiredFields: ["firstName", "lastName", "affiliation", "email"],
    },
  },
  {
    id: "subjects",
    label: "Subjects",
    required: false, // per DOCX: optional section
    kind: "fields",
    fields: [
      {
        key: "subjects",
        label: "Subjects",
        type: "multiselect",
        required: false,
        options: SUBJECT_OPTIONS,
        hint: "Tip: Hold Ctrl (Windows) or ⌘ (Mac) to select multiple.",
      },
      {
        key: "keywords",
        label: "Keywords",
        type: "keywords",
        required: false,
        hint: "Comma-separated keywords. Suggestions will appear as you type.",
        placeholder: "e.g., fusion, plasma, diagnostics",
      },
    ],
  },
  {
    id: "funding",
    label: "Funding Information",
    required: true,
    kind: "fields",
    fields: [
      {
        key: "fundingInfo.sponsoringOrganizations",
        label: "Sponsoring Organizations",
        type: "text",
        required: true,
      },
      {
        key: "fundingInfo.originatingResearchOrganization",
        label: "Originating Research Organization",
        type: "text",
        required: true,
      },
      {
        key: "fundingInfo.otherContributingOrganizations",
        label: "Other Contributing Organizations",
        type: "text",
        required: false,
      },
      {
        key: "fundingInfo.doeContractNumber",
        label: "DOE Contract Number",
        type: "text",
        required: true,
      },
      {
        key: "fundingInfo.olcfProjectIdentifier",
        label: "OLCF Project Identifier",
        type: "text",
        required: false,
      },
      {
        key: "fundingInfo.otherContractNumbers",
        label: "Other Contract Number(s)",
        type: "text",
        required: false,
      },
      {
        key: "fundingInfo.otherIdentifyingNumbers",
        label: "Other Identifying Numbers",
        type: "text",
        required: false,
      },
    ],
  },
  {
    id: "related",
    label: "Related Works",
    required: false, // per DOCX: optional, conditional required if any entered
    kind: "fields",
    conditionalRequired: {
      mode: "any-to-all",
      keys: [
        "relatedWork.relatedIdentifier",
        "relatedWork.relatedIdentifierType",
        "relatedWork.relationType",
      ],
      note: "If related work is added, all fields are required.",
    },
    fields: [
      {
        key: "relatedWork.relatedIdentifier",
        label: "Related Identifier",
        type: "text",
        required: false,
      },
      {
        key: "relatedWork.relatedIdentifierType",
        label: "Related Identifier Type",
        type: "text",
        required: false,
      },
      {
        key: "relatedWork.relationType",
        label: "Relation Type",
        type: "text",
        required: false,
      },
    ],
  },
];

// ──────────────────────────────────────────────────────────────
// Schema helpers
// ──────────────────────────────────────────────────────────────

export function getSchemaSection(id) {
  return METADATA_SCHEMA.find((s) => s.id === id) || null;
}

export function getAllSchemaFields() {
  return METADATA_SCHEMA.flatMap((s) => (Array.isArray(s.fields) ? s.fields.map((f) => ({ ...f, section: s.id })) : []));
}

export function getPath(obj, path) {
  const parts = String(path || "").split(".").filter(Boolean);
  let cur = obj;
  for (const p of parts) {
    if (cur == null) return undefined;
    cur = cur[p];
  }
  return cur;
}

export function setPath(obj, path, value) {
  const parts = String(path || "").split(".").filter(Boolean);
  if (!parts.length) return obj;
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i];
    if (typeof cur[p] !== "object" || cur[p] === null) cur[p] = {};
    cur = cur[p];
  }
  cur[parts[parts.length - 1]] = value;
  return obj;
}

export function createDefaultsFromSchema() {
  const defaults = {
    // Core
    title: "",
    description: "",
    datasetType: "",
    softwareNeeded: "",

    // Upload / Authors
    uploadedFiles: [],
    authors: [],

    // Subjects / Keywords
    subjects: [],
    keywords: [],

    // Funding
    fundingInfo: {
      sponsoringOrganizations: "",
      originatingResearchOrganization: "",
      otherContributingOrganizations: "",
      doeContractNumber: "",
      olcfProjectIdentifier: "",
      otherContractNumbers: "",
      otherIdentifyingNumbers: "",
    },

    // Related
    relatedWork: {
      relatedIdentifier: "",
      relatedIdentifierType: "",
      relationType: "",
    },
  };

  return defaults;
}
