// editor.js — Schema-driven metadata editor

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
  KEYWORD_SUGGESTIONS,
} from "/src/assets/js/metadata-schema.js";

(() => {
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

  function formatShortDateTime(iso) {
    try {
      const d = new Date(iso);
      return d.toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
    } catch (_) {
      return "";
    }
  }

  function getQueryParam(name) {
    const u = new URL(window.location.href);
    return u.searchParams.get(name);
  }

  // DOM refs
  const pageTitleEl = $("pageTitle");
  const titleEditingEl = $("titleEditing");
  const startedOnDateEl = $("startedOnDate");

  const previewBtn = $("previewBtn");
  const submitBtn = $("submitBtn");
  const saveBtn = $("saveBtn");
  const saveToast = $("saveToast");
  const requiredRemainingEl = $("requiredRemaining");
  const lockBanner = $("lockBanner");

  // Submitter request panel + modal
  const curRequestPanel = $("curRequestPanel");
  const curViewHistoryBtn = $("curViewHistoryBtn");
  const curHistoryCountEl = $("curHistoryCount");
  const curLatestMsgEl = $("curLatestMsg");
  const curLatestMetaEl = $("curLatestMeta");

  const reqHistoryModal = $("reqHistoryModal");
  const reqHistDatasetTitle = $("reqHistDatasetTitle");
  const reqHistDatasetDoi = $("reqHistDatasetDoi");
  const reqHistEmpty = $("reqHistEmpty");
  const reqHistList = $("reqHistList");

  // Curator drawer + controls
  const curatorReviewBtn = $("curatorReviewBtn");
  const curatorDrawer = $("curatorDrawer");
  const curDrawerStatusChip = $("curDrawerStatusChip");

  const curDrawerToggleHistoryBtn = $("curDrawerToggleHistoryBtn");
  const curDrawerHistoryWrap = $("curDrawerHistoryWrap");
  const curDrawerHistoryCount = $("curDrawerHistoryCount");
  const curDrawerLatestMsg = $("curDrawerLatestMsg");
  const curDrawerLatestMeta = $("curDrawerLatestMeta");
  const curDrawerHistEmpty = $("curDrawerHistEmpty");
  const curDrawerHistList = $("curDrawerHistList");

  const curatorNoteEl = $("curatorNote");
  const requestUpdatesBtn = $("requestUpdatesBtn");
  const publishBtn = $("publishBtn");

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
  const cancelFormBtn = $("cancelForm");
  const saveAuthorFormBtn = $("saveAuthorForm");
  const saveAddAnotherBtn = $("saveAddAnother");
  const firstNameEl = $("firstName");
  const middleNameEl = $("middleName");
  const lastNameEl = $("lastName");
  const emailEl = $("email");
  const orcidEl = $("orcid");
  const affiliationEl = $("affiliationEl") || $("affiliation");

  const metaAccordion = $("metaAccordion");

  let currentRecord = null;
  let uploadedFiles = [];
  let authors = [];
  let editingIndex = null;
  let titleTypingTimer = null;

  function isCuratorRole() {
    const role = window.DatasetPortal?.getRole?.() || "Submitter";
    return role === "Curator" || role === "Admin";
  }

  function isCuratorMode() {
    const flag = String(getQueryParam("curator") || "").trim();
    return (flag === "1" || flag.toLowerCase() === "true") && isCuratorRole();
  }

  function isRecordLocked() {
    const s = String(currentRecord?.status || "").toLowerCase();
    if (s === "published") return true;
    if (s === "in review") return !isCuratorMode();
    return false;
  }

  // ──────────────────────────────────────────────────────────────
  // Required fields remaining banner: animate hide/show when 0
  // Targets ONLY the alert that contains #requiredRemaining
  // ──────────────────────────────────────────────────────────────
  let _requiredAlertEl = null;

  function getRequiredAlertEl() {
    if (_requiredAlertEl) return _requiredAlertEl;
    if (!requiredRemainingEl) return null;

    // Find the closest USWDS alert container for the remaining counter
    const alert = requiredRemainingEl.closest(".usa-alert");
    if (!alert) return null;

    // Add base class once (CSS handles the transition)
    alert.classList.add("editor-required-alert");
    _requiredAlertEl = alert;
    return alert;
  }

  function hideRequiredAlertAnimated() {
    const alert = getRequiredAlertEl();
    if (!alert) return;

    if (alert.classList.contains("is-hidden")) return;

    // Animate out
    alert.classList.add("is-hidden");

    // After transition, fully hide so it doesn't occupy space
    window.setTimeout(() => {
      alert.hidden = true;
      alert.setAttribute("aria-hidden", "true");
    }, 220);
  }

  function showRequiredAlertAnimated() {
    const alert = getRequiredAlertEl();
    if (!alert) return;

    // If it isn't hidden, ensure it's visible and bail
    if (!alert.classList.contains("is-hidden") && alert.hidden === false)
      return;

    alert.hidden = false;
    alert.removeAttribute("aria-hidden");

    // Force reflow so transition plays when removing is-hidden
    // eslint-disable-next-line no-unused-expressions
    alert.offsetHeight;

    alert.classList.remove("is-hidden");
  }

  function syncRequiredAlertVisibility(remaining) {
    // Default: visible unless remaining === 0
    if (remaining === 0) hideRequiredAlertAnimated();
    else showRequiredAlertAnimated();
  }

  // ──────────────────────────────────────────────────────────────
  // Curator drawer open/close (no overlay; allow background interaction)
  // ──────────────────────────────────────────────────────────────
  function openCuratorDrawer() {
    if (!curatorDrawer) return;
    curatorDrawer.hidden = false;
    curatorDrawer.setAttribute("aria-hidden", "false");

    syncDrawerStatusChip();
    renderDrawerHistoryIfOpen();

    const first =
      curatorDrawer.querySelector("[data-cur-drawer-close]") || curatorNoteEl;
    try {
      first?.focus?.();
    } catch (_) {}
  }

  function closeCuratorDrawer() {
    if (!curatorDrawer) return;
    curatorDrawer.hidden = true;
    curatorDrawer.setAttribute("aria-hidden", "true");
  }

  function wireCuratorDrawer() {
    if (!curatorDrawer) return;

    curatorDrawer.querySelectorAll("[data-cur-drawer-close]").forEach((el) => {
      el.addEventListener("click", closeCuratorDrawer);
    });

    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      if (!curatorDrawer || curatorDrawer.hidden) return;
      closeCuratorDrawer();
    });

    curatorReviewBtn?.addEventListener("click", () => {
      if (curatorNoteEl)
        curatorNoteEl.value = String(currentRecord?.curatorNote || "");
      openCuratorDrawer();
    });

    // History toggle inside drawer
    curDrawerToggleHistoryBtn?.addEventListener("click", () => {
      const isOpen = curDrawerHistoryWrap
        ? !curDrawerHistoryWrap.hidden
        : false;
      const nextOpen = !isOpen;

      if (curDrawerHistoryWrap) curDrawerHistoryWrap.hidden = !nextOpen;
      curDrawerToggleHistoryBtn.setAttribute(
        "aria-expanded",
        nextOpen ? "true" : "false",
      );

      if (nextOpen) renderDrawerHistory();
    });
  }

  function syncDrawerStatusChip() {
    if (!curDrawerStatusChip || !currentRecord) return;

    const label = String(currentRecord.status || "Draft");
    const norm = label.toLowerCase().trim();

    let key = "draft";
    if (norm === "in review" || norm === "in-review" || norm === "review")
      key = "in-review";
    else if (norm === "needs updates" || norm === "needs-updates")
      key = "needs-updates";
    else if (norm === "published") key = "published";
    else if (norm === "draft") key = "draft";

    curDrawerStatusChip.textContent = label;
    curDrawerStatusChip.setAttribute("aria-label", `Status: ${label}`);
    curDrawerStatusChip.setAttribute("data-status", key);
  }

  // ──────────────────────────────────────────────────────────────
  // Curator request history helpers
  // ──────────────────────────────────────────────────────────────
  function ensureHistory(rec) {
    if (!rec || typeof rec !== "object") return rec;
    if (!Array.isArray(rec.reviewRequests)) rec.reviewRequests = [];
    return rec;
  }

  function getHistory(rec) {
    return Array.isArray(rec?.reviewRequests) ? rec.reviewRequests : [];
  }

  function getLatestRequest(rec) {
    const h = getHistory(rec);
    return h.length ? h[0] : null;
  }

  // Submitter modal open/close
  function openReqModal() {
    if (!reqHistoryModal) return;
    reqHistoryModal.hidden = false;
    document.body.style.overflow = "hidden";
    const focusEl =
      reqHistoryModal.querySelector("[data-req-close]") || reqHistoryModal;
    try {
      focusEl?.focus?.();
    } catch (_) {}
  }

  function closeReqModal() {
    if (!reqHistoryModal) return;
    reqHistoryModal.hidden = true;
    document.body.style.overflow = "";
  }

  function wireReqModalClose() {
    if (!reqHistoryModal) return;

    reqHistoryModal.querySelectorAll("[data-req-close]").forEach((el) => {
      el.addEventListener("click", closeReqModal);
    });

    document.addEventListener("keydown", (e) => {
      if (
        e.key === "Escape" &&
        reqHistoryModal &&
        reqHistoryModal.hidden === false
      ) {
        closeReqModal();
      }
    });
  }

  function renderRequestPanel() {
    // Submitter panel
    if (curRequestPanel) {
      if (!currentRecord) {
        curRequestPanel.hidden = true;
      } else {
        ensureHistory(currentRecord);

        const history = getHistory(currentRecord);
        const latest = getLatestRequest(currentRecord);

        const statusNorm = String(currentRecord.status || "").toLowerCase();
        const legacyNote = safeTrim(currentRecord.curatorNote);
        const shouldShow =
          history.length > 0 || !!legacyNote || statusNorm === "needs updates";

        if (!shouldShow) {
          curRequestPanel.hidden = true;
        } else {
          curRequestPanel.hidden = false;

          if (curHistoryCountEl)
            curHistoryCountEl.textContent = String(history.length || 0);

          const msg = latest?.message
            ? String(latest.message)
            : legacyNote || "—";
          if (curLatestMsgEl) curLatestMsgEl.textContent = msg;

          const when = latest?.createdAt
            ? formatShortDateTime(latest.createdAt)
            : "";
          const meta = when
            ? `Most recent request: ${when}`
            : legacyNote
              ? "Most recent request: (legacy note)"
              : "";
          if (curLatestMetaEl) curLatestMetaEl.textContent = meta || "—";

          if (curViewHistoryBtn)
            curViewHistoryBtn.hidden = history.length === 0;
        }
      }
    }

    // Drawer latest + count
    if (currentRecord) {
      ensureHistory(currentRecord);
      const history = getHistory(currentRecord);
      const latest = getLatestRequest(currentRecord);
      const legacyNote = safeTrim(currentRecord.curatorNote);

      if (curDrawerHistoryCount)
        curDrawerHistoryCount.textContent = String(history.length || 0);

      const msg = latest?.message ? String(latest.message) : legacyNote || "—";
      if (curDrawerLatestMsg) curDrawerLatestMsg.textContent = msg;

      const when = latest?.createdAt
        ? formatShortDateTime(latest.createdAt)
        : "";
      const meta = when
        ? `Most recent request: ${when}`
        : legacyNote
          ? "Most recent request: (legacy note)"
          : "";
      if (curDrawerLatestMeta) curDrawerLatestMeta.textContent = meta || "—";

      // If drawer history is open, refresh it
      renderDrawerHistoryIfOpen();
    }
  }

  function renderRequestHistoryModal() {
    if (!currentRecord || !reqHistList) return;

    ensureHistory(currentRecord);
    const history = getHistory(currentRecord);

    if (reqHistDatasetTitle)
      reqHistDatasetTitle.textContent = String(
        currentRecord.title || "Untitled Dataset",
      );
    if (reqHistDatasetDoi)
      reqHistDatasetDoi.textContent = String(currentRecord.doi || "");

    if (reqHistEmpty) reqHistEmpty.hidden = history.length !== 0;

    reqHistList.innerHTML = history
      .map((h) => {
        const when = formatShortDateTime(h.createdAt);
        return `
        <article class="req-hist__item">
          <div class="req-hist__top">
            <div class="req-hist__label">
              <i class="fa-solid fa-rotate-left" aria-hidden="true"></i>
              Request updates
            </div>
            <div class="req-hist__when">${escapeHtml(when)}</div>
          </div>
          <div class="req-hist__msg">${escapeHtml(h.message || "")}</div>
        </article>
      `;
      })
      .join("");
  }

  function renderDrawerHistoryIfOpen() {
    if (!curDrawerHistoryWrap) return;
    if (curDrawerHistoryWrap.hidden) return;
    renderDrawerHistory();
  }

  function renderDrawerHistory() {
    if (!currentRecord || !curDrawerHistList) return;
    ensureHistory(currentRecord);
    const history = getHistory(currentRecord);

    if (curDrawerHistEmpty) curDrawerHistEmpty.hidden = history.length !== 0;

    curDrawerHistList.innerHTML = history
      .map((h) => {
        const when = formatShortDateTime(h.createdAt);
        return `
          <article class="cur-drawer__histItem">
            <div class="cur-drawer__histTop">
              <strong>Request updates</strong>
              <div class="cur-drawer__histWhen">${escapeHtml(when)}</div>
            </div>
            <div class="cur-drawer__histMsg">${escapeHtml(h.message || "")}</div>
          </article>
        `;
      })
      .join("");
  }

  // ──────────────────────────────────────────────────────────────
  // UI gates
  // ──────────────────────────────────────────────────────────────
  function showCuratorReviewIfNeeded() {
    if (!curatorReviewBtn) return;
    const s = String(currentRecord?.status || "").toLowerCase();
    const show =
      isCuratorMode() && (s === "in review" || s === "needs updates");
    curatorReviewBtn.hidden = !show;
    curatorReviewBtn.setAttribute("aria-hidden", show ? "false" : "true");
  }

  function setStatusChip(status) {
    if (!statusChipEl) return;
    const label = status || "Draft";
    const norm = String(label).toLowerCase().trim();

    let key = "draft";
    if (norm === "in review" || norm === "in-review" || norm === "review")
      key = "in-review";
    else if (norm === "needs updates" || norm === "needs-updates")
      key = "needs-updates";
    else if (norm === "published") key = "published";
    else if (norm === "draft") key = "draft";

    statusChipEl.textContent = label;
    statusChipEl.setAttribute("aria-label", `Status: ${label}`);
    statusChipEl.setAttribute("data-status", key);

    syncDrawerStatusChip();
  }

  function applyLockedUI() {
    const locked = isRecordLocked();

    if (lockBanner) {
      lockBanner.hidden = !locked;
      if (locked) {
        const heading = lockBanner.querySelector(".usa-alert__heading");
        if (heading) heading.textContent = currentRecord?.status || "In Review";
      }
    }

    if (saveBtn) saveBtn.disabled = locked;
    if (submitBtn) {
      if (locked) {
        submitBtn.disabled = true;
        submitBtn.setAttribute("aria-disabled", "true");
      } else {
        const remaining = getMissingRequiredFields().length;
        submitBtn.disabled = remaining !== 0;
        submitBtn.setAttribute(
          "aria-disabled",
          remaining !== 0 ? "true" : "false",
        );
      }
    }

    const panels = Array.from(
      document.querySelectorAll("[data-section-content]"),
    );
    panels.forEach((panel) => {
      const controls = Array.from(
        panel.querySelectorAll("input, select, textarea, button"),
      );
      controls.forEach((el) => {
        if (locked) {
          el.disabled = true;
          el.setAttribute("aria-disabled", "true");
        } else {
          el.disabled = false;
          el.removeAttribute("aria-disabled");
        }
      });
    });

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

    if (locked) {
      try {
        modal?.setAttribute("hidden", "");
      } catch (_) {}
    }

    showCuratorReviewIfNeeded();
    renderRequestPanel();
  }

  // ──────────────────────────────────────────────────────────────
  // Schema rendering
  // ──────────────────────────────────────────────────────────────
  function makeIdFromPath(path) {
    return String(path)
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function renderField(field, sectionId) {
    const id = makeIdFromPath(field.key);
    const requiredStar = field.required
      ? ' <span class="required-star" aria-hidden="true">*</span>'
      : "";
    const requiredAttrs = field.required ? "required data-required" : "";
    const hintHtml = field.hint
      ? `<div class="usa-hint">${escapeHtml(field.hint)}</div>`
      : "";

    const conditionalAttr =
      sectionId === "related" ? 'data-conditional="related"' : "";

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
      const opts = (Array.isArray(field.options) ? field.options : [])
        .map((o) => {
          if (typeof o === "string")
            return `<option value="${escapeHtml(o)}">${escapeHtml(o)}</option>`;
          return `<option value="${escapeHtml(o.value)}">${escapeHtml(o.label)}</option>`;
        })
        .join("");

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
      const opts = (Array.isArray(field.options) ? field.options : [])
        .map((o) => {
          return `<option value="${escapeHtml(o)}">${escapeHtml(o)}</option>`;
        })
        .join("");

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

    container.innerHTML = section.fields
      .map((f) => renderField(f, sectionId))
      .join("");

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

  function buildKeywordSuggestionsFromStore() {
    const dl = document.getElementById("keywordsDatalist");
    if (!dl) return;

    const all = getAllRecords();
    const set = new Set(
      (Array.isArray(KEYWORD_SUGGESTIONS) ? KEYWORD_SUGGESTIONS : [])
        .map((k) => safeTrim(k))
        .filter(Boolean),
    );
    all.forEach((r) => {
      (Array.isArray(r.keywords) ? r.keywords : []).forEach((k) => {
        const v = safeTrim(k);
        if (v) set.add(v);
      });
    });

    const sorted = Array.from(set).sort((a, b) => a.localeCompare(b));
    dl.innerHTML = sorted
      .map((k) => `<option value="${escapeHtml(k)}"></option>`)
      .join("");
  }

  function readFieldValue(fieldEl) {
    const path = fieldEl.getAttribute("data-path");
    if (!path) return null;

    if (fieldEl.tagName === "SELECT" && fieldEl.multiple) {
      return Array.from(fieldEl.selectedOptions).map((o) => o.value);
    }

    if (path === "keywords") {
      return parseCommaList(fieldEl.value);
    }

    return fieldEl.value;
  }

  function writeFieldValue(fieldEl, value) {
    const path = fieldEl.getAttribute("data-path");
    if (!path) return;

    if (fieldEl.tagName === "SELECT" && fieldEl.multiple) {
      const set = new Set(
        (Array.isArray(value) ? value : [])
          .map((v) => safeTrim(v))
          .filter(Boolean),
      );
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

  function isRelatedConditionalActive() {
    const section = getSchemaSection("related");
    const keys = section?.conditionalRequired?.keys || [];
    return keys.some((k) => safeTrim(getPath(currentRecord, k)));
  }

  function getMissingRequiredFields() {
    const missing = [];

    const schemaFields = getAllSchemaFields();
    schemaFields.forEach((f) => {
      if (f.section === "related") return;
      if (!f.required) return;

      const v = getPath(currentRecord, f.key);
      const empty = Array.isArray(v) ? v.length === 0 : !safeTrim(v);
      if (empty) missing.push({ section: f.section, key: f.key });
    });

    if (!Array.isArray(uploadedFiles) || uploadedFiles.length < 1) {
      missing.push({ section: "upload", key: "uploadedFiles" });
    }

    if (!Array.isArray(authors) || authors.length < 1) {
      missing.push({ section: "authors", key: "authors" });
    }

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

    if (isOptional) {
      if (
        sectionId === "related" &&
        isRelatedConditionalActive() &&
        missingCount > 0
      ) {
        chip.dataset.state = "incomplete";
        chip.textContent = `Missing: ${missingCount}`;
        chip.style.cursor = "pointer";
        chip.setAttribute("role", "button");
        chip.setAttribute("tabindex", "0");
        chip.setAttribute(
          "aria-label",
          `Jump to first missing required field in ${sectionId}`,
        );
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
      chip.setAttribute(
        "aria-label",
        `Jump to first missing required field in ${sectionId}`,
      );
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

    if (requiredRemainingEl)
      requiredRemainingEl.textContent = String(remaining);

    // NEW: animate the required-fields info alert in/out based on remaining count
    syncRequiredAlertVisibility(remaining);

    if (submitBtn) {
      submitBtn.disabled = remaining !== 0;
      submitBtn.setAttribute(
        "aria-disabled",
        remaining !== 0 ? "true" : "false",
      );
    }

    METADATA_SCHEMA.forEach((s) => {
      const sectionMissing = missing.filter((m) => m.section === s.id).length;
      setSectionStatus(s.id, sectionMissing);
    });

    if (uploadRequiredAlert) {
      uploadRequiredAlert.hidden =
        Array.isArray(uploadedFiles) && uploadedFiles.length > 0;
    }
  }

  function focusWithScroll(el) {
    if (!el) return;
    const stickyH =
      document.getElementById("stickyShell")?.getBoundingClientRect().height ||
      0;
    const y = el.getBoundingClientRect().top + window.scrollY - stickyH - 16;
    window.scrollTo({ top: y, behavior: "smooth" });
    el.focus?.({ preventScroll: true });
  }

  function jumpToFirstMissing(sectionId) {
    const missing = getMissingRequiredFields().filter(
      (m) => m.section === sectionId,
    );
    openAccordionSection(sectionId);

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
    const heading = metaAccordion?.querySelector(
      `.usa-accordion__heading[data-section="${sectionId}"]`,
    );
    if (!heading) return;
    const btn = heading.querySelector(".usa-accordion__button");
    const controls = btn?.getAttribute("aria-controls");
    const content = controls ? document.getElementById(controls) : null;
    if (!btn || !content) return;

    if (btn.getAttribute("aria-expanded") !== "true") {
      btn.click();
    }
  }

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

  function updateTitleUI(title) {
    const t = safeTrim(title) || "Untitled Dataset";
    if (pageTitleEl) pageTitleEl.textContent = t;
  }

  function simulateUploadComplete() {
    uploadedFiles = [
      { name: "dataset-files.zip", size: "1.2 GB" },
      { name: "README.md", size: "4 KB" },
    ];

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
    if (isRecordLocked()) {
      e.preventDefault();
      return;
    }
    setTimeout(simulateUploadComplete, 450);
  });

  function openAuthorModal(mode = "add") {
    if (!modal) return;
    modal.hidden = false;
    modal.setAttribute("aria-hidden", "false");
    if (modalTitle)
      modalTitle.textContent = mode === "edit" ? "Edit Author" : "Add Author";
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

    saveRecord(currentRecord);

    const doi = currentRecord.doi;
    if (!doi) return;

    const href = `/src/pages/dataset/index.html?doi=${encodeURIComponent(doi)}&preview=1`;
    window.open(href, "_blank", "noopener");
  });

  submitBtn?.addEventListener("click", () => {
    if (!currentRecord) return;
    if (getMissingRequiredFields().length) return;
    currentRecord.status = "In Review";

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

  // Curator actions
  requestUpdatesBtn?.addEventListener("click", () => {
    if (!currentRecord) return;
    if (!isCuratorMode()) return;

    const note = String(curatorNoteEl?.value || "").trim();
    const noteSnippet = note.replace(/\s+/g, " ").trim();
    const noteShort = noteSnippet.length > 280 ? noteSnippet.slice(0, 280) + "…" : noteSnippet;
    const noteBlock = noteShort ? `\n\nCurator note:\n${noteShort}` : "";

    if (!note) {
      alert("Please enter a curator note before requesting updates.");
      curatorNoteEl?.focus?.();
      return;
    }

    ensureHistory(currentRecord);

    const entry = {
      id: `req_${Date.now()}_${Math.random().toString(16).slice(2)}`,
      type: "request_updates",
      createdAt: new Date().toISOString(),
      createdByRole: window.DatasetPortal?.getRole?.() || "Curator",
      createdByName: "Curator",
      message: note,
      flags: [],
    };

    currentRecord.reviewRequests.unshift(entry);
    currentRecord.curatorNote = note; // legacy convenience

    currentRecord.status = "Needs Updates";
    saveRecord(currentRecord);

    // Notify submitter (in-app)
    try {
      const toEmail = String(currentRecord.submitterEmail || "").trim().toLowerCase();
      window.DatasetPortal?.notifications?.add?.({
        toRole: "Submitter",
        toEmail,
        title: "Curator requested updates",
        message: `Updates were requested for “${currentRecord.title || "a dataset"}”.${noteBlock}`,
        href: `/src/pages/editor/index.html?doi=${encodeURIComponent(currentRecord.doi || "")}`,
        recordDoi: currentRecord.doi,
        kind: "needs-updates",
      });
    } catch (_) {}

    setStatusChip(currentRecord.status);
    applyLockedUI();
  });

  publishBtn?.addEventListener("click", () => {
    if (!currentRecord) return;
    if (!isCuratorMode()) return;
    const note = String(curatorNoteEl?.value || "").trim();
    if (note) currentRecord.curatorNote = note;
    currentRecord.status = "Published";
    saveRecord(currentRecord);

    // Notify submitter (in-app)
    try {
      const toEmail = String(currentRecord.submitterEmail || "").trim().toLowerCase();
      window.DatasetPortal?.notifications?.add?.({
        toRole: "Submitter",
        toEmail,
        title: "Dataset published",
        message: `“${currentRecord.title || "Your dataset"}” was published.`,
        href: `/src/pages/dataset/index.html?doi=${encodeURIComponent(currentRecord.doi || "")}`,
        recordDoi: currentRecord.doi,
        kind: "published",
      });
    } catch (_) {}

    setStatusChip(currentRecord.status);
    applyLockedUI();
    closeCuratorDrawer();
  });

  // Init
  function init() {
    renderAllSchemaSections();

    const doi = getQueryParam("doi");
    currentRecord = doi ? getRecord(doi) : null;
    if (!currentRecord) currentRecord = createNewDraft("Untitled Dataset");

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

    hydrateFieldsFromRecord();
    buildKeywordSuggestionsFromStore();
    renderAuthorsList();

    updateTitleUI(currentRecord.title);
    setStatusChip(currentRecord.status || "Draft");
    if (startedOnDateEl)
      startedOnDateEl.textContent = formatShortDate(currentRecord.createdAt);

    bindSchemaFieldListeners();

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

    wireReqModalClose();
    curViewHistoryBtn?.addEventListener("click", () => {
      renderRequestHistoryModal();
      openReqModal();
    });

    // IMPORTANT: curator drawer wiring stays intact (this is what was lost before)
    wireCuratorDrawer();

    updateCompletionUI();
    applyLockedUI();
  }

  init();
})();
