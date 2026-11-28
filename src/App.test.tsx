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
  timezone: null,
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
  http.get('*/v1/dashboard/briefing', () => HttpResponse.json({ lines: [], all_clear: true })),
  http.get('*/v1/notifications', () => HttpResponse.json({ items: [], total: 0 })),
  http.get('*/v1/notifications/push-subscriptions', () => HttpResponse.json([])),
  http.get('*/v1/finance/accounts', () => HttpResponse.json({ items: [], total: 0 })),
  http.get('*/v1/finance/period-change', () =>
    HttpResponse.json({
      status: 'unavailable',
      start_date: '2026-11-21',
      end_date: '2026-11-28',
      currency: null,
      net_worth: {},
      investments: {},
    }),
  ),
  http.get('*/v1/todo/', () => HttpResponse.json({ items: [], total: 0 })),
  http.get('*/v1/spending/transactions', () => HttpResponse.json({ items: [], total: 0 })),
  http.get('*/v1/health/medications/schedule', () => HttpResponse.json({ items: [] })),
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

  it('redirects legacy routes to the reshaped pages', async () => {
    server.use(
      ...defaultHandlers,
      http.get('*/v1/platform/workspaces/', () => HttpResponse.json({ items: [workspaceA] })),
    );

    window.history.pushState({}, '', '/summaries');
    renderApp();

    expect(await screen.findByRole('heading', { name: 'Today' })).toBeInTheDocument();
    await waitFor(() => expect(window.location.pathname).toBe('/'));
  });

  it('resolves every current API-emitted deep link to a page instead of the fallback', async () => {
    const emittedRoutes = [
      '/money/budget',
      '/money/spending',
      '/portfolio',
      '/todo',
      '/health',
      '/settings/data',
      '/notifications',
    ];
    server.use(
      ...defaultHandlers,
      http.get('*/v1/platform/workspaces/', () => HttpResponse.json({ items: [workspaceA] })),
    );

    for (const route of emittedRoutes) {
      window.history.pushState({}, '', route);
      const app = renderApp();
      await waitFor(() => expect(window.location.pathname).toBe(route));
      app.unmount();
    }
  });

  it('redirects every legacy product route to its replacement', async () => {
    const redirects: Array<[string, string]> = [
      ['/spending', '/money/budget'],
      ['/spending?tab=budgets', '/money/budget'],
      ['/spending?tab=recurring', '/money/budget'],
      ['/spending/budgets', '/money/budget'],
      ['/spending/recurring', '/money/budget'],
      ['/spending/kpis', '/money/budget'],
      ['/spending/analytics', '/money/spending'],
      ['/summaries', '/'],
      ['/imports/finance-account-statement', '/settings/data'],
      ['/exports', '/settings/data'],
      ['/net-worth', '/money/accounts'],
    ];
    server.use(
      ...defaultHandlers,
      http.get('*/v1/platform/workspaces/', () => HttpResponse.json({ items: [workspaceA] })),
    );

    for (const [legacy, target] of redirects) {
      window.history.pushState({}, '', legacy);
      const app = renderApp();
      await waitFor(() => expect(window.location.pathname).toBe(target));
      app.unmount();
    }
  });

  it('opens More from the bottom bar without losing the active route', async () => {
    server.use(
      ...defaultHandlers,
      http.get('*/v1/platform/workspaces/', () => HttpResponse.json({ items: [workspaceA] })),
    );

    renderApp();

    expect(await screen.findByRole('heading', { name: 'Today' })).toBeInTheDocument();
    expect((await screen.findAllByText('Alpha Workspace')).length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: 'More' }));

    await waitFor(() => {
      expect(document.body.style.overflow).toBe('hidden');
    });
    expect(screen.getByTestId('nav-health-mobile')).toBeInTheDocument();

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

  it('shows verb-based quick-add labels in header', async () => {
    server.use(
      ...defaultHandlers,
      http.get('*/v1/platform/workspaces/', () => HttpResponse.json({ items: [workspaceA] })),
    );

    renderApp();

    expect(await screen.findByRole('heading', { name: 'Today' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Add todo' })).toHaveAttribute('href', '/todo?new=1');
    expect(screen.getByRole('link', { name: 'Add expense' })).toHaveAttribute(
      'href',
      '/money?new=1',
    );
  });

  it('gives bottom navigation and header icon buttons a >=44px touch target (web#202)', async () => {
    server.use(
      ...defaultHandlers,
      http.get('*/v1/platform/workspaces/', () => HttpResponse.json({ items: [workspaceA] })),
    );

    renderApp();

    await screen.findByRole('heading', { name: 'Today' });
    expect(screen.getByTestId('nav-dashboard-mobile-bottom')).toHaveClass('min-h-14');
    expect(screen.getByTestId('header-notifications')).toHaveClass('h-11', 'w-11');
  });

  it('keeps the authenticated shell available when the auth probe fails offline', async () => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });
    server.use(
      http.get('*/v1/auth/me', () => HttpResponse.error()),
      ...defaultHandlers,
      http.get('*/v1/platform/workspaces/', () => HttpResponse.json({ items: [workspaceA] })),
    );

    try {
      renderApp();
      expect(await screen.findByTestId('offline-mode-banner')).toBeInTheDocument();
      expect(await screen.findByRole('heading', { name: 'Today' })).toBeInTheDocument();
    } finally {
      Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
    }
  });
});
