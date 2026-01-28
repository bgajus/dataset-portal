// /src/assets/js/demo-datasets.js
// Single source of truth for deterministic demo/fallback datasets.
// Used by Homepage, Search, and Dataset landing pages so demos stay coherent.

import { SUBJECT_OPTIONS, DATASET_TYPE_OPTIONS } from "./metadata-schema.js";

export const DEMO_DOI_BASE = 1400000;
export const DEMO_MOCK_COUNT = 10;

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function mulberry32(seed) {
  let t = seed >>> 0;
  return function () {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function pickNWithRng(rng, arr, n) {
  const a = Array.isArray(arr) ? arr.slice() : [];
  for (let j = a.length - 1; j > 0; j--) {
    const k = Math.floor(rng() * (j + 1));
    [a[j], a[k]] = [a[k], a[j]];
  }
  return a.slice(0, Math.max(0, Math.min(n, a.length)));
}

function getDemoIndexFromDoi(doi) {
  const m = String(doi || "").match(/^10\.13139\/ORNLNCCS\/(\d+)$/);
  if (!m) return null;
  const suffix = Number(m[1]);
  if (!Number.isFinite(suffix)) return null;
  const i = suffix - DEMO_DOI_BASE;
  if (i < 0 || i >= DEMO_MOCK_COUNT) return null;
  return i;
}

/**
 * Create a deterministic, rich demo dataset record by index.
 * The output is shaped like real records as stored in localStorage.
 */
export function makeDemoDataset(i) {
  const idx = clamp(Number(i) || 0, 0, DEMO_MOCK_COUNT - 1);
  const suffix = DEMO_DOI_BASE + idx;
  const doi = `10.13139/ORNLNCCS/${suffix}`;

  // Spread dates so “latest” looks like latest.
  const date = new Date(2020 + Math.floor(idx / 3), 0, 1 + (idx % 28));

  // Deterministic per DOI so every page sees the same record.
  const r = mulberry32(584199 ^ suffix);
  const pick = (arr) => arr[Math.floor(r() * arr.length)];
  const pickN = (arr, n) => pickNWithRng(r, arr, n);

  // Subjects
  const primarySubject = pick(Array.isArray(SUBJECT_OPTIONS) ? SUBJECT_OPTIONS : ["HPC Performance"]);
  const secondarySubject = r() > 0.65 ? pick(Array.isArray(SUBJECT_OPTIONS) ? SUBJECT_OPTIONS : [primarySubject]) : null;
  const subjects = [primarySubject, secondarySubject].filter(Boolean).slice(0, 2);

  // Dataset types (use metadata-schema options)
  const typeOpt = pick(
    Array.isArray(DATASET_TYPE_OPTIONS)
      ? DATASET_TYPE_OPTIONS
      : [{ value: "ND", label: "ND — Numeric Data" }]
  );

  // Keywords with overlap so keyword filtering demos well
  const keywordPoolBySubject = {
    "Bioinformatics": ["genomics", "proteomics", "sequence", "annotation", "pipeline"],
    "Climate": ["climate", "weather", "modeling", "forecasting", "reanalysis"],
    "Computational Fluid Dynamics": ["CFD", "turbulence", "mesh", "Navier-Stokes", "simulation"],
    "Cybersecurity": ["security", "anomaly detection", "encryption", "malware", "threat"],
    "Energy Systems": ["energy", "grid", "optimization", "demand", "simulation"],
    "Environmental Monitoring": ["sensors", "monitoring", "air quality", "time series", "remote sensing"],
    "Fusion": ["plasma", "tokamak", "MHD", "simulation", "diagnostics"],
    "Geospatial Analytics": ["GIS", "geospatial", "mapping", "raster", "vector"],
    "HPC Performance": ["HPC", "benchmarking", "scaling", "MPI", "OpenMP", "profiling"],
    "Machine Learning": ["machine learning", "training", "inference", "GPU", "HPC"],
    "Materials Science": ["materials", "molecular dynamics", "DFT", "simulation", "microstructure"],
    "Nuclear Energy": ["nuclear", "reactor", "neutronics", "thermal hydraulics", "simulation"],
    "Remote Sensing": ["remote sensing", "satellite", "imagery", "classification", "geospatial"],
    "Robotics": ["robotics", "planning", "control", "SLAM", "simulation"],
    "Transportation": ["traffic", "mobility", "routing", "simulation", "optimization"],
    "Urban Sensing": ["urban", "IoT", "sensors", "geospatial", "time series"],
  };
  const basePool = keywordPoolBySubject[primarySubject] || ["HPC", "simulation", "benchmarking"];
  const globalOverlap = ["HPC", "simulation", "benchmarking"]; // ensures cross-record overlap
  const pool = Array.from(new Set(basePool.concat(pickN(globalOverlap, 2))));
  const keywords = pickN(pool, clamp(2 + Math.floor(r() * 3), 2, 5));

  // Title + description
  const titleBySubject = {
    "Bioinformatics": "Genome Assembly Benchmark Suite",
    "Climate": "Regional Climate Reanalysis Collection",
    "Computational Fluid Dynamics": "High-Resolution Turbulence Simulation Outputs",
    "Cybersecurity": "Network Intrusion Detection Feature Set",
    "Energy Systems": "Grid Optimization Scenario Dataset",
    "Environmental Monitoring": "Air Quality Sensor Timeseries",
    "Fusion": "Tokamak Edge Plasma Simulation Data",
    "Geospatial Analytics": "Land Cover Change Detection Tiles",
    "HPC Performance": "Application Scaling and Profiling Dataset",
    "Machine Learning": "GPU Training Metrics and Checkpoints",
    "Materials Science": "Microstructure Characterization and Models",
    "Nuclear Energy": "Reactor Neutronics Benchmark Data",
    "Remote Sensing": "Satellite Imagery Classification Labels",
    "Robotics": "Autonomous Navigation Test Runs",
    "Transportation": "Traffic Flow Simulation Scenarios",
    "Urban Sensing": "Smart City IoT Sensor Readings",
  };
  const title = `${titleBySubject[primarySubject] || "Fallback Mock Dataset"} (${idx + 1})`;
  const descriptionPool = [
    `Demo dataset for ${primarySubject}. Includes representative outputs and metadata for UI walkthroughs.`,
    `A curated collection of results supporting ${primarySubject.toLowerCase()} workflows. Provided as a demo record.`,
    `Benchmark-ready artifacts for ${primarySubject.toLowerCase()} analysis and validation (demo).`,
  ];

  // Authors
  const authorPool = [
    { firstName: "Jane", lastName: "Doe", affiliation: "ORNL", orcid: "0000-0002-1825-0097" },
    { firstName: "John", lastName: "Smith", affiliation: "ORNL" },
    { firstName: "Alex", lastName: "Kim", affiliation: "Georgia Tech" },
    { firstName: "Priya", lastName: "Patel", affiliation: "UT Knoxville" },
    { firstName: "Miguel", lastName: "Santos", affiliation: "NVIDIA" },
    { firstName: "Emily", lastName: "Chen", affiliation: "LLNL" },
    { firstName: "Sam", lastName: "Nguyen", affiliation: "PNNL" },
    { firstName: "Ava", lastName: "Johnson", affiliation: "UNC Chapel Hill" },
  ];
  const authors = pickN(authorPool, clamp(2 + Math.floor(r() * 4), 2, 6));

  // Funding + related work
  const sponsor = pick([
    "U.S. Department of Energy (DOE)",
    "DOE Office of Science",
    "DOE Advanced Scientific Computing Research (ASCR)",
    "National Science Foundation (NSF)",
  ]);

  const originatingOrg = pick([
    "Oak Ridge National Laboratory (ORNL)",
    "National Center for Computational Sciences (NCCS)",
    "Oak Ridge Leadership Computing Facility (OLCF)",
  ]);

  const contractSuffix = String(22725 + (suffix % 40)).padStart(5, "0");
  const doeContractNumber = `DE-AC05-00OR${contractSuffix} (demo)`;

  const relatedIsDoi = r() > 0.5;
  const relatedIdentifier = relatedIsDoi
    ? `10.0000/DEMO.RELATED.${(suffix % 7) + 1}`
    : `https://example.com/demo-related/${suffix}`;

  const ack = pick([
    "This research used resources of the Oak Ridge Leadership Computing Facility at ORNL.",
    "We acknowledge the support of the U.S. Department of Energy and our collaborating institutions.",
    "Compute time was provided under an allocation on Frontier (demo).",
    "We thank the project team for contributions to data generation and validation (demo).",
  ]) + " (demo)";

  // Pseudo file list so files section feels real
  const fileCount = clamp(3 + Math.floor(r() * 8), 3, 10);
  const uploadedFiles = Array.from({ length: fileCount }).map((_, fileIdx) => {
    const ext = pick(["csv", "h5", "nc", "json", "vtk", "parquet"]);
    const sizeMB = clamp(Math.round((r() * 900 + 25) * 10) / 10, 5, 1200);
    return {
      name: `${primarySubject.replaceAll(" ", "_").toLowerCase()}_${suffix}_${fileIdx + 1}.${ext}`,
      size: `${sizeMB} MB`,
    };
  });

  return {
    _isDemo: true,
    doi,
    title,
    description: pick(descriptionPool),
    createdAt: date.toISOString().slice(0, 10),
    updatedAt: date.toISOString().slice(0, 10),
    publishedAt: date.toISOString().slice(0, 10),
    status: "Published",

    // Structured fields used across the app
    subjects,
    subjectsKeywords: subjects.join(", "),
    keywords,
    datasetType: typeOpt.value,
    datasetSizeLabel: `${Math.round((r() * 120 + 5) * 10) / 10} GB`,
    softwareNeeded: pick(["ParaView", "Python", "MATLAB", "R"]) + " (demo)",
    authors,
    fundingInfo: {
      doeContractNumber,
      originatingResearchOrganization: `${originatingOrg} (demo)`,
      sponsoringOrganizations: `${sponsor} (demo)`,
      otherContributingOrganizations: pick(["", "Georgia Tech", "UT Knoxville", "LLNL"]) || "",
      olcfProjectIdentifier: r() > 0.6 ? `OLCF-${(suffix % 9000) + 1000}` : "",
      otherContractNumbers: "",
      otherIdentifyingNumbers: "",
    },
    relatedWork: {
      relatedIdentifier,
      relatedIdentifierType: relatedIsDoi ? "DOI" : "URL",
      relationType: pick(["IsReferencedBy", "IsSupplementTo", "IsDerivedFrom"]),
    },
    ack,
    uploadedFiles,
  };
}

/**
 * Get a demo record by DOI, or null if DOI isn't in the demo range.
 */
export function getDemoDatasetByDoi(doi) {
  const idx = getDemoIndexFromDoi(doi);
  if (idx === null) return null;
  return makeDemoDataset(idx);
}

/**
 * Get the full list of demo datasets (rich records).
 */
export function getDemoDatasets() {
  return Array.from({ length: DEMO_MOCK_COUNT }).map((_, i) => makeDemoDataset(i));
}
