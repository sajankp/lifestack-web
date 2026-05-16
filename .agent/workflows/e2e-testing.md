# E2E Agent Testing Workflow

**Description:** This workflow outlines the exact steps an agent should follow when performing exploratory End-to-End (E2E) testing on the Lifestack UI via the browser. 

**Prerequisites:** 
- The backend API (`lifestack-api`) must be running locally.
- The frontend dev server (`lifestack-web`) must be running locally (usually `http://localhost:5173`).

---

## 1. Authentication & Registration
1. **Navigate** to `http://localhost:5173`.
2. **Action:** Attempt to register a new user with a test email (e.g., `test_e2e@example.com`) and password.
3. **Verify:** The application successfully creates the account, sets the session cookies, and redirects the user to the unified Dashboard.

## 2. Todos Module Verification
1. **Navigate** to the **Todos** section via the sidebar.
2. **Action:** Create a new task (e.g., "E2E Test Task"). Set a priority if available.
3. **Verify:** The task appears in the list immediately without requiring a manual page refresh.
4. **Action:** Mark the task as completed or delete it.
5. **Verify:** The UI reflects the state change accurately.

## 3. Spending Module Verification
1. **Navigate** to the **Spending** section via the sidebar.
2. **Action:** Add a new transaction (e.g., Income: $1000 "Salary", or Expense: $50 "Groceries").
3. **Verify:** The transaction appears in the "Recent Transactions" table.
4. **Verify:** The local Spending overview cards (Total Income, Total Expenses, Net Balance) update correctly based on the new transaction.

## 4. Dashboard Aggregation Verification
1. **Navigate** back to the main **Dashboard** section.
2. **Verify:** The summary cards on the Dashboard accurately reflect the data created in the Todos and Spending modules.
   - The "To do" card should show the correct count of active tasks.
   - The "Spending" card should show the correct balance based on the transactions.
   - *(Note: Check for the known bug where summaries remain at 0).*

## 5. Session Management & Logout
1. **Action:** Click the logout button (if available in the UI).
2. **Verify:** The user is redirected back to the Login page.
3. **Action:** Attempt to access a protected route directly (e.g., `http://localhost:5173/dashboard`).
4. **Verify:** The application redirects the unauthenticated user back to the Login page.

---

**Execution:**
To run this test, invoke the agent and provide the following prompt:
> "Please run the E2E Agent Testing Workflow on the UI. Follow the steps in `.agent/workflows/e2e-testing.md` and report your findings."
