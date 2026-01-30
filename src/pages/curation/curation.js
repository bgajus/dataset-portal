import { getAllRecords, saveRecord } from "/src/assets/js/shared-store.js";

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

function formatShortDate(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch (_) {
    return "";
  }
}

function nowIso() {
  try {
    return new Date().toISOString();
  } catch (_) {
    return "";
  }
}

function isCuratorRole() {
  const role = window.DatasetPortal?.getRole?.() || "Submitter";
  return role === "Curator" || role === "Admin";
}

function getRecordByDoi(doi) {
  return getAllRecords().find((x) => String(x.doi || "") === String(doi || ""));
}

function ensureArray(v) {
  return Array.isArray(v) ? v : [];
}

/* ──────────────────────────────────────────────────────────────
   Request Updates modal controller
   ────────────────────────────────────────────────────────────── */

let requestDoi = "";
let requestTitle = "";

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

function openRequestModal({ doi, title }) {
  const dlg = $("requestUpdatesDialog");
  const note = $("requestUpdatesNote");
  const due = $("requestUpdatesDue");
  const preview = $("requestUpdatesPreview");

  requestDoi = String(doi || "");
  requestTitle = String(title || "Untitled Dataset");

  setModalError("");

  if ($("requestUpdatesDatasetTitle"))
    $("requestUpdatesDatasetTitle").textContent = requestTitle;
  if ($("requestUpdatesDatasetDoi"))
    $("requestUpdatesDatasetDoi").textContent = requestDoi;

  // Reset fields
  if (note) note.value = "";
  if (due) due.value = "";
  const form = $("requestUpdatesForm");
  if (form) {
    form.querySelectorAll('input[name="reasons"]').forEach((c) => {
      c.checked = false;
    });
  }

  if (preview) {
    preview.innerHTML = buildPreviewHtml("", [], "");
  }

  if (dlg && typeof dlg.showModal === "function") {
    dlg.showModal();
    setTimeout(() => note?.focus(), 0);
  }
}

function closeRequestModal() {
  const dlg = $("requestUpdatesDialog");
  if (dlg && typeof dlg.close === "function") dlg.close();
  requestDoi = "";
  requestTitle = "";
  setModalError("");
}

function wireRequestModal() {
  const dlg = $("requestUpdatesDialog");
  const form = $("requestUpdatesForm");
  const closeBtn = $("requestUpdatesCloseBtn");
  const cancelBtn = $("requestUpdatesCancelBtn");
  const note = $("requestUpdatesNote");
  const due = $("requestUpdatesDue");
  const preview = $("requestUpdatesPreview");

  if (!dlg || !form) return;

  closeBtn?.addEventListener("click", closeRequestModal);
  cancelBtn?.addEventListener("click", closeRequestModal);

  // Click outside closes
  dlg.addEventListener("click", (e) => {
    const rect = dlg.getBoundingClientRect();
    const inside =
      e.clientX >= rect.left &&
      e.clientX <= rect.right &&
      e.clientY >= rect.top &&
      e.clientY <= rect.bottom;
    if (!inside) closeRequestModal();
  });

  // Live preview updates
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
    .querySelectorAll('input[name="reasons"]')
    .forEach((c) => c.addEventListener("change", updatePreview));

  // Submit (Send back)
  form.addEventListener("submit", (e) => {
    // NOTE: this form is method=dialog; prevent default close until we validate/save
    e.preventDefault();
    setModalError("");

    if (!requestDoi) {
      setModalError("Missing dataset DOI. Please close and try again.");
      return;
    }

    const rec = getRecordByDoi(requestDoi);
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

    // Store structured request history (so we can show multiple rounds later)
    const existing = ensureArray(rec.curatorRequests);
    const requestItem = {
      at: nowIso(),
      note: noteText,
      reasons,
      due: dueVal,
      byRole: window.DatasetPortal?.getRole?.() || "Curator",
    };

    rec.curatorRequests = [requestItem, ...existing];

    // Backward-compat: keep the single note field used elsewhere
    rec.curatorNote = noteText;

    rec.status = "Needs Updates";
    rec.updatedAt = nowIso();
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
      href: `/src/pages/editor/index.html?doi=${encodeURIComponent(requestDoi)}`,
      recordDoi: requestDoi,
      kind: "warning",
    });

    closeRequestModal();
    render();
  });
}

/* ──────────────────────────────────────────────────────────────
   Main list
   ────────────────────────────────────────────────────────────── */

function render() {
  const listEl = $("curList");
  const emptyEl = $("curEmpty");
  const deniedEl = $("curAccessDenied");
  if (!listEl) return;

  if (!isCuratorRole()) {
    if (deniedEl) deniedEl.hidden = false;
    if (emptyEl) emptyEl.hidden = true;
    listEl.innerHTML = "";
    return;
  }

  if (deniedEl) deniedEl.hidden = true;

  const all = getAllRecords();
  const items = all
    .filter((r) => String(r.status || "").toLowerCase() === "in review")
    .sort((a, b) =>
      String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")),
    );

  if (emptyEl) emptyEl.hidden = items.length !== 0;

  listEl.innerHTML = items
    .map((r) => {
      const doi = String(r.doi || "");
      const title = String(r.title || "Untitled Dataset");
      const when = formatShortDate(r.updatedAt || r.createdAt);
      const submitter = String(r.submitterEmail || "").trim();

      return `
      <article class="cur-card" data-doi="${escapeHtml(doi)}">
        <div class="cur-meta">
          <div>
            <h3 class="cur-title">${escapeHtml(title)}</h3>
            <p class="cur-doi">${escapeHtml(doi)} · Updated ${escapeHtml(when)}${submitter ? ` · Submitter: ${escapeHtml(submitter)}` : ""}</p>
          </div>
          <div class="cur-actions">
            <a class="usa-button btnBrandSolid" href="/src/pages/editor/index.html?doi=${encodeURIComponent(doi)}&curator=1">
              Review
            </a>
            <button type="button" class="usa-button usa-button--outline btnBrandOutline" data-action="request" data-doi="${escapeHtml(doi)}">
              Request updates
            </button>
            <button type="button" class="usa-button btnPublishGreen" data-action="publish" data-doi="${escapeHtml(doi)}">
              Approve &amp; Publish
            </button>
          </div>
        </div>
      </article>
    `;
    })
    .join("");

  // Wire buttons
  listEl.querySelectorAll("button[data-action]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const action = btn.getAttribute("data-action");
      const doi = btn.getAttribute("data-doi");
      if (!doi) return;

      const rec = getRecordByDoi(doi);
      if (!rec) return;

      if (action === "request") {
        openRequestModal({ doi, title: rec.title || "Untitled Dataset" });
        return;
      }

      if (action === "publish") {
        const t = String(rec.title || "Untitled Dataset");

        rec.status = "Published";
        rec.publishedAt = rec.publishedAt || nowIso();
        rec.updatedAt = nowIso();
        saveRecord(rec);

        window.DatasetPortal?.notifications?.add?.({
          toRole: "Submitter",
          toEmail: rec.submitterEmail || "",
          title: "Dataset published",
          message: `Your dataset “${t}” has been approved and published.`,
          href: `/src/pages/dataset/index.html?doi=${encodeURIComponent(doi)}`,
          recordDoi: doi,
          kind: "success",
        });

        render();
      }
    });
  });
}

function init() {
  wireRequestModal();
  render();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
