// dataset.js - Supports store records + demo mock landing pages

import { getRecord } from "/src/assets/js/shared-store.js";

(() => {
  const DEMO_DOI_BASE = 1400000;
  const DEMO_MOCK_COUNT = 10;

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

  function mulberry32(seed){
    let t = seed >>> 0;
    return function(){
      t += 0x6D2B79F5;
      let r = Math.imul(t ^ (t >>> 15), 1 | t);
      r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  }

  // deterministic, but separate instance so dataset page doesn't depend on search page runtime
  const rand = mulberry32(584199);

  const subjects = [
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
    "Urban Sensing"
  ];

  function pick(arr) {
    return arr[Math.floor(rand() * arr.length)];
  }

  function makeDemoMock(i){
    const suffix = DEMO_DOI_BASE + i;
    const doi = `10.13139/ORNLNCCS/${suffix}`;
    const date = new Date(2020 + Math.floor(i/3), 0, 1 + i%28);

    return {
      _isDemo: true,
      doi,
      title: `Fallback Mock Dataset ${i + 1}`,
      createdAt: date.toISOString().slice(0,10),
      updatedAt: date.toISOString().slice(0,10),
      description: "This is a demo dataset record used for UI prototyping and stakeholder walkthroughs.",
      subjectsKeywords: `${pick(subjects)}, ${pick(subjects)}, ${pick(subjects)}`,
      datasetType: "ND Numeric Data",
      datasetSizeLabel: `${(Math.round((rand()*120 + 5) * 10)/10)} GB`,
      software: "Paraview (demo)",
      authors: [
        { firstName: "Jane", lastName: "Doe", affiliation: "ORNL", orcid: "0000-0000-0000-0000" },
        { firstName: "John", lastName: "Smith", affiliation: "ORNL" },
        { firstName: "Alex", lastName: "Kim", affiliation: "Georgia Tech" }
      ],
      funding: { funderName: "U.S. Department of Energy (demo)", awardNumber: "DE-AC05-00OR22725 (demo)" },
      related: [
        { doi: "10.0000/DEMO.RELATED.1" },
        { url: "https://example.com/demo-related" }
      ],
      ack: "Demo acknowledgement text for prototyping."
    };
  }

  function getDemoMockByDoi(doi){
    const m = String(doi || "").match(/^10\.13139\/ORNLNCCS\/(\d+)$/);
    if (!m) return null;
    const suffix = Number(m[1]);
    if (!Number.isFinite(suffix)) return null;
    const i = suffix - DEMO_DOI_BASE;
    if (i < 0 || i >= DEMO_MOCK_COUNT) return null;
    return makeDemoMock(i);
  }

  function parseSubjects(ds) {
    const csv = (ds.subjectsKeywords || "").trim();
    if (csv) return csv.split(",").map(s => s.trim()).filter(Boolean);
    if (Array.isArray(ds.keywords)) return ds.keywords.map(s => String(s || "").trim()).filter(Boolean);
    return [];
  }

  function authorDisplayName(a) {
    const parts = [a.firstName, a.middleName, a.lastName].filter(Boolean);
    return parts.join(" ");
  }

  function renderAuthors(ds) {
    const host = document.getElementById("dsAuthors");
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
    const pop = document.getElementById("contribPopover");
    const backdrop = document.getElementById("contribBackdrop");
    const popTitle = document.getElementById("popTitle");
    const popClose = document.getElementById("popClose");
    const popSearch = document.getElementById("popSearch");
    const popMeta = document.getElementById("popMeta");
    const popList = document.getElementById("popList");

    if (!pop || !backdrop || !popTitle || !popClose || !popSearch || !popMeta || !popList) return;

    const all = Array.isArray(ds.authors) ? ds.authors : [];
    let active = all.slice();

    function renderList(q) {
      const query = (q || "").trim().toLowerCase();
      const rows = !query ? active : active.filter(p => {
        const blob = `${authorDisplayName(p)} ${p.affiliation || ""}`.toLowerCase();
        return blob.includes(query);
      });

      popMeta.textContent = `${rows.length} of ${active.length} shown`;

      popList.innerHTML = rows.map(p => {
        const nm = authorDisplayName(p) || "Contributor";
        const aff = (p.affiliation || "").trim();
        return `
          <div class="dlp-contribRow" title="${escapeHtml(nm)} — ${escapeHtml(aff)}">
            <div class="nm">${escapeHtml(nm)}</div>
            <div class="aff">${escapeHtml(aff || "—")}</div>
          </div>
        `;
      }).join("");
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

  function citationForStyle(ds, style) {
    const baseDate = ds.releaseISO || ds.createdAt || ds.updatedAt;
    const year = baseDate ? new Date(baseDate.includes("T") ? baseDate : `${baseDate}T00:00:00`).getFullYear() : "";

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
    const toast = document.getElementById("copyToast");
    if (!toast) return;
    toast.hidden = false;
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => { toast.hidden = true; }, 1400);
  }

  function getUrlParams() {
    const params = new URLSearchParams(window.location.search);
    return {
      doi: (params.get("doi") || "").trim(),
      preview: (params.get("preview") || "").trim() === "1"
    };
  }

  function init() {
    const { doi, preview } = getUrlParams();

    const banner = document.getElementById("previewBanner");
    if (banner) banner.hidden = !preview;

    if (!doi) {
      document.getElementById("dsTitle").textContent = "No DOI provided";
      document.getElementById("crumbDoi").textContent = "Invalid";
      return;
    }

    // Load real record; if missing, attempt demo mock
    let ds = getRecord(doi);
    if (!ds) ds = getDemoMockByDoi(doi);

    if (!ds) {
      document.getElementById("dsTitle").textContent = "Dataset not found";
      document.getElementById("crumbDoi").textContent = doi;
      return;
    }

    document.getElementById("dsTitle").textContent = ds.title || "Untitled Dataset";
    document.getElementById("crumbDoi").textContent = ds.doi || doi;

    document.getElementById("dsDoi").textContent = ds.doi || doi;
    document.getElementById("dsRelease").textContent = formatLongDate(ds.createdAt || ds.updatedAt || "");

    // Subjects (links to search via ?subject=)
    const subjectsList = parseSubjects(ds);
    const catsEl = document.getElementById("dsCategories"); // id kept for now
    if (catsEl) {
      catsEl.innerHTML = subjectsList.map(s => {
        const href = `/src/pages/search/index.html?subject=${encodeURIComponent(s)}`;
        return `<a href="${href}">${escapeHtml(s)}</a>`;
      }).join(", ") || "—";
    }

    document.getElementById("dsType").textContent = ds.datasetType || "—";
    document.getElementById("dsSize").textContent = ds.datasetSizeLabel || "—";
    document.getElementById("dsSoftware").textContent = ds.software || "—";

    const descEl = document.getElementById("dsDescription");
    if (descEl) {
      const txt = (ds.description || "").trim();
      descEl.innerHTML = txt ? `<p>${escapeHtml(txt)}</p>` : `<p>No description available</p>`;
    }

    document.getElementById("fundingContract").textContent = ds.funding?.awardNumber || "—";
    document.getElementById("fundingOrg").textContent = "Oak Ridge National Laboratory";
    document.getElementById("fundingSponsor").textContent = ds.funding?.funderName || "—";

    const rEl = document.getElementById("relatedList");
    if (rEl) {
      const rel = Array.isArray(ds.related) ? ds.related : [];
      rEl.innerHTML =
        rel.map(r => {
          const doiVal = (r.doi || "").trim();
          const urlVal = (r.url || "").trim();
          if (doiVal) {
            const href = `https://doi.org/${doiVal}`;
            return `<li>DOI: <a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(doiVal)}</a></li>`;
          }
          if (urlVal) {
            return `<li>URL: <a href="${escapeHtml(urlVal)}" target="_blank" rel="noopener noreferrer">${escapeHtml(urlVal)}</a></li>`;
          }
          return "";
        }).filter(Boolean).join("") || "<li>No related resources</li>";
    }

    document.getElementById("dsAck").textContent = ds.ack || "";

    renderAuthors(ds);

    const authorHost = document.getElementById("dsAuthors");
    if (authorHost) {
      authorHost.addEventListener("click", (e) => {
        const a = e.target.closest("#moreContribs");
        if (!a) return;
        e.preventDefault();
        openContribPopover(ds, a);
      });
    }

    const citeTextEl = document.getElementById("citeText");
    const citeStyleEl = document.getElementById("citeStyle");
    const copyBtn = document.getElementById("copyCite");

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

    document.getElementById("downloadBtn")?.addEventListener("click", () => {
      alert("Download via Globus (demo) — integration coming soon.");
    });

    document.getElementById("starBtn")?.addEventListener("click", (e) => {
      const icon = e.currentTarget.querySelector("i");
      if (icon) {
        const isSaved = icon.classList.contains("fa-solid");
        icon.classList.toggle("fa-solid", !isSaved);
        icon.classList.toggle("fa-regular", isSaved);
      }
    });

    document.title = `${ds.title || "Dataset"} — Constellation`;
  }

  init();
})();
