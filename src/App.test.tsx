import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from './components/ui/toast';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { vi } from 'vitest';

import App from './App';
import { useAuthStore } from './store/authStore';
import { useWorkspaceStore } from './store/workspaceStore';
import { server } from './test/setup';

vi.mock('./components/VoiceAgentWidget', () => ({
  VoiceAgentWidget: () => <div data-testid="voice-agent-widget" />,
}));

const user = {
  public_id: 'user-1',
  email: 'sajan@example.com',
  username: 'sajan',
  is_active: true,
};

const workspaceA = {
  public_id: 'workspace-alpha',
  name: 'Alpha Workspace',
  description: null,
  is_active: true,
  role: 'owner',
};

const workspaceB = {
  public_id: 'workspace-beta',
  name: 'Beta Workspace',
  description: null,
  is_active: true,
  role: 'member',
};

const dashboardSummary = {
  todos: {
    open_count: 0,
    overdue_count: 0,
    next_due_items: [],
    active_guardrail_todo_count: 0,
  },
  spending: {
    month_spent: '0.00',
    month_budget: null,
    top_overspent_categories: [],
  },
  investing: {
    portfolio_value: '0.00',
    daily_change: null,
    holdings_count: 0,
  },
  system: { generated_at: '2026-06-12T00:00:00Z' },
};

const defaultHandlers = [
  http.get('*/v1/auth/me', () => HttpResponse.json(user)),
  http.get('*/v1/notifications/unread-count', () => HttpResponse.json({ count: 0 })),
  http.get('*/v1/dashboard/summary', () => HttpResponse.json(dashboardSummary)),
  http.get('*/v1/summaries/weekly/latest', () =>
    HttpResponse.json({ detail: 'No weekly summary found' }, { status: 404 }),
  ),
  http.get('*/v1/finance/settings/user', () =>
    HttpResponse.json({
      reporting_currency_override_code: null,
      currency_display_preference_override: null,
      workspace_reporting_currency_code: null,
      workspace_currency_display_preference: 'symbol',
      effective_reporting_currency_code: null,
      effective_currency_display_preference: 'symbol',
      updated_at: '2026-06-12T00:00:00Z',
    }),
  ),
];

const renderApp = () => {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <App />
      </ToastProvider>
    </QueryClientProvider>,
  );
};

describe('App shell', () => {
  beforeEach(() => {
    localStorage.clear();
    window.history.pushState({}, '', '/');
    useAuthStore.setState({
      isAuthenticated: true,
      isAuthResolved: true,
      user,
    });
    useWorkspaceStore.getState().clearActiveWorkspace();
    document.body.style.overflow = '';
  });

  it('opens and closes mobile navigation without losing the active route', async () => {
    server.use(
      ...defaultHandlers,
      http.get('*/v1/platform/workspaces/', () =>
        HttpResponse.json({ items: [workspaceA] }),
      ),
    );

    renderApp();

    expect(await screen.findByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
    expect((await screen.findAllByText('Alpha Workspace')).length).toBeGreaterThan(0);

    fireEvent.click(screen.getByTestId('nav-mobile-open'));

    await waitFor(() => {
      expect(document.body.style.overflow).toBe('hidden');
    });
    expect(screen.getByTestId('nav-dashboard-mobile')).toHaveAttribute('aria-current', 'page');

    fireEvent.click(screen.getByLabelText('Close navigation'));

    await waitFor(() => {
      expect(document.body.style.overflow).toBe('');
    });
    expect(screen.getByTestId('nav-dashboard')).toHaveAttribute('aria-current', 'page');
  });

  it('switches active workspace from the header selector', async () => {
    let selectedWorkspace: string | null = null;

    server.use(
      http.get('*/v1/notifications/unread-count', () => HttpResponse.json({ count: 3 })),
      ...defaultHandlers,
      http.get('*/v1/platform/workspaces/', () =>
        HttpResponse.json({ items: [workspaceA, workspaceB] }),
      ),
      http.post('*/v1/platform/workspaces/:workspaceId/select', ({ params }) => {
        selectedWorkspace = String(params.workspaceId);
        return HttpResponse.json({}, { status: 204 });
      }),
    );

    renderApp();

    const workspaceSelect = await screen.findByTestId('header-workspace-select');
    expect(workspaceSelect).toHaveValue(workspaceA.public_id);

    fireEvent.change(workspaceSelect, { target: { value: workspaceB.public_id } });

    await waitFor(() => {
      expect(selectedWorkspace).toBe(workspaceB.public_id);
      expect(useWorkspaceStore.getState().activeWorkspaceId).toBe(workspaceB.public_id);
    });
  });
});
