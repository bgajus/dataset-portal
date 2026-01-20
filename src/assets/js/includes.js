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
  'portal-header': '/src/components/header.html',
  'portal-footer': '/src/components/footer.html',
};

function getAuthState() {
  const bodyAttr = document.body?.dataset?.auth;
  const stored = localStorage.getItem('dp-auth');
  const raw = (bodyAttr ?? stored ?? 'false').toString().toLowerCase();
  return raw === 'true' || raw === '1' || raw === 'yes';
}

function applyAuthState(rootEl, isAuthed) {
  if (!rootEl) return;

  rootEl.dataset.auth = isAuthed ? 'true' : 'false';

  rootEl.querySelectorAll('[data-requires-auth="true"]').forEach((el) => {
    el.hidden = !isAuthed;
  });

  rootEl.querySelectorAll('[data-requires-auth="false"]').forEach((el) => {
    el.hidden = isAuthed;
  });
}

function htmlToNodes(html) {
  const tpl = document.createElement('template');
  tpl.innerHTML = html;
  return Array.from(tpl.content.childNodes); // includes text nodes; that's OK
}

async function loadInclude(target, includeKey) {
  const key = (includeKey || '').trim();
  const url = INCLUDE_MAP[key];

  if (!url) {
    console.warn(`[includes] Unknown include key: "${key}"`);
    return;
  }

  const res = await fetch(url, { cache: 'no-cache' });
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
  const wrap = document.createElement('div');
  nodes.forEach((n) => wrap.appendChild(n.cloneNode(true)));
  applyAuthState(wrap, getAuthState());

  // Replace placeholder with the wrapped children.
  const outNodes = Array.from(wrap.childNodes);
  target.replaceWith(...outNodes);
}

function setActiveNav() {
  const currentPath = window.location.pathname;
  const navLinks = document.querySelectorAll(".portal-authnav__item[data-path], .usa-menu__link[data-path]");

  navLinks.forEach(link => {
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
        const firstLink = userMenu.querySelector('a');
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

async function initIncludes() {
  const isAuthed = getAuthState();

  const placeholders = Array.from(document.querySelectorAll('[data-include]'));
  await Promise.all(
    placeholders.map((ph) =>
      loadInclude(ph, ph.getAttribute('data-include'))
    )
  );

  // Apply auth toggles across the whole page (fallback safety)
  applyAuthState(document.body, isAuthed);

  // Post-processing helpers
  document.querySelectorAll('[data-footer-year]').forEach((el) => {
    el.textContent = String(new Date().getFullYear());
  });

  // Highlight active nav item after includes load
  setActiveNav();

  // Initialize avatar dropdown
  initAvatarDropdown();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initIncludes);
} else {
  initIncludes();
}

// Also re-run on popstate (back/forward navigation) for single-page feel
window.addEventListener('popstate', setActiveNav);

window.DatasetPortal = window.DatasetPortal || {};
window.DatasetPortal.setAuth = function setAuth(isAuthed) {
  localStorage.setItem('dp-auth', isAuthed ? 'true' : 'false');
  window.location.reload();
};