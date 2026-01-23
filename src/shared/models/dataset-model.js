// src/shared/models/dataset-model.js
//
// Canonical UI dataset model.
// This is the source-of-truth shape the UI consumes, regardless of backend.
// Future adapters (DKAN/Drupal JSON:API, Directus, etc.) map INTO these types.
//
// This file is JSDoc-only on purpose (no runtime impact). It exists to:
// - document expected fields
// - standardize naming
// - keep Search/Home lean and Dataset/Editor rich
//
// IMPORTANT: Keep this backend-agnostic. Avoid Drupal machine names here.

/**
 * Dataset status values used across UI.
 * @typedef {"Draft"|"In Review"|"Needs Updates"|"Published"} DatasetStatus
 */

/**
 * A single facet bucket (value + count).
 * @template T
 * @typedef {Object} FacetBucket
 * @property {T} value
 * @property {number} count
 */

/**
 * Canonical summary record used in Search results + Homepage cards.
 * Keep this lean to support fast search/facet responses.
 *
 * @typedef {Object} DatasetSummary
 * @property {string} doi
 * @property {string} title
 * @property {string} description
 * @property {string[]} subjects
 * @property {string[]} keywords
 * @property {number|null} publishedYear
 * @property {string[]} fileTypes
 * @property {DatasetStatus} status
 *
 * @property {string=} publishedAt   // ISO 8601 string
 * @property {string=} updatedAt     // ISO 8601 string
 * @property {number|null=} datasetSizeBytes
 */

/**
 * Contributor model (covers authors, PIs, contacts).
 * Keep role flexible; downstream systems differ.
 *
 * @typedef {Object} Contributor
 * @property {string} name
 * @property {string=} orcid
 * @property {string=} affiliation
 * @property {string=} role         // e.g. "Author", "Contact", "PI"
 */

/**
 * Funding model (flexible for many org formats).
 * @typedef {Object} FundingItem
 * @property {string=} funderName
 * @property {string=} awardNumber
 * @property {string=} awardTitle
 * @property {string=} url
 */

/**
 * Related works / identifiers model.
 * Maps well to DOI-related identifiers and DCAT relations.
 *
 * @typedef {Object} RelatedWork
 * @property {string} label
 * @property {string} url
 * @property {string=} relationType // e.g. "IsSupplementTo", "References"
 */

/**
 * Canonical detail record used on Dataset landing page + Editor.
 * Extends DatasetSummary with richer metadata.
 *
 * @typedef {DatasetSummary & {
 *   contributors?: Contributor[];
 *   funding?: FundingItem[];
 *   relatedWorks?: RelatedWork[];
 *   acknowledgements?: string;
 * }} DatasetDetail
 */

/**
 * Search parameters (backend-agnostic).
 * @typedef {Object} SearchParams
 * @property {string=} q
 * @property {string[]=} subjects
 * @property {string[]=} keywords
 * @property {number[]=} years
 * @property {string[]=} fileTypes
 * @property {DatasetStatus[]=} status
 * @property {"relevance"|"yearDesc"|"yearAsc"|"titleAsc"|"titleDesc"|"sizeDesc"|"sizeAsc"=} sort
 * @property {number=} page       // 1-based
 * @property {number=} perPage
 */

/**
 * Search response (results + facets + paging).
 * @typedef {Object} SearchResponse
 * @property {DatasetSummary[]} results
 * @property {number} total
 * @property {number} page
 * @property {number} perPage
 * @property {number} pageCount
 * @property {{
 *   subjects: FacetBucket<string>[],
 *   keywords: FacetBucket<string>[],
 *   years: FacetBucket<number>[],
 *   fileTypes: FacetBucket<string>[],
 *   status?: FacetBucket<DatasetStatus>[]
 * }} facets
 * @property {SearchParams=} queryEcho
 */

export {};
