/**
 * src/assets/js/includes.js
 *
 * Loads header/footer includes and applies auth-aware UI toggles.
 * Also provides a shared "avatar model" so pages (dashboard/settings/etc.)
 * render user identity consistently across demo + API modes.
 */

import { getSession } from "../../shared/data/authClient.js";

const INCLUDE_MAP = {
  "portal-header": "/components/header.html",
  "portal-footer": "/components/footer.html",
};

// ──────────────────────────────────────────────────────────────
// Demo user profile (localStorage)
// ──────────────────────────────────────────────────────────────

const USER_STORAGE_KEY = "constellation:user:v1";

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
  } catch {
    return getDefaultUserProfile();
  }
}

function saveUserProfile(profile) {
  try {
    const merged = { ...getDefaultUserProfile(), ...(profile || {}) };
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(merged));
    return true;
  } catch (e) {
    console.warn("Failed to save user profile:", e);
    return false;
  }
}

function initialsFromName(name) {
  const n = String(name || "").trim();
  if (!n) return "??";
  const parts = n.split(/\s+/).filter(Boolean);
  const a = parts[0]?.[0]?.toUpperCase() || "";
  const b = parts.length > 1 ? parts[parts.length - 1][0]?.toUpperCase() || "" : "";
  return (a + b) || "??";
}

function initialsFromProfile(profile) {
  const first = String(profile?.firstName || "").trim();
  const last = String(profile?.lastName || "").trim();
  const a = first ? first[0].toUpperCase() : "";
  const b = last ? last[0].toUpperCase() : "";
  return (a + b) || "??";
}

function getDemoAuthState() {
  const bodyAttr = document.body?.dataset?.auth;
  const stored = localStorage.getItem("dp-auth");
  const raw = (bodyAttr ?? stored ?? "false").toString().toLowerCase();
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

async function loadInclude(target, includeKey, isAuthed) {
  const key = (includeKey || "").trim();
  const includeUrl = INCLUDE_MAP[key];

  if (!includeUrl) {
    console.warn(`[includes] Unknown include key: "${key}"`);
    return;
  }

  const res = await fetch(includeUrl, { cache: "no-cache" });
  if (!res.ok) {
    console.warn(`[includes] Failed to load ${includeUrl} (${res.status})`);
    return;
  }

  const html = await res.text();
  const nodes = htmlToNodes(html);

  const wrap = document.createElement("div");
  nodes.forEach((n) => wrap.appendChild(n.cloneNode(true)));
  applyAuthState(wrap, isAuthed);

  target.replaceWith(...Array.from(wrap.childNodes));
}

function setActiveNav() {
  const currentPath = window.location.pathname;
  const navLinks = document.querySelectorAll(
    ".portal-authnav__item[data-path], .usa-menu__link[data-path]"
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
        const firstLink = userMenu.querySelector("a,button");
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
}

function wireHeaderAuthLinks({ mode, dkanOrigin }) {
  const loggedOut = document.querySelector(".portal-auth__loggedout");
  if (!loggedOut) return;

  // Log In button is wrapped in an <a> in your header
  const loginAnchor = loggedOut.querySelector('a[href][class*="usa-link--unstyled"]');
  const signupLink = loggedOut.querySelector(".portal-auth__signup");

  if (mode === "api") {
    if (loginAnchor) {
      loginAnchor.href = `${dkanOrigin.replace(/\/$/, "")}/user/login`;
      loginAnchor.target = "_blank";
      loginAnchor.rel = "noopener noreferrer";
    }
    if (signupLink) {
      signupLink.href = `${dkanOrigin.replace(/\/$/, "")}/user/register`;
      signupLink.target = "_blank";
      signupLink.rel = "noopener noreferrer";
    }
  } else {
    if (loginAnchor) {
      loginAnchor.href = "/src/pages/dashboard/index.html";
      loginAnchor.removeAttribute("target");
      loginAnchor.removeAttribute("rel");
    }
    if (signupLink) {
      signupLink.href = "javascript:void(0)";
      signupLink.removeAttribute("target");
      signupLink.removeAttribute("rel");
    }
  }
}

function wireSignOut({ mode, dkanOrigin }) {
  const btn = document.getElementById("signOutBtn");
  if (!btn) return;

  btn.addEventListener("click", (e) => {
    e.preventDefault();

    if (mode === "api") {
      const logoutUrl = `${dkanOrigin.replace(/\/$/, "")}/user/logout`;
      window.open(logoutUrl, "_blank", "noopener,noreferrer");
      localStorage.removeItem("dp-auth");
      setTimeout(() => window.location.reload(), 250);
      return;
    }

    localStorage.setItem("dp-auth", "false");
    window.location.reload();
  });
}

function applyHeaderAvatar({ avatarModel }) {
  const initialsEl = document.getElementById("avatarInitials");
  const imgEl = document.getElementById("avatarImg");

  if (initialsEl) initialsEl.textContent = avatarModel.initials || "??";

  if (imgEl) {
    const hasAvatar = !!String(avatarModel.avatarDataUrl || "").trim();
    if (hasAvatar) {
      imgEl.src = avatarModel.avatarDataUrl;
      imgEl.alt = avatarModel.displayName || "User avatar";
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

async function detectAuth() {
  const mode = String(import.meta.env.VITE_DATA_MODE || "demo").toLowerCase();

  if (mode !== "api") {
    return { isAuthed: getDemoAuthState(), sessionUser: null, mode };
  }

  try {
    const session = await getSession();
    return {
      isAuthed: !!session?.isAuthenticated,
      sessionUser: session?.user || null,
      mode,
    };
  } catch (e) {
    console.warn("Auth detection failed; falling back to logged-out:", e);
    return { isAuthed: false, sessionUser: null, mode };
  }
}

function buildAvatarModel({ isAuthed, sessionUser }) {
  const profile = getUserProfile();
  const hasAvatar = !!String(profile.avatarDataUrl || "").trim();

  // Display name:
  // - If API authed, prefer Drupal username (or display_name)
  // - Otherwise, use demo first/last
  const displayName =
    (isAuthed && (sessionUser?.name || "")) ||
    `${String(profile.firstName || "").trim()} ${String(profile.lastName || "").trim()}`.trim() ||
    "User";

  // Initials:
  // - If API authed, prefer initials from Drupal username
  // - Else demo initials from profile
  const initials = isAuthed
    ? initialsFromName(sessionUser?.name || "")
    : initialsFromProfile(profile);

  return {
    isAuthed,
    displayName,
    initials,
    avatarDataUrl: hasAvatar ? profile.avatarDataUrl : "",
    demoProfile: profile,
    sessionUser: sessionUser || null,
  };
}

async function initIncludes() {
  const dkanOrigin = import.meta.env.VITE_DKAN_ORIGIN || "http://dkan-local.ddev.site";

  // Cache session result so other pages can read it too
  const { isAuthed, sessionUser, mode } = await detectAuth();
  const avatarModel = buildAvatarModel({ isAuthed, sessionUser });

  // Load includes
  const placeholders = Array.from(document.querySelectorAll("[data-include]"));
  await Promise.all(
    placeholders.map((ph) => loadInclude(ph, ph.getAttribute("data-include"), isAuthed))
  );

  // Apply auth toggles across the whole page (fallback safety)
  applyAuthState(document.body, isAuthed);

  // Footer year
  document.querySelectorAll("[data-footer-year]").forEach((el) => {
    el.textContent = String(new Date().getFullYear());
  });

  // Highlight active nav item after includes load
  setActiveNav();

  // Initialize avatar dropdown
  initAvatarDropdown();

  // Update header login/signup targets based on mode
  wireHeaderAuthLinks({ mode, dkanOrigin });

  // Wire sign out
  wireSignOut({ mode, dkanOrigin });

  // Apply header avatar (initials/photo)
  applyHeaderAvatar({ avatarModel });

  // Notify pages that session + includes are ready
  window.dispatchEvent(
    new CustomEvent("dp:session-ready", {
      detail: { isAuthed, sessionUser, mode, avatarModel },
    })
  );
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initIncludes);
} else {
  initIncludes();
}

window.addEventListener("popstate", setActiveNav);

// ──────────────────────────────────────────────────────────────
// Public helpers for pages
// ──────────────────────────────────────────────────────────────

window.DatasetPortal = window.DatasetPortal || {};

window.DatasetPortal.setAuth = function setAuth(isAuthed) {
  localStorage.setItem("dp-auth", isAuthed ? "true" : "false");
  window.location.reload();
};

window.DatasetPortal.getUserProfile = function () {
  return getUserProfile();
};

window.DatasetPortal.saveUserProfile = function (profile) {
  const ok = saveUserProfile(profile);
  // If header exists, refresh avatar immediately in demo mode
  try {
    const isAuthed = getDemoAuthState();
    const avatarModel = buildAvatarModel({ isAuthed, sessionUser: null });
    applyHeaderAvatar({ avatarModel });
  } catch {
    // ignore
  }
  return ok;
};

window.DatasetPortal.getAvatarModel = function getAvatarModel() {
  // Best-effort: if dp:session-ready already fired, consumers should use the event.
  // This function returns a model based on current best-known state.
  const mode = String(import.meta.env.VITE_DATA_MODE || "demo").toLowerCase();
  const isAuthed = mode === "api" ? false : getDemoAuthState();
  return buildAvatarModel({ isAuthed, sessionUser: null });
};
