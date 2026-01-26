// src/pages/my-datasets/my-datasets.js
import { getAllRecords } from "/src/assets/js/shared-store.js";
import { getSession, getMyDatasets } from "/src/shared/data/dataClient.js";

// My Datasets
// - Sortable columns + search
// - Filter popover (Status)
// - Count chip in card header
// - Pagination (USWDS markup) like screenshot
// - API mode: uses Drupal JSON:API to fetch authenticated user's datasets (workflow read)
// - Demo mode: falls back to local store records

(() => {
  const tableBody = document.getElementById("datasetsBody");
  const emptyState = document.getElementById("emptyState");

  const searchFilter = document.getElementById("searchFilter");
  const datasetCountChip = document.getElementById("datasetCountChip");

  // Pagination elements
  const paginationBar = document.getElementById("paginationBar");
  const paginationList = document.getElementById("paginationList");

  // Filter UI
  const filterBtn = document.getElementById("filterBtn");
  const filterPopover = document.getElementById("filterPopover");
  const filterBackdrop = document.getElementById("filterBackdrop");
  const filterCloseBtn = document.getElementById("filterCloseBtn");
  const clearFiltersBtn = document.getElementById("clearFiltersBtn");
  const applyFiltersBtn = document.getElementById("applyFiltersBtn");
  const statusFilter = document.getElementById("statusFilter");

  let allDatasets = [];
  let sortColumn = "startedOn";
  let sortDirection = "desc";

  // "Applied" filter state (commits on Apply)
  let appliedStatus = "all";

  // Pagination state
  const PAGE_SIZE = 10;
  let currentPage = 1;
  let currentFiltered = [];

  function escapeHtml(str) {
    return String(str || "").replace(/[&<>"']/g, (s) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }[s]));
  }

  function formatDate(iso) {
    if (!iso) return "—";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    return (
      d.toLocaleDateString(undefined, { month: "numeric", day: "numeric", year: "2-digit" }) +
      " " +
      d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
    );
  }

  function normalizeStatusLabel(status) {
    const s = String(status || "Draft").trim();
    // We want consistent labels for UI + getStatusClass()
    // Examples we may see:
    // - "published" (Drupal moderation_state)
    // - "Published" (your canonical model)
    // - "in_review" / "in review"
    // - "needs_updates" / "needs updates"
    const low = s.toLowerCase();

    if (low === "published") return "Published";
    if (low === "draft") return "Draft";

    if (low === "in_review" || low === "in review") return "In Review";
    if (low === "needs_updates" || low === "needs updates") return "Needs Updates";

    // Title-case fallback for unknowns
    return s.length ? s[0].toUpperCase() + s.slice(1) : "Draft";
  }

  function getStatusClass(status) {
    const s = (status || "Draft").toLowerCase();
    if (s === "draft") return "status-draft";
    if (s === "in review") return "status-inreview";
    if (s === "needs updates") return "status-needsupdates";
    if (s === "published") return "status-published";
    return "status-draft";
  }

  function getRowLink(ds) {
    const status = (ds.status || "Draft").toLowerCase();
    const doi = encodeURIComponent(ds.doi || "");
    if (status === "published") return `/src/pages/dataset/index.html?doi=${doi}`;
    return `/src/pages/editor/index.html?doi=${doi}`;
  }

  function updateSortIndicators() {
    document.querySelectorAll("#datasetsTable thead th[data-sort]").forEach((th) => {
      th.removeAttribute("data-sort-state");
      if (th.dataset.sort === sortColumn) {
        th.setAttribute("data-sort-state", sortDirection);
      }
    });
  }

  function renderTableRows(datasetsPage) {
    tableBody.innerHTML = "";

    if (currentFiltered.length === 0) {
      emptyState.hidden = false;
      if (paginationBar) paginationBar.hidden = true;
      datasetCountChip.textContent = "0 datasets";
      return;
    }

    emptyState.hidden = true;
    datasetCountChip.textContent = `${currentFiltered.length} datasets`;

    datasetsPage.forEach((ds) => {
      const row = document.createElement("tr");

      const link = getRowLink(ds);
      const statusText = ds.status || "Draft";
      const isPublished = (statusText || "").toLowerCase() === "published";
      const actionIcon = isPublished ? "fa-eye" : "fa-pencil";

      row.innerHTML = `
        <td>
          <a href="${link}" class="usa-link">${escapeHtml(ds.title || "Untitled")}</a>
        </td>
        <td>${escapeHtml(ds.doi || "—")}</td>
        <td>${formatDate(ds.createdAt)}</td>
        <td>${formatDate(ds.submittedAt)}</td>
        <td>
          <span class="status-chip ${getStatusClass(statusText)}">${escapeHtml(statusText)}</span>
        </td>
        <td class="action-icons" aria-label="Actions">
          <a href="${link}" aria-label="${isPublished ? "View" : "Edit"} dataset">
            <i class="fa-solid ${actionIcon}" aria-hidden="true"></i>
          </a>
          <button type="button" aria-label="More actions">
            <i class="fa-solid fa-ellipsis-vertical" aria-hidden="true"></i>
          </button>
        </td>
      `;

      tableBody.appendChild(row);
    });
  }

  // --- Pagination rendering (like screenshot) ---
  function createPageItem({ label, page, current = false, disabled = false, ariaLabel, isEllipsis = false }) {
    const li = document.createElement("li");
    li.className = "usa-pagination__item";

    if (isEllipsis) {
      li.className = "usa-pagination__item usa-pagination__overflow";
      li.innerHTML = `<span class="usa-pagination__link" aria-hidden="true">…</span>`;
      return li;
    }

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = current ? "usa-pagination__button usa-pagination__button--current" : "usa-pagination__button";
    btn.textContent = label;

    if (ariaLabel) btn.setAttribute("aria-label", ariaLabel);
    if (current) btn.setAttribute("aria-current", "page");
    if (disabled) {
      btn.disabled = true;
      btn.className = "usa-pagination__button";
    }

    btn.addEventListener("click", () => {
      if (disabled || current) return;
      currentPage = page;
      renderPage();
    });

    li.appendChild(btn);
    return li;
  }

  function renderPagination(totalPages) {
    if (!paginationBar || !paginationList) return;

    paginationList.innerHTML = "";

    if (totalPages <= 1) {
      paginationBar.hidden = true;
      return;
    }

    paginationBar.hidden = false;

    // 1 2 3 4 5 … last  Next
    const windowSize = 5;
    let start = 1;
    let end = Math.min(totalPages, windowSize);

    if (currentPage > 3 && totalPages > windowSize) {
      start = Math.max(1, currentPage - 2);
      end = Math.min(totalPages, start + windowSize - 1);

      if (end - start + 1 < windowSize) {
        start = Math.max(1, end - windowSize + 1);
      }
    }

    for (let p = start; p <= end; p += 1) {
      paginationList.appendChild(
        createPageItem({
          label: String(p),
          page: p,
          current: p === currentPage,
          ariaLabel: `Page ${p}`,
        })
      );
    }

    if (end < totalPages - 1) {
      paginationList.appendChild(createPageItem({ isEllipsis: true }));
    }

    if (end < totalPages) {
      paginationList.appendChild(
        createPageItem({
          label: String(totalPages),
          page: totalPages,
          current: totalPages === currentPage,
          ariaLabel: `Page ${totalPages}`,
        })
      );
    }

    const nextLi = document.createElement("li");
    nextLi.className = "usa-pagination__item usa-pagination__arrow";

    const nextBtn = document.createElement("button");
    nextBtn.type = "button";
    nextBtn.className = "usa-pagination__link usa-pagination__next-page";
    nextBtn.setAttribute("aria-label", "Next page");
    nextBtn.innerHTML = `Next <span class="usa-pagination__link-text"><i class="fa-solid fa-chevron-right" aria-hidden="true"></i></span>`;

    const isLast = currentPage >= totalPages;
    if (isLast) {
      nextBtn.disabled = true;
      nextBtn.setAttribute("aria-disabled", "true");
      nextBtn.classList.add("is-disabled");
    }

    nextBtn.addEventListener("click", () => {
      if (isLast) return;
      currentPage += 1;
      renderPage();
    });

    nextLi.appendChild(nextBtn);
    paginationList.appendChild(nextLi);
  }

  function renderPage() {
    const totalPages = Math.max(1, Math.ceil(currentFiltered.length / PAGE_SIZE));
    if (currentPage > totalPages) currentPage = totalPages;

    const startIdx = (currentPage - 1) * PAGE_SIZE;
    const pageItems = currentFiltered.slice(startIdx, startIdx + PAGE_SIZE);

    renderTableRows(pageItems);
    renderPagination(totalPages);
  }

  function applyFiltersAndSort() {
    let filtered = allDatasets.slice();

    // Applied status filter
    if (appliedStatus !== "all") {
      filtered = filtered.filter(
        (ds) => (ds.status || "Draft").toLowerCase() === appliedStatus.toLowerCase()
      );
    }

    // Search filter
    const searchTerm = (searchFilter?.value || "").trim().toLowerCase();
    if (searchTerm) {
      filtered = filtered.filter((ds) =>
        (ds.title || "").toLowerCase().includes(searchTerm) ||
        (ds.doi || "").toLowerCase().includes(searchTerm)
      );
    }

    // Sort
    filtered.sort((a, b) => {
      let valA, valB;

      switch (sortColumn) {
        case "title":
          valA = (a.title || "").toLowerCase();
          valB = (b.title || "").toLowerCase();
          break;
        case "doi":
          valA = a.doi || "";
          valB = b.doi || "";
          break;
        case "startedOn":
          valA = new Date(a.createdAt || 0);
          valB = new Date(b.createdAt || 0);
          break;
        case "submittedOn":
          valA = new Date(a.submittedAt || 0);
          valB = new Date(b.submittedAt || 0);
          break;
        case "status":
          valA = (a.status || "Draft").toLowerCase();
          valB = (b.status || "Draft").toLowerCase();
          break;
        default:
          valA = new Date(a.createdAt || 0);
          valB = new Date(b.createdAt || 0);
      }

      if (valA < valB) return sortDirection === "asc" ? -1 : 1;
      if (valA > valB) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });

    currentFiltered = filtered;
    updateSortIndicators();

    // Reset to page 1 whenever filter/search/sort changes
    currentPage = 1;
    renderPage();
  }

  // --- Filter popover controls ---
  function openFilters() {
    if (!filterPopover || !filterBackdrop || !filterBtn) return;

    filterPopover.hidden = false;
    filterBackdrop.hidden = false;
    filterBtn.setAttribute("aria-expanded", "true");

    if (statusFilter) statusFilter.value = appliedStatus;
    filterCloseBtn?.focus();
  }

  function closeFilters({ restoreFocus = true } = {}) {
    if (!filterPopover || !filterBackdrop || !filterBtn) return;

    filterPopover.hidden = true;
    filterBackdrop.hidden = true;
    filterBtn.setAttribute("aria-expanded", "false");
    if (restoreFocus) filterBtn.focus();
  }

  function applyFilterUI() {
    appliedStatus = statusFilter?.value || "all";
    applyFiltersAndSort();
    closeFilters();
  }

  function clearFilterUI() {
    if (statusFilter) statusFilter.value = "all";
  }

  function onKeydown(e) {
    if (e.key === "Escape" && filterPopover && !filterPopover.hidden) {
      e.preventDefault();
      closeFilters();
    }
  }

  function setEmptyStateMessage(html) {
    if (!emptyState) return;
    emptyState.hidden = false;

    // If the empty state already has a structured layout, keep it;
    // otherwise, safely replace its contents.
    emptyState.innerHTML = html;
  }

  async function loadDatasets() {
    const mode = (import.meta.env.VITE_DATA_MODE || "demo").toLowerCase();

    // API mode: attempt workflow read via JSON:API
    if (mode === "api") {
      try {
        const session = await getSession();

        if (!session?.isAuthenticated) {
          allDatasets = [];
          datasetCountChip.textContent = "0 datasets";
          if (paginationBar) paginationBar.hidden = true;
          setEmptyStateMessage(`
            <div class="usa-prose">
              <h2 class="margin-top-0">Log in required</h2>
              <p>Log in to view your datasets.</p>
            </div>
          `);
          return;
        }

        const resp = await getMyDatasets({ limit: 200, offset: 0 });

        const results = Array.isArray(resp?.results) ? resp.results : [];

        // Normalize to the shape this page expects
        allDatasets = results.map((ds) => {
          const status = normalizeStatusLabel(ds.status);

          return {
            title: ds.title || "Untitled",
            doi: ds.doi || "—",
            createdAt: ds.createdAt || "",
            // JSON:API doesn’t expose "submittedAt" by default; use updatedAt as a reasonable proxy for now.
            submittedAt: ds.submittedAt || ds.updatedAt || "",
            status,
          };
        });

        // If authenticated but no datasets:
if (!allDatasets.length) {
  datasetCountChip.textContent = "0 datasets";
  if (paginationBar) paginationBar.hidden = true;

  // Render the original-styled empty state (keeps your working logic)
  setEmptyStateMessage(`
    <div class="my-datasets-empty">
      <h3>No datasets yet</h3>
      <p>You haven’t created any datasets.</p>
    </div>
  `);

  return;
}


        return;
      } catch (e) {
        // If API mode fails, fall back to demo so the page still works.
        // Also surface a helpful message.
        console.error("My Datasets: API workflow read failed; falling back to demo records.", e);
      }
    }

    // Demo mode (or API fallback)
    allDatasets = getAllRecords();
  }

  // --- Init (async) ---
  (async () => {
    await loadDatasets();
    applyFiltersAndSort();

    // Search debounce
    searchFilter?.addEventListener("input", () => {
      clearTimeout(searchFilter._t);
      searchFilter._t = setTimeout(applyFiltersAndSort, 200);
    });

    // Sortable columns
    document.querySelectorAll("#datasetsTable thead th[data-sort]").forEach((th) => {
      const btn = th.querySelector(".md-thBtn");
      if (!btn) return;

      btn.addEventListener("click", () => {
        const column = th.dataset.sort;
        if (sortColumn === column) {
          sortDirection = sortDirection === "asc" ? "desc" : "asc";
        } else {
          sortColumn = column;
          sortDirection = "asc";
        }
        applyFiltersAndSort();
      });
    });

    // Filter popover wiring
    filterBtn?.addEventListener("click", () => {
      if (filterPopover?.hidden) openFilters();
      else closeFilters();
    });

    filterBackdrop?.addEventListener("click", () => closeFilters());
    filterCloseBtn?.addEventListener("click", () => closeFilters());

    applyFiltersBtn?.addEventListener("click", applyFilterUI);

    clearFiltersBtn?.addEventListener("click", () => {
      clearFilterUI();
    });

    document.addEventListener("keydown", onKeydown);
  })();
})();
