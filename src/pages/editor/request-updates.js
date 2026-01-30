import { getRecord, saveRecord } from "/src/assets/js/shared-store.js";

const $ = (id) => document.getElementById(id);

function escapeHtml(str) {
  return String(str ?? "").replace(
    /[&<>'"]/g,
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

function nowIso() {
  try {
    return new Date().toISOString();
  } catch (_) {
    return "";
  }
}

function getRole() {
  return window.DatasetPortal?.getRole?.() || "Submitter";
}

function isCuratorRole() {
  const r = getRole();
  return r === "Curator" || r === "Admin";
}

function getQueryParam(name) {
  const u = new URL(window.location.href);
  return u.searchParams.get(name);
}

function ensureArray(v) {
  return Array.isArray(v) ? v : [];
}

let activeDoi = "";
let activeTitle = "";

function setModalError(msg) {
  const el = $("requestUpdatesError");
  if (!el) return;
  el.textContent = msg || "";
  el.hidden = !msg;
}

function getCheckedReasons() {
  const form = $("requestUpdatesForm");
  if (!form) return [];
  const checks = Array.from(
    form.querySelectorAll('input[name="reasons"]:checked'),
  );
  return checks.map((c) => String(c.value || "").trim()).filter(Boolean);
}

function buildPreviewHtml(noteText, reasons, due) {
  const safeNote = escapeHtml(noteText || "").trim();
  const safeDue = escapeHtml(due || "").trim();

  const lines = [];

  lines.push(
    `<div class="dp-preview__line"><strong>Dataset needs updates</strong></div>`,
  );

  if (safeDue) {
    lines.push(
      `<div class="dp-preview__line dp-preview__muted">Requested by: <strong>${safeDue}</strong></div>`,
    );
  }

  if (safeNote) {
    lines.push(
      `<div class="dp-preview__line">${safeNote.replace(/\n/g, "<br/>")}</div>`,
    );
  } else {
    lines.push(
      `<div class="dp-preview__line dp-preview__muted">Add a note to see the preview…</div>`,
    );
  }

  if (reasons.length) {
    const pills = reasons
      .map(
        (r) =>
          `<span class="dp-preview__pill"><i class="fa-solid fa-check" aria-hidden="true"></i>${escapeHtml(r)}</span>`,
      )
      .join("");
    lines.push(`<div class="dp-preview__pillrow">${pills}</div>`);
  }

  lines.push(
    `<div class="dp-preview__line dp-preview__muted">Link: Edit dataset to address requested changes.</div>`,
  );

  return lines.join("");
}

function openModal(doi, title) {
  const dlg = $("requestUpdatesDialog");
  const note = $("requestUpdatesNote");
  const due = $("requestUpdatesDue");
  const preview = $("requestUpdatesPreview");
  const form = $("requestUpdatesForm");

  activeDoi = String(doi || "");
  activeTitle = String(title || "Untitled Dataset");
  setModalError("");

  if ($("requestUpdatesDatasetTitle"))
    $("requestUpdatesDatasetTitle").textContent = activeTitle;
  if ($("requestUpdatesDatasetDoi"))
    $("requestUpdatesDatasetDoi").textContent = activeDoi;

  if (note) note.value = "";
  if (due) due.value = "";
  if (form)
    form.querySelectorAll('input[name="reasons"]').forEach((c) => {
      c.checked = false;
    });

  if (preview) preview.innerHTML = buildPreviewHtml("", [], "");

  if (dlg?.showModal) {
    dlg.showModal();
    setTimeout(() => note?.focus(), 0);
  }
}

function closeModal() {
  const dlg = $("requestUpdatesDialog");
  if (dlg?.close) dlg.close();
  activeDoi = "";
  activeTitle = "";
  setModalError("");
}

function init() {
  // Only show for Curator/Admin
  const btn = $("curatorRequestUpdatesBtn");
  if (!btn) return;

  if (!isCuratorRole()) {
    btn.hidden = true;
    return;
  }

  // Find record DOI from URL
  const doi = getQueryParam("doi");
  if (!doi) {
    btn.hidden = true;
    return;
  }

  const record = getRecord(doi);
  if (!record) {
    btn.hidden = true;
    return;
  }

  // Show button for curator review context (when in-review OR needs-updates)
  const status = String(record.status || "").toLowerCase();
  const show =
    status === "in review" ||
    status === "in-review" ||
    status === "needs updates" ||
    status === "needs-updates";

  btn.hidden = !show;

  // Wire modal controls
  const dlg = $("requestUpdatesDialog");
  const form = $("requestUpdatesForm");
  const closeBtn = $("requestUpdatesCloseBtn");
  const cancelBtn = $("requestUpdatesCancelBtn");
  const note = $("requestUpdatesNote");
  const due = $("requestUpdatesDue");
  const preview = $("requestUpdatesPreview");

  btn.addEventListener("click", () =>
    openModal(doi, record.title || "Untitled Dataset"),
  );
  closeBtn?.addEventListener("click", closeModal);
  cancelBtn?.addEventListener("click", closeModal);

  // click outside closes
  dlg?.addEventListener("click", (e) => {
    const rect = dlg.getBoundingClientRect();
    const inside =
      e.clientX >= rect.left &&
      e.clientX <= rect.right &&
      e.clientY >= rect.top &&
      e.clientY <= rect.bottom;
    if (!inside) closeModal();
  });

  // Live preview
  function updatePreview() {
    const reasons = getCheckedReasons();
    const noteText = String(note?.value || "");
    const dueVal = String(due?.value || "");
    if (preview)
      preview.innerHTML = buildPreviewHtml(noteText, reasons, dueVal);
  }

  note?.addEventListener("input", updatePreview);
  due?.addEventListener("input", updatePreview);
  form
    ?.querySelectorAll('input[name="reasons"]')
    .forEach((c) => c.addEventListener("change", updatePreview));

  // Submit
  form?.addEventListener("submit", (e) => {
    e.preventDefault();
    setModalError("");

    const rec = getRecord(doi);
    if (!rec) {
      setModalError(
        "Could not find that dataset record. Please refresh and try again.",
      );
      return;
    }

    const noteText = String(note?.value || "").trim();
    if (!noteText) {
      setModalError("Please enter a note to the submitter.");
      note?.focus();
      return;
    }

    const reasons = getCheckedReasons();
    const dueVal = String(due?.value || "").trim();

    const existing = ensureArray(rec.curatorRequests);
    const requestItem = {
      at: nowIso(),
      note: noteText,
      reasons,
      due: dueVal,
      byRole: getRole(),
      from: "editor",
    };

    rec.curatorRequests = [requestItem, ...existing];
    rec.curatorNote = noteText; // backward compat

    rec.status = "Needs Updates";
    saveRecord(rec);

    // Notify submitter
    const reasonText = reasons.length ? `Reasons: ${reasons.join(", ")}.` : "";
    const dueText = dueVal ? `Requested by: ${dueVal}.` : "";
    const messageParts = [noteText, reasonText, dueText].filter(Boolean);

    window.DatasetPortal?.notifications?.add?.({
      toRole: "Submitter",
      toEmail: rec.submitterEmail || "",
      title: "Dataset needs updates",
      message: messageParts.join(" "),
      href: `/src/pages/editor/index.html?doi=${encodeURIComponent(doi)}`,
      recordDoi: doi,
      kind: "warning",
    });

    closeModal();

    // Let workflow-ui.js refresh immediately
    window.dispatchEvent(new Event("dp-record-updated"));

    // Also keep header button in sync
    btn.hidden = false;
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
