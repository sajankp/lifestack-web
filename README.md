# Lifestack Web

> The web client for a private personal operating system.

Lifestack Web is the frontend for the Lifestack product vision: one place to manage actions, money, health, documents, and memory without scattering data across disconnected apps.

The web app is where the personal operating system becomes visible and usable day to day. It is responsible for turning the platform's shared data model into a calm, high-clarity interface for capture, review, and decision-making.

The long-term interface goal is a daily briefing, not a generic chat surface: today's tasks, reminders, health context, money signals, document follow-ups, and coach recommendations with visible source context.

---

## Product Principles

- Own your data end to end. The UI should make personal data understandable, portable, and easy to inspect.
- Capture should be easier than forgetting. Common actions should be fast, lightweight, and available from the surfaces people reach first.
- AI is an interface, not the foundation. The frontend should expose assistant workflows that act through real product features and structured state.
- Every module should strengthen the same operating loop. Tasks, money, health, documents, and memory should feel like one system, not adjacent tabs.
- Start personal, then expand. The app should become truly useful for one person or one household before broader platform concerns dominate the product.
- Add complexity only when it earns its keep. New UI primitives, flows, and platform layers should follow genuine user need.

---

## Product Direction

Lifestack Web follows the same staged roadmap as the core platform:

### Stage 1: Personal OS Foundation
- Dashboard, todo, spending, and investing flows
- Shared authentication and protected routes
- Core review-and-action experience for one user or one household

### Stage 2: Capture Layer
- Faster entry points for todo, spending, and journal capture
- Voice-first and mobile-friendly input paths
- Lower-friction daily interactions

### Stage 3: AI Assistant Interface
- Voice and chat actions on top of existing features
- Assistant flows grounded in structured product data
- Summaries, logging, and task creation through AI adapters

### Stage 4: Mobile Companion
- Shared design language across web and mobile
- Faster capture, notifications, camera flows, and sync
- Health-app sync foundation for sleep, weight, workouts, and other supported metrics
- Personal-device-first use cases handled outside the desktop browser

### Stage 5: Health Module
- UI for vitals, labs, medications, symptoms, sleep, weight, and workouts
- Medication tracker and reminder flows
- Manual health entry first, followed by mobile health-app sync review surfaces
- Shared dashboard views and follow-up workflows

### Stage 6: Document Intelligence
- Upload, review, and confirm extracted data from receipts, statements, reports, and forms
- Source-linked document views tied to normalized records

### Stage 7: Memory and Second Brain
- Journal, notes, timeline, and context views
- Cross-domain retrieval and review surfaces across documents, notes, health, tasks, and finance
- Source-backed personal coach views grounded in structured product data
- Permissioned agent-access surfaces for MCP and other trusted integrations

### Stage 8: SaaS
- Multi-user and multi-workspace collaboration surfaces
- Roles, admin, billing, and expanded platform controls when product maturity justifies them

---

## What Works Today

Today the web app focuses on the personal OS foundation:

- Dashboard
- Todo management
- Spending tracking
- Investing tracking
- Notifications inbox and unread indicators
- Weekly summaries view
- Quick capture flow (todo + spending)
- Bulk CSV imports flow (transactions, budgets, holdings)
- Recurring rules UX for todo and spending
- Authentication and session handling
- Responsive app shell with mobile navigation
- Real workspace name/role display from the platform API
- Shared loading, empty, and error states on key daily-use pages

The current implementation is intentionally centered on a single-user personal workflow before expanding into later-stage domains.

---

## Future Product Tracks

These tracks are planned product direction, not current web functionality:

- **Mobile companion:** quick capture, notifications, camera upload, background sync, and health-app sync review.
- **Health tracking:** sleep, weight, vitals, labs, symptoms, medications, and workouts, with manual entry before health-app sync.
- **Medication reminders:** schedules, adherence check-ins, refill notes, and dashboard follow-up tasks.
- **Document intelligence:** upload, extraction review, source-linked records, and privacy-focused lifecycle controls.
- **Second brain:** notes, journal, documents, health records, tasks, and finance events combined into source-backed retrieval.
- **MCP and agent access:** permissioned access for trusted external assistants to selected preferences, second-brain memory, todos, documents, and domain summaries.
- **Personal coach:** planning and recommendations over structured life data, with citations and user-confirmed actions.

The frontend should keep these tracks visually integrated with the existing dashboard, capture, notification, and review surfaces instead of presenting them as disconnected apps.

Trust should be visible in the UI: data-source labels, domain permissions, user confirmation for sensitive changes, export/delete affordances, and cited answers for document-backed or health-backed coach responses.

Settings and master configuration should stay lean and low-traffic: useful for removing clutter from feature pages, but not a major destination in the product.

---

## Architecture Summary

- React 19 + TypeScript + Vite
- React Router for navigation
- Zustand for auth/session state
- TanStack Query for server state
- Shared UI components for consistent module experiences

The frontend mirrors backend module boundaries rather than inventing a separate product model. As the product grows, new surfaces should still feel like one coherent operating system.

---

## Design Direction

Lifestack Web should feel:

- calm enough for repeated daily use
- structured enough to scan quickly
- rich enough to hold multiple life domains without feeling scattered
- ready for assistant-driven capture and summaries without becoming chat-first

The UI goal is not just "good CRUD." It is to help users notice what matters, decide what to do next, and act with minimal friction.

---

## Frontend Responsibilities

- Render the shared dashboard and module workflows clearly
- Keep authentication, routing, and session transitions predictable
- Support capture, review, and editing flows across domains
- Surface partial, missing, and derived data honestly
- Prepare the product for future mobile, voice, and AI-assisted interactions

---

## Frontend Notes

### Investing module behavior
- Investing forms now use backend-managed finance references:
  - `GET /v1/finance/accounts`
  - `GET /v1/finance/currencies`
- Holdings and cash creation should use selector-driven values from those endpoints, not free-text currency/account inputs.
- Investing summary supports valuation-state semantics:
  - `single_currency_native`
  - `multi_currency_unconverted`
  - `conversion_required`
  - `converted_available`
- When conversion is unavailable, totals may be `null`; UI should display `N/A` and show `valuation_status` plus `reporting_currency`.

### Look-through analytics (Spec 012)
- Frontend now supports:
  - `GET /v1/investing/instruments`
  - `POST /v1/investing/instruments`
  - `POST /v1/investing/instruments/{instrument_id}/constituents`
  - `GET /v1/investing/analytics/exposure?as_of=YYYY-MM-DD`
  - `GET /v1/investing/analytics/overlap?as_of=YYYY-MM-DD`
- Investing page includes a `Look-through Analytics` tab with:
  - instrument creation
  - constituent seeding for manual bootstrap
  - exposure table and overlap summary
- Analytics responses may be partial; UI surfaces `analysis_status`, coverage, and warnings.

### Phase 1.1 surfaces
- Notifications page:
  - list
  - unread count
  - mark-read + mark-all-read
  - preferences update
- Weekly summaries page:
  - list and latest summary surfaces
- Capture page:
  - single input routing to todo/spending via backend capture API
- Todo page:
  - recurring todo rule CRUD (create/list/delete)
  - explicit due-date support in create flow
- Spending page:
  - recurring transaction rule management
  - upcoming recurring preview support from backend

### Dashboard budget remaining
- The dashboard `Budget remaining` card is computed from:
  - `spending.month_budget - spending.month_spent`
- `month_budget` is sourced from monthly budgets for the current month. If no monthly budget exists, UI should show `N/A`.

---

## Testing

- Unit/integration tests:
  - `npm test -- --run`
- Coverage:
  - `npm run test:coverage`
  - Playwright/E2E specs do not contribute to this Vitest coverage number — CI coverage gates are measured from unit/integration tests only.
- Browser E2E:
  - `npm run test:e2e`
- Key page-level tests:
  - `src/pages/InvestingPage.test.tsx`
  - `src/pages/DashboardPage.test.tsx`
- E2E spec:
  - `e2e/investing-lookthrough.spec.ts`

The current browser E2E suite in this repo focuses on frontend behavior. The full-stack end-to-end harness now lives in the standalone `lifestack-e2e` repo, where the UI, API, and database run together against real contracts.

### E2E Strategy
- Current frontend Playwright tests mock API responses for fast UI regression checks.
- Full-stack FE+BE+DB coverage is handled in the dedicated `lifestack-e2e` repo because FE and BE are separate repositories.
- Remaining follow-up:
  - seeded deterministic test data and cross-repo CI gate
  - screenshot/accessibility pass for responsive layouts
  - continued decomposition of large feature pages into smaller feature components/hooks

---

## Running Locally

```bash
npm install
npm run dev
```

The frontend expects the backend API to be available separately. It reads the API base URL from `VITE_API_URL` (see `.env`, defaults to `http://localhost:8000/v1`) — update this if your `lifestack-api` instance runs elsewhere.

---

## Relationship to the API

This repo is the frontend companion to [`lifestack-api`](https://github.com/sajankp/lifestack-api), which owns the core domain services, workflows, and data model.

---

## Deeper Domain Reference

Detailed documentation on domain behaviors, API contracts, testing strategies, and module-specific design decisions that were previously in this README have been moved to dedicated agent memory files and spec documents:

- **Architecture & design decisions** — `.agent/context.md` in this repo
- **Backend domain behaviors** (investing, spending analytics, ledger reconciliation) — `lifestack-api/docs/specs/`
- **Test patterns & key file paths** — `.agent/memory/MEMORY-FRONTEND.md` and `.agent/memory/MEMORY-E2E.md` at the workspace root
- **Roadmap and planning context** — `.agent/memory/MEMORY-OVERVIEW.md` at the workspace root
