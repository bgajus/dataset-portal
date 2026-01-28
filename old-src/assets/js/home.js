// /src/assets/js/home.js
// Homepage-only behaviors:
// - Search clear button
// - Render Browse by Subject (show 10 with See more/less)
// - Render Latest Published Datasets (4 cards)

import { SUBJECT_OPTIONS } from "/src/assets/js/metadata-schema.js";
import { getAllRecords } from "/src/assets/js/shared-store.js";
import { getDemoDatasets } from "/src/assets/js/demo-datasets.js";

const SUBJECT_CARD_DEFAULT_COUNT = 10;
const LATEST_CARD_COUNT = 4;

const $ = (id) => document.getElementById(id);

function escapeHtml(str) {
  return String(str || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function wordsTruncate(text, maxWords = 18) {
  const s = String(text || "").trim();
  if (!s) return "";
  const words = s.split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return s;
  return words.slice(0, maxWords).join(" ") + "…";
}

function isoToDateValue(iso) {
  if (!iso) return 0;
  const d = new Date(String(iso).includes("T") ? iso : `${iso}T00:00:00`);
  const t = d.getTime();
  return Number.isFinite(t) ? t : 0;
}

function getHomepageDatasets() {
  const real = getAllRecords();

  // Homepage should only surface Published datasets.
  const published = Array.isArray(real)
    ? real.filter((r) => String(r.status || "").toLowerCase() === "published")
    : [];

  if (published.length) return published;

  // Fallback: use the SAME demo datasets as Search/Dataset landing pages.
  return getDemoDatasets();
}

function renderSearchClear() {
  const input = $("homeSearch");
  const clearBtn = $("homeClear");
  if (!input || !clearBtn) return;

  const sync = () => {
    const v = (input.value || "").trim();
    clearBtn.hidden = v.length === 0;
  };

  sync();
  input.addEventListener("input", sync);
  input.addEventListener("blur", sync);

  clearBtn.addEventListener("click", () => {
    input.value = "";
    sync();
    input.focus();
  });
}

function renderSubjects() {
  const host = $("homeSubjects");
  const toggle = $("homeSubjectsToggle");
  if (!host || !toggle) return;

  const subjects = Array.isArray(SUBJECT_OPTIONS) ? SUBJECT_OPTIONS.slice() : [];
  const total = subjects.length;

  const state = {
    expanded: false,
  };

  const render = () => {
    host.innerHTML = "";

    subjects.forEach((s, idx) => {
      const a = document.createElement("a");
      a.setAttribute("role", "listitem");
      a.className = "home-catcard";
      a.href = `/src/pages/search/index.html?subject=${encodeURIComponent(s)}`;
      a.textContent = s;

      if (!state.expanded && idx >= SUBJECT_CARD_DEFAULT_COUNT) {
        a.classList.add("home-catcard--hidden");
      }

      host.appendChild(a);
    });

    const needsToggle = total > SUBJECT_CARD_DEFAULT_COUNT;
    toggle.hidden = !needsToggle;
    toggle.setAttribute("aria-expanded", state.expanded ? "true" : "false");
    toggle.textContent = state.expanded ? "See less" : "See more";

    // Update helper text for screen readers
    if (needsToggle) {
      toggle.setAttribute(
        "aria-label",
        state.expanded ? "See fewer subjects" : `See all subjects (${total})`
      );
    }
  };

  toggle.addEventListener("click", () => {
    state.expanded = !state.expanded;
    render();
  });

  render();
}

function renderLatestPublished() {
  const host = $("homeLatest");
  if (!host) return;

  const all = getHomepageDatasets();

  // “Latest published” uses createdAt (demo) or publishedAt/createdAt (real)
  const normalized = all
    .map((r) => {
      const created = r.createdAt || r.publishedAt || r.publishedDate || r.updatedAt || "";
      return {
        doi: String(r.doi || "").trim(),
        title: String(r.title || "Untitled dataset").trim(),
        description: String(r.description || "").trim(),
        createdAt: created,
        _isDemo: !!r._isDemo,
      };
    })
    .filter((r) => r.doi);

  const sorted = normalized
    .slice()
    .sort((a, b) => isoToDateValue(b.createdAt) - isoToDateValue(a.createdAt));

  const top = sorted.slice(0, LATEST_CARD_COUNT);

  if (top.length === 0) {
    host.innerHTML = `
      <div class="usa-alert usa-alert--info">
        <div class="usa-alert__body">
          <p class="usa-alert__text">No published datasets yet.</p>
        </div>
      </div>
    `;
    return;
  }

  host.innerHTML = `
    <div class="home-latest__grid" role="list">
      ${top
        .map((d) => {
          const href = `/src/pages/dataset/index.html?doi=${encodeURIComponent(d.doi)}`;
          const desc = wordsTruncate(d.description, 18);
          return `
            <article class="home-ds-card" role="listitem">
              <h3 class="home-ds-card__title">${escapeHtml(d.title)}</h3>
              <p class="home-ds-card__desc">${escapeHtml(desc || "—")}</p>
              <div class="home-ds-card__doi">DOI: <span class="home-ds-card__doiVal">${escapeHtml(d.doi)}</span></div>
              <div class="home-ds-card__actions">
                <a class="usa-button btnBrandOutline" href="${href}">View dataset</a>
              </div>
            </article>
          `;
        })
        .join("")}
    </div>
  `;
}

function initHomepage() {
  renderSearchClear();
  renderSubjects();
  renderLatestPublished();
}

initHomepage();
