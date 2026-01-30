import { getRecord } from "/src/assets/js/shared-store.js";

(() => {
  const $ = (id) => document.getElementById(id);

  function getQueryParam(name) {
    const u = new URL(window.location.href);
    return u.searchParams.get(name);
  }

  function safe(v) {
    return String(v ?? "");
  }

  function escapeHtml(str) {
    return safe(str).replace(
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

  function normStatus(raw) {
    const s = safe(raw).trim().toLowerCase();
    if (s === "published") return "published";
    if (s === "needs updates" || s === "needs-updates") return "needs-updates";
    if (s === "in review" || s === "in-review" || s === "review")
      return "in-review";
    return "draft";
  }

  function formatShortDate(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  function pickLatestCuratorRequest(record) {
    const arr = Array.isArray(record?.curatorRequests)
      ? record.curatorRequests
      : [];
    if (!arr.length) return null;
    const sorted = [...arr].sort((a, b) => {
      const ta = new Date(a?.at || 0).getTime();
      const tb = new Date(b?.at || 0).getTime();
      return tb - ta;
    });
    return sorted[0] || null;
  }

  function renderTimeline(record) {
    const host = $("workflowTimeline");
    if (!host) return;

    const status = normStatus(record?.status);
    const createdAt = record?.createdAt;
    const updatedAt = record?.updatedAt;

    const latestReq = pickLatestCuratorRequest(record);

    const submittedAt =
      record?.submittedAt || (status === "in-review" ? updatedAt : "");
    const needsUpdatesAt =
      latestReq?.at || (status === "needs-updates" ? updatedAt : "");
    const publishedAt =
      record?.publishedAt || (status === "published" ? updatedAt : "");

    const steps = [
      { key: "draft", label: "Draft", when: createdAt },
      { key: "in-review", label: "In Review", when: submittedAt },
      { key: "needs-updates", label: "Needs Updates", when: needsUpdatesAt },
      { key: "published", label: "Published", when: publishedAt },
    ];

    function isDone(stepKey) {
      if (stepKey === "draft") return true;
      if (stepKey === "in-review") return status !== "draft";
      if (stepKey === "needs-updates")
        return status === "needs-updates" || status === "published";
      if (stepKey === "published") return status === "published";
      return false;
    }

    function pillFor(stepKey) {
      if (status === stepKey)
        return `<span class="wf-pill wf-pill--current">Current</span>`;
      if (isDone(stepKey) && stepKey !== "draft")
        return `<span class="wf-pill wf-pill--done">Done</span>`;
      return "";
    }

    const html = `
      <ol class="wf-timeline__list">
        ${steps
          .map((s) => {
            const cls = [
              "wf-step",
              status === s.key ? "is-current" : "",
              isDone(s.key) && status !== s.key ? "is-done" : "",
            ]
              .filter(Boolean)
              .join(" ");

            return `
            <li class="${cls}">
              <div class="wf-step__top">
                <div class="wf-step__label">${escapeHtml(s.label)}</div>
                ${pillFor(s.key)}
              </div>
              <div class="wf-step__meta">
                ${s.when ? escapeHtml(formatShortDate(s.when)) : "&nbsp;"}
              </div>
            </li>
          `;
          })
          .join("")}
      </ol>
    `;

    host.innerHTML = html;
  }

  function renderCuratorNote(record) {
    const host = $("curatorNoteCard");
    if (!host) return;

    const status = normStatus(record?.status);
    const latestReq = pickLatestCuratorRequest(record);

    if (!latestReq) {
      host.hidden = true;
      host.innerHTML = "";
      return;
    }

    const whenIso = latestReq?.at || record?.updatedAt || "";
    const when = formatShortDate(whenIso);

    const note = safe(latestReq?.note || latestReq?.message || "").trim();
    const reasons = Array.isArray(latestReq?.reasons) ? latestReq.reasons : [];
    const due = safe(latestReq?.dueBy || latestReq?.due || "").trim();

    const tags = [
      ...reasons.map((r) => ({ icon: "fa-circle-exclamation", text: r })),
      ...(due ? [{ icon: "fa-calendar", text: `Due: ${due}` }] : []),
    ];

    host.hidden = false;

    const statePill =
      status === "needs-updates"
        ? `<span class="wf-pill wf-pill--danger"><i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i> Needs Updates</span>`
        : `<span class="wf-pill wf-pill--warn"><i class="fa-solid fa-circle-info" aria-hidden="true"></i> Curator note</span>`;

    host.innerHTML = `
      <div class="curator-note__head">
        <h2 class="curator-note__title">
          <i class="fa-solid fa-clipboard-list" aria-hidden="true"></i>
          Latest curator request
        </h2>
        <div class="curator-note__when">${escapeHtml(when || "")}</div>
      </div>

      <div class="curator-note__body">
        <p class="curator-note__msg">
          ${note ? escapeHtml(note) : "A curator requested updates to this dataset. Review the requested changes and re-submit."}
        </p>

        ${
          tags.length
            ? `
          <div class="curator-note__tags" aria-label="Requested updates">
            ${tags
              .map(
                (t) => `
              <span class="curator-tag">
                <i class="fa-solid ${escapeHtml(t.icon)}" aria-hidden="true"></i>
                ${escapeHtml(t.text)}
              </span>
            `,
              )
              .join("")}
          </div>
        `
            : ""
        }

        <div class="curator-note__footer">
          <div class="curator-note__hint">
            Update the requested fields and click <strong>Submit for Review</strong> again.
          </div>
          ${statePill}
        </div>
      </div>
    `;
  }

  function renderAll() {
    const doi = getQueryParam("doi");
    if (!doi) return;
    const record = getRecord(doi);
    if (!record) return;
    renderTimeline(record);
    renderCuratorNote(record);
  }

  function wireReRenderHooks() {
    const saveBtn = $("saveBtn");
    const submitBtn = $("submitBtn");

    const rerenderSoon = () => window.setTimeout(renderAll, 80);

    saveBtn?.addEventListener("click", rerenderSoon);
    submitBtn?.addEventListener("click", rerenderSoon);

    window.addEventListener("storage", (e) => {
      if (e.key && e.key.includes("constellation:records")) {
        rerenderSoon();
      }
    });

    // NEW: immediate rerender when curator uses in-editor Request Updates
    window.addEventListener("dp-record-updated", rerenderSoon);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      renderAll();
      wireReRenderHooks();
    });
  } else {
    renderAll();
    wireReRenderHooks();
  }
})();
