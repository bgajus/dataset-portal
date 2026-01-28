# Constellation Dataset Portal — Demo Project Brief

## Overview
Constellation Dataset Portal is a frontend-only demonstration web application built with Vite and modern JavaScript. It is designed to showcase a polished, production-quality user experience for discovering, browsing, and reviewing scientific datasets.

This demo is intentionally backend-agnostic. All data is currently mocked or deterministic, allowing the UI/UX, workflows, and interaction patterns to be evaluated independently of any specific CMS, API, or infrastructure choice.

The demo serves as a **presentation-ready artifact** for stakeholders to evaluate:
- Overall UX and IA
- Search and filtering patterns
- Dataset landing page structure
- Auth-aware UI states (visual only)
- Editorial and workflow concepts

Decisions about backend implementation (headless APIs, Drupal/DKAN theming, etc.) are explicitly deferred.

---

## Goals
- Provide a realistic, high-fidelity dataset discovery experience
- Demonstrate advanced search, filtering, and sorting UX
- Showcase dataset landing pages with rich metadata sections
- Support internal dashboards and user-centric views (e.g. My Datasets)
- Be easy to run, demo, and hand off as static files

---

## Non-Goals (Out of Scope)
- Live backend integration
- Authentication or authorization enforcement
- Drupal/DKAN theming or Twig templates
- Environment-based API/demo switching
- Persistent data mutation

These may be explored later but are **not part of the current demo scope**.

---

## Tech Stack
- **Build Tool:** Vite
- **Language:** Modern JavaScript (ES modules)
- **UI Framework:** U.S. Web Design System (USWDS)
- **Icons:** Font Awesome
- **Styling:** Custom design tokens + UI layer
- **State:** Local, in-memory, deterministic demo data

---

## Project Structure (High Level)

```
dataset-portal/
├── index.html                 # Homepage
├── src/
│   ├── assets/
│   │   ├── css/
│   │   │   ├── portal-tokens.css
│   │   │   ├── portal-ui.css
│   │   │   ├── home.css
│   │   │   └── uswds-overrides.css
│   │   ├── img/
│   │   │   └── stars_constellation.jpg
│   │   └── js/
│   │       ├── includes.js
│   │       ├── home.js
│   │       ├── metadata-schema.js
│   │       ├── demo-datasets.js
│   │       └── shared-store.js

│   ├── pages/
│   │   ├── search/
│   │   ├── dataset/
│   │   ├── editor/
│   │   ├── dashboard/
│   │   ├── my-datasets/
│   │   └── settings/
│   └── shared/
│       └── data/
├── dist/                      # Build output (generated, not committed)
├── vite.config.js
├── public/
│   ├── components/
│   │   ├── footer.html
│   │   ├── header.html
│   │   └── constellation_logo.svg
├── package.json
└── .gitignore
```

---

## dist/ Directory
- `dist/` is **generated**, not committed to Git
- Created by running:
  ```bash
  npm run build
  ```
- Represents the **handoff-ready static demo**
- Safe to regenerate on any machine
- Not required to be copied between environments

---

## Key Pages & Features

### Homepage
- Hero search experience
- Browse by subject
- Latest published datasets

### Search Results
- Keyword search
- Faceted filtering (subjects, keywords, etc.)
- Sorting and pagination
- Result cards with consistent metadata layout

### Dataset Landing Page
- Title, authors, and actions
- Description and metadata sections
- Sidebar details (DOI, subjects, keywords, size, etc.)
- Citation generator (visual)
- Preview state handling (visual only)

### Dashboard (Demo)
- Auth-aware UI states (mocked)
- Summary cards and navigation

### My Datasets
- User-scoped dataset list (mocked)
- Empty states and status indicators

### Settings
- Account/profile UI
- Avatar handling (visual/demo only)

---

## Current State
- Stable demo lives on the `main` branch
- Fully runnable via Vite dev server
- Deterministic demo data only
- No environment configuration required
- Presentation-ready with minimal setup

---

## Next Steps (Post-Brief)
- UX polish and consistency passes
- Identify high-impact demo features
- Begin developing our Curator role features
- Improve dataset card completeness
- Refine empty states and transitions
- Prepare stakeholder walkthrough flow

---

## Audience
- Product owners
- Designers
- Developers
- Stakeholders evaluating future technical direction

This demo is intentionally flexible so it can inform — but not constrain — future architectural decisions.
