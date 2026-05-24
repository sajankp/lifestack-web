# Lifestack Web

> The web client for a private personal operating system.

Lifestack Web is the frontend for the Lifestack product vision: one place to manage actions, money, health, documents, and memory without scattering data across disconnected apps.

The web app is where the personal operating system becomes visible and usable day to day. It is responsible for turning the platform's shared data model into a calm, high-clarity interface for capture, review, and decision-making.

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
- Personal-device-first use cases handled outside the desktop browser

### Stage 5: Health Module
- UI for vitals, labs, medications, symptoms, sleep, and workouts
- Shared dashboard views and follow-up workflows

### Stage 6: Document Intelligence
- Upload, review, and confirm extracted data from receipts, statements, reports, and forms
- Source-linked document views tied to normalized records

### Stage 7: Memory and Second Brain
- Journal, notes, timeline, and context views
- Cross-domain retrieval and review surfaces

### Stage 8: SaaS
- Multi-user and multi-workspace collaboration surfaces
- Roles, admin, billing, and expanded platform controls when product maturity justifies them

---

## Current Scope

Today the web app focuses on the personal OS foundation:

- Dashboard
- Todo management
- Spending tracking
- Investing tracking
- Authentication and session handling

The current implementation is intentionally centered on a single-user personal workflow before expanding into later-stage domains.

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

## Testing

- Unit/integration tests:
  - `npm test -- --run`
- Coverage:
  - `npm run test:coverage`
- Browser E2E:
  - `npm run test:e2e`

The current browser E2E suite focuses on frontend behavior. A true full-stack end-to-end harness across frontend, backend, and database is still a later integration step.

---

## Running Locally

```bash
npm install
npm run dev
```

The frontend expects the backend API to be available separately.

---

## Relationship to the API

This repo is the frontend companion to [`lifestack-api`](https://github.com/sajankp/lifestack-api), which owns the core domain services, workflows, and data model.
