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

function normalizeStatus(s) {
  return String(s ?? "")
    .trim()
    .toLowerCase();
}

function statusKey(s) {
  const n = normalizeStatus(s);
  if (n === "draft") return "draft";
  if (n === "published") return "published";
  if (n === "needs updates" || n === "needs-updates") return "needs-updates";
  if (n === "in review" || n === "in-review") return "in-review";
  return "draft";
}

function statusLabel(s) {
  const k = statusKey(s);
  if (k === "draft") return "Draft";
  if (k === "published") return "Published";
  if (k === "needs-updates") return "Needs Updates";
  if (k === "in-review") return "In Review";
  return String(s || "Draft");
}

function isCuratorRole() {
  const role = window.DatasetPortal?.getRole?.() || "Submitter";
  return role === "Curator" || role === "Admin";
}

function getRecordByDoi(doi) {
  return getAllRecords().find((x) => String(x.doi || "") === String(doi || ""));
}

function ensureHistory(rec) {
  if (!rec || typeof rec !== "object") return rec;
  if (!Array.isArray(rec.reviewRequests)) rec.reviewRequests = [];
  return rec;
}

function getLatestRequest(rec) {
  const list = Array.isArray(rec?.reviewRequests) ? rec.reviewRequests : [];
  return list.length ? list[0] : null; // newest first
}

function truncate(str, n = 160) {
  const s = String(str ?? "").trim();
  if (s.length <= n) return s;
  return s.slice(0, n - 1) + "…";
}

/* ──────────────────────────────────────────────────────────────
   Modals (simple)
   ────────────────────────────────────────────────────────────── */

let activeModal = null;
let lastFocusedEl = null;

function openModal(modalEl) {
  if (!modalEl) return;
  lastFocusedEl = document.activeElement;

  modalEl.hidden = false;
  activeModal = modalEl;

  const focusTarget = modalEl.querySelector(
    "textarea, input, button, [href], select, [tabindex]:not([tabindex='-1'])",
  );
  if (focusTarget) focusTarget.focus();

  document.addEventListener("keydown", onModalKeydown);
  document.body.style.overflow = "hidden";
}

function closeModal(modalEl) {
  if (!modalEl) return;
  modalEl.hidden = true;

  activeModal = null;
  document.removeEventListener("keydown", onModalKeydown);
  document.body.style.overflow = "";

  if (lastFocusedEl && typeof lastFocusedEl.focus === "function") {
    lastFocusedEl.focus();
  }
  lastFocusedEl = null;
}

function onModalKeydown(e) {
  if (e.key === "Escape" && activeModal) {
    closeModal(activeModal);
  }
}

function wireModalClose(modalEl) {
  if (!modalEl) return;
  modalEl.querySelectorAll("[data-cur-modal-close]").forEach((el) => {
    el.addEventListener("click", () => closeModal(modalEl));
  });
}

/* ──────────────────────────────────────────────────────────────
   Request Updates flow + history
   ────────────────────────────────────────────────────────────── */

let currentRequestDoi = null;

function collectFlags() {
  const ids = ["flagMeta", "flagFiles", "flagSubject", "flagOther"];
  const out = [];
  ids.forEach((id) => {
    const el = $(id);
    if (el && el.checked) out.push(el.value);
  });
  return out;
}

function resetRequestForm() {
  const msg = $("curReqMessage");
  const err = $("curReqError");
  if (msg) msg.value = "";
  if (err) {
    err.textContent = "";
    err.hidden = true;
  }
  ["flagMeta", "flagFiles", "flagSubject", "flagOther"].forEach((id) => {
    const el = $(id);
    if (el) el.checked = false;
  });
}

function openRequestModalFor(doi) {
  const rec = getRecordByDoi(doi);
  if (!rec) return;

  currentRequestDoi = doi;

  const titleEl = $("curReqDatasetTitle");
  const doiEl = $("curReqDatasetDoi");
  if (titleEl) titleEl.textContent = String(rec.title || "Untitled Dataset");
  if (doiEl) doiEl.textContent = String(rec.doi || "");

  resetRequestForm();
  openModal($("curRequestModal"));
}

function writeRequestToHistoryAndNotify(rec, message, flags) {
  ensureHistory(rec);

  const entry = {
    id: `req_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    type: "request_updates",
    createdAt: new Date().toISOString(),
    createdByRole: window.DatasetPortal?.getRole?.() || "Curator",
    createdByName: "Curator",
    message: String(message || "").trim(),
    flags: Array.isArray(flags) ? flags : [],
  };

  rec.reviewRequests.unshift(entry);
  rec.curatorNote = entry.message; // legacy convenience
  rec.status = "Needs Updates";
  saveRecord(rec);

  window.DatasetPortal?.notifications?.add?.({
    toRole: "Submitter",
    toEmail: rec.submitterEmail || "",
    title: "Dataset needs updates",
    message: `Curator request: ${entry.message}`,
    href: `/src/pages/editor/index.html?doi=${encodeURIComponent(rec.doi || "")}`,
    recordDoi: rec.doi || "",
    kind: "warning",
  });
}

function submitRequestUpdates() {
  const doi = currentRequestDoi;
  if (!doi) return;

  const rec = getRecordByDoi(doi);
  if (!rec) return;

  const msgEl = $("curReqMessage");
  const errEl = $("curReqError");
  const message = String(msgEl?.value || "").trim();

  if (!message) {
    if (errEl) {
      errEl.textContent = "Please enter a message to the submitter.";
      errEl.hidden = false;
    }
    msgEl?.focus();
    return;
  }

  const flags = collectFlags();
  writeRequestToHistoryAndNotify(rec, message, flags);

  closeModal($("curRequestModal"));
  currentRequestDoi = null;

  render();
}

function openHistoryModalFor(doi) {
  const rec = getRecordByDoi(doi);
  if (!rec) return;

  ensureHistory(rec);

  const titleEl = $("curHistDatasetTitle");
  const doiEl = $("curHistDatasetDoi");
  if (titleEl) titleEl.textContent = String(rec.title || "Untitled Dataset");
  if (doiEl) doiEl.textContent = String(rec.doi || "");

  const listEl = $("curHistList");
  const emptyEl = $("curHistEmpty");
  if (!listEl) return;

  const history = Array.isArray(rec.reviewRequests) ? rec.reviewRequests : [];
  if (emptyEl) emptyEl.hidden = history.length !== 0;

  listEl.innerHTML = history
    .map((h) => {
      const when = formatShortDateTime(h.createdAt);
      const flags = Array.isArray(h.flags) ? h.flags : [];
      return `
      <article class="cur-hist__item">
        <div class="cur-hist__top">
          <div class="cur-hist__label">
            <i class="fa-solid fa-rotate-left" aria-hidden="true"></i>
            Request updates
          </div>
          <div class="cur-hist__when">${escapeHtml(when)}</div>
        </div>

        ${
          flags.length
            ? `
          <div class="cur-hist__flags">
            ${flags.map((f) => `<span class="cur-flag">${escapeHtml(f)}</span>`).join("")}
          </div>
        `
            : ""
        }

        <div class="cur-hist__msg">${escapeHtml(h.message || "")}</div>
      </article>
    `;
    })
    .join("");

  openModal($("curHistoryModal"));
}

/* ──────────────────────────────────────────────────────────────
   Rendering
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

  // Curator queue includes In Review + Needs Updates (until Published)
  const queueStatuses = new Set([
    "in review",
    "in-review",
    "needs updates",
    "needs-updates",
  ]);

  const items = all
    .filter((r) => queueStatuses.has(normalizeStatus(r.status)))
    // Needs Updates first, then In Review; newest updated first
    .sort((a, b) => {
      const aS = normalizeStatus(a.status);
      const bS = normalizeStatus(b.status);

      const aPri = aS.startsWith("needs") ? 0 : 1;
      const bPri = bS.startsWith("needs") ? 0 : 1;
      if (aPri !== bPri) return aPri - bPri;

      const aT = String(a.updatedAt || a.createdAt || "");
      const bT = String(b.updatedAt || b.createdAt || "");
      return bT.localeCompare(aT);
    });

  if (emptyEl) emptyEl.hidden = items.length !== 0;

  listEl.innerHTML = items
    .map((r) => {
      ensureHistory(r);

      const doi = String(r.doi || "");
      const title = String(r.title || "Untitled Dataset");
      const when = formatShortDate(r.updatedAt || r.createdAt);
      const submitter = String(r.submitterEmail || "").trim();

      const sKey = statusKey(r.status);
      const sLabel = statusLabel(r.status);

      const latest = getLatestRequest(r);
      const historyCount = Array.isArray(r.reviewRequests)
        ? r.reviewRequests.length
        : 0;

      // ✅ Publish only visible if In Review
      const showPublish = sKey === "in-review";
      const showWaiting = sKey === "needs-updates";

      return `
      <article class="cur-card" data-doi="${escapeHtml(doi)}">
        <div class="cur-meta">
          <div>
            <h3 class="cur-title">${escapeHtml(title)}</h3>
            <p class="cur-doi">
              <span class="cur-status" data-status="${escapeHtml(sKey)}">${escapeHtml(sLabel)}</span>
              ${showWaiting ? `<span class="cur-queue-label"><i class="fa-solid fa-hourglass-half" aria-hidden="true"></i>Waiting on Submitter</span>` : ""}
              · ${escapeHtml(doi)} · Updated ${escapeHtml(when)}${submitter ? ` · Submitter: ${escapeHtml(submitter)}` : ""}
            </p>
          </div>

          <div class="cur-actions">
            <a class="usa-button btnBrandSolid" href="/src/pages/editor/index.html?doi=${encodeURIComponent(doi)}&curator=1">
              Review
            </a>

            <button type="button" class="usa-button usa-button--outline btnBrandOutline" data-action="request" data-doi="${escapeHtml(doi)}">
              Request updates
            </button>

            ${
              showPublish
                ? `<button type="button" class="usa-button btnPublishGreen" data-action="publish" data-doi="${escapeHtml(doi)}">Publish</button>`
                : ""
            }
          </div>
        </div>

        ${
          latest
            ? `
          <div class="cur-note">
            <div class="cur-note__left">
              <div class="cur-note__k">
                <i class="fa-solid fa-note-sticky" aria-hidden="true"></i>
                Most recent request
              </div>
              <div class="cur-note__v">${escapeHtml(truncate(latest.message || ""))}</div>
              <div class="cur-note__meta">Sent ${escapeHtml(formatShortDateTime(latest.createdAt))}</div>
            </div>
            <div class="cur-note__right">
              <button type="button" class="usa-button usa-button--unstyled" data-action="history" data-doi="${escapeHtml(doi)}">
                View history (${historyCount})
              </button>
            </div>
          </div>
        `
            : historyCount
              ? `
          <div class="cur-note">
            <div class="cur-note__left">
              <div class="cur-note__k">
                <i class="fa-solid fa-note-sticky" aria-hidden="true"></i>
                Request history
              </div>
              <div class="cur-note__v">This dataset has ${historyCount} prior request(s).</div>
            </div>
            <div class="cur-note__right">
              <button type="button" class="usa-button usa-button--unstyled" data-action="history" data-doi="${escapeHtml(doi)}">
                View history (${historyCount})
              </button>
            </div>
          </div>
        `
              : ""
        }
      </article>
    `;
    })
    .join("");

  // Wire buttons
  listEl.querySelectorAll("[data-action]").forEach((el) => {
    el.addEventListener("click", () => {
      const action = el.getAttribute("data-action");
      const doi = el.getAttribute("data-doi");
      if (!doi) return;

      const rec = getRecordByDoi(doi);
      if (!rec) return;

      if (action === "request") {
        openRequestModalFor(doi);
        return;
      }

      if (action === "history") {
        openHistoryModalFor(doi);
        return;
      }

      if (action === "publish") {
        // Only allow publish if currently In Review
        if (statusKey(rec.status) !== "in-review") return;

        rec.status = "Published";
        saveRecord(rec);

        window.DatasetPortal?.notifications?.add?.({
          toRole: "Submitter",
          toEmail: rec.submitterEmail || "",
          title: "Dataset published",
          message: "Your dataset has been published.",
          href: `/src/pages/dataset/index.html?doi=${encodeURIComponent(doi)}`,
          recordDoi: doi,
          kind: "success",
        });

        render();
        return;
      }
    });
  });
}

function init() {
  wireModalClose($("curRequestModal"));
  wireModalClose($("curHistoryModal"));

  $("curReqSend")?.addEventListener("click", submitRequestUpdates);

  render();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
