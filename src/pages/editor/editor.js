// editor.js — Schema-driven metadata editor
// Uses METADATA_SCHEMA as the single source of truth for sections/fields/required rules.

import { getRecord, saveRecord, createNewDraft, getAllRecords } from "/src/assets/js/shared-store.js";
import {
  METADATA_SCHEMA,
  getSchemaSection,
  getAllSchemaFields,
  getPath,
  setPath,
  SUBJECT_OPTIONS,
  DATASET_TYPE_OPTIONS,
  KEYWORD_SUGGESTIONS,
} from "/src/assets/js/metadata-schema.js";

(() => {
  // ──────────────────────────────────────────────────────────────
  // Helpers
  // ──────────────────────────────────────────────────────────────
  const $ = (id) => document.getElementById(id);

  function escapeHtml(str) {
    return String(str ?? "").replace(/[&<>"']/g, (s) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }[s]));
  }

  function safeTrim(v) {
    return String(v ?? "").trim();
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

  function formatShortDate(iso) {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  }

  function getQueryParam(name) {
    const u = new URL(window.location.href);
    return u.searchParams.get(name);
  }

  // ──────────────────────────────────────────────────────────────
  // DOM refs
  // ──────────────────────────────────────────────────────────────
  const pageTitleEl = $("pageTitle");
  const titleEditingEl = $("titleEditing");
  const startedOnDateEl = $("startedOnDate");

  const previewBtn = $("previewBtn");
  const submitBtn = $("submitBtn");
  const saveBtn = $("saveBtn");
  const saveToast = $("saveToast");
  const requiredRemainingEl = $("requiredRemaining");
  const lockBanner = $("lockBanner");

  // Status chip (top-left)
  const statusChipEl = document.querySelector(".status-chip");

  // Schema-driven containers
  const descriptionFieldsEl = $("descriptionFields");
  const subjectsFieldsEl = $("subjectsFields");
  const fundingFieldsEl = $("fundingFields");
  const relatedFieldsEl = $("relatedFields");

  // Upload section (demo)
  const uploadWithGlobusBtn = $("uploadWithGlobusBtn");
  const uploadRequiredAlert = $("uploadRequiredAlert");
  const uploadedPanel = $("uploadedPanel");
  const uploadedFilesList = $("uploadedFilesList");

  // Help
  const helpBtn = $("helpBtn");
  helpBtn?.addEventListener("click", () => alert("Help (demo) — link this to docs or a support panel."));

  // Authors (special)
  const authorsListEl = $("authors-list");
  const addAuthorBtn = $("add-author-btn");
  const modal = $("author-modal");
  const modalTitle = $("modal-title");
  const closeModalBtn = modal?.querySelector(".modal-close");
  const cancelFormBtn = $("cancelForm");
  const saveAuthorFormBtn = $("saveAuthorForm");
  const saveAddAnotherBtn = $("saveAddAnother");
  const firstNameEl = $("firstName");
  const middleNameEl = $("middleName");
  const lastNameEl = $("lastName");
  const emailEl = $("email");
  const orcidEl = $("orcid");
  const affiliationEl = $("affiliation");

  // Accordion
  const metaAccordion = $("metaAccordion");

  let currentRecord = null;
  let uploadedFiles = [];
  let authors = [];
  let editingIndex = null;
  let titleTypingTimer = null;

  function isRecordLocked() {
    const s = String(currentRecord?.status || "").toLowerCase();
    // Once submitted, user should not be able to edit.
    return s === "in review" || s === "published";
  }

  function setStatusChip(status) {
    if (!statusChipEl) return;
    const label = status || "Draft";
    const norm = String(label).toLowerCase().trim();

    // Drive chip styling via a data attribute so CSS can color-code states.
    // Keep the human label text exactly as stored.
    let key = "draft";
    if (norm === "in review" || norm === "in-review" || norm === "review") key = "in-review";
    else if (norm === "needs updates" || norm === "needs-updates") key = "needs-updates";
    else if (norm === "published") key = "published";
    else if (norm === "draft") key = "draft";

    statusChipEl.textContent = label;
    statusChipEl.setAttribute("aria-label", `Status: ${label}`);
    statusChipEl.setAttribute("data-status", key);
  }

  function applyLockedUI() {
    const locked = isRecordLocked();

    // Banner
    if (lockBanner) {
      lockBanner.hidden = !locked;
      if (locked) {
        const heading = lockBanner.querySelector(".usa-alert__heading");
        if (heading) heading.textContent = currentRecord?.status || "In Review";
      }
    }

    // Disable save when locked. Submit is disabled when locked OR when required fields are missing.
    if (saveBtn) saveBtn.disabled = locked;
    if (submitBtn) {
      if (locked) {
        submitBtn.disabled = true;
        submitBtn.setAttribute("aria-disabled", "true");
      } else {
        const remaining = getMissingRequiredFields().length;
        submitBtn.disabled = remaining !== 0;
        submitBtn.setAttribute("aria-disabled", remaining !== 0 ? "true" : "false");
      }
    }

    // Disable all editable controls inside accordion content panels
    const panels = Array.from(document.querySelectorAll("[data-section-content]"));
    panels.forEach((panel) => {
      const controls = Array.from(panel.querySelectorAll("input, select, textarea, button"));
      controls.forEach((el) => {
        // Skip accordion toggle buttons (not inside panels) — panels only.
        // Allow buttons that should remain active even in locked mode (none right now)
        if (locked) {
          el.disabled = true;
          el.setAttribute("aria-disabled", "true");
        } else {
          // Re-enable general form controls when unlocked.
          // (Do not handle Submit gating here — that is handled above.)
          el.disabled = false;
          el.removeAttribute("aria-disabled");
        }
      });
    });

    // Upload with Globus is an <a>, so handle it explicitly
    if (uploadWithGlobusBtn) {
      if (locked) {
        uploadWithGlobusBtn.classList.add("is-disabled");
        uploadWithGlobusBtn.setAttribute("aria-disabled", "true");
        uploadWithGlobusBtn.setAttribute("tabindex", "-1");
      } else {
        uploadWithGlobusBtn.classList.remove("is-disabled");
        uploadWithGlobusBtn.removeAttribute("aria-disabled");
        uploadWithGlobusBtn.removeAttribute("tabindex");
      }
    }

    // Authors modal controls (in case user opened it before lock)
    if (locked) {
      try { modal?.setAttribute("hidden", ""); } catch (_) {}
    }
  }

  // ──────────────────────────────────────────────────────────────
  // Schema-driven rendering
  // ──────────────────────────────────────────────────────────────

  function makeIdFromPath(path) {
    return String(path).replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  }

  function renderField(field, sectionId) {
    const id = makeIdFromPath(field.key);
    const requiredStar = field.required ? ' <span class="required-star" aria-hidden="true">*</span>' : "";
    const requiredAttrs = field.required ? "required data-required" : "";
    const hintHtml = field.hint ? `<div class="usa-hint">${escapeHtml(field.hint)}</div>` : "";

    // Conditional group for Related Works
    const conditionalAttr = sectionId === "related" ? 'data-conditional="related"' : "";

    if (field.type === "text") {
      return `
        <div class="usa-form-group">
          <label class="usa-label" for="${id}">${escapeHtml(field.label)}${requiredStar}</label>
          ${hintHtml}
          <input
            class="usa-input"
            id="${id}"
            type="text"
            ${requiredAttrs}
            data-path="${escapeHtml(field.key)}"
            data-section="${escapeHtml(sectionId)}"
            ${conditionalAttr}
          />
        </div>
      `;
    }

    if (field.type === "textarea") {
      const rows = Number(field.rows || 5);
      return `
        <div class="usa-form-group">
          <label class="usa-label" for="${id}">${escapeHtml(field.label)}${requiredStar}</label>
          ${hintHtml}
          <textarea
            class="usa-textarea"
            id="${id}"
            rows="${rows}"
            ${requiredAttrs}
            data-path="${escapeHtml(field.key)}"
            data-section="${escapeHtml(sectionId)}"
            ${conditionalAttr}
          ></textarea>
        </div>
      `;
    }

    if (field.type === "select") {
      const opts = (Array.isArray(field.options) ? field.options : []).map((o) => {
        if (typeof o === "string") return `<option value="${escapeHtml(o)}">${escapeHtml(o)}</option>`;
        return `<option value="${escapeHtml(o.value)}">${escapeHtml(o.label)}</option>`;
      }).join("");

      const placeholder = field.placeholder || "Select";

      return `
        <div class="usa-form-group">
          <label class="usa-label" for="${id}">${escapeHtml(field.label)}${requiredStar}</label>
          ${hintHtml}
          <select
            class="usa-select"
            id="${id}"
            ${requiredAttrs}
            data-path="${escapeHtml(field.key)}"
            data-section="${escapeHtml(sectionId)}"
            ${conditionalAttr}
          >
            <option value="">${escapeHtml(placeholder)}</option>
            ${opts}
          </select>
        </div>
      `;
    }

    if (field.type === "multiselect") {
      const opts = (Array.isArray(field.options) ? field.options : []).map((o) => {
        return `<option value="${escapeHtml(o)}">${escapeHtml(o)}</option>`;
      }).join("");

      return `
        <div class="usa-form-group">
          <label class="usa-label" for="${id}">${escapeHtml(field.label)} <span class="text-base">(Optional)</span></label>
          ${field.hint ? `<div class="usa-hint">${escapeHtml(field.hint)}</div>` : ""}
          <select
            id="${id}"
            class="usa-select"
            multiple
            size="8"
            data-path="${escapeHtml(field.key)}"
            data-section="${escapeHtml(sectionId)}"
          >
            ${opts}
          </select>
        </div>
      `;
    }

    if (field.type === "keywords") {
      const dlId = "keywordsDatalist";
      const placeholder = field.placeholder || "";
      return `
        <div class="usa-form-group">
          <label class="usa-label" for="${id}">${escapeHtml(field.label)} <span class="text-base">(Optional)</span></label>
          ${hintHtml}
          <input
            id="${id}"
            class="usa-input"
            type="text"
            placeholder="${escapeHtml(placeholder)}"
            list="${dlId}"
            data-path="${escapeHtml(field.key)}"
            data-section="${escapeHtml(sectionId)}"
          />
          <datalist id="${dlId}"></datalist>
        </div>
      `;
    }

    // Fallback
    return "";
  }

  function renderSection(sectionId) {
    const section = getSchemaSection(sectionId);
    if (!section || section.kind !== "fields") return;

    const containerMap = {
      description: descriptionFieldsEl,
      subjects: subjectsFieldsEl,
      funding: fundingFieldsEl,
      related: relatedFieldsEl,
    };
    const container = containerMap[sectionId];
    if (!container) return;

    // Slight grouping by UX within section: keep order as defined in schema
    container.innerHTML = section.fields.map((f) => renderField(f, sectionId)).join("");

    // Add a note for conditional related rule
    if (sectionId === "related" && section.conditionalRequired?.note) {
      const note = document.createElement("div");
      note.className = "usa-hint margin-bottom-2";
      note.textContent = section.conditionalRequired.note;
      container.prepend(note);
    }
  }

  function renderAllSchemaSections() {
    renderSection("description");
    renderSection("subjects");
    renderSection("funding");
    renderSection("related");
  }

  // ──────────────────────────────────────────────────────────────
  // Keywords suggestions (schema field type)
  // ──────────────────────────────────────────────────────────────
  function buildKeywordSuggestionsFromStore() {
    const dl = document.getElementById("keywordsDatalist");
    if (!dl) return;

    // Merge:
    // 1) a small curated demo list (schema)
    // 2) keywords already used across saved records (store)
    const all = getAllRecords();
    const set = new Set((Array.isArray(KEYWORD_SUGGESTIONS) ? KEYWORD_SUGGESTIONS : []).map((k) => safeTrim(k)).filter(Boolean));
    all.forEach((r) => {
      (Array.isArray(r.keywords) ? r.keywords : []).forEach((k) => {
        const v = safeTrim(k);
        if (v) set.add(v);
      });
    });

    const sorted = Array.from(set).sort((a, b) => a.localeCompare(b));
    dl.innerHTML = sorted.map((k) => `<option value="${escapeHtml(k)}"></option>`).join("");
  }

  // ──────────────────────────────────────────────────────────────
  // Record I/O helpers
  // ──────────────────────────────────────────────────────────────
  function readFieldValue(fieldEl) {
    const path = fieldEl.getAttribute("data-path");
    if (!path) return null;

    // Multi-select
    if (fieldEl.tagName === "SELECT" && fieldEl.multiple) {
      return Array.from(fieldEl.selectedOptions).map((o) => o.value);
    }

    // Keywords are stored as array
    if (path === "keywords") {
      return parseCommaList(fieldEl.value);
    }

    return fieldEl.value;
  }

  function writeFieldValue(fieldEl, value) {
    const path = fieldEl.getAttribute("data-path");
    if (!path) return;

    if (fieldEl.tagName === "SELECT" && fieldEl.multiple) {
      const set = new Set((Array.isArray(value) ? value : []).map((v) => safeTrim(v)).filter(Boolean));
      Array.from(fieldEl.options).forEach((opt) => {
        opt.selected = set.has(opt.value);
      });
      return;
    }

    if (path === "keywords") {
      fieldEl.value = joinCommaList(value);
      return;
    }

    fieldEl.value = value ?? "";
  }

  function bindSchemaFieldListeners() {
    const fields = Array.from(document.querySelectorAll("[data-path]"));
    fields.forEach((el) => {
      el.addEventListener("input", () => {
        if (!currentRecord) return;
        if (isRecordLocked()) return;
        const path = el.getAttribute("data-path");
        const value = readFieldValue(el);
        setPath(currentRecord, path, value);

        // Title sync (top title)
        if (path === "title") {
          updateTitleUI(value);
          if (titleEditingEl) titleEditingEl.hidden = false;
          clearTimeout(titleTypingTimer);
          titleTypingTimer = setTimeout(() => {
            if (titleEditingEl) titleEditingEl.hidden = true;
          }, 650);
        }

        updateCompletionUI();
      });
    });
  }

  function hydrateFieldsFromRecord() {
    const fields = Array.from(document.querySelectorAll("[data-path]"));
    fields.forEach((el) => {
      const path = el.getAttribute("data-path");
      const v = getPath(currentRecord, path);
      writeFieldValue(el, v);
    });
  }

  // ──────────────────────────────────────────────────────────────
  // Required / completion logic (schema-aware)
  // ──────────────────────────────────────────────────────────────

  function isRelatedConditionalActive() {
    const section = getSchemaSection("related");
    const keys = section?.conditionalRequired?.keys || [];
    return keys.some((k) => safeTrim(getPath(currentRecord, k)));
  }

  function getMissingRequiredFields() {
    const missing = [];

    // 1) Fields marked required in schema
    const schemaFields = getAllSchemaFields();
    schemaFields.forEach((f) => {
      // Related fields handled by conditional rule
      if (f.section === "related") return;
      if (!f.required) return;

      const v = getPath(currentRecord, f.key);
      const empty = Array.isArray(v) ? v.length === 0 : !safeTrim(v);
      if (empty) missing.push({ section: f.section, key: f.key });
    });

    // 2) Upload required (>=1)
    if (!Array.isArray(uploadedFiles) || uploadedFiles.length < 1) {
      missing.push({ section: "upload", key: "uploadedFiles" });
    }

    // 3) Authors required (>=1)
    if (!Array.isArray(authors) || authors.length < 1) {
      missing.push({ section: "authors", key: "authors" });
    }

    // 4) Related conditional: if any entered, all required
    if (isRelatedConditionalActive()) {
      const section = getSchemaSection("related");
      const keys = section?.conditionalRequired?.keys || [];
      keys.forEach((k) => {
        const v = getPath(currentRecord, k);
        if (!safeTrim(v)) missing.push({ section: "related", key: k });
      });
    }

    return missing;
  }

  function setSectionStatus(sectionId, missingCount) {
    const chip = document.querySelector(`[data-status-for="${sectionId}"]`);
    if (!chip) return;

    const section = getSchemaSection(sectionId);
    const isOptional = section ? section.required === false : false;

    // Optional sections: show Optional unless conditional required activates (Related Works)
    if (isOptional) {
      if (sectionId === "related" && isRelatedConditionalActive() && missingCount > 0) {
        chip.dataset.state = "incomplete";
        chip.textContent = `Missing: ${missingCount}`;
        chip.style.cursor = "pointer";
        chip.setAttribute("role", "button");
        chip.setAttribute("tabindex", "0");
        chip.setAttribute("aria-label", `Jump to first missing required field in ${sectionId}`);
        return;
      }

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

  function updateCompletionUI() {
    const missing = getMissingRequiredFields();
    const remaining = missing.length;
    if (requiredRemainingEl) requiredRemainingEl.textContent = String(remaining);

    // Update submit gating
    if (submitBtn) {
      submitBtn.disabled = remaining !== 0;
      submitBtn.setAttribute("aria-disabled", remaining !== 0 ? "true" : "false");
    }

    // Section chips
    METADATA_SCHEMA.forEach((s) => {
      const sectionMissing = missing.filter((m) => m.section === s.id).length;
      setSectionStatus(s.id, sectionMissing);
    });

    // Upload alert
    if (uploadRequiredAlert) {
      uploadRequiredAlert.hidden = Array.isArray(uploadedFiles) && uploadedFiles.length > 0;
    }
  }

  // Jump-to-missing behavior (chip click)
  function focusWithScroll(el) {
    if (!el) return;
    const stickyH = document.getElementById("stickyShell")?.getBoundingClientRect().height || 0;
    const y = el.getBoundingClientRect().top + window.scrollY - stickyH - 16;
    window.scrollTo({ top: y, behavior: "smooth" });
    el.focus?.({ preventScroll: true });
  }

  function jumpToFirstMissing(sectionId) {
    const missing = getMissingRequiredFields().filter((m) => m.section === sectionId);
    openAccordionSection(sectionId);

    // Upload + Authors: focus their primary action
    if (sectionId === "upload") {
      focusWithScroll(uploadWithGlobusBtn);
      return;
    }
    if (sectionId === "authors") {
      focusWithScroll(addAuthorBtn);
      return;
    }

    const first = missing[0];
    if (!first) return;
    const el = document.querySelector(`[data-path="${CSS.escape(first.key)}"]`);
    if (el) focusWithScroll(el);
  }

  function openAccordionSection(sectionId) {
    const heading = metaAccordion?.querySelector(`.usa-accordion__heading[data-section="${sectionId}"]`);
    if (!heading) return;
    const btn = heading.querySelector(".usa-accordion__button");
    const controls = btn?.getAttribute("aria-controls");
    const content = controls ? document.getElementById(controls) : null;
    if (!btn || !content) return;

    if (btn.getAttribute("aria-expanded") !== "true") {
      btn.click();
    }
  }

  // Wire chip interactions (click + keyboard)
  document.addEventListener("click", (e) => {
    const t = e.target;
    if (!(t instanceof Element)) return;
    const chip = t.closest("[data-status-for]");
    if (!chip) return;
    const sectionId = chip.getAttribute("data-status-for");
    if (!sectionId) return;
    if (chip.dataset.state === "incomplete") {
      jumpToFirstMissing(sectionId);
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    const t = e.target;
    if (!(t instanceof Element)) return;
    const chip = t.closest("[data-status-for]");
    if (!chip) return;
    const sectionId = chip.getAttribute("data-status-for");
    if (!sectionId) return;
    if (chip.dataset.state === "incomplete") {
      e.preventDefault();
      jumpToFirstMissing(sectionId);
    }
  });

  function scrollToFirstMissingInSection(sectionId) {
    const missing = getMissingRequiredFields().filter((m) => m.section === sectionId);
    if (!missing.length) return;

    openAccordionSection(sectionId);

    // Special cases
    if (sectionId === "upload") {
      uploadWithGlobusBtn?.scrollIntoView({ behavior: "smooth", block: "center" });
      uploadWithGlobusBtn?.focus?.({ preventScroll: true });
      return;
    }
    if (sectionId === "authors") {
      addAuthorBtn?.scrollIntoView({ behavior: "smooth", block: "center" });
      addAuthorBtn?.focus?.({ preventScroll: true });
      return;
    }

    // Find first missing field by data-path
    const first = missing[0];
    const id = makeIdFromPath(first.key);
    const el = document.getElementById(id);
    if (!el) return;

    // Offset for sticky header
    const sticky = document.getElementById("stickyShell");
    const offset = (sticky?.offsetHeight || 0) + 16;
    const y = el.getBoundingClientRect().top + window.scrollY - offset;
    window.scrollTo({ top: y, behavior: "smooth" });
    setTimeout(() => el.focus?.({ preventScroll: true }), 300);
  }

  function wireJumpChips() {
    metaAccordion?.addEventListener("click", (e) => {
      const t = e.target;
      if (!(t instanceof Element)) return;
      const btn = t.closest("button[data-jump]");
      if (!btn) return;
      const sectionId = btn.getAttribute("data-jump");
      if (!sectionId) return;
      scrollToFirstMissingInSection(sectionId);
    });
  }

  // ──────────────────────────────────────────────────────────────
  // Title UI
  // ──────────────────────────────────────────────────────────────
  function updateTitleUI(title) {
    const t = safeTrim(title) || "Untitled Dataset";
    if (pageTitleEl) pageTitleEl.textContent = t;
  }

  // ──────────────────────────────────────────────────────────────
  // Upload demo
  // ──────────────────────────────────────────────────────────────
  function simulateUploadComplete() {
    uploadedFiles = [
      { name: "dataset-files.zip", size: "1.2 GB" },
      { name: "README.md", size: "4 KB" },
    ];

    // Persist to the current record so it survives navigation/reload
    if (currentRecord) {
      currentRecord.uploadedFiles = uploadedFiles;
      saveRecord(currentRecord);
    }

    if (uploadedFilesList) {
      uploadedFilesList.innerHTML = uploadedFiles.map((f) => `<li>${escapeHtml(f.name)} <span class="text-italic text-base">(${escapeHtml(f.size)})</span></li>`).join("");
    }
    if (uploadedPanel) uploadedPanel.hidden = false;
    updateCompletionUI();
  }

  uploadWithGlobusBtn?.addEventListener("click", (e) => {
    // In Review (locked) means no uploads allowed
    if (isRecordLocked()) {
      e.preventDefault();
      return;
    }
    // Let the link open in new tab, but also simulate completion in this demo
    setTimeout(simulateUploadComplete, 450);
  });

  // ──────────────────────────────────────────────────────────────
  // Authors modal (required: First, Last, Affiliation, Email)
  // ──────────────────────────────────────────────────────────────
  function openAuthorModal(mode = "add") {
    if (!modal) return;
    modal.hidden = false;
    modal.setAttribute("aria-hidden", "false");
    if (modalTitle) modalTitle.textContent = mode === "edit" ? "Edit Author" : "Add Author";

    // Focus first field
    setTimeout(() => firstNameEl?.focus?.(), 0);
  }

  function closeAuthorModal() {
    if (!modal) return;
    modal.hidden = true;
    modal.setAttribute("aria-hidden", "true");
    editingIndex = null;
  }

  function clearAuthorForm() {
    if (firstNameEl) firstNameEl.value = "";
    if (middleNameEl) middleNameEl.value = "";
    if (lastNameEl) lastNameEl.value = "";
    if (emailEl) emailEl.value = "";
    if (orcidEl) orcidEl.value = "";
    if (affiliationEl) affiliationEl.value = "";
  }

  function isValidOrcid(orcid) {
    const v = safeTrim(orcid);
    if (!v) return true;
    return /^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/.test(v);
  }

  function validateAuthorForm() {
    const first = safeTrim(firstNameEl?.value);
    const last = safeTrim(lastNameEl?.value);
    const email = safeTrim(emailEl?.value);
    const affiliation = safeTrim(affiliationEl?.value);
    const orcid = safeTrim(orcidEl?.value);

    if (!first || !last || !email || !affiliation) {
      alert("Please fill all required author fields: First Name, Last Name, Institutional Affiliation, Email.");
      return false;
    }
    if (!/^\S+@\S+\.[^\S]+$/.test(email) && !/^\S+@\S+\.\S+$/.test(email)) {
      // Basic email check
      alert("Please enter a valid email address.");
      return false;
    }
    if (!isValidOrcid(orcid)) {
      alert("ORCID iD should look like 0000-0000-0000-0000 (last digit may be X). ");
      return false;
    }
    return true;
  }

  function authorDisplayName(a) {
    const parts = [a.firstName, a.middleName, a.lastName].filter(Boolean);
    return parts.join(" ");
  }

  function renderAuthorsList() {
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

      const emailLine = a.email ? `<small>${escapeHtml(a.email)}</small><br>` : "";
      const orcidLine = a.orcid ? `<small>ORCID: ${escapeHtml(a.orcid)}</small><br>` : "";

      li.innerHTML = `
        <span class="drag-handle" title="Drag to reorder" aria-hidden="true">↕</span>
        <div class="author-info">
          <strong>${escapeHtml(authorDisplayName(a))}</strong><br>
          ${emailLine}
          ${orcidLine}
          <small>${escapeHtml(a.affiliation || "")}</small>
        </div>
        <div class="author-actions">
          <button type="button" class="usa-button usa-button--unstyled" data-action="edit">Edit</button>
          <button type="button" class="usa-button usa-button--unstyled text-secondary" data-action="delete">Delete</button>
        </div>
      `;

      li.querySelector('[data-action="edit"]')?.addEventListener("click", () => {
        editingIndex = index;
        setAuthorFormFrom(index);
        openAuthorModal("edit");
      });
      li.querySelector('[data-action="delete"]')?.addEventListener("click", () => {
        authors.splice(index, 1);
        currentRecord.authors = authors;
        saveRecord(currentRecord);
        renderAuthorsList();
        updateCompletionUI();
      });

      authorsListEl.appendChild(li);
    });

    initAuthorDragAndDrop();
  }

  function initAuthorDragAndDrop() {
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

        currentRecord.authors = authors;
        saveRecord(currentRecord);
        renderAuthorsList();
        updateCompletionUI();
      });

      row.addEventListener("dragend", () => row.classList.remove("dragging"));
    });
  }

  function setAuthorFormFrom(index) {
    const a = authors[index];
    if (!a) return;
    if (firstNameEl) firstNameEl.value = a.firstName || "";
    if (middleNameEl) middleNameEl.value = a.middleName || "";
    if (lastNameEl) lastNameEl.value = a.lastName || "";
    if (emailEl) emailEl.value = a.email || "";
    if (orcidEl) orcidEl.value = a.orcid || "";
    if (affiliationEl) affiliationEl.value = a.affiliation || "";
  }

  function readAuthorForm() {
    return {
      firstName: safeTrim(firstNameEl?.value),
      middleName: safeTrim(middleNameEl?.value),
      lastName: safeTrim(lastNameEl?.value),
      email: safeTrim(emailEl?.value),
      orcid: safeTrim(orcidEl?.value),
      affiliation: safeTrim(affiliationEl?.value),
    };
  }

  addAuthorBtn?.addEventListener("click", () => {
    editingIndex = null;
    clearAuthorForm();
    openAuthorModal("add");
  });

  closeModalBtn?.addEventListener("click", closeAuthorModal);
  cancelFormBtn?.addEventListener("click", closeAuthorModal);

  saveAuthorFormBtn?.addEventListener("click", () => {
    if (!validateAuthorForm()) return;
    const a = readAuthorForm();
    if (editingIndex == null) authors.push(a);
    else authors[editingIndex] = a;
    currentRecord.authors = authors;
    saveRecord(currentRecord);
    renderAuthorsList();
    closeAuthorModal();
    updateCompletionUI();
  });

  saveAddAnotherBtn?.addEventListener("click", () => {
    if (!validateAuthorForm()) return;
    const a = readAuthorForm();
    authors.push(a);
    currentRecord.authors = authors;
    saveRecord(currentRecord);
    renderAuthorsList();
    clearAuthorForm();
    firstNameEl?.focus?.();
    updateCompletionUI();
  });

  // ──────────────────────────────────────────────────────────────
  // Save / preview / submit
  // ──────────────────────────────────────────────────────────────
  function showSaveToast() {
    if (!saveToast) return;
    saveToast.hidden = false;
    setTimeout(() => (saveToast.hidden = true), 1100);
  }

  saveBtn?.addEventListener("click", () => {
    if (!currentRecord) return;
    saveRecord(currentRecord);
    showSaveToast();
  });

  previewBtn?.addEventListener("click", () => {
    if (!currentRecord) return;

    // Persist latest edits before preview
    saveRecord(currentRecord);

    const doi = currentRecord.doi;
    if (!doi) return;

    // Open dataset landing page in a new tab.
    // Always use preview=1 from the editor so the dataset page shows the Preview banner.
    const href = `/src/pages/dataset/index.html?doi=${encodeURIComponent(doi)}&preview=1`;
    window.open(href, "_blank", "noopener");
  });

  submitBtn?.addEventListener("click", () => {
    if (!currentRecord) return;
    if (getMissingRequiredFields().length) return;
    currentRecord.status = "In Review";
    saveRecord(currentRecord);
    setStatusChip(currentRecord.status);
    applyLockedUI();
  });

  // ──────────────────────────────────────────────────────────────
  // Init
  // ──────────────────────────────────────────────────────────────
  function init() {
    renderAllSchemaSections();

    // Load record from DOI query param, else create a new draft
    const doi = getQueryParam("doi");
    currentRecord = doi ? getRecord(doi) : null;
    if (!currentRecord) currentRecord = createNewDraft("Untitled Dataset");

    uploadedFiles = Array.isArray(currentRecord.uploadedFiles) ? currentRecord.uploadedFiles : [];
    authors = Array.isArray(currentRecord.authors) ? currentRecord.authors : [];

    // Hydrate UI
    hydrateFieldsFromRecord();
    buildKeywordSuggestionsFromStore();
    renderAuthorsList();

    updateTitleUI(currentRecord.title);
    setStatusChip(currentRecord.status || "Draft");
    if (startedOnDateEl) startedOnDateEl.textContent = formatShortDate(currentRecord.createdAt);

    // Wire listeners after DOM exists
    bindSchemaFieldListeners();
    wireJumpChips();

    // Upload demo UI hydrate
    if (Array.isArray(uploadedFiles) && uploadedFiles.length) {
      if (uploadedFilesList) {
        uploadedFilesList.innerHTML = uploadedFiles
          .map((f) => `<li>${escapeHtml(f.name || "file")} <span class="text-italic text-base">(${escapeHtml(f.size || "")})</span></li>`)
          .join("");
      }
      if (uploadedPanel) uploadedPanel.hidden = false;
    }

    updateCompletionUI();
    applyLockedUI();
  }

  init();
})();
