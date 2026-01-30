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

function isCuratorRole() {
  const role = window.DatasetPortal?.getRole?.() || "Submitter";
  return role === "Curator" || role === "Admin";
}

function statusKey(status) {
  const norm = String(status || "")
    .toLowerCase()
    .trim();
  if (norm === "in review" || norm === "in-review") return "in-review";
  if (norm === "needs updates" || norm === "needs-updates")
    return "needs-updates";
  if (norm === "published") return "published";
  return "draft";
}

function isQueueStatus(status) {
  const k = statusKey(status);
  return k === "in-review" || k === "needs-updates";
}

function canPublish(status) {
  return statusKey(status) === "in-review";
}

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
    .filter((r) => isQueueStatus(r.status))
    .sort((a, b) =>
      String(b.updatedAt || b.createdAt || "").localeCompare(
        String(a.updatedAt || a.createdAt || ""),
      ),
    );

  if (emptyEl) emptyEl.hidden = items.length !== 0;

  listEl.innerHTML = items
    .map((r) => {
      const doi = String(r.doi || "");
      const title = String(r.title || "Untitled Dataset");
      const when = formatShortDate(r.updatedAt || r.createdAt);
      const submitter = String(r.submitterEmail || "").trim();

      const sKey = statusKey(r.status);
      const sLabel = String(r.status || "Draft");

      const showPublish = canPublish(r.status);
      const isWaiting = sKey === "needs-updates";

      // Waiting indicator now appears next to status chip (not in actions)
      const waitingInline = isWaiting
        ? `
          <span class="cur-waiting" aria-label="Waiting on submitter">
            <i class="fa-regular fa-clock" aria-hidden="true"></i>
            Waiting on Submitter
          </span>
        `
        : "";

      const publishBtn = showPublish
        ? `
          <button
            type="button"
            class="usa-button cur-publish"
            data-action="publish"
            data-doi="${escapeHtml(doi)}"
            aria-label="Publish dataset"
          >
            Publish
          </button>
        `
        : "";

      return `
        <article class="cur-card" data-doi="${escapeHtml(doi)}">
          <div class="cur-meta">
            <div class="cur-meta__left">
              <div class="cur-titleRow">
                <h3 class="cur-title">${escapeHtml(title)}</h3>
                <span class="status-chip" data-status="${escapeHtml(sKey)}">${escapeHtml(sLabel)}</span>
                ${waitingInline}
              </div>

              <p class="cur-doi">
                ${escapeHtml(doi)} · Updated ${escapeHtml(when)}${
                  submitter ? ` · Submitter: ${escapeHtml(submitter)}` : ""
                }
              </p>
            </div>

            <div class="cur-actions">
              <a class="usa-button btnBrandSolid" href="/src/pages/editor/index.html?doi=${encodeURIComponent(doi)}&curator=1">
                Review
              </a>
              ${publishBtn}
            </div>
          </div>
        </article>
      `;
    })
    .join("");

  // Wire publish buttons
  listEl.querySelectorAll('button[data-action="publish"]').forEach((btn) => {
    btn.addEventListener("click", () => {
      const doi = btn.getAttribute("data-doi");
      if (!doi) return;

      const rec = getAllRecords().find((x) => x.doi === doi);
      if (!rec || !canPublish(rec.status)) return;

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
    });
  });
}

function init() {
  render();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
