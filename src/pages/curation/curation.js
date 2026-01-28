import { getAllRecords, saveRecord } from "/src/assets/js/shared-store.js";

const $ = (id) => document.getElementById(id);

function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>'"]/g, (s) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[s]));
}

function formatShortDate(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  } catch (_) {
    return "";
  }
}

function isCuratorRole() {
  const role = window.DatasetPortal?.getRole?.() || "Submitter";
  return role === "Curator" || role === "Admin";
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
    .filter((r) => String(r.status || "").toLowerCase() === "in review")
    .sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));

  if (emptyEl) emptyEl.hidden = items.length !== 0;

  listEl.innerHTML = items.map((r) => {
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
            <button type="button" class="usa-button" data-action="publish" data-doi="${escapeHtml(doi)}">
              Publish
            </button>
          </div>
        </div>
      </article>
    `;
  }).join("");

  // Wire buttons
  listEl.querySelectorAll("button[data-action]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const action = btn.getAttribute("data-action");
      const doi = btn.getAttribute("data-doi");
      if (!doi) return;
      const rec = getAllRecords().find((x) => x.doi === doi);
      if (!rec) return;

      if (action === "request") {
        const note = window.prompt("Add a note for the submitter (optional):", "Please review the metadata and update the requested fields.");
        rec.curatorNote = String(note || "").trim();
        rec.status = "Needs Updates";
        saveRecord(rec);

        window.DatasetPortal?.notifications?.add?.({
          toRole: "Submitter",
          toEmail: rec.submitterEmail || "",
          title: "Dataset needs updates",
          message: (rec.curatorNote ? `Curator note: ${rec.curatorNote}` : "A curator requested changes to your submitted dataset."),
          href: `/src/pages/editor/index.html?doi=${encodeURIComponent(doi)}`,
          recordDoi: doi,
          kind: "warning",
        });
      }

      if (action === "publish") {
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
      }

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
