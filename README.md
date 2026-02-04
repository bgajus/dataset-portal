# Constellation Dataset Portal Demo

A front-end UX demo of the **Constellation Dataset Portal** — a modern dataset repository experience with realistic submission, curation, and publication workflows.

This project is intentionally **backend-free**. All data, roles, workflow state, notifications, and curator actions are simulated using **browser localStorage** so stakeholders can explore the full lifecycle of a dataset without infrastructure dependencies.

---

## Purpose of this repository

This repository exists to:

- Demonstrate the **end-to-end dataset lifecycle**
- Support **UX review and stakeholder feedback**
- Provide a realistic interaction model for:
  - submitters
  - curators
  - administrators
- Enable easy deployment as a **static site** for demos, testing, and feedback

This is **not** a production system — it is a high-fidelity prototype.

---

## Core pages

- **Home**
  - Hero search
  - Browse by subject
  - Latest published datasets
- **Search**
  - Faceted filtering (subjects, keywords, etc.)
  - Pagination
  - Optional inclusion of tombstoned datasets
- **Dataset landing page**
  - Public dataset view
  - Sidebar metadata
  - Citation and DOI display
- **Dashboard**
  - Latest activity
  - Notification banner
  - Entry point for submitters and curators
- **My Datasets**
  - Submitter-owned datasets
  - Status chips and actions
- **Dataset Editor**
  - Schema-driven metadata editor
  - Required field completion tracking
- **Curator Review**
  - Queue of datasets under review or awaiting updates
- **Notifications**
  - Workflow-driven notifications with bulk delete
  - Header bell slide-out panel with recent notifications preview
  - Unread badge + visual state, click-outside to close
- **Settings**
  - Demo-only role switching
  - Demo authentication toggle
  - User profile and avatar

---

## Roles and behavior

### Submitter

- Creates dataset drafts
- Edits metadata
- Uploads files (simulated)
- Submits datasets for review
- Responds to curator requests

### Curator / Admin

- Reviews submitted datasets
- Requests updates with notes
- Publishes datasets
- Views request history
- Manages withdrawn (tombstoned) datasets

---

## Dataset workflow states

- Draft
- In Review
- Needs Updates
- Published
- Tombstoned

---

## Tombstoned datasets

Tombstoned datasets remain discoverable but are read-only.

They display:

- Tombstone alert banner
- Reason for withdrawal (if provided)
- Tombstoned date
- Optional replacement or related DOI/URL

Search excludes tombstoned datasets by default, with an opt-in filter under **More Filters…**.

---

## Notifications

Workflow actions generate notifications including:

- Dataset submitted for review
- Curator requests updates
- Publication events

The Notifications page supports:

- Delete individual notifications
- Select multiple notifications
- Delete all notifications

---

## Technical overview

- Vite multi-page build
- USWDS base styles
- Custom design tokens
- No backend dependencies

---

## Running locally

```bash
npm install
npm run dev
```

Build for production:

```bash
npm run build
npm run preview
```

---

## Demo data

All data is stored in browser localStorage.

Clear localStorage to reset the demo.

---

## Deployment

The project builds to static assets in `dist/` and can be deployed via any static hosting solution.

---

## Project status

This demo is actively evolving and intended for UX validation and stakeholder review.
