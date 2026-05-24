# Feature Spec: Spending UI
**Status:** Approved
**Spec ID:** 001

## 1. Overview
The Spending UI is the frontend component of the Lifestack Spending module. It provides a user interface for authenticated users to view, add, and manage their income and expenses, organize them into categories, and view monthly category budgets.

## 2. Goals
- Provide a responsive and premium UI for managing spending transactions.
- Integrate with the existing `lifestack-api` Spending endpoints (`/v1/spending/*`).
- Support CRUD operations for Transactions.
- Support viewing and managing Categories (including color and icon presentation).
- Display a summary of spending vs. budgets.
- Integrate smoothly with the existing authentication and routing patterns.

## 3. Scope
- **Spending Dashboard/Page**: A dedicated page for the Spending module.
- **Transaction List**: A list or table view of recent transactions with filtering by month/category.
- **Transaction Modal/Form**: A form to add or edit transactions, selecting from available workspace categories.
- **Category Management (Basic)**: Ability to view available categories and add custom categories.
- **API Integration**: Use `@tanstack/react-query` to fetch and mutate spending data (categories, transactions, budgets).

### Out of Scope for This Slice
- Advanced charts and analytics (e.g., spending trends over years).
- Multi-workspace switching UI (assumed handled globally if at all).
- Budget creation/editing UI (will just display existing budgets for now, or provide a simple edit form later).

## 4. Architecture Alignment

### 4.1 Routing
- Add a new protected route: `/spending`
- Add navigation link to the main sidebar/header.

### 4.2 State Management
- Use `@tanstack/react-query` for server state.
- Create custom hooks (`useTransactions`, `useCategories`, `useBudgets`) in `src/hooks/spending.ts` or similar.
- Use the existing `api.ts` axios instance for requests.

### 4.3 UI/UX Design
- **Aesthetics**: Follow the "web_application_development" guidelines: vibrant, premium, modern typography, glassmorphism if applicable, and smooth micro-animations.
- **TailwindCSS**: Leverage the existing Tailwind setup for styling.
- **Components**: Reusable components should be placed in `src/components/`.

## 5. Requirements

### 5.1 Endpoints to Integrate
- `GET /v1/spending/categories`
- `POST /v1/spending/categories`
- `DELETE /v1/spending/categories/{public_id}`
- `GET /v1/spending/transactions`
- `GET /v1/spending/transactions/summary`
- `POST /v1/spending/transactions`
- `GET /v1/spending/transactions/{public_id}`
- `PATCH /v1/spending/transactions/{public_id}`
- `DELETE /v1/spending/transactions/{public_id}`
- `GET /v1/spending/budgets?month_start=YYYY-MM-01`
- `POST /v1/spending/budgets`
- `PATCH /v1/spending/budgets/{public_id}`

### 5.2 Key Components
- `SpendingPage`: Main layout container.
- `TransactionList`: Displays transactions grouped by date.
- `TransactionForm`: Modal to input Amount, Type (Income/Expense), Category, Date, and Description.
- `CategoryBadge`: A visual pill representing a category, using its `color` and `icon`.
- `BudgetProgress`: A mini progress bar showing spent amount vs. budgeted amount for a category.

## 6. Implementation Steps
1. **API Hooks**: Define React Query hooks and API service methods for the Spending endpoints.
2. **Types**: Define TypeScript interfaces matching the Pydantic schemas.
3. **Components**: Build the UI components (Transaction List, Form, Category Badges).
4. **Page Assembly**: Create the `SpendingPage` and add it to the router.
5. **Styling & Polish**: Apply premium design, hover states, and animations.
6. **Testing**: Ensure manual E2E flow works (Create transaction, see it in list, update, delete).
