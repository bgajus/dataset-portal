// dashboard.js - Updated to use shared client-side record store

import { createNewDraft, getAllRecords } from "/src/assets/js/shared-store.js";

(() => {
  const $ = (id) => document.getElementById(id);

  const els = {
    note: $("dashNote"),
    noteClose: $("dashNoteClose"),

    openModal: $("openDoiModal"),
    backdrop: $("doiBackdrop"),
    modal: $("doiModal"),
    closeModal: $("closeDoiModal"),
    cancelModal: $("cancelDoiBtn"),

    stepForm: $("doiStepForm"),
    stepSuccess: $("doiStepSuccess"),
    titleInput: $("doiTitle"),
    reserveBtn: $("reserveDoiBtn"),
    err: $("doiError"),

    // NEW: OLCF radios (optional, frontend-only)
    olcfYes: $("doiOlcfYes"),
    olcfNo: $("doiOlcfNo"),

    reservedValue: $("reservedDoiValue"),
    editLink: $("editRecordLink"),
    returnBtn: $("returnToDashBtn"),

    statDatasets: $("statDatasets"),
    statViews: $("statViews"),
    statDownloads: $("statDownloads"),
    statSaved: $("statSaved"),
    statUploads: $("statUploads"),

    activityEmpty: $("dashActivityEmpty"),
    activityList: $("dashActivity"),
  };

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (s) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[s]));
  }

  function formatShortDate(iso) {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  }

  function statusToBadgeClass(status) {
    const s = (status || "").toLowerCase().trim();
    if (s === "draft") return "dash-badge--draft";
    if (s === "in review" || s === "review" || s === "in-review") return "dash-badge--review";
    if (s === "needs updates" || s === "needs-updates") return "dash-badge--needs";
    if (s === "published") return "dash-badge--published";
    return "dash-badge--draft";
  }

  function badgeLabel(status) {
    if (status === "Draft") return "Draft";
    if (status === "In Review") return "In Review";
    if (status === "Needs Updates") return "Needs Updates";
    if (status === "Published") return "Published";
    return status || "Draft";
  }

  // ──────────────────────────────────────────────────────────────
  // Modal focus trap + inert (same pattern as editor/search)
  // ──────────────────────────────────────────────────────────────

  function getFocusableElements(container) {
    return Array.from(container.querySelectorAll(
      'a[href]:not([disabled]), button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled])'
    ));
  }

  function trapFocus(e) {
    if (e.key !== 'Tab') return;

    const focusable = getFocusableElements(els.modal);
    if (focusable.length === 0) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (e.shiftKey) {
      if (document.activeElement === first || !els.modal.contains(document.activeElement)) {
        e.preventDefault();
        last.focus();
      }
    } else {
      if (document.activeElement === last || !els.modal.contains(document.activeElement)) {
        e.preventDefault();
        first.focus();
      }
    }
  }

  function startModalTrap() {
    els.modal.addEventListener('keydown', trapFocus);

    const sectionsToInert = [
      document.querySelector('header'),
      document.querySelector('main'),
      document.querySelector('[data-include="portal-footer"]')
    ].filter(Boolean);

    sectionsToInert.forEach(el => {
      if (el && !el.contains(els.modal)) {
        el.setAttribute('aria-hidden', 'true');
        el.setAttribute('inert', '');
      }
    });

    const first = getFocusableElements(els.modal)[0];
    if (first) first.focus();
  }

  function stopModalTrap() {
    els.modal.removeEventListener('keydown', trapFocus);

    document.querySelectorAll('[aria-hidden="true"][inert]').forEach(el => {
      el.removeAttribute('aria-hidden');
      el.removeAttribute('inert');
    });
  }

  function openModal() {
    if (!els.modal || !els.backdrop) return;

    if (els.stepForm) els.stepForm.hidden = false;
    if (els.stepSuccess) els.stepSuccess.hidden = true;
    if (els.err) { els.err.hidden = true; els.err.textContent = ""; }
    if (els.titleInput) els.titleInput.value = "";

    // NEW: reset OLCF radios each time modal opens
    if (els.olcfYes) els.olcfYes.checked = false;
    if (els.olcfNo) els.olcfNo.checked = false;

    els.backdrop.hidden = false;
    els.modal.hidden = false;
    document.body.style.overflow = "hidden";

    startModalTrap();
    setTimeout(() => els.titleInput?.focus?.(), 0);
  }

  function closeModal() {
    if (!els.modal || !els.backdrop) return;
    els.backdrop.hidden = true;
    els.modal.hidden = true;
    document.body.style.overflow = "";

    stopModalTrap();
    els.openModal?.focus?.();
  }

  function reserveDoi() {
    const title = (els.titleInput?.value || "").trim();
    if (!title) {
      if (els.err) {
        els.err.hidden = false;
        els.err.textContent = "Please enter a dataset title to reserve a DOI.";
      }
      els.titleInput?.focus?.();
      return;
    }

    // NOTE: OLCF yes/no is frontend-only for this build (not persisted).
    // const olcfValue = els.olcfYes?.checked ? "yes" : els.olcfNo?.checked ? "no" : "";

    // Use shared store to create real draft
    const newRecord = createNewDraft(title);

    // Show success
    if (els.reservedValue) els.reservedValue.textContent = newRecord.doi;
    if (els.editLink) els.editLink.href = `/src/pages/editor/index.html?doi=${encodeURIComponent(newRecord.doi)}`;
    if (els.stepForm) els.stepForm.hidden = true;
    if (els.stepSuccess) els.stepSuccess.hidden = false;

    // Refresh UI
    renderActivity();
    syncStats();
  }

  function syncStats() {
    const records = getAllRecords();
    if (els.statDatasets) els.statDatasets.textContent = String(records.length || 0);
    // Other stats remain demo values for now
    if (els.statViews) els.statViews.textContent = "774";
    if (els.statDownloads) els.statDownloads.textContent = "56";
    if (els.statSaved) els.statSaved.textContent = "14";
    if (els.statUploads) els.statUploads.textContent = "32 GB";
  }

  function renderActivity() {
    if (!els.activityList || !els.activityEmpty) return;

    const records = getAllRecords();
    if (!records.length) {
      els.activityEmpty.hidden = false;
      els.activityList.hidden = true;
      els.activityList.innerHTML = "";
      return;
    }

    els.activityEmpty.hidden = true;
    els.activityList.hidden = false;

    const rows = records.slice(0, 6).map((r) => {
      const editorHref = `/src/pages/editor/index.html?doi=${encodeURIComponent(r.doi)}`;
      const meta = `${badgeLabel(r.status)} · ${formatShortDate(r.updatedAt || r.createdAt)}`;

      const badgeClass = statusToBadgeClass(r.status);
      const badgeText = badgeLabel(r.status);

      return `
        <div class="dash-activity__row">
          <div>
            <h3 class="dash-activity__title margin-0">
              <a class="usa-link" href="${editorHref}">${escapeHtml(r.title || "Untitled dataset")}</a>
            </h3>
            <div class="dash-activity__meta">${escapeHtml(r.doi)} · ${escapeHtml(meta)}</div>
          </div>

          <div class="dash-activity__right">
            <span class="dash-badge ${badgeClass}">${escapeHtml(badgeText)}</span>
            <a class="dash-editlink" href="${editorHref}">Edit</a>
          </div>
        </div>
      `;
    }).join("");

    els.activityList.innerHTML = rows;
  }

  // Notification close
  if (els.noteClose && els.note) {
    els.noteClose.addEventListener("click", () => {
      els.note.hidden = true;
    });
  }

  // Modal wiring
  els.openModal?.addEventListener("click", openModal);
  els.closeModal?.addEventListener("click", closeModal);
  els.cancelModal?.addEventListener("click", closeModal);
  els.backdrop?.addEventListener("click", closeModal);

  els.reserveBtn?.addEventListener("click", reserveDoi);
  els.returnBtn?.addEventListener("click", closeModal);

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (els.modal && !els.modal.hidden) closeModal();
  });

  // Init
  syncStats();
  renderActivity();

  // Ensure modal/backdrop start hidden
  if (els.backdrop) els.backdrop.hidden = true;
  if (els.modal) els.modal.hidden = true;
})();
