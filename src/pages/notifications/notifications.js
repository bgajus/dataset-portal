// Notifications page (demo)
// Supports: delete single, delete selected, delete all (for current user)
// Enhancements:
// - Selected count indicator + button label updates
// - USWDS-styled confirm modal (replaces window.confirm)

const $ = (id) => document.getElementById(id);

const NOTIF_STORAGE_KEY = "constellation:notifications:v1";
const selected = new Set();

// Modal state
let pendingAction = null; // { type: 'deleteSelected'|'deleteAll', ids?: string[], count?: number }

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

function formatTime(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch (_) {
    return "";
  }
}

function readAllNotifications() {
  try {
    const raw = localStorage.getItem(NOTIF_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
}

function writeAllNotifications(list) {
  try {
    localStorage.setItem(
      NOTIF_STORAGE_KEY,
      JSON.stringify(Array.isArray(list) ? list : []),
    );
  } catch (e) {
    console.warn("Failed to write notifications:", e);
  }
}

/**
 * Delete only for the current user's role/email (not global across roles).
 * Matches includes.js semantics: toRole must match, and toEmail (if present) must match.
 */
function notificationIsForMe(n) {
  if (!n) return false;

  const role = window.DatasetPortal?.getRole?.() || "Submitter";
  const profile = window.DatasetPortal?.getUserProfile?.() || {};
  const myEmail = String(profile.email || "")
    .trim()
    .toLowerCase();

  const toRole = String(n.toRole || "Submitter").trim();
  if (toRole !== role) return false;

  const toEmail = String(n.toEmail || "")
    .trim()
    .toLowerCase();
  if (toEmail) return toEmail === myEmail;

  return true;
}

function updateHeaderBadge() {
  const badge = document.getElementById("notifBadge");
  if (!badge) return;

  const count = window.DatasetPortal?.notifications?.unreadCount?.() ?? 0;
  badge.hidden = count <= 0;
  badge.textContent = String(count);
}

function getVisibleItems() {
  if (!window.DatasetPortal?.notifications?.listForMe) return [];
  return window.DatasetPortal.notifications.listForMe();
}

function deleteByIds(ids) {
  const remove = new Set((Array.isArray(ids) ? ids : []).map(String));
  if (!remove.size) return;

  const all = readAllNotifications();
  const next = all.filter((n) => !(n && remove.has(String(n.id))));
  writeAllNotifications(next);

  remove.forEach((id) => selected.delete(id));

  render();
  updateHeaderBadge();
}

function deleteAllForMe() {
  const all = readAllNotifications();
  const next = all.filter((n) => !notificationIsForMe(n));
  writeAllNotifications(next);

  selected.clear();
  render();
  updateHeaderBadge();
}

/* ──────────────────────────────────────────────────────────────
   Confirm modal (USWDS-styled)
   ────────────────────────────────────────────────────────────── */
function openConfirmModal({ title, desc, okLabel, action }) {
  const wrap = $("notifConfirmModal");
  const titleEl = $("notifConfirmTitle");
  const descEl = $("notifConfirmDesc");
  const okBtn = $("notifConfirmOk");

  if (!wrap || !titleEl || !descEl || !okBtn) return;

  pendingAction = action;

  titleEl.textContent = title || "Confirm";
  descEl.textContent = desc || "Are you sure?";
  okBtn.textContent = okLabel || "Delete";

  wrap.hidden = false;
  wrap.setAttribute("aria-hidden", "false");

  // focus OK by default
  try {
    okBtn.focus();
  } catch (_) {}
}

function closeConfirmModal() {
  const wrap = $("notifConfirmModal");
  if (!wrap) return;
  wrap.hidden = true;
  wrap.setAttribute("aria-hidden", "true");
  pendingAction = null;
}

function wireConfirmModal() {
  const wrap = $("notifConfirmModal");
  if (!wrap) return;

  wrap.querySelectorAll("[data-modal-close]").forEach((el) => {
    el.addEventListener("click", closeConfirmModal);
  });

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (!wrap || wrap.hidden) return;
    closeConfirmModal();
  });

  $("notifConfirmOk")?.addEventListener("click", () => {
    const act = pendingAction;
    closeConfirmModal();

    if (!act) return;

    if (act.type === "deleteSelected") {
      deleteByIds(act.ids || []);
      return;
    }
    if (act.type === "deleteAll") {
      deleteAllForMe();
      return;
    }
  });
}

/* ──────────────────────────────────────────────────────────────
   Selection UI helpers
   ────────────────────────────────────────────────────────────── */
function updateSelectedUI(visibleItems) {
  const labelWrap = $("selectedCountLabel");
  const countEl = $("selectedCount");
  const deleteSelectedBtn = $("deleteSelected");
  const deleteSelectedLabel = $("deleteSelectedLabel");

  const visibleIds = new Set((visibleItems || []).map((n) => String(n.id)));

  // drop selections not visible anymore
  Array.from(selected).forEach((id) => {
    if (!visibleIds.has(id)) selected.delete(id);
  });

  const selectedCount = Array.from(selected).filter((id) =>
    visibleIds.has(id),
  ).length;

  // show/hide selected count badge
  if (labelWrap && countEl) {
    if (selectedCount > 0) {
      labelWrap.hidden = false;
      countEl.textContent = String(selectedCount);
    } else {
      labelWrap.hidden = true;
      countEl.textContent = "0";
    }
  }

  // delete selected enabled state
  if (deleteSelectedBtn) {
    deleteSelectedBtn.disabled = selectedCount === 0;
    deleteSelectedBtn.setAttribute(
      "aria-disabled",
      selectedCount === 0 ? "true" : "false",
    );
  }

  // button label includes count
  if (deleteSelectedLabel) {
    deleteSelectedLabel.textContent =
      selectedCount > 0
        ? `Delete selected (${selectedCount})`
        : "Delete selected";
  }

  // select-all state (checked/indeterminate)
  const selectAllEl = $("selectAllNotifs");
  if (selectAllEl) {
    const visibleCount = visibleIds.size;
    if (visibleCount === 0) {
      selectAllEl.checked = false;
      selectAllEl.indeterminate = false;
      selectAllEl.disabled = true;
    } else {
      selectAllEl.disabled = false;
      selectAllEl.checked = selectedCount > 0 && selectedCount === visibleCount;
      selectAllEl.indeterminate =
        selectedCount > 0 && selectedCount < visibleCount;
    }
  }
}

function render() {
  const listEl = $("notifList");
  const emptyEl = $("notifEmpty");
  if (!listEl || !window.DatasetPortal?.notifications) return;

  const items = getVisibleItems();
  updateSelectedUI(items);

  if (!items.length) {
    if (emptyEl) emptyEl.hidden = false;
    listEl.innerHTML = "";
    return;
  }

  if (emptyEl) emptyEl.hidden = true;

  listEl.innerHTML = items
    .map((n) => {
      const unread = !n.read;
      const href = String(n.href || "").trim();
      const id = String(n.id);

      const title = escapeHtml(n.title || "Notification");
      const msg = escapeHtml(n.message || "");
      const time = escapeHtml(formatTime(n.createdAt));

      const isChecked = selected.has(id);
      const checkedAttr = isChecked ? "checked" : "";

      const checkboxId = `notifCheck_${id.replace(/[^a-zA-Z0-9_-]/g, "_")}`;

      return `
      <article class="notif-card ${unread ? "is-unread" : ""} ${
        isChecked ? "is-selected" : ""
      }" data-id="${escapeHtml(id)}">
        <div class="notif-row">
          <div class="notif-check">
            <div class="usa-checkbox">
              <input
                class="usa-checkbox__input"
                id="${escapeHtml(checkboxId)}"
                type="checkbox"
                data-select="${escapeHtml(id)}"
                ${checkedAttr}
              />
              <label class="usa-checkbox__label" for="${escapeHtml(checkboxId)}">
                <span class="usa-sr-only">Select notification</span>
              </label>
            </div>
          </div>

          <div class="notif-main">
            <div class="notif-meta">
              <div>
                <p class="notif-title">${title}</p>
                <p class="notif-msg">${msg}</p>
              </div>
              <div class="notif-time">${time}</div>
            </div>

            <div class="notif-foot">
              ${href ? `<a class="usa-link" href="${escapeHtml(href)}">Open</a>` : `<span></span>`}
              ${
                unread
                  ? `<button class="usa-button usa-button--unstyled" type="button" data-mark-read="${escapeHtml(
                      id,
                    )}">Mark read</button>`
                  : ""
              }

              <button class="notif-iconbtn" type="button" data-delete="${escapeHtml(
                id,
              )}" aria-label="Delete notification">
                <i class="fa-regular fa-trash-can" aria-hidden="true"></i>
              </button>
            </div>
          </div>
        </div>
      </article>
    `;
    })
    .join("");

  // Wire checkbox selection
  listEl.querySelectorAll("[data-select]").forEach((cb) => {
    cb.addEventListener("change", () => {
      const id = cb.getAttribute("data-select");
      if (!id) return;

      if (cb.checked) selected.add(id);
      else selected.delete(id);

      const card = cb.closest(".notif-card");
      if (card) card.classList.toggle("is-selected", cb.checked);

      updateSelectedUI(getVisibleItems());
    });
  });

  // Mark read
  listEl.querySelectorAll("[data-mark-read]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-mark-read");
      if (!id) return;
      window.DatasetPortal.notifications.markRead(id);
      render();
      updateHeaderBadge();
    });
  });

  // Delete single (no confirm yet; we can add if you want)
  listEl.querySelectorAll("[data-delete]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-delete");
      if (!id) return;
      deleteByIds([id]);
    });
  });
}

function init() {
  wireConfirmModal();

  // Select all
  $("selectAllNotifs")?.addEventListener("change", (e) => {
    const el = e.currentTarget;
    const items = getVisibleItems();
    if (!el || !items.length) return;

    if (el.checked) items.forEach((n) => selected.add(String(n.id)));
    else items.forEach((n) => selected.delete(String(n.id)));

    render();
  });

  // Mark all read
  $("markAllRead")?.addEventListener("click", () => {
    window.DatasetPortal?.notifications?.markAllRead?.();
    render();
    updateHeaderBadge();
  });

  // Delete selected (confirm modal)
  $("deleteSelected")?.addEventListener("click", () => {
    const items = getVisibleItems();
    const visibleIds = new Set(items.map((n) => String(n.id)));
    const ids = Array.from(selected).filter((id) => visibleIds.has(id));
    if (!ids.length) return;

    openConfirmModal({
      title: "Delete selected notifications",
      desc: `Delete ${ids.length} notification${ids.length === 1 ? "" : "s"}? This cannot be undone.`,
      okLabel: "Delete selected",
      action: { type: "deleteSelected", ids, count: ids.length },
    });
  });

  // Delete all (confirm modal)
  $("deleteAll")?.addEventListener("click", () => {
    const items = getVisibleItems();
    if (!items.length) return;

    openConfirmModal({
      title: "Delete all notifications",
      desc: "Delete all notifications? This cannot be undone.",
      okLabel: "Delete all",
      action: { type: "deleteAll" },
    });
  });

  render();
  updateHeaderBadge();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
