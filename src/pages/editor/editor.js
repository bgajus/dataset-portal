// editor.js - Updated to use shared client-side record store
import { getRecord, saveRecord, createNewDraft, getAllRecords } from "/src/assets/js/shared-store.js";

(() => {
  // ──────────────────────────────────────────────────────────────
  // Helpers
  // ──────────────────────────────────────────────────────────────

  function escapeHtml(str) {
    return String(str ?? "").replace(/[&<>"']/g, (s) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }[s]));
  }

  function parseCommaList(value) {
    return String(value || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }

  function joinCommaList(arr) {
    return (Array.isArray(arr) ? arr : [])
      .map((s) => String(s || "").trim())
      .filter(Boolean)
      .join(", ");
  }

  function safeTrim(v) {
    return String(v ?? "").trim();
  }

  // ──────────────────────────────────────────────────────────────
  // Subjects list (hardcoded for now)
  // ──────────────────────────────────────────────────────────────
  const SUBJECT_OPTIONS = [
    "Coal, Lignite, & Peat",
    "Petroleum",
    "Natural Gas",
    "Oil Shales & Tar S&S",
    "Isotope & Radiation Sources",
    "Hydrogen",
    "Biomass Fuels",
    "Synthetic Fuels",
    "Nuclear Fuel Cycle & Fuel Materials",
    "Management Of Radioactive & Non-Radioactive Wastes From Nuclear Facilities",
    "Hydro Energy",
    "Solar Energy",
    "Geothermal Energy",
    "Tidal & Wave Power",
    "Wind Energy",
    "Fossil-Fueled Power Plants",
    "Specific Nuclear Reactors & Associated Plants",
    "General Studies Of Nuclear Reactors",
    "Power Transmission & Distribution",
    "Energy Storage",
    "Energy Planning, Policy, & Economy",
    "Direct Energy Conversion",
    "Energy Conservation, Consumption, & Utilization",
    "Advanced Propulsion Systems",
    "Materials Science",
    "Inorganic, Organic, Physical, & Analytical Chemistry",
    "Radiation Chemistry, Radiochemistry, & Nuclear Chemistry",
    "Engineering",
    "Particle Accelerators",
    "Military Technology, Weaponry, & National Defense",
    "Instrumentation Related To Nuclear Science & Technology",
    "Other Instrumentation",
    "Environmental Sciences",
    "Geosciences",
    "Basic Biological Sciences",
    "Applied Life Sciences",
    "Radiation Protection & Dosimetry",
    "Radiology & Nuclear Medicine",
    "Radiation, Thermal, & Other Environ. Pollutant Effects On Living Orgs. & Biol. Mat.",
    "Plasma Physics & Fusion Technology",
    "Classical & Quantum Mechanics, General Physics",
    "Physics Of Elementary Particles & Fields",
    "Nuclear Physics & Radiation Physics",
    "Atomic & Molecular Physics",
    "Condensed Matter Physics, Superconductivity & Superfluidity",
    "Nanoscience & Nanotechnology",
    "Astronomy & Astrophysics",
    "Knowledge Management & Preservation",
    "Mathematics & Computing",
    "Nuclear Disarmament, Safeguards, & Physical Protection",
    "General & Miscellaneou",
  ];

  const sections = [
    { id: "upload" },
    { id: "description" },
    { id: "authors" },
    { id: "subjects" }, // optional
    { id: "funding" },
    { id: "related" },  // optional
  ];

  // ──────────────────────────────────────────────────────────────
  // DOM refs
  // ──────────────────────────────────────────────────────────────
  const pageTitleEl = document.getElementById("pageTitle");
  const titleEditingEl = document.getElementById("titleEditing");
  const titleInputEl = document.getElementById("title");
  const startedOnDateEl = document.getElementById("startedOnDate");

  const previewBtn = document.getElementById("previewBtn");
  const submitBtn = document.getElementById("submitBtn");
  const saveBtn = document.getElementById("saveBtn");
  const saveToast = document.getElementById("saveToast");
  const requiredRemainingEl = document.getElementById("requiredRemaining");

  // Description section fields
  const datasetTypeEl = document.getElementById("datasetType");
  const descriptionEl = document.getElementById("description");

  // Subjects + Keywords
  const subjectsSelectEl = document.getElementById("subjectsSelect");
  const keywordsInputEl = document.getElementById("keywordsInput");
  const keywordsDatalistEl = document.getElementById("keywordsDatalist");

  // Funding section fields
  const funderNameEl = document.getElementById("funderName");
  const awardNumberEl = document.getElementById("awardNumber");

  // Related Works section fields
  const relatedDoiEl = document.getElementById("relatedDoi");
  const relatedUrlEl = document.getElementById("relatedUrl");

  // Help
  const helpBtn = document.getElementById("helpBtn");
  helpBtn?.addEventListener("click", () => alert("Help (demo) — link this to docs or a support panel."));

  // Upload section (still demo)
  const uploadWithGlobusBtn = document.getElementById("uploadWithGlobusBtn");
  const uploadRequiredAlert = document.getElementById("uploadRequiredAlert");
  const uploadedPanel = document.getElementById("uploadedPanel");
  const uploadedFilesList = document.getElementById("uploadedFilesList");
  let uploadedFiles = [];

  // Authors
  const authorsListEl = document.getElementById("authors-list");
  const addAuthorBtn = document.getElementById("add-author-btn");

  const modal = document.getElementById("author-modal");
  const modalTitle = document.getElementById("modal-title");
  const closeModalBtn = modal?.querySelector(".modal-close");
  const cancelFormBtn = document.getElementById("cancelForm");
  const saveAuthorFormBtn = document.getElementById("saveAuthorForm");
  const saveAddAnotherBtn = document.getElementById("saveAddAnother");

  const firstNameEl = document.getElementById("firstName");
  const middleNameEl = document.getElementById("middleName");
  const lastNameEl = document.getElementById("lastName");
  const emailEl = document.getElementById("email");
  const orcidEl = document.getElementById("orcid");
  const affiliationEl = document.getElementById("affiliation");

  let authors = [];
  let editingIndex = null;
  let currentRecord = null;

  // ──────────────────────────────────────────────────────────────
  // Subjects + Keywords UI
  // ──────────────────────────────────────────────────────────────
  function buildKeywordSuggestionsFromStore() {
    if (!keywordsDatalistEl) return;

    const all = getAllRecords();
    const set = new Set();

    all.forEach((r) => {
      (Array.isArray(r.keywords) ? r.keywords : []).forEach((k) => {
        const v = safeTrim(k);
        if (v) set.add(v);
      });
    });

    const sorted = Array.from(set).sort((a, b) => a.localeCompare(b));
    keywordsDatalistEl.innerHTML = sorted.map((k) => `<option value="${escapeHtml(k)}"></option>`).join("");
  }

  function populateSubjectsOptions() {
    if (!subjectsSelectEl) return;

    subjectsSelectEl.innerHTML = SUBJECT_OPTIONS
      .map((s) => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`)
      .join("");
  }

  function setSelectedSubjects(values) {
    if (!subjectsSelectEl) return;
    const set = new Set((Array.isArray(values) ? values : []).map((s) => safeTrim(s)).filter(Boolean));

    Array.from(subjectsSelectEl.options).forEach((opt) => {
      opt.selected = set.has(opt.value);
    });
  }

  function getSelectedSubjects() {
    if (!subjectsSelectEl) return [];
    return Array.from(subjectsSelectEl.selectedOptions).map((opt) => opt.value);
  }

  // ──────────────────────────────────────────────────────────────
  // Related Works helpers (persist as array)
  // ──────────────────────────────────────────────────────────────
  function normalizeRelatedEntry(entry) {
    if (!entry || typeof entry !== "object") return null;

    const doi = safeTrim(entry.doi);
    const url = safeTrim(entry.url);

    if (!doi && !url) return null;

    const out = {};
    if (doi) out.doi = doi;
    if (url) out.url = url;
    return out;
  }

  function extractRelatedFromInputs() {
    const doi = safeTrim(relatedDoiEl?.value);
    const url = safeTrim(relatedUrlEl?.value);

    const related = [];
    if (doi) related.push({ doi });
    if (url) related.push({ url });

    return related.map(normalizeRelatedEntry).filter(Boolean);
  }

  function applyRelatedToInputs(record) {
    const rel = Array.isArray(record?.related) ? record.related : [];
    const firstDoi = rel.find((r) => safeTrim(r?.doi))?.doi || "";
    const firstUrl = rel.find((r) => safeTrim(r?.url))?.url || "";

    if (relatedDoiEl) relatedDoiEl.value = firstDoi;
    if (relatedUrlEl) relatedUrlEl.value = firstUrl;
  }

  // ──────────────────────────────────────────────────────────────
  // Focus trap + inert for modal
  // ──────────────────────────────────────────────────────────────
  function getFocusableElements(container) {
    return Array.from(container.querySelectorAll(
      'a[href]:not([disabled]), button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled])'
    ));
  }

  function trapFocus(e) {
    if (e.key !== "Tab") return;

    const focusable = getFocusableElements(modal);
    if (focusable.length === 0) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (e.shiftKey) {
      if (document.activeElement === first || !modal.contains(document.activeElement)) {
        e.preventDefault();
        last.focus();
      }
    } else {
      if (document.activeElement === last || !modal.contains(document.activeElement)) {
        e.preventDefault();
        first.focus();
      }
    }
  }

  function startModalTrap() {
    modal.addEventListener("keydown", trapFocus);

    const sectionsToInert = [
      document.querySelector("header"),
      document.querySelector("main"),
      document.querySelector('[data-include="portal-footer"]'),
    ].filter(Boolean);

    sectionsToInert.forEach((el) => {
      if (el && !el.contains(modal)) {
        el.setAttribute("aria-hidden", "true");
        el.setAttribute("inert", "");
      }
    });

    const first = getFocusableElements(modal)[0];
    if (first) first.focus();
  }

  function stopModalTrap() {
    modal.removeEventListener("keydown", trapFocus);

    document.querySelectorAll('[aria-hidden="true"][inert]').forEach((el) => {
      el.removeAttribute("aria-hidden");
      el.removeAttribute("inert");
    });
  }

  // ──────────────────────────────────────────────────────────────
  // Load record from store on init
  // ──────────────────────────────────────────────────────────────
  function getUrlParams() {
    const params = new URLSearchParams(window.location.search);
    return { doi: safeTrim(params.get("doi")) };
  }

  function loadRecord() {
    const { doi } = getUrlParams();

    if (doi) {
      currentRecord = getRecord(doi);
      if (!currentRecord) {
        console.warn(`No record found for DOI: ${doi}. Creating new draft.`);
        currentRecord = createNewDraft("Untitled Dataset (from invalid DOI)");
      }
    } else {
      currentRecord = createNewDraft("Untitled Dataset");
    }

    // Title
    if (titleInputEl) titleInputEl.value = currentRecord.title || "";
    if (pageTitleEl) pageTitleEl.textContent = currentRecord.title || "Untitled Dataset";

    if (startedOnDateEl && currentRecord.createdAt) {
      startedOnDateEl.textContent = new Date(currentRecord.createdAt).toLocaleDateString(undefined, {
        month: "long",
        day: "numeric",
        year: "numeric",
      });
    }

    // Description section
    if (datasetTypeEl) datasetTypeEl.value = currentRecord.datasetType || "";
    if (descriptionEl) descriptionEl.value = currentRecord.description || "";

    // Authors
    authors = Array.isArray(currentRecord.authors) ? currentRecord.authors : [];
    renderAuthors();

    // Subjects + Keywords
    populateSubjectsOptions();
    setSelectedSubjects(currentRecord.subjects || []);
    if (keywordsInputEl) keywordsInputEl.value = joinCommaList(currentRecord.keywords || []);
    buildKeywordSuggestionsFromStore();

    // Funding
    const funding = (currentRecord.funding && typeof currentRecord.funding === "object") ? currentRecord.funding : {};
    if (funderNameEl) funderNameEl.value = funding.funderName || "";
    if (awardNumberEl) awardNumberEl.value = funding.awardNumber || "";

    // Related Works
    applyRelatedToInputs(currentRecord);

    updateAll();
  }

  // ──────────────────────────────────────────────────────────────
  // Save changes back to store
  // ──────────────────────────────────────────────────────────────
  function saveCurrentRecord() {
    if (!currentRecord) return;

    // Title
    currentRecord.title = safeTrim(titleInputEl?.value);
    currentRecord.authors = authors.slice();

    // Description section
    currentRecord.datasetType = safeTrim(datasetTypeEl?.value);
    currentRecord.description = safeTrim(descriptionEl?.value);

    // Subjects + Keywords
    currentRecord.subjects = getSelectedSubjects();
    currentRecord.keywords = parseCommaList(keywordsInputEl?.value || "");
    currentRecord.subjectsKeywords = (currentRecord.subjects || []).join(", ");

    // Funding section
    currentRecord.funding = {
      funderName: safeTrim(funderNameEl?.value),
      awardNumber: safeTrim(awardNumberEl?.value),
    };

    // Related works section (optional)
    currentRecord.related = extractRelatedFromInputs();

    const success = saveRecord(currentRecord);

    if (success) {
      buildKeywordSuggestionsFromStore();

      if (saveToast) {
        saveToast.hidden = false;
        clearTimeout(saveToast._t);
        saveToast._t = setTimeout(() => (saveToast.hidden = true), 1300);
      }

      updateAll();
    } else {
      alert("Failed to save changes. Check console for details.");
    }
  }

  // ──────────────────────────────────────────────────────────────
  // Preview button → open landing page
  // ──────────────────────────────────────────────────────────────
  previewBtn?.addEventListener("click", () => {
    if (!currentRecord || !currentRecord.doi) {
      alert("No draft to preview yet. Save first.");
      return;
    }
    // Ensure the most recent changes are persisted before preview
    saveCurrentRecord();
    const previewUrl = `/src/pages/dataset/index.html?doi=${encodeURIComponent(currentRecord.doi)}&preview=1`;
    window.open(previewUrl, "_blank");
  });

  // ──────────────────────────────────────────────────────────────
  // Upload demo
  // ──────────────────────────────────────────────────────────────
  function renderUploads() {
    const hasUploads = uploadedFiles.length > 0;
    if (uploadRequiredAlert) uploadRequiredAlert.hidden = hasUploads;
    if (uploadedPanel) uploadedPanel.hidden = !hasUploads;

    if (uploadedFilesList) {
      uploadedFilesList.innerHTML = hasUploads
        ? uploadedFiles.map((f) => `<li>${escapeHtml(f)}</li>`).join("")
        : "";
    }
  }

  uploadWithGlobusBtn?.addEventListener("click", () => {
    if (uploadedFiles.length === 0) {
      uploadedFiles = ["urban-radiation-dataset_v1.zip"];
      renderUploads();
      updateAll();
    }
  });

  // ──────────────────────────────────────────────────────────────
  // Title sync
  // ──────────────────────────────────────────────────────────────
  let editingTimer = null;

  function setDatasetTitleText(nextTitle, { allowUntitled = true } = {}) {
    const trimmed = safeTrim(nextTitle);
    if (!trimmed && allowUntitled) pageTitleEl.textContent = "Untitled Dataset";
    else if (trimmed) pageTitleEl.textContent = trimmed;
  }

  function showEditingPill() {
    if (!titleEditingEl) return;
    titleEditingEl.hidden = false;
    clearTimeout(editingTimer);
    editingTimer = setTimeout(() => (titleEditingEl.hidden = true), 900);
  }

  titleInputEl?.addEventListener("input", () => {
    showEditingPill();
    const val = titleInputEl.value;
    if (safeTrim(val).length > 0) setDatasetTitleText(val, { allowUntitled: false });
    updateAll();
  });

  titleInputEl?.addEventListener("blur", () => {
    setDatasetTitleText(titleInputEl.value, { allowUntitled: true });
    if (titleEditingEl) titleEditingEl.hidden = true;
    updateAll();
  });

  // Refresh status when these change
  subjectsSelectEl?.addEventListener("change", () => updateAll());
  keywordsInputEl?.addEventListener("input", () => updateAll());
  datasetTypeEl?.addEventListener("change", () => updateAll());
  descriptionEl?.addEventListener("input", () => updateAll());
  funderNameEl?.addEventListener("input", () => updateAll());
  awardNumberEl?.addEventListener("input", () => updateAll());
  relatedDoiEl?.addEventListener("input", () => updateAll());
  relatedUrlEl?.addEventListener("input", () => updateAll());

  // ──────────────────────────────────────────────────────────────
  // Authors
  // ──────────────────────────────────────────────────────────────
  function validateOrcid(value) {
    const v = safeTrim(value);
    if (!v) return true;
    return /^\d{4}-\d{4}-\d{4}-\d{4}$/.test(v);
  }

  function isFilled(el) {
    if (!el) return false;
    if (el.type === "checkbox" || el.type === "radio") return el.checked;
    return safeTrim(el.value).length > 0;
  }

  function openAuthorModal(editIndex = null) {
    if (!modal) return;

    editingIndex = editIndex;
    modal.hidden = false;
    modal.setAttribute("aria-hidden", "false");

    if (editIndex !== null) {
      modalTitle.textContent = "Edit Author";
      const a = authors[editIndex] || {};
      firstNameEl.value = a.firstName || "";
      middleNameEl.value = a.middleName || "";
      lastNameEl.value = a.lastName || "";
      emailEl.value = a.email || "";
      orcidEl.value = a.orcid || "";
      affiliationEl.value = a.affiliation || "";
    } else {
      modalTitle.textContent = "Add Author";
      resetAuthorForm();
    }

    startModalTrap();
    setTimeout(() => firstNameEl?.focus(), 0);
  }

  function closeAuthorModal() {
    if (!modal) return;

    modal.hidden = true;
    modal.setAttribute("aria-hidden", "true");
    editingIndex = null;

    stopModalTrap();
    addAuthorBtn?.focus();
  }

  function resetAuthorForm() {
    [firstNameEl, middleNameEl, lastNameEl, emailEl, orcidEl, affiliationEl].forEach((el) => {
      if (el) el.value = "";
    });
    orcidEl?.classList.remove("usa-input--error");
    orcidEl?.setAttribute("aria-invalid", "false");
  }

  function getAuthorFormValues() {
    return {
      firstName: safeTrim(firstNameEl?.value),
      middleName: safeTrim(middleNameEl?.value),
      lastName: safeTrim(lastNameEl?.value),
      email: safeTrim(emailEl?.value),
      orcid: safeTrim(orcidEl?.value),
      affiliation: safeTrim(affiliationEl?.value),
    };
  }

  function validateAuthor(a) {
    const requiredOk = !!(a.firstName && a.lastName && a.affiliation);
    const orcidOk = validateOrcid(a.orcid);
    return requiredOk && orcidOk;
  }

  function saveAuthor(closeAfterSave = true) {
    const newAuthor = getAuthorFormValues();

    const orcidOk = validateOrcid(newAuthor.orcid);
    orcidEl?.classList.toggle("usa-input--error", !orcidOk);
    orcidEl?.setAttribute("aria-invalid", String(!orcidOk));

    if (!validateAuthor(newAuthor)) {
      alert("Please fill out required author fields (First, Last, Affiliation) and ensure ORCID is valid if provided.");
      return;
    }

    if (editingIndex !== null) authors[editingIndex] = newAuthor;
    else authors.push(newAuthor);

    renderAuthors();
    updateAll();

    if (closeAfterSave) closeAuthorModal();
    else {
      resetAuthorForm();
      modalTitle.textContent = "Add Another Author";
      firstNameEl?.focus();
    }
  }

  function deleteAuthor(index) {
    if (!confirm("Delete this author?")) return;
    authors.splice(index, 1);
    renderAuthors();
    updateAll();
  }

  function authorDisplayName(a) {
    const parts = [a.firstName, a.middleName, a.lastName].filter(Boolean);
    return parts.join(" ");
  }

  function renderAuthors() {
    if (!authorsListEl) return;

    authorsListEl.innerHTML = "";

    if (authors.length === 0) {
      const empty = document.createElement("li");
      empty.className = "text-base text-italic text-secondary";
      empty.textContent = "No authors added yet.";
      authorsListEl.appendChild(empty);
      return;
    }

    authors.forEach((a, index) => {
      const li = document.createElement("li");
      li.className = "author-row";
      li.draggable = true;
      li.dataset.index = String(index);

      li.innerHTML = `
        <span class="drag-handle" title="Drag to reorder" aria-hidden="true">↕</span>
        <div class="author-info">
          <strong>${escapeHtml(authorDisplayName(a))}</strong><br>
          <small>${escapeHtml(a.affiliation || "")}</small>
        </div>
        <div class="author-actions">
          <button type="button" class="usa-button usa-button--unstyled" data-action="edit">Edit</button>
          <button type="button" class="usa-button usa-button--unstyled text-secondary" data-action="delete">Delete</button>
        </div>
      `;

      li.querySelector('[data-action="edit"]')?.addEventListener("click", () => openAuthorModal(index));
      li.querySelector('[data-action="delete"]')?.addEventListener("click", () => deleteAuthor(index));
      authorsListEl.appendChild(li);
    });

    initDragAndDrop();
  }

  function initDragAndDrop() {
    if (!authorsListEl) return;

    let dragStartIndex = null;

    authorsListEl.querySelectorAll(".author-row").forEach((row) => {
      row.addEventListener("dragstart", () => {
        dragStartIndex = Number(row.dataset.index);
        row.classList.add("dragging");
      });

      row.addEventListener("dragover", (e) => {
        e.preventDefault();
        const dragging = authorsListEl.querySelector(".dragging");
        if (!dragging) return;

        const siblings = [...authorsListEl.querySelectorAll(".author-row:not(.dragging)")];
        const nextSibling = siblings.find((sibling) => e.clientY <= sibling.offsetTop + sibling.offsetHeight / 2);
        authorsListEl.insertBefore(dragging, nextSibling || null);
      });

      row.addEventListener("drop", () => {
        const rows = [...authorsListEl.querySelectorAll(".author-row")];
        const droppedIndex = rows.indexOf(row);
        if (dragStartIndex === null || droppedIndex < 0) return;

        const moved = authors.splice(dragStartIndex, 1)[0];
        authors.splice(droppedIndex, 0, moved);

        renderAuthors();
        updateAll();
      });

      row.addEventListener("dragend", () => row.classList.remove("dragging"));
    });
  }

  addAuthorBtn?.addEventListener("click", () => openAuthorModal(null));
  closeModalBtn?.addEventListener("click", closeAuthorModal);
  cancelFormBtn?.addEventListener("click", closeAuthorModal);
  modal?.addEventListener("click", (e) => { if (e.target === modal) closeAuthorModal(); });

  saveAuthorFormBtn?.addEventListener("click", () => saveAuthor(true));
  saveAddAnotherBtn?.addEventListener("click", () => saveAuthor(false));

  // ──────────────────────────────────────────────────────────────
  // Status + submit logic
  // ──────────────────────────────────────────────────────────────
  function getSectionMissingCount(sectionId) {
    // Optional sections: do not count missing
    if (sectionId === "subjects") return 0;
    if (sectionId === "related") return 0;

    if (sectionId === "upload") return uploadedFiles.length === 0 ? 1 : 0;
    if (sectionId === "authors") return authors.length === 0 ? 1 : 0;

    const requiredFields = document.querySelectorAll(`[data-required][data-section="${sectionId}"]`);
    let missing = 0;
    requiredFields.forEach((el) => { if (!isFilled(el)) missing += 1; });
    return missing;
  }

  function setSectionStatus(sectionId, missingCount) {
    const chip = document.querySelector(`[data-status-for="${sectionId}"]`);
    if (!chip) return;

    if (sectionId === "related" || sectionId === "subjects") {
      chip.dataset.state = "neutral";
      chip.textContent = "Optional";
      chip.style.cursor = "default";
      chip.removeAttribute("role");
      chip.removeAttribute("tabindex");
      chip.removeAttribute("aria-label");
      return;
    }

    if (missingCount > 0) {
      chip.dataset.state = "incomplete";
      chip.textContent = `Missing: ${missingCount}`;
      chip.style.cursor = "pointer";
      chip.setAttribute("role", "button");
      chip.setAttribute("tabindex", "0");
      chip.setAttribute("aria-label", `Jump to first missing required field in ${sectionId}`);
    } else {
      chip.dataset.state = "complete";
      chip.textContent = "Complete";
      chip.style.cursor = "default";
      chip.removeAttribute("role");
      chip.removeAttribute("tabindex");
      chip.removeAttribute("aria-label");
    }
  }

  function updateSubmitState(totalMissingRequired) {
    const canSubmit = totalMissingRequired === 0;
    submitBtn.disabled = !canSubmit;
    submitBtn.setAttribute("aria-disabled", String(!canSubmit));
    requiredRemainingEl.textContent = String(totalMissingRequired);
  }

  function openAccordionSection(sectionId) {
    const content = document.querySelector(`[data-section-content="${sectionId}"]`);
    const heading = document.querySelector(`.usa-accordion__heading[data-section="${sectionId}"]`);
    if (!content || !heading) return;

    const btn = heading.querySelector(".usa-accordion__button");
    if (!btn) return;

    if (content.hasAttribute("hidden")) {
      content.removeAttribute("hidden");
      btn.setAttribute("aria-expanded", "true");
    }
  }

  function focusWithScroll(el) {
    const stickyH = document.getElementById("stickyShell")?.getBoundingClientRect().height || 0;
    const y = el.getBoundingClientRect().top + window.scrollY - stickyH - 16;
    window.scrollTo({ top: y, behavior: "smooth" });

    setTimeout(() => {
      el.focus?.({ preventScroll: true });
      if (el.tagName === "INPUT" && el.type === "text") el.select?.();
    }, 250);
  }

  function focusFirstMissingInSection(sectionId) {
    if (sectionId === "upload") return focusWithScroll(uploadWithGlobusBtn);

    if (sectionId === "authors") {
      if (authors.length === 0) return openAuthorModal(null);
      const firstRow = authorsListEl?.querySelector(".author-row");
      if (firstRow) return focusWithScroll(firstRow);
      return;
    }

    const requiredFields = Array.from(document.querySelectorAll(`[data-required][data-section="${sectionId}"]`));
    const firstMissing = requiredFields.find((el) => !isFilled(el));
    if (firstMissing) return focusWithScroll(firstMissing);
  }

  function handleChipActivate(sectionId) {
    const missing = getSectionMissingCount(sectionId);
    if (missing <= 0) return;
    openAccordionSection(sectionId);
    focusFirstMissingInSection(sectionId);
  }

  function wireChipHandlers() {
    const accordion = document.getElementById("metaAccordion");
    if (!accordion) return;

    accordion.addEventListener("click", (e) => {
      const chip = e.target.closest(".acc-status");
      if (!chip || chip.dataset.state !== "incomplete") return;

      e.stopPropagation();
      e.preventDefault();

      const sectionId = chip.getAttribute("data-status-for");
      handleChipActivate(sectionId);
    });

    accordion.addEventListener("keydown", (e) => {
      const chip = e.target.closest(".acc-status");
      if (!chip || chip.dataset.state !== "incomplete") return;

      const isEnter = e.key === "Enter";
      const isSpace = e.key === " " || e.key === "Spacebar";
      if (!isEnter && !isSpace) return;

      e.preventDefault();
      const sectionId = chip.getAttribute("data-status-for");
      handleChipActivate(sectionId);
    });
  }

  function updateAll() {
    if (orcidEl) {
      const ok = validateOrcid(orcidEl.value);
      orcidEl.classList.toggle("usa-input--error", !ok);
      orcidEl.setAttribute("aria-invalid", String(!ok));
    }

    let totalMissing = 0;

    sections.forEach((s) => {
      const missing = getSectionMissingCount(s.id);

      // Optional sections do NOT count toward required remaining
      if (s.id !== "related" && s.id !== "subjects") totalMissing += missing;

      setSectionStatus(s.id, missing);
    });

    updateSubmitState(totalMissing);
  }

  document.addEventListener("input", (e) => {
    const t = e.target;
    if (!t) return;
    if (t.matches("[data-required]") || t.closest("[data-section-content]")) updateAll();
  });

  document.addEventListener("change", (e) => {
    const t = e.target;
    if (!t) return;
    if (t.matches("[data-required]") || t.closest("[data-section-content]")) updateAll();
  });

  saveBtn?.addEventListener("click", () => {
    saveCurrentRecord();
  });

  submitBtn?.addEventListener("click", () => alert("Submitted for review (demo)."));

  // Init
  loadRecord();
  renderUploads();
  renderAuthors();
  wireChipHandlers();
  updateAll();
})();
