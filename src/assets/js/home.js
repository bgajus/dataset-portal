// /src/assets/js/home.js
// Homepage-only behaviors:
// - Search clear button
// - Render Browse by Subject (show 10 with See more/less)
// - Render Latest Published Datasets (4 cards)
//
// Rewired to use dataClient, with a safe fallback to SUBJECT_OPTIONS
// so the homepage never shows an empty Subjects section due to vocab/API issues.

import { SUBJECT_OPTIONS } from "/src/assets/js/metadata-schema.js";
import { getLatestPublished, getVocabularies } from "../../shared/data/dataClient.js";

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

async function renderSubjects() {
  const host = $("homeSubjects");
  const toggle = $("homeSubjectsToggle");
  if (!host || !toggle) return;

  // Prefer vocabularies (future-proof for DKAN/API),
  // but fall back to SUBJECT_OPTIONS so UI is never blank.
  let subjects = [];

  try {
    const vocabs = await getVocabularies();
    if (Array.isArray(vocabs?.subjects) && vocabs.subjects.length) {
      subjects = vocabs.subjects.slice();
    }
  } catch (e) {
    console.warn("Homepage: getVocabularies() failed, falling back to SUBJECT_OPTIONS", e);
  }

  if (!subjects.length) {
    subjects = Array.isArray(SUBJECT_OPTIONS) ? SUBJECT_OPTIONS.slice() : [];
  }

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

async function renderLatestPublished() {
  const host = $("homeLatest");
  if (!host) return;

  let latest = [];
  try {
    latest = await getLatestPublished(LATEST_CARD_COUNT);
  } catch (e) {
    console.warn("Homepage: getLatestPublished() failed", e);
    latest = [];
  }

  const normalized = (Array.isArray(latest) ? latest : [])
    .map((r) => {
      const created = r.publishedAt || r.createdAt || r.publishedDate || r.updatedAt || "";
      return {
        doi: String(r.doi || "").trim(),
        title: String(r.title || "Untitled dataset").trim(),
        description: String(r.description || "").trim(),
        createdAt: created,
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

async function initHomepage() {
  renderSearchClear();
  await renderSubjects();
  await renderLatestPublished();
}

initHomepage();
