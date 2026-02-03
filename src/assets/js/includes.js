/**
 * Simple HTML includes for static multi-page prototypes.
 *
 * Usage:
 *   <div data-include="portal-header"></div>
 *   <main id="main-content">...</main>
 *   <div data-include="portal-footer"></div>
 *
 * Auth state:
 *   - Set <body data-auth="true|false"> per page (recommended)
 *   - Or set localStorage 'dp-auth' to 'true'/'false'
 */

const INCLUDE_MAP = {
  "portal-header": "/components/header.html",
  "portal-footer": "/components/footer.html",
};

// ──────────────────────────────────────────────────────────────
// User profile (demo) — used for avatar + Settings page
// Stored in localStorage so it persists across pages
// ──────────────────────────────────────────────────────────────

const USER_STORAGE_KEY = "constellation:user:v1";

// Demo role (Submitter / Curator / Admin)
const ROLE_STORAGE_KEY = "constellation:role:v1";

// Notifications store (demo)
const NOTIF_STORAGE_KEY = "constellation:notifications:v1";

function normalizeRole(role) {
  const r = String(role || "")
    .trim()
    .toLowerCase();
  if (r === "curator") return "Curator";
  if (r === "admin") return "Admin";
  return "Submitter";
}

function getRole() {
  try {
    const raw = localStorage.getItem(ROLE_STORAGE_KEY);
    return normalizeRole(raw || "Submitter");
  } catch (_) {
    return "Submitter";
  }
}

function setRole(role) {
  try {
    localStorage.setItem(ROLE_STORAGE_KEY, normalizeRole(role));
    return true;
  } catch (e) {
    console.warn("Failed to save role:", e);
    return false;
  }
}

function roleAllows(requiredRole) {
  const role = getRole();
  const raw = String(requiredRole || "").trim();
  if (!raw) return true;

  // Support comma-separated role lists, e.g. "Curator,Admin"
  const reqs = raw
    .split(",")
    .map((s) => normalizeRole(s))
    .filter(Boolean);

  if (!reqs.length) return true;

  return reqs.some((req) => {
    if (!req) return true;
    if (req === "Submitter") return true;
    if (req === "Curator") return role === "Curator" || role === "Admin";
    if (req === "Admin") return role === "Admin";
    return true;
  });
}

function applyRoleState(rootEl) {
  if (!rootEl) return;

  rootEl.dataset.role = getRole();

  // Elements can declare data-requires-role="Curator" or "Admin"
  rootEl.querySelectorAll("[data-requires-role]").forEach((el) => {
    const req = el.getAttribute("data-requires-role");
    const shouldShow = roleAllows(req);

    // Use both the semantic [hidden] attribute and an inline display override.
    // Inline display ensures elements remain hidden even if CSS accidentally overrides [hidden].
    el.hidden = !shouldShow;
    el.setAttribute("aria-hidden", shouldShow ? "false" : "true");
    if (!shouldShow) {
      el.style.display = "none";
    } else {
      el.style.removeProperty("display");
    }
  });

  // Optional: show current role label if element exists
  const roleLabel = rootEl.querySelector("[data-role-label]");
  if (roleLabel) roleLabel.textContent = getRole();
}

// ──────────────────────────────────────────────────────────────
// Notifications (demo) — stored in localStorage
// ──────────────────────────────────────────────────────────────

function readNotifications() {
  try {
    const raw = localStorage.getItem(NOTIF_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
}

function writeNotifications(list) {
  try {
    localStorage.setItem(
      NOTIF_STORAGE_KEY,
      JSON.stringify(Array.isArray(list) ? list : []),
    );
  } catch (e) {
    console.warn("Failed to write notifications:", e);
  }
}

function addNotification({
  toRole,
  toEmail,
  title,
  message,
  href,
  recordDoi,
  kind,
} = {}) {
  const now = new Date().toISOString();
  const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const item = {
    id,
    createdAt: now,
    read: false,
    toRole: normalizeRole(toRole || "Submitter"),
    toEmail: String(toEmail || "").trim(),
    title: String(title || "Notification"),
    message: String(message || ""),
    href: String(href || ""),
    recordDoi: String(recordDoi || ""),
    kind: String(kind || "info"),
  };

  const list = readNotifications();
  list.unshift(item);
  writeNotifications(list);
  updateNotifBadge();
  return item;
}

function getCurrentUserEmail() {
  const p = getUserProfile();
  return String(p?.email || "").trim();
}

function getNotificationsForCurrentUser() {
  const role = getRole();
  const email = getCurrentUserEmail();
  return readNotifications().filter((n) => {
    if (!n) return false;
    const byRole = normalizeRole(n.toRole) === role;
    if (!byRole) return false;
    // If a notification is addressed to a specific email, enforce it
    if (String(n.toEmail || "").trim()) {
      return (
        String(n.toEmail || "")
          .trim()
          .toLowerCase() === email.toLowerCase()
      );
    }
    return true;
  });
}

function markNotificationRead(id) {
  const list = readNotifications();
  const next = list.map((n) => (n?.id === id ? { ...n, read: true } : n));
  writeNotifications(next);
  updateNotifBadge();
}

function markAllNotificationsRead() {
  const list = readNotifications();
  const next = list.map((n) => ({ ...n, read: true }));
  writeNotifications(next);
  updateNotifBadge();
}

function getUnreadCountForCurrentUser() {
  return getNotificationsForCurrentUser().filter((n) => !n.read).length;
}

function updateNotifBadge() {
  const badge = document.getElementById("notifBadge");
  if (!badge) return;
  const count = getUnreadCountForCurrentUser();
  badge.hidden = count <= 0;
  badge.textContent = String(count);
}

function getDefaultUserProfile() {
  return {
    firstName: "Brian",
    middleName: "",
    lastName: "Gajus",
    email: "",
    affiliation: "",
    orcid: "",
    avatarDataUrl: "", // base64/data URL
  };
}

function getUserProfile() {
  try {
    const raw = localStorage.getItem(USER_STORAGE_KEY);
    if (!raw) return getDefaultUserProfile();
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return getDefaultUserProfile();
    return { ...getDefaultUserProfile(), ...parsed };
  } catch (e) {
    return getDefaultUserProfile();
  }
}

function getUserInitials(profile) {
  const first = String(profile?.firstName || "").trim();
  const last = String(profile?.lastName || "").trim();
  const a = first ? first[0].toUpperCase() : "";
  const b = last ? last[0].toUpperCase() : "";
  return a + b || "??";
}

function applyUserProfileToHeader() {
  const profile = getUserProfile();

  const initialsEl = document.getElementById("avatarInitials");
  const imgEl = document.getElementById("avatarImg");

  if (initialsEl) initialsEl.textContent = getUserInitials(profile);

  const hasAvatar = !!String(profile.avatarDataUrl || "").trim();
  if (imgEl) {
    if (hasAvatar) {
      imgEl.src = profile.avatarDataUrl;
      imgEl.alt =
        `${String(profile.firstName || "").trim()} ${String(profile.lastName || "").trim()}`.trim() ||
        "User avatar";
      imgEl.hidden = false;
      if (initialsEl) initialsEl.hidden = true;
    } else {
      imgEl.removeAttribute("src");
      imgEl.alt = "";
      imgEl.hidden = true;
      if (initialsEl) initialsEl.hidden = false;
    }
  }
}

function getAuthState() {
  // IMPORTANT: In the demo, localStorage is the source of truth for auth.
  // Some pages ship with <body data-auth="false"> for static fallbacks,
  // but once a user signs in/out we must honor dp-auth across pages.
  const stored = localStorage.getItem("dp-auth");
  const bodyAttr = document.body?.dataset?.auth;

  const raw = (stored ?? bodyAttr ?? "false").toString().toLowerCase();
  return raw === "true" || raw === "1" || raw === "yes";
}

function applyAuthState(rootEl, isAuthed) {
  if (!rootEl) return;

  rootEl.dataset.auth = isAuthed ? "true" : "false";

  rootEl.querySelectorAll('[data-requires-auth="true"]').forEach((el) => {
    const shouldShow = !!isAuthed;
    el.hidden = !shouldShow;
    el.setAttribute("aria-hidden", shouldShow ? "false" : "true");
    if (!shouldShow) {
      el.style.display = "none";
    } else {
      el.style.removeProperty("display");
    }
  });

  rootEl.querySelectorAll('[data-requires-auth="false"]').forEach((el) => {
    const shouldShow = !isAuthed;
    el.hidden = !shouldShow;
    el.setAttribute("aria-hidden", shouldShow ? "false" : "true");
    if (!shouldShow) {
      el.style.display = "none";
    } else {
      el.style.removeProperty("display");
    }
  });
}

function escapeHtml(str) {
  return String(str ?? "").replace(
    /[&<>"']/g,
    (s) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        s
      ],
  );
}

function formatNotifTime(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch (_) {
    return "";
  }
}

function htmlToNodes(html) {
  const tpl = document.createElement("template");
  tpl.innerHTML = html;
  return Array.from(tpl.content.childNodes); // includes text nodes; that's OK
}

async function loadInclude(target, includeKey) {
  const key = (includeKey || "").trim();
  const url = INCLUDE_MAP[key];

  if (!url) {
    console.warn(`[includes] Unknown include key: "${key}"`);
    return;
  }

  const res = await fetch(url, { cache: "no-cache" });
  if (!res.ok) {
    console.warn(`[includes] Failed to load ${url} (${res.status})`);
    return;
  }

  const html = await res.text();
  if (!html || !html.trim()) {
    console.warn(`[includes] Loaded ${url} but it was empty.`);
    return;
  }

  // Build nodes from the fetched HTML (supports multiple top-level elements).
  const nodes = htmlToNodes(html);

  // Apply auth toggles to any included elements (wrap to query safely).
  const wrap = document.createElement("div");
  nodes.forEach((n) => wrap.appendChild(n.cloneNode(true)));
  applyAuthState(wrap, getAuthState());
  applyRoleState(wrap);

  // Replace placeholder with the wrapped children.
  const outNodes = Array.from(wrap.childNodes);
  target.replaceWith(...outNodes);
}

function setActiveNav() {
  const currentPath = window.location.pathname;
  const navLinks = document.querySelectorAll(
    ".portal-authnav__item[data-path], .usa-menu__link[data-path]",
  );

  navLinks.forEach((link) => {
    const linkPath = link.getAttribute("data-path");
    // Remove active from all
    link.classList.remove("is-active");
    link.removeAttribute("aria-current");

    // Add to matching one (partial match for flexibility)
    if (currentPath.includes(linkPath)) {
      link.classList.add("is-active");
      link.setAttribute("aria-current", "page"); // Accessibility win
    }
  });
}

function initAvatarDropdown() {
  const avatarBtn = document.getElementById("avatarBtn");
  const userMenu = document.getElementById("userMenu");

  if (!avatarBtn || !userMenu) return;

  function toggleMenu() {
    const isExpanded = avatarBtn.getAttribute("aria-expanded") === "true";
    avatarBtn.setAttribute("aria-expanded", !isExpanded);
    userMenu.hidden = isExpanded;

    // Focus first menu item when opening
    if (!isExpanded) {
      setTimeout(() => {
        const firstLink = userMenu.querySelector("a");
        if (firstLink) firstLink.focus();
      }, 0);
    }
  }

  avatarBtn.addEventListener("click", toggleMenu);

  // Close on outside click
  document.addEventListener("click", (e) => {
    if (!avatarBtn.contains(e.target) && !userMenu.contains(e.target)) {
      avatarBtn.setAttribute("aria-expanded", "false");
      userMenu.hidden = true;
    }
  });

  // Close on ESC
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !userMenu.hidden) {
      avatarBtn.setAttribute("aria-expanded", "false");
      userMenu.hidden = true;
      avatarBtn.focus();
    }
  });

  // Sign Out (demo)
  document.getElementById("signOutBtn")?.addEventListener("click", () => {
    alert("Signed out (demo) — redirecting to login...");
    // Real implementation: clear auth and reload
    // window.DatasetPortal.setAuth(false);
  });
}

function initNotifSlideout() {
  const bellBtn = document.getElementById("notifBellBtn");
  const panel = document.getElementById("notifPanel");
  const back = document.getElementById("notifBack");
  const closeBtn = document.getElementById("notifCloseBtn");
  const listEl = document.getElementById("notifPanelList");
  const emptyEl = document.getElementById("notifPanelEmpty");
  const unreadChip = document.getElementById("notifPanelUnreadChip");
  const unreadCountEl = document.getElementById("notifPanelUnreadCount");
  const markAllBtn = document.getElementById("notifMarkAllReadBtn");

  if (!bellBtn || !panel || !back || !listEl) return;

  function isOpen() {
    return panel.classList.contains("is-open");
  }

  function setOpen(open) {
    if (open) {
      panel.hidden = false;
      back.hidden = false;

      // allow CSS transitions
      requestAnimationFrame(() => {
        panel.classList.add("is-open");
        back.classList.add("is-open");
      });

      bellBtn.setAttribute("aria-expanded", "true");
      panel.setAttribute("aria-hidden", "false");

      // Lock scroll like a typical notifications drawer
      document.body.style.overflow = "hidden";

      render();
      // focus close button for accessibility
      setTimeout(() => {
        (closeBtn || panel).focus?.();
      }, 0);
    } else {
      panel.classList.remove("is-open");
      back.classList.remove("is-open");
      bellBtn.setAttribute("aria-expanded", "false");
      panel.setAttribute("aria-hidden", "true");

      document.body.style.overflow = "";

      // wait for transition to finish before hiding
      window.setTimeout(() => {
        if (!panel.classList.contains("is-open")) {
          panel.hidden = true;
          back.hidden = true;
        }
      }, 200);
    }
  }

  function toggle() {
    setOpen(!isOpen());
  }

  function render() {
    const list = window.DatasetPortal?.notifications?.listForMe?.() || [];
    const unread = list.filter((n) => n && !n.read).length;

    if (unreadCountEl) unreadCountEl.textContent = String(unread);
    if (unreadChip) unreadChip.hidden = unread <= 0;

    const top = list.slice(0, 5);

    if (emptyEl) emptyEl.hidden = top.length !== 0;

    listEl.innerHTML = top
      .map((n) => {
        const title = escapeHtml(n.title || "Notification");
        const msg = escapeHtml(n.message || "");
        const when = escapeHtml(formatNotifTime(n.createdAt));
        const href = String(n.href || "").trim();
        const unreadClass = n.read ? "" : " is-unread";
        const dot = n.read
          ? ""
          : '<span class="portal-notifDot" aria-hidden="true"></span>';

        // We render an <a> for expected behavior; we intercept click to mark read + close.
        const safeHref = href || "javascript:void(0)";
        return `
          <article class="portal-notifItem${unreadClass}" role="listitem" data-notif-id="${escapeHtml(n.id || "")}" data-notif-href="${escapeHtml(href)}">
            <a class="portal-notifItem__link" href="${escapeHtml(safeHref)}">
              ${dot}
              <div class="portal-notifItem__main">
                <div class="portal-notifItem__top">
                  <div class="portal-notifItem__title">${title}</div>
                  <div class="portal-notifItem__time">${when}</div>
                </div>
                <div class="portal-notifItem__msg">${msg}</div>
              </div>
            </a>
          </article>
        `;
      })
      .join("");

    // wire click handlers
    listEl.querySelectorAll(".portal-notifItem__link").forEach((a) => {
      a.addEventListener("click", (e) => {
        const item = a.closest(".portal-notifItem");
        if (!item) return;

        const id = item.getAttribute("data-notif-id");
        const href = item.getAttribute("data-notif-href") || "";

        // Always mark read when opened from the panel
        if (id) window.DatasetPortal?.notifications?.markRead?.(id);

        // Update badge + rerender before navigating
        updateNotifBadge();
        render();

        // Close the panel
        setOpen(false);

        // Navigate only if we have a real href
        if (href) {
          e.preventDefault();
          window.location.href = href;
        }
      });
    });
  }

  bellBtn.addEventListener("click", (e) => {
    e.preventDefault();
    toggle();
  });

  closeBtn?.addEventListener("click", () => setOpen(false));
  back.addEventListener("click", () => setOpen(false));

  markAllBtn?.addEventListener("click", () => {
    window.DatasetPortal?.notifications?.markAllRead?.();
    updateNotifBadge();
    render();
  });

  // ESC closes
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && isOpen()) {
      setOpen(false);
      try {
        bellBtn.focus();
      } catch (_) {}
    }
  });

  // Close if avatar menu opens (optional safety)
  document.getElementById("avatarBtn")?.addEventListener("click", () => {
    if (isOpen()) setOpen(false);
  });

  // Re-render on storage changes (multiple tabs / demo role changes)
  window.addEventListener("storage", (evt) => {
    if (evt.key === "constellation:notifications:v1") {
      updateNotifBadge();
      if (isOpen()) render();
    }
  });
}

async function initIncludes() {
  const isAuthed = getAuthState();

  const placeholders = Array.from(document.querySelectorAll("[data-include]"));
  await Promise.all(
    placeholders.map((ph) => loadInclude(ph, ph.getAttribute("data-include"))),
  );

  // Apply auth toggles across the whole page (fallback safety)
  applyAuthState(document.body, isAuthed);
  applyRoleState(document.body);

  // Post-processing helpers
  document.querySelectorAll("[data-footer-year]").forEach((el) => {
    el.textContent = String(new Date().getFullYear());
  });

  // Highlight active nav item after includes load
  setActiveNav();

  // Initialize avatar dropdown
  initAvatarDropdown();
  initNotifSlideout();

  // Apply user profile (avatar initials / photo)
  applyUserProfileToHeader();

  // Notification badge in header
  updateNotifBadge();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initIncludes);
} else {
  initIncludes();
}

// Also re-run on popstate (back/forward navigation) for single-page feel
window.addEventListener("popstate", setActiveNav);

window.DatasetPortal = window.DatasetPortal || {};
window.DatasetPortal.setAuth = function setAuth(isAuthed) {
  localStorage.setItem("dp-auth", isAuthed ? "true" : "false");
  window.location.reload();
};

// Expose user profile helpers for pages that want them (e.g., Settings)
window.DatasetPortal.getUserProfile = function () {
  return getUserProfile();
};

window.DatasetPortal.saveUserProfile = function (profile) {
  try {
    const merged = { ...getDefaultUserProfile(), ...(profile || {}) };
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(merged));
    applyUserProfileToHeader();
    return true;
  } catch (e) {
    console.warn("Failed to save user profile:", e);
    return false;
  }
};

// Role helpers
window.DatasetPortal.getRole = function () {
  return getRole();
};

window.DatasetPortal.setRole = function (role) {
  const ok = setRole(role);
  if (ok) window.location.reload();
  return ok;
};

// Notifications helpers
window.DatasetPortal.notifications = {
  add: addNotification,
  listForMe: getNotificationsForCurrentUser,
  markRead: markNotificationRead,
  markAllRead: markAllNotificationsRead,
  unreadCount: getUnreadCountForCurrentUser,
};
