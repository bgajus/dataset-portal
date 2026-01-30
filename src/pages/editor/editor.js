// editor.js — Schema-driven metadata editor
// Uses METADATA_SCHEMA as the single source of truth for sections/fields/required rules.

import {
  getRecord,
  saveRecord,
  createNewDraft,
  getAllRecords,
} from "/src/assets/js/shared-store.js";
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
    return String(str ?? "").replace(
      /[&<>"']/g,
      (s) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[s],
    );
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
    return d.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
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

  // Curator review panel (demo)
  const curatorPanel = $("curatorPanel");
  const curatorNoteEl = $("curatorNote");
  const requestUpdatesBtn = $("requestUpdatesBtn");
  const publishBtn = $("publishBtn");

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
  helpBtn?.addEventListener("click", () =>
    alert("Help (demo) — link this to docs or a support panel."),
  );

  // Authors (special)
  const authorsListEl = $("authors-list");
  const addAuthorBtn = $("add-author-btn");
  const modal = $("author-modal");
  const modalTitle = $("modal-title");
  const closeModalBtn = modal?.querySelector(".modal-close");

  // ✅ Backward-compatible IDs (older editor used generic field ids; newer editor may use author-prefixed ids)
  const cancelFormBtn = $("authorCancelBtn") || $("cancelForm");
  const saveAuthorFormBtn = $("authorSaveBtn") || $("saveAuthorForm");
  const saveAddAnotherBtn = $("authorSaveAddAnotherBtn") || $("saveAddAnother");

  const firstNameEl = $("authorFirstName") || $("firstName");
  const middleNameEl = $("authorMiddleName") || $("middleName");
  const lastNameEl = $("authorLastName") || $("lastName");
  const emailEl = $("authorEmail") || $("email");
  const orcidEl = $("authorOrcid") || $("orcid");
  const affiliationEl = $("authorAffiliation") || $("affiliation");

  // Accordion
  const metaAccordion = $("metaAccordion");

  let currentRecord = null;
  let uploadedFiles = [];
  let authors = [];

  let editingIndex = null;

  // ──────────────────────────────────────────────────────────────
  // Role / mode
  // ──────────────────────────────────────────────────────────────
  function getRole() {
    return window.DatasetPortal?.getRole?.() || "Submitter";
  }

  function isCuratorMode() {
    // Allows curator preview by query flag or actual role.
    const flag = String(getQueryParam("curator") || "").trim();
    if (flag === "1" || flag.toLowerCase() === "true") return true;
    const r = getRole();
    return r === "Curator" || r === "Admin";
  }

  function isRecordLocked() {
    const s = String(currentRecord?.status || "").toLowerCase();
    return s === "in review" || s === "published";
  }

  // ──────────────────────────────────────────────────────────────
  // Status chip
  // ──────────────────────────────────────────────────────────────
  function setStatusChip(status) {
    if (!statusChipEl) return;
    const s = String(status || "Draft");
    statusChipEl.textContent = s;

    const key =
      s.toLowerCase() === "draft"
        ? "draft"
        : s.toLowerCase() === "in review"
          ? "in-review"
          : s.toLowerCase() === "needs updates"
            ? "needs-updates"
            : s.toLowerCase() === "published"
              ? "published"
              : "draft";

    statusChipEl.setAttribute("data-status", key);
    statusChipEl.setAttribute("aria-label", `Status: ${s}`);
  }

  // ──────────────────────────────────────────────────────────────
  // Schema rendering (existing)
  // ──────────────────────────────────────────────────────────────
  function renderAllSchemaSections() {
    // Description
    if (descriptionFieldsEl) {
      descriptionFieldsEl.innerHTML = renderSectionFields("description");
    }
    // Subjects/Keywords
    if (subjectsFieldsEl) {
      subjectsFieldsEl.innerHTML = renderSectionFields("subjects");
    }
    // Funding
    if (fundingFieldsEl) {
      fundingFieldsEl.innerHTML = renderSectionFields("funding");
    }
    // Related Works
    if (relatedFieldsEl) {
      relatedFieldsEl.innerHTML = renderSectionFields("related");
    }
  }

  function renderSectionFields(sectionKey) {
    const section = getSchemaSection(sectionKey);
    if (!section) return "";

    const fields = section.fields || [];
    return fields.map((f) => renderField(f, sectionKey)).join("");
  }

  function renderField(field, sectionKey) {
    const id = field.id;
    const label = field.label || id;
    const required = !!field.required;
    const hint = field.hint || "";
    const type = field.type || "text";
    const placeholder = field.placeholder || "";

    const requiredStar = required ? `<span class="required-star">*</span>` : "";

    if (type === "textarea") {
      return `
        <div class="margin-top-2">
          <label class="usa-label" for="${escapeHtml(id)}">${escapeHtml(label)}${requiredStar}</label>
          ${hint ? `<span class="usa-hint">${escapeHtml(hint)}</span>` : ""}
          <textarea class="usa-textarea" id="${escapeHtml(id)}" rows="4" placeholder="${escapeHtml(placeholder)}"></textarea>
        </div>
      `;
    }

    if (type === "select" && Array.isArray(field.options)) {
      const options = field.options
        .map(
          (o) =>
            `<option value="${escapeHtml(o.value)}">${escapeHtml(o.label)}</option>`,
        )
        .join("");
      return `
        <div class="margin-top-2">
          <label class="usa-label" for="${escapeHtml(id)}">${escapeHtml(label)}${requiredStar}</label>
          ${hint ? `<span class="usa-hint">${escapeHtml(hint)}</span>` : ""}
          <select class="usa-select" id="${escapeHtml(id)}">
            <option value="">Select…</option>
            ${options}
          </select>
        </div>
      `;
    }

    // Default: input
    return `
      <div class="margin-top-2">
        <label class="usa-label" for="${escapeHtml(id)}">${escapeHtml(label)}${requiredStar}</label>
        ${hint ? `<span class="usa-hint">${escapeHtml(hint)}</span>` : ""}
        <input class="usa-input" id="${escapeHtml(id)}" type="${escapeHtml(type)}" placeholder="${escapeHtml(placeholder)}" />
      </div>
    `;
  }

  // ──────────────────────────────────────────────────────────────
  // Hydration + listeners (existing)
  // ──────────────────────────────────────────────────────────────
  function hydrateFieldsFromRecord() {
    const fields = getAllSchemaFields();
    fields.forEach((f) => {
      const el = $(f.id);
      if (!el) return;

      const value = getPath(currentRecord, f.path);

      // keywords stored as array but editor is comma separated
      if (f.id === "keywords") {
        el.value = joinCommaList(value);
        return;
      }

      if (f.id === "subjects") {
        // multi-select rendering handled elsewhere (if present)
        // If a multi-select exists, set selected options here.
        if (el.tagName === "SELECT" && el.multiple) {
          const arr = Array.isArray(value) ? value : [];
          [...el.options].forEach((opt) => {
            opt.selected = arr.includes(opt.value);
          });
        } else {
          el.value = Array.isArray(value)
            ? value.join(", ")
            : String(value ?? "");
        }
        return;
      }

      if (el.tagName === "SELECT") {
        el.value = String(value ?? "");
      } else {
        el.value = String(value ?? "");
      }
    });
  }

  function bindSchemaFieldListeners() {
    const fields = getAllSchemaFields();
    fields.forEach((f) => {
      const el = $(f.id);
      if (!el) return;

      const handler = () => {
        if (isRecordLocked()) return;

        titleEditingEl && (titleEditingEl.hidden = false);
        setTimeout(() => titleEditingEl && (titleEditingEl.hidden = true), 650);

        let nextVal = el.value;

        if (f.id === "keywords") {
          nextVal = parseCommaList(nextVal);
        }

        if (f.id === "subjects") {
          if (el.tagName === "SELECT" && el.multiple) {
            nextVal = [...el.selectedOptions].map((o) => o.value);
          } else {
            nextVal = parseCommaList(nextVal);
          }
        }

        setPath(currentRecord, f.path, nextVal);

        // Update title heading live if title changed
        if (f.path === "title") updateTitleUI(nextVal);

        // Autosave for demo responsiveness
        saveRecord(currentRecord);

        updateCompletionUI();
      };

      el.addEventListener("input", handler);
      el.addEventListener("change", handler);
    });
  }

  // ──────────────────────────────────────────────────────────────
  // Required fields logic (existing)
  // ──────────────────────────────────────────────────────────────
  function isFieldComplete(field) {
    const v = getPath(currentRecord, field.path);

    // Authors required handled separately
    if (field.id === "authors") {
      return Array.isArray(authors) && authors.length > 0;
    }

    if (field.id === "keywords") {
      // optional
      return true;
    }

    if (Array.isArray(v)) return v.length > 0;
    return safeTrim(v).length > 0;
  }

  function getMissingRequiredFields() {
    const fields = getAllSchemaFields().filter((f) => !!f.required);

    const missing = fields.filter((f) => !isFieldComplete(f));

    // Upload required (demo)
    if (!uploadedFiles || uploadedFiles.length === 0) {
      missing.push({ id: "uploadRequired" });
    }

    // Authors required (special)
    if (!authors || authors.length === 0) {
      missing.push({ id: "authorsRequired" });
    }

    return missing;
  }

  function updateCompletionUI() {
    const missing = getMissingRequiredFields();

    if (requiredRemainingEl) {
      requiredRemainingEl.textContent = String(missing.length);
    }

    // Upload alert
    if (uploadRequiredAlert) {
      uploadRequiredAlert.hidden = uploadedFiles && uploadedFiles.length > 0;
    }

    // Submit button enabled only when no missing
    const canSubmit = missing.length === 0 && !isRecordLocked();
    if (submitBtn) {
      submitBtn.disabled = !canSubmit;
      submitBtn.setAttribute("aria-disabled", canSubmit ? "false" : "true");
    }

    // Accordion status bubbles
    document.querySelectorAll("[data-status-for]").forEach((el) => {
      const key = el.getAttribute("data-status-for");
      if (!key) return;

      // Basic completion mapping for our section keys
      let complete = true;

      if (key === "upload")
        complete = uploadedFiles && uploadedFiles.length > 0;
      if (key === "authors") complete = authors && authors.length > 0;

      const section = getSchemaSection(key);
      if (section && Array.isArray(section.fields)) {
        // required fields only
        const requiredFields = section.fields.filter((f) => !!f.required);
        complete = requiredFields.every((f) => isFieldComplete(f));
      }

      el.textContent = complete ? "Complete" : "Incomplete";
      el.classList.toggle("is-complete", complete);
      el.classList.toggle("is-incomplete", !complete);
    });
  }

  function applyLockedUI() {
    const locked = isRecordLocked();
    if (lockBanner) lockBanner.hidden = !locked;

    // disable inputs/selects/textarea in the accordion when locked
    document
      .querySelectorAll(
        ".usa-accordion__content input, .usa-accordion__content select, .usa-accordion__content textarea, .usa-accordion__content button",
      )
      .forEach((el) => {
        // still allow accordion toggle buttons (outside content), modal close, and preview/save buttons
        const id = el.id || "";
        const allow =
          id === "previewBtn" ||
          id === "saveBtn" ||
          id === "helpBtn" ||
          id === "submitBtn" ||
          el.classList.contains("usa-accordion__button") ||
          el.classList.contains("modal-close") ||
          el.closest("#author-modal");

        if (allow) return;

        if (el.tagName === "BUTTON" || el.tagName === "A") {
          el.toggleAttribute("disabled", locked);
          el.setAttribute("aria-disabled", locked ? "true" : "false");
        } else {
          el.toggleAttribute("disabled", locked);
          el.setAttribute("aria-disabled", locked ? "true" : "false");
        }
      });

    // Curator panel only for curator mode
    if (curatorPanel) {
      curatorPanel.hidden = !isCuratorMode();
      if (isCuratorMode() && curatorNoteEl)
        curatorNoteEl.value = String(currentRecord?.curatorNote || "");
    }
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
      uploadedFilesList.innerHTML = uploadedFiles
        .map(
          (f) =>
            `<li>${escapeHtml(f.name)} <span class="text-italic text-base">(${escapeHtml(f.size)})</span></li>`,
        )
        .join("");
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

    // Support either <dialog> or a simple div[hidden] modal.
    if (modal.tagName === "DIALOG" && typeof modal.showModal === "function") {
      if (!modal.open) modal.showModal();
    } else {
      modal.hidden = false;
      modal.setAttribute("aria-hidden", "false");
    }

    if (modalTitle)
      modalTitle.textContent = mode === "edit" ? "Edit Author" : "Add Author";

    // Focus first field
    setTimeout(() => firstNameEl?.focus?.(), 0);
  }

  function closeAuthorModal() {
    if (!modal) return;

    if (modal.tagName === "DIALOG" && typeof modal.close === "function") {
      if (modal.open) modal.close();
    } else {
      modal.hidden = true;
      modal.setAttribute("aria-hidden", "true");
    }

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
      alert(
        "Please fill all required author fields: First Name, Last Name, Institutional Affiliation, Email.",
      );
      return false;
    }
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      alert("Please enter a valid email address.");
      return false;
    }
    if (!isValidOrcid(orcid)) {
      alert(
        "ORCID iD should look like 0000-0000-0000-0000 (last digit may be X). ",
      );
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

      const emailLine = a.email
        ? `<small>${escapeHtml(a.email)}</small><br>`
        : "";
      const orcidLine = a.orcid
        ? `<small>ORCID: ${escapeHtml(a.orcid)}</small><br>`
        : "";

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

      li.querySelector('[data-action="edit"]')?.addEventListener(
        "click",
        () => {
          editingIndex = index;
          setAuthorFormFrom(index);
          openAuthorModal("edit");
        },
      );
      li.querySelector('[data-action="delete"]')?.addEventListener(
        "click",
        () => {
          authors.splice(index, 1);
          currentRecord.authors = authors;
          saveRecord(currentRecord);
          renderAuthorsList();
          updateCompletionUI();
        },
      );

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

        const siblings = [
          ...authorsListEl.querySelectorAll(".author-row:not(.dragging)"),
        ];
        const nextSibling = siblings.find(
          (sibling) =>
            e.clientY <= sibling.offsetTop + sibling.offsetHeight / 2,
        );
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
    if (isRecordLocked()) return;
    editingIndex = null;
    clearAuthorForm();
    openAuthorModal("add");
  });

  closeModalBtn?.addEventListener("click", closeAuthorModal);
  cancelFormBtn?.addEventListener("click", closeAuthorModal);

  saveAuthorFormBtn?.addEventListener("click", () => {
    if (isRecordLocked()) return;
    if (!validateAuthorForm()) return;
    const a = readAuthorForm();
    if (editingIndex == null) authors.push(a);
    else authors[editingIndex] = a;

    currentRecord.authors = authors;
    saveRecord(currentRecord); // ✅ ensures preview reflects immediately

    renderAuthorsList();
    closeAuthorModal();
    updateCompletionUI();
  });

  saveAddAnotherBtn?.addEventListener("click", () => {
    if (isRecordLocked()) return;
    if (!validateAuthorForm()) return;
    const a = readAuthorForm();
    authors.push(a);

    currentRecord.authors = authors;
    saveRecord(currentRecord); // ✅ ensures preview reflects immediately

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

    // Ensure submitter attribution exists (used by curator workflow / notifications)
    if (!currentRecord.submitterEmail || !currentRecord.submitterName) {
      const p = window.DatasetPortal?.getUserProfile?.() || {};
      const name =
        `${String(p.firstName || "").trim()} ${String(p.lastName || "").trim()}`.trim();
      currentRecord.submitterName = currentRecord.submitterName || name;
      currentRecord.submitterEmail =
        currentRecord.submitterEmail || String(p.email || "").trim();
    }

    saveRecord(currentRecord);
    setStatusChip(currentRecord.status);
    applyLockedUI();

    // Notify curators (demo)
    try {
      window.DatasetPortal?.notifications?.add?.({
        toRole: "Curator",
        title: "Dataset submitted for review",
        message: `${currentRecord.title || "A dataset"} was submitted and is ready for curator review.`,
        href: `/src/pages/curation/index.html`,
        recordDoi: currentRecord.doi,
        kind: "review",
      });
    } catch (_) {}
  });

  // Curator actions (demo)
  requestUpdatesBtn?.addEventListener("click", () => {
    if (!currentRecord) return;
    if (!isCuratorMode()) return;
    const note = String(curatorNoteEl?.value || "").trim();
    if (note) currentRecord.curatorNote = note;
    currentRecord.status = "Needs Updates";
    saveRecord(currentRecord);
    setStatusChip(currentRecord.status);
    applyLockedUI();

    try {
      window.DatasetPortal?.notifications?.add?.({
        toRole: "Submitter",
        toEmail: String(currentRecord.submitterEmail || "").trim(),
        title: "Changes requested",
        message: note
          ? `Curator note: ${note}`
          : "A curator requested changes to your submitted dataset.",
        href: `/src/pages/editor/index.html?doi=${encodeURIComponent(currentRecord.doi || "")}`,
        recordDoi: currentRecord.doi,
        kind: "updates",
      });
    } catch (_) {}
  });

  publishBtn?.addEventListener("click", () => {
    if (!currentRecord) return;
    if (!isCuratorMode()) return;
    const note = String(curatorNoteEl?.value || "").trim();
    if (note) currentRecord.curatorNote = note;
    currentRecord.status = "Published";
    saveRecord(currentRecord);
    setStatusChip(currentRecord.status);
    applyLockedUI();

    try {
      window.DatasetPortal?.notifications?.add?.({
        toRole: "Submitter",
        toEmail: String(currentRecord.submitterEmail || "").trim(),
        title: "Dataset published",
        message: note
          ? `Curator note: ${note}`
          : "Your dataset has been published.",
        href: `/src/pages/dataset/index.html?doi=${encodeURIComponent(currentRecord.doi || "")}`,
        recordDoi: currentRecord.doi,
        kind: "publish",
      });
    } catch (_) {}
  });

  // ──────────────────────────────────────────────────────────────
  // Misc: keyword suggestions (existing)
  // ──────────────────────────────────────────────────────────────
  function buildKeywordSuggestionsFromStore() {
    // noop placeholder (kept from earlier versions)
    // You likely have this implemented elsewhere in the project.
    return KEYWORD_SUGGESTIONS;
  }

  function wireJumpChips() {
    // noop placeholder (kept from earlier versions)
  }

  // ──────────────────────────────────────────────────────────────
  // Init
  // ──────────────────────────────────────────────────────────────
  function init() {
    renderAllSchemaSections();

    // Load record from DOI query param, else create a new draft
    const doi = getQueryParam("doi");
    currentRecord = doi ? getRecord(doi) : null;
    if (!currentRecord) currentRecord = createNewDraft("Untitled Dataset");

    // Capture submitter attribution early (demo)
    if (!currentRecord.submitterEmail || !currentRecord.submitterName) {
      const p = window.DatasetPortal?.getUserProfile?.() || {};
      const name =
        `${String(p.firstName || "").trim()} ${String(p.lastName || "").trim()}`.trim();
      currentRecord.submitterName = currentRecord.submitterName || name;
      currentRecord.submitterEmail =
        currentRecord.submitterEmail || String(p.email || "").trim();
    }

    uploadedFiles = Array.isArray(currentRecord.uploadedFiles)
      ? currentRecord.uploadedFiles
      : [];
    authors = Array.isArray(currentRecord.authors) ? currentRecord.authors : [];

    // Hydrate UI
    hydrateFieldsFromRecord();
    buildKeywordSuggestionsFromStore();
    renderAuthorsList();

    updateTitleUI(currentRecord.title);
    setStatusChip(currentRecord.status || "Draft");
    if (startedOnDateEl)
      startedOnDateEl.textContent = formatShortDate(currentRecord.createdAt);

    // Wire listeners after DOM exists
    bindSchemaFieldListeners();
    wireJumpChips();

    // Upload demo UI hydrate
    if (Array.isArray(uploadedFiles) && uploadedFiles.length) {
      if (uploadedFilesList) {
        uploadedFilesList.innerHTML = uploadedFiles
          .map(
            (f) =>
              `<li>${escapeHtml(f.name || "file")} <span class="text-italic text-base">(${escapeHtml(f.size || "")})</span></li>`,
          )
          .join("");
      }
      if (uploadedPanel) uploadedPanel.hidden = false;
    }

    updateCompletionUI();
    applyLockedUI();
  }

  init();
})();
