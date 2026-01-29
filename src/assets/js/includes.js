/**
 * Simple HTML includes for static multi-page prototypes.
 *
 * Usage:
 *   <div data-include="portal-header"></div>
 *   <main id="main-content">...</main>
 *   <div data-include="portal-footer"></div>
 *
 * Auth state:
 *   - Demo auth should be driven by localStorage 'dp-auth'
 *   - Pages MAY have <body data-auth="true|false"> but localStorage wins
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

function parseRoleList(value) {
  // Supports: "Curator", "Admin", "Curator,Admin", "Curator, Admin"
  return String(value || "")
    .split(",")
    .map((s) => normalizeRole(s))
    .filter(Boolean);
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

function roleAllows(requiredRoleOrList) {
  const role = getRole();
  const allowed = parseRoleList(requiredRoleOrList);

  // If no requirement provided, allow.
  if (!allowed.length) return true;

  // Admin sees everything.
  if (role === "Admin") return true;

  // If the element explicitly allows Submitter, allow everyone.
  if (allowed.includes("Submitter")) return true;

  // Otherwise role must match one of allowed.
  return allowed.includes(role);
}

function applyRoleState(rootEl) {
  if (!rootEl) return;

  rootEl.dataset.role = getRole();

  rootEl.querySelectorAll("[data-requires-role]").forEach((el) => {
    const req = el.getAttribute("data-requires-role");
    el.hidden = !roleAllows(req);
  });

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

function getDefaultUserProfile() {
  return {
    firstName: "Brian",
    middleName: "",
    lastName: "Gajus",
    email: "",
    affiliation: "",
    orcid: "",
    avatarDataUrl: "",
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
        `${String(profile.firstName || "").trim()} ${String(
          profile.lastName || "",
        ).trim()}`.trim() || "User avatar";
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

/**
 * IMPORTANT: localStorage dp-auth is the source of truth.
 * Some pages may have <body data-auth="false"> hardcoded for old demos;
 * this function intentionally ignores that if dp-auth exists.
 */
function getAuthState() {
  // 1) localStorage wins
  let stored = null;
  try {
    stored = localStorage.getItem("dp-auth");
  } catch (_) {}

  if (stored !== null && stored !== undefined) {
    const raw = String(stored).toLowerCase();
    return raw === "true" || raw === "1" || raw === "yes";
  }

  // 2) fallback to body attribute if localStorage doesn't exist yet
  const bodyAttr = document.body?.dataset?.auth;
  const raw = (bodyAttr ?? "false").toString().toLowerCase();
  return raw === "true" || raw === "1" || raw === "yes";
}

function applyAuthState(rootEl, isAuthed) {
  if (!rootEl) return;

  rootEl.dataset.auth = isAuthed ? "true" : "false";

  rootEl.querySelectorAll('[data-requires-auth="true"]').forEach((el) => {
    el.hidden = !isAuthed;
  });

  rootEl.querySelectorAll('[data-requires-auth="false"]').forEach((el) => {
    el.hidden = isAuthed;
  });
}

function htmlToNodes(html) {
  const tpl = document.createElement("template");
  tpl.innerHTML = html;
  return Array.from(tpl.content.childNodes);
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

  const nodes = htmlToNodes(html);

  const wrap = document.createElement("div");
  nodes.forEach((n) => wrap.appendChild(n.cloneNode(true)));

  // Apply state inside the included header/footer before inserting
  applyAuthState(wrap, getAuthState());
  applyRoleState(wrap);

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
    link.classList.remove("is-active");
    link.removeAttribute("aria-current");

    if (linkPath && currentPath.includes(linkPath)) {
      link.classList.add("is-active");
      link.setAttribute("aria-current", "page");
    }
  });
}

function initAvatarDropdown() {
  const avatarBtn = document.getElementById("avatarBtn");
  const userMenu = document.getElementById("userMenu");
  if (!avatarBtn || !userMenu) return;

  function toggleMenu() {
    const isExpanded = avatarBtn.getAttribute("aria-expanded") === "true";
    avatarBtn.setAttribute("aria-expanded", String(!isExpanded));
    userMenu.hidden = isExpanded;

    if (!isExpanded) {
      setTimeout(() => {
        const firstLink = userMenu.querySelector("a");
        if (firstLink) firstLink.focus();
      }, 0);
    }
  }

  avatarBtn.addEventListener("click", toggleMenu);

  document.addEventListener("click", (e) => {
    if (!avatarBtn.contains(e.target) && !userMenu.contains(e.target)) {
      avatarBtn.setAttribute("aria-expanded", "false");
      userMenu.hidden = true;
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !userMenu.hidden) {
      avatarBtn.setAttribute("aria-expanded", "false");
      userMenu.hidden = true;
      avatarBtn.focus();
    }
  });

  document.getElementById("signOutBtn")?.addEventListener("click", () => {
    // Sign out demo: set dp-auth false and redirect home
    try {
      localStorage.setItem("dp-auth", "false");
    } catch (_) {}
    window.location.href = "/index.html";
  });
}

function getNotificationsForCurrentUser() {
  const role = getRole();
  const email = String(getUserProfile()?.email || "")
    .trim()
    .toLowerCase();

  return readNotifications().filter((n) => {
    if (!n) return false;
    const byRole = normalizeRole(n.toRole) === role;
    if (!byRole) return false;

    const toEmail = String(n.toEmail || "")
      .trim()
      .toLowerCase();
    if (toEmail) return toEmail === email;
    return true;
  });
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

async function initIncludes() {
  const isAuthed = getAuthState();

  const placeholders = Array.from(document.querySelectorAll("[data-include]"));
  await Promise.all(
    placeholders.map((ph) => loadInclude(ph, ph.getAttribute("data-include"))),
  );

  // Apply state to the full page as a safety net
  applyAuthState(document.body, isAuthed);
  applyRoleState(document.body);

  document.querySelectorAll("[data-footer-year]").forEach((el) => {
    el.textContent = String(new Date().getFullYear());
  });

  setActiveNav();
  initAvatarDropdown();
  applyUserProfileToHeader();
  updateNotifBadge();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initIncludes);
} else {
  initIncludes();
}

window.addEventListener("popstate", setActiveNav);

window.DatasetPortal = window.DatasetPortal || {};
window.DatasetPortal.setAuth = function setAuth(isAuthed) {
  try {
    localStorage.setItem("dp-auth", isAuthed ? "true" : "false");
  } catch (_) {}
  window.location.reload();
};

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

window.DatasetPortal.getRole = function () {
  return getRole();
};

window.DatasetPortal.setRole = function (role) {
  const ok = setRole(role);
  if (ok) window.location.reload();
  return ok;
};

window.DatasetPortal.notifications = {
  add: addNotification,
  listForMe: getNotificationsForCurrentUser,
  markRead: markNotificationRead,
  markAllRead: markAllNotificationsRead,
  unreadCount: getUnreadCountForCurrentUser,
};
