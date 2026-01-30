// /src/pages/editor/curator-publish.js
// Curator/Admin override for the primary CTA in the editor:
// - Submitter: "Submit for Review" (handled by editor.js)
// - Curator/Admin: "Approve & Publish" (handled here)

import { getRecord, saveRecord } from "/src/assets/js/shared-store.js";

(() => {
  const $ = (id) => document.getElementById(id);

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

  function nowIso() {
    try {
      return new Date().toISOString();
    } catch (_) {
      return "";
    }
  }

  function normStatus(raw) {
    const s = String(raw || "")
      .trim()
      .toLowerCase();
    if (s === "in review" || s === "in-review" || s === "review")
      return "in-review";
    if (s === "needs updates" || s === "needs-updates") return "needs-updates";
    if (s === "published") return "published";
    return "draft";
  }

  function init() {
    const submitBtn = $("submitBtn");
    if (!submitBtn) return;

    if (!isCuratorRole()) return;

    const doi = getQueryParam("doi");
    if (!doi) return;

    const rec = getRecord(doi);
    if (!rec) return;

    const s = normStatus(rec.status);

    // Only override when curator is actually reviewing
    const shouldOverride = s === "in-review" || s === "needs-updates";
    if (!shouldOverride) return;

    // Update UI: label + green styling
    submitBtn.textContent = "Approve & Publish";
    submitBtn.classList.add("btnPublishGreen");
    submitBtn.disabled = false;
    submitBtn.setAttribute("aria-disabled", "false");

    // Capture click FIRST and prevent editor.js Submit-for-Review behavior
    submitBtn.addEventListener(
      "click",
      (e) => {
        // Stop editor.js handler from running
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();

        const latest = getRecord(doi);
        if (!latest) return;

        // Publish
        latest.status = "Published";
        latest.publishedAt = latest.publishedAt || nowIso();
        saveRecord(latest);

        // Notify submitter
        const title = latest.title || "Untitled Dataset";
        window.DatasetPortal?.notifications?.add?.({
          toRole: "Submitter",
          toEmail: latest.submitterEmail || "",
          title: "Dataset published",
          message: `Your dataset “${title}” has been approved and published.`,
          href: `/src/pages/dataset/index.html?doi=${encodeURIComponent(doi)}`,
          recordDoi: doi,
          kind: "success",
        });

        // Let any UI widgets refresh
        window.dispatchEvent(new Event("dp-record-updated"));

        // Redirect to public landing (no preview flag)
        window.location.href = `/src/pages/dataset/index.html?doi=${encodeURIComponent(doi)}`;
      },
      true, // capture phase
    );
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
