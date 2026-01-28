// Notifications page (demo)

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

function formatTime(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch (_) {
    return "";
  }
}

function render() {
  const listEl = $("notifList");
  const emptyEl = $("notifEmpty");
  if (!listEl || !window.DatasetPortal?.notifications) return;

  const items = window.DatasetPortal.notifications.listForMe();

  if (!items.length) {
    if (emptyEl) emptyEl.hidden = false;
    listEl.innerHTML = "";
    return;
  }

  if (emptyEl) emptyEl.hidden = true;

  listEl.innerHTML = items.map((n) => {
    const unread = !n.read;
    const href = String(n.href || "").trim();

    const title = escapeHtml(n.title || "Notification");
    const msg = escapeHtml(n.message || "");
    const time = escapeHtml(formatTime(n.createdAt));

    const body = `
      <div class="notif-meta">
        <div>
          <p class="notif-title">${title}</p>
          <p class="notif-msg">${msg}</p>
        </div>
        <div class="notif-time">${time}</div>
      </div>
      <div class="margin-top-1">
        ${href ? `<a class="usa-link" href="${escapeHtml(href)}">Open</a>` : ""}
        <button class="usa-button usa-button--unstyled margin-left-2" type="button" data-mark-read="${escapeHtml(n.id)}">Mark read</button>
      </div>
    `;

    return `<div class="notif-card ${unread ? "is-unread" : ""}" data-id="${escapeHtml(n.id)}">${body}</div>`;
  }).join("");

  // Wire mark-read
  listEl.querySelectorAll("[data-mark-read]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-mark-read");
      if (!id) return;
      window.DatasetPortal.notifications.markRead(id);
      render();
    });
  });
}

function init() {
  $("markAllRead")?.addEventListener("click", () => {
    window.DatasetPortal?.notifications?.markAllRead?.();
    render();
  });
  render();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
