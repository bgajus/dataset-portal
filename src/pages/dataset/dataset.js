// /src/pages/dataset/dataset.js
// Dataset landing page
// - Supports real store records + deterministic demo mocks
// - Polished to render key sections from the shared metadata schema

import { getRecord, getAllRecords } from "/src/assets/js/shared-store.js";
import {
  DATASET_TYPE_OPTIONS,
  SUBJECT_OPTIONS,
  getPath,
} from "/src/assets/js/metadata-schema.js";

(() => {
  const DEMO_DOI_BASE = 1400000;
  const DEMO_MOCK_COUNT = 10;

  const $ = (id) => document.getElementById(id);

  function escapeHtml(str) {
    return String(str || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function formatLongDate(iso) {
    if (!iso) return "—";
    const d = new Date(iso.includes("T") ? iso : `${iso}T00:00:00`);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
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

  // deterministic, but separate instance so dataset page doesn't depend on other pages
  const rand = mulberry32(584199);

  function pick(arr) {
    return arr[Math.floor(rand() * arr.length)];
  }

  function makeDemoMock(i) {
    const suffix = DEMO_DOI_BASE + i;
    const doi = `10.13139/ORNLNCCS/${suffix}`;
    const date = new Date(2020 + Math.floor(i / 3), 0, 1 + (i % 28));
    const subjects = [pick(SUBJECT_OPTIONS), pick(SUBJECT_OPTIONS), pick(SUBJECT_OPTIONS)];

    const typeOpt = pick(DATASET_TYPE_OPTIONS);

    return {
      _isDemo: true,
      doi,
      title: `Fallback Mock Dataset ${i + 1}`,
      createdAt: date.toISOString().slice(0, 10),
      updatedAt: date.toISOString().slice(0, 10),
      status: "Published",

      description:
        "This is a demo dataset record used for UI prototyping and stakeholder walkthroughs.",
      subjects,
      subjectsKeywords: subjects.join(", "),
      keywords: ["HPC", "simulation", "benchmarking"],

      datasetType: typeOpt.value,
      datasetSizeLabel: `${Math.round((rand() * 120 + 5) * 10) / 10} GB`,
      softwareNeeded: "ParaView (demo)",

      authors: [
        { firstName: "Jane", lastName: "Doe", affiliation: "ORNL", orcid: "0000-0000-0000-0000" },
        { firstName: "John", lastName: "Smith", affiliation: "ORNL" },
        { firstName: "Alex", lastName: "Kim", affiliation: "Georgia Tech" },
      ],

      fundingInfo: {
        doeContractNumber: "DE-AC05-00OR22725 (demo)",
        originatingResearchOrganization: "Oak Ridge National Laboratory (demo)",
        sponsoringOrganizations: "U.S. Department of Energy (demo)",
        otherContributingOrganizations: "",
        olcfProjectIdentifier: "",
        otherContractNumbers: "",
        otherIdentifyingNumbers: "",
      },

      relatedWork: {
        relatedIdentifier: i % 2 === 0 ? "10.0000/DEMO.RELATED.1" : "https://example.com/demo-related",
        relatedIdentifierType: i % 2 === 0 ? "DOI" : "URL",
        relationType: "IsReferencedBy",
      },

      ack: "Demo acknowledgement text for prototyping.",
    };
  }

  function getDemoMockByDoi(doi) {
    const m = String(doi || "").match(/^10\.13139\/ORNLNCCS\/(\d+)$/);
    if (!m) return null;
    const suffix = Number(m[1]);
    if (!Number.isFinite(suffix)) return null;
    const i = suffix - DEMO_DOI_BASE;
    if (i < 0 || i >= DEMO_MOCK_COUNT) return null;
    return makeDemoMock(i);
  }

  function getUrlParams() {
    const params = new URLSearchParams(window.location.search);
    return {
      doi: (params.get("doi") || "").trim(),
      preview: (params.get("preview") || "").trim() === "1",
    };
  }

  function authorDisplayName(a) {
    const parts = [a.firstName, a.middleName, a.lastName].filter(Boolean);
    return parts.join(" ");
  }

  function renderAuthors(ds) {
    const host = $("dsAuthors");
    if (!host) return;

    const contributors = Array.isArray(ds.authors) ? ds.authors : [];
    if (contributors.length === 0) {
      host.textContent = "—";
      return;
    }

    const topN = 8;
    const top = contributors.slice(0, topN);
    const remaining = Math.max(0, contributors.length - top.length);

    const namesHtml = top
      .map((p) => {
        const nm = authorDisplayName(p) || "Contributor";
        const hasOrcid = !!(p.orcid || "").trim();
        return `
          <span class="dlp-author">
            ${escapeHtml(nm)}
            ${hasOrcid ? `<span class="dlp-orcid" title="ORCID: ${escapeHtml(p.orcid)}" aria-hidden="true">i</span>` : ""}
          </span>
        `;
      })
      .join(`<span class="text-base margin-x-05">,</span>`);

    const moreHtml = remaining
      ? `
        <span class="text-base margin-x-05">,</span>
        <a href="#" id="moreContribs" class="dlp-moreLink" aria-label="View all contributors">+${remaining} others</a>
      `
      : "";

    host.innerHTML = `${namesHtml}${moreHtml}`;
  }

  function openContribPopover(ds, anchorEl) {
    const pop = $("contribPopover");
    const backdrop = $("contribBackdrop");
    const popTitle = $("popTitle");
    const popClose = $("popClose");
    const popSearch = $("popSearch");
    const popMeta = $("popMeta");
    const popList = $("popList");

    if (!pop || !backdrop || !popTitle || !popClose || !popSearch || !popMeta || !popList) return;

    const all = Array.isArray(ds.authors) ? ds.authors : [];
    const active = all.slice();

    function renderList(q) {
      const query = (q || "").trim().toLowerCase();
      const rows = !query
        ? active
        : active.filter((p) => {
            const blob = `${authorDisplayName(p)} ${p.affiliation || ""}`.toLowerCase();
            return blob.includes(query);
          });

      popMeta.textContent = `${rows.length} of ${active.length} shown`;

      popList.innerHTML = rows
        .map((p) => {
          const nm = authorDisplayName(p) || "Contributor";
          const aff = (p.affiliation || "").trim();
          return `
            <div class="dlp-contribRow" title="${escapeHtml(nm)} — ${escapeHtml(aff)}">
              <div class="nm">${escapeHtml(nm)}</div>
              <div class="aff">${escapeHtml(aff || "—")}</div>
            </div>
          `;
        })
        .join("");
    }

    function close() {
      pop.hidden = true;
      pop.setAttribute("aria-hidden", "true");
      backdrop.hidden = true;
      document.body.style.overflow = "";
      if (anchorEl && typeof anchorEl.focus === "function") anchorEl.focus();
    }

    popTitle.textContent = `Contributors (${all.length})`;
    popSearch.value = "";
    renderList("");

    pop.hidden = false;
    pop.setAttribute("aria-hidden", "false");
    backdrop.hidden = false;
    document.body.style.overflow = "hidden";

    popClose.onclick = close;
    backdrop.onclick = close;
    popSearch.oninput = () => renderList(popSearch.value);

    setTimeout(() => popSearch.focus(), 0);
  }

  function datasetTypeLabel(value) {
    const v = String(value || "").trim();
    if (!v) return "—";
    const opt = DATASET_TYPE_OPTIONS.find((o) => o.value === v);
    if (opt) return opt.label;
    // fall back: if it already looks like a label, keep it
    return v;
  }

  function parseSubjects(ds) {
    if (Array.isArray(ds.subjects) && ds.subjects.length) {
      return ds.subjects.map((s) => String(s || "").trim()).filter(Boolean);
    }

    const csv = (ds.subjectsKeywords || "").trim();
    if (csv) return csv.split(",").map((s) => s.trim()).filter(Boolean);
    return [];
  }

  function parseKeywords(ds) {
    if (Array.isArray(ds.keywords) && ds.keywords.length) {
      return ds.keywords.map((k) => String(k || "").trim()).filter(Boolean);
    }
    // legacy: keywords sometimes stored in a single string
    const csv = (ds.keywordsCsv || "").trim();
    if (csv) return csv.split(",").map((s) => s.trim()).filter(Boolean);
    return [];
  }

  function renderSubjectsAndKeywords(ds) {
    const sec = $("sectionSubjects");
    const host = $("dsSubjects");
    if (!sec || !host) return;

    const subjects = parseSubjects(ds);
    const keywords = parseKeywords(ds);

    if (!subjects.length && !keywords.length) {
      sec.hidden = true;
      host.innerHTML = "";
      return;
    }

    const parts = [];
    if (subjects.length) {
      const links = subjects
        .map((s) => {
          const href = `/src/pages/search/index.html?subject=${encodeURIComponent(s)}`;
          return `<a href="${href}">${escapeHtml(s)}</a>`;
        })
        .join(", ");
      parts.push(`<div><strong>Subjects:</strong> ${links}</div>`);
    }

    if (keywords.length) {
      const kw = keywords.map((k) => `<span class="usa-tag">${escapeHtml(k)}</span>`).join(" ");
      parts.push(`<div class="margin-top-1"><strong>Keywords:</strong> ${kw}</div>`);
    }

    sec.hidden = false;
    host.innerHTML = parts.join("");
  }

  function renderDescription(ds) {
    const descEl = $("dsDescription");
    if (!descEl) return;
    const txt = String(ds.description || "").trim();
    descEl.innerHTML = txt ? `<p>${escapeHtml(txt)}</p>` : `<p>No description available.</p>`;
  }

  function renderFunding(ds) {
    const sec = $("sectionFunding");
    const dl = $("fundingDl");
    if (!sec || !dl) return;

    // Pull values using schema paths
    const rows = [
      { key: "fundingInfo.doeContractNumber", label: "DOE Contract Number" },
      { key: "fundingInfo.originatingResearchOrganization", label: "Originating Research Organization" },
      { key: "fundingInfo.sponsoringOrganizations", label: "Sponsoring Organizations" },
      { key: "fundingInfo.olcfProjectIdentifier", label: "OLCF Project Identifier" },
      { key: "fundingInfo.otherContributingOrganizations", label: "Other Contributing Organizations" },
      { key: "fundingInfo.otherContractNumbers", label: "Other Contract Number(s)" },
      { key: "fundingInfo.otherIdentifyingNumbers", label: "Other Identifying Numbers" },
    ];

    // Back-compat fallback if fundingInfo is empty
    const legacySponsor = ds.funding?.funderName || "";
    const legacyContract = ds.funding?.awardNumber || "";

    const html = rows
      .map((r) => {
        let val = getPath(ds, r.key);
        val = String(val || "").trim();

        // legacy fill
        if (!val && r.key === "fundingInfo.sponsoringOrganizations") val = String(legacySponsor || "").trim();
        if (!val && r.key === "fundingInfo.doeContractNumber") val = String(legacyContract || "").trim();

        // Only show optional rows if they have values, but always show the 3 key items
        const always = [
          "fundingInfo.doeContractNumber",
          "fundingInfo.originatingResearchOrganization",
          "fundingInfo.sponsoringOrganizations",
        ];

        if (!val && !always.includes(r.key)) return "";

        return `<dt>${escapeHtml(r.label)}</dt><dd>${escapeHtml(val || "—")}</dd>`;
      })
      .filter(Boolean)
      .join("");

    // If absolutely nothing is available, hide the section
    const hasAny = !!String(getPath(ds, "fundingInfo.doeContractNumber") || legacyContract || "").trim() ||
      !!String(getPath(ds, "fundingInfo.originatingResearchOrganization") || "").trim() ||
      !!String(getPath(ds, "fundingInfo.sponsoringOrganizations") || legacySponsor || "").trim();

    if (!hasAny) {
      sec.hidden = true;
      dl.innerHTML = "";
      return;
    }

    sec.hidden = false;
    dl.innerHTML = html;
  }

  function normalizeRelated(ds) {
    // New schema uses relatedWork.{relatedIdentifier, relatedIdentifierType, relationType}
    const rw = ds.relatedWork || {};
    const id = String(rw.relatedIdentifier || "").trim();
    const type = String(rw.relatedIdentifierType || "").trim();
    const rel = String(rw.relationType || "").trim();

    // Legacy array used by older demo builds
    const legacy = Array.isArray(ds.related) ? ds.related : [];

    const out = [];
    if (id) out.push({ relatedIdentifier: id, relatedIdentifierType: type, relationType: rel });

    legacy.forEach((r) => {
      const doiVal = String(r?.doi || "").trim();
      const urlVal = String(r?.url || "").trim();
      if (doiVal) out.push({ relatedIdentifier: doiVal, relatedIdentifierType: "DOI", relationType: "Related" });
      if (urlVal) out.push({ relatedIdentifier: urlVal, relatedIdentifierType: "URL", relationType: "Related" });
    });

    // Deduplicate
    const seen = new Set();
    return out.filter((r) => {
      const k = `${r.relatedIdentifierType}|${r.relatedIdentifier}|${r.relationType}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }

  function isLikelyUrl(value) {
    const v = String(value || "").trim();
    return /^https?:\/\//i.test(v);
  }

  function isLikelyDoi(value) {
    const v = String(value || "").trim();
    return /^10\.\d{4,9}\//.test(v);
  }

  function renderRelated(ds) {
    const sec = $("sectionRelated");
    const list = $("relatedList");
    if (!sec || !list) return;

    const items = normalizeRelated(ds);
    if (!items.length) {
      sec.hidden = true;
      list.innerHTML = "";
      return;
    }

    sec.hidden = false;
    list.innerHTML = items
      .map((r) => {
        const id = String(r.relatedIdentifier || "").trim();
        const type = String(r.relatedIdentifierType || "").trim();
        const rel = String(r.relationType || "").trim();

        let href = "";
        if (type.toLowerCase() === "doi" || isLikelyDoi(id)) href = `https://doi.org/${id}`;
        if (!href && isLikelyUrl(id)) href = id;

        const label = rel ? `${rel}: ` : "";
        const link = href
          ? `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(id)}</a>`
          : escapeHtml(id);

        return `<li>${escapeHtml(label)}${link}</li>`;
      })
      .join("");
  }

  function renderAcknowledgements(ds) {
    const sec = $("sectionAck");
    const main = $("dsAckMain");
    const aside = $("dsAck");
    const ack = String(ds.ack || "").trim();

    if (aside) aside.textContent = ack;
    if (!sec || !main) return;

    if (!ack) {
      sec.hidden = true;
      main.innerHTML = "";
      return;
    }

    sec.hidden = false;
    main.innerHTML = `<p>${escapeHtml(ack)}</p>`;
  }

  function renderDetailsCards(ds) {
    // DOI + dates
    $("dsDoi").textContent = ds.doi || "—";
    $("dsRelease").textContent = formatLongDate(ds.createdAt || ds.updatedAt || "");
    $("crumbDoi").textContent = ds.doi || "—";

    // Subjects sidebar list
    const subjectsList = parseSubjects(ds);
    const catsEl = $("dsCategories");
    if (catsEl) {
      catsEl.innerHTML =
        subjectsList
          .map((s) => {
            const href = `/src/pages/search/index.html?subject=${encodeURIComponent(s)}`;
            return `<a href="${href}">${escapeHtml(s)}</a>`;
          })
          .join(", ") || "—";
    }

    // Dataset card values
    const typeLabel = datasetTypeLabel(ds.datasetType);
    $("dsType").textContent = typeLabel;
    $("dsSize").textContent = ds.datasetSizeLabel || "—";
    $("dsSoftware").textContent = String(ds.softwareNeeded || ds.software || "").trim() || "—";
  }

  function citationForStyle(ds, style) {
    const baseDate = ds.releaseISO || ds.createdAt || ds.updatedAt;
    const year = baseDate
      ? new Date(baseDate.includes("T") ? baseDate : `${baseDate}T00:00:00`).getFullYear()
      : "";

    const authors = (Array.isArray(ds.authors) ? ds.authors : [])
      .slice(0, 5)
      .map((p) => {
        const last = (p.lastName || "").trim();
        const first = (p.firstName || "").trim();
        const fi = first ? `${first[0]}.` : "";
        return `${last}${last && fi ? ", " : ""}${fi}`;
      })
      .filter(Boolean)
      .join(", ");

    const others = (Array.isArray(ds.authors) ? ds.authors : []).length > 5 ? ", et al." : "";
    const title = ds.title || "Untitled Dataset";
    const doiUrl = ds.doi ? `https://doi.org/${ds.doi}` : "";

    if (style === "mla") return `${authors}${others}. "${title}." Oak Ridge National Laboratory, ${year || "n.d."}. ${doiUrl}.`;
    if (style === "chicago") return `${authors}${others}. "${title}." Oak Ridge National Laboratory, ${year || "n.d."}. ${doiUrl}.`;

    if (style === "bibtex") {
      const key = `ornl_${String(ds.doi || "dataset").split("/").pop()}`;
      const bibAuthors = (Array.isArray(ds.authors) ? ds.authors : [])
        .map((p) => {
          const last = (p.lastName || "").trim();
          const first = (p.firstName || "").trim();
          const mid = (p.middleName || "").trim();
          const fullFirst = [first, mid].filter(Boolean).join(" ").trim();
          return `${last}, ${fullFirst}`.trim();
        })
        .filter(Boolean)
        .join(" and ");

      return [
        `@dataset{${key},`,
        `  title        = {${title}},`,
        `  author       = {${bibAuthors}},`,
        `  year         = {${year || ""}},`,
        `  publisher    = {Oak Ridge National Laboratory},`,
        `  doi          = {${ds.doi || ""}},`,
        `  url          = {${doiUrl}}`,
        `}`,
      ].join("\n");
    }

    return `${authors}${others} (${year || "n.d."}). ${title}. Oak Ridge National Laboratory. ${doiUrl}.`;
  }

  async function copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      try {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.setAttribute("readonly", "true");
        ta.style.position = "absolute";
        ta.style.left = "-9999px";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        return true;
      } catch {
        return false;
      }
    }
  }

  function showToast() {
    const toast = $("copyToast");
    if (!toast) return;
    toast.hidden = false;
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => {
      toast.hidden = true;
    }, 1400);
  }

  function initCitation(ds) {
    const citeTextEl = $("citeText");
    const citeStyleEl = $("citeStyle");
    const copyBtn = $("copyCite");

    function updateCitation() {
      const style = (citeStyleEl?.value || "apa").toLowerCase();
      const text = citationForStyle(ds, style);
      if (citeTextEl) citeTextEl.textContent = text;
      return text;
    }

    if (citeStyleEl) citeStyleEl.addEventListener("change", updateCitation);
    if (copyBtn) {
      copyBtn.addEventListener("click", async () => {
        const txt = updateCitation();
        const ok = await copyToClipboard(txt);
        if (ok) showToast();
      });
    }

    updateCitation();
  }

  function initActions(ds) {
    $("downloadBtn")?.addEventListener("click", () => {
      alert("Download via Globus (demo) — integration coming soon.");
    });

    $("starBtn")?.addEventListener("click", (e) => {
      const icon = e.currentTarget.querySelector("i");
      if (icon) {
        const isSaved = icon.classList.contains("fa-solid");
        icon.classList.toggle("fa-solid", !isSaved);
        icon.classList.toggle("fa-regular", isSaved);
      }
    });

    const authorHost = $("dsAuthors");
    if (authorHost) {
      authorHost.addEventListener("click", (e) => {
        const a = e.target.closest("#moreContribs");
        if (!a) return;
        e.preventDefault();
        openContribPopover(ds, a);
      });
    }
  }

  function shouldShowPreviewBanner(ds, previewParam) {
    if (previewParam) return true;
    if (ds?._isDemo) return false;
    const status = String(ds?.status || "").trim();
    return status && status !== "Published";
  }

  function init() {
    const { doi, preview } = getUrlParams();

    if (!doi) {
      $("dsTitle").textContent = "No DOI provided";
      $("crumbDoi").textContent = "Invalid";
      return;
    }

    // Load real record; if missing, attempt demo mock
    let ds = getRecord(doi);
    if (!ds) ds = getDemoMockByDoi(doi);

    if (!ds) {
      $("dsTitle").textContent = "Dataset not found";
      $("crumbDoi").textContent = doi;
      return;
    }

    // Title + head
    $("dsTitle").textContent = ds.title || "Untitled Dataset";
    document.title = `${ds.title || "Dataset"} — Constellation`;

    const banner = $("previewBanner");
    if (banner) banner.hidden = !shouldShowPreviewBanner(ds, preview);

    renderDetailsCards(ds);
    renderAuthors(ds);
    renderDescription(ds);
    renderSubjectsAndKeywords(ds);
    renderFunding(ds);
    renderRelated(ds);
    renderAcknowledgements(ds);
    initCitation(ds);
    initActions(ds);
  }

  init();
})();
