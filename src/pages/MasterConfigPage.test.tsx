import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';

import { MasterConfigPage } from './MasterConfigPage';
import { server } from '../test/setup';
import { useWorkspaceStore } from '../store/workspaceStore';

const renderWithQuery = (ui: React.ReactNode) => {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
};

beforeAll(() => {
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  Element.prototype.scrollIntoView = vi.fn();
});

describe('MasterConfigPage', () => {
  beforeEach(() => {
    localStorage.clear();
    useWorkspaceStore.getState().clearActiveWorkspace();
  });

  it('resets the active workspace rather than the first workspace in the list', async () => {
    const workspaceA = '11111111-1111-1111-1111-111111111111';
    const workspaceB = '22222222-2222-2222-2222-222222222222';
    let resetTarget: string | null = null;

    useWorkspaceStore.getState().setActiveWorkspaceId(workspaceB);

    server.use(
      http.get('*/v1/platform/workspaces/', () =>
        HttpResponse.json({
          items: [
            {
              public_id: workspaceA,
              name: 'Alpha Workspace',
              description: null,
              is_active: true,
              role: 'owner',
            },
            {
              public_id: workspaceB,
              name: 'Beta Workspace',
              description: null,
              is_active: true,
              role: 'owner',
            },
          ],
        }),
      ),
      http.get(`*/v1/platform/workspaces/${workspaceB}/reset-demo/status`, () =>
        HttpResponse.json({
          enabled: true,
          allowed: true,
          workspace_public_id: workspaceB,
          workspace_name: 'Beta Workspace',
          role: 'owner',
          reason: null,
        }),
      ),
      http.get('*/v1/finance/currencies', () =>
        HttpResponse.json([
          { code: 'USD', name: 'US Dollar', symbol: '$', minor_unit: 2, is_active: true },
        ]),
      ),
      http.get('*/v1/finance/accounts', () =>
        HttpResponse.json({ items: [], total: 0, limit: 200, offset: 0 }),
      ),
      http.get('*/v1/finance/settings', () =>
        HttpResponse.json({
          reporting_currency_code: null,
          currency_display_preference: 'symbol',
          updated_at: '2026-06-10T00:00:00Z',
        }),
      ),
      http.get('*/v1/finance/settings/user', () =>
        HttpResponse.json({
          reporting_currency_override_code: null,
          currency_display_preference_override: null,
          workspace_reporting_currency_code: null,
          workspace_currency_display_preference: 'symbol',
          effective_reporting_currency_code: null,
          effective_currency_display_preference: 'symbol',
          updated_at: '2026-06-10T00:00:00Z',
        }),
      ),
      http.get('*/v1/spending/categories', () =>
        HttpResponse.json({ items: [], total: 0, limit: 200, offset: 0 }),
      ),
      http.post('*/v1/platform/workspaces/:workspaceId/reset-demo', ({ params }) => {
        resetTarget = String(params.workspaceId);
        return HttpResponse.json({ status: 'reset_success' });
      }),
    );

    renderWithQuery(<MasterConfigPage />);

    expect(await screen.findByText('Beta Workspace')).toBeInTheDocument();
    const resetButton = screen.getByTestId('master-demo-reset-button');
    await waitFor(() => expect(resetButton).not.toBeDisabled());
    fireEvent.click(resetButton);

    const confirmButton = screen.getByRole('button', { name: 'Reset & Seed' });
    expect(confirmButton).toBeDisabled();

    fireEvent.change(screen.getByTestId('master-demo-reset-confirmation'), {
      target: { value: 'Beta Workspace' },
    });
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(resetTarget).toBe(workspaceB);
    });
  }, 20000);

  it('shows reset section with disabled action and reason when reset is not allowed', async () => {
    const workspaceId = '33333333-3333-3333-3333-333333333333';
    useWorkspaceStore.getState().setActiveWorkspaceId(workspaceId);

    server.use(
      http.get('*/v1/platform/workspaces/', () =>
        HttpResponse.json({
          items: [
            {
              public_id: workspaceId,
              name: 'Member Workspace',
              description: null,
              is_active: true,
              role: 'member',
            },
          ],
        }),
      ),
      http.get(`*/v1/platform/workspaces/${workspaceId}/reset-demo/status`, () =>
        HttpResponse.json({
          enabled: true,
          allowed: false,
          workspace_public_id: workspaceId,
          workspace_name: 'Member Workspace',
          role: 'member',
          reason: 'insufficient_role',
        }),
      ),
      http.get('*/v1/finance/currencies', () =>
        HttpResponse.json([
          { code: 'USD', name: 'US Dollar', symbol: '$', minor_unit: 2, is_active: true },
        ]),
      ),
      http.get('*/v1/finance/accounts', () =>
        HttpResponse.json({ items: [], total: 0, limit: 200, offset: 0 }),
      ),
      http.get('*/v1/finance/settings', () =>
        HttpResponse.json({
          reporting_currency_code: null,
          currency_display_preference: 'symbol',
          updated_at: '2026-06-10T00:00:00Z',
        }),
      ),
      http.get('*/v1/finance/settings/user', () =>
        HttpResponse.json({
          reporting_currency_override_code: null,
          currency_display_preference_override: null,
          workspace_reporting_currency_code: null,
          workspace_currency_display_preference: 'symbol',
          effective_reporting_currency_code: null,
          effective_currency_display_preference: 'symbol',
          updated_at: '2026-06-10T00:00:00Z',
        }),
      ),
      http.get('*/v1/spending/categories', () =>
        HttpResponse.json({ items: [], total: 0, limit: 200, offset: 0 }),
      ),
    );

    renderWithQuery(<MasterConfigPage />);

    expect(await screen.findByTestId('master-demo-reset-section')).toBeInTheDocument();
    expect(await screen.findByText('insufficient_role')).toBeInTheDocument();
    expect(screen.getByTestId('master-demo-reset-button')).toBeDisabled();
  });

  it('sets the default spending account and excludes brokerage/inactive accounts from the picker', async () => {
    const workspaceId = '44444444-4444-4444-4444-444444444444';
    useWorkspaceStore.getState().setActiveWorkspaceId(workspaceId);
    let capturedPayload: Record<string, unknown> | null = null;

    server.use(
      http.get('*/v1/platform/workspaces/', () =>
        HttpResponse.json({
          items: [
            {
              public_id: workspaceId,
              name: 'Gamma Workspace',
              description: null,
              is_active: true,
              role: 'owner',
            },
          ],
        }),
      ),
      http.get(`*/v1/platform/workspaces/${workspaceId}/reset-demo/status`, () =>
        HttpResponse.json({
          enabled: false,
          allowed: false,
          workspace_public_id: workspaceId,
          workspace_name: 'Gamma Workspace',
          role: 'owner',
          reason: null,
        }),
      ),
      http.get('*/v1/finance/currencies', () =>
        HttpResponse.json([
          { code: 'USD', name: 'US Dollar', symbol: '$', minor_unit: 2, is_active: true },
        ]),
      ),
      http.get('*/v1/finance/accounts', () =>
        HttpResponse.json({
          items: [
            {
              public_id: 'acc-wallet',
              name: 'Everyday Wallet',
              account_type: 'wallet',
              default_currency_code: 'USD',
              is_active: true,
              created_at: '2026-01-01T00:00:00Z',
              updated_at: '2026-01-01T00:00:00Z',
            },
            {
              public_id: 'acc-brokerage',
              name: 'Brokerage One',
              account_type: 'brokerage',
              default_currency_code: 'USD',
              is_active: true,
              created_at: '2026-01-01T00:00:00Z',
              updated_at: '2026-01-01T00:00:00Z',
            },
            {
              public_id: 'acc-inactive',
              name: 'Closed Wallet',
              account_type: 'wallet',
              default_currency_code: 'USD',
              is_active: false,
              created_at: '2026-01-01T00:00:00Z',
              updated_at: '2026-01-01T00:00:00Z',
            },
          ],
          total: 3,
          limit: 200,
          offset: 0,
        }),
      ),
      http.get('*/v1/finance/settings', () =>
        HttpResponse.json({
          reporting_currency_code: null,
          currency_display_preference: 'symbol',
          default_spending_account_id: null,
          updated_at: '2026-06-10T00:00:00Z',
        }),
      ),
      http.patch('*/v1/finance/settings', async ({ request }) => {
        capturedPayload = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({
          reporting_currency_code: null,
          currency_display_preference: 'symbol',
          default_spending_account_id: 'acc-wallet',
          updated_at: '2026-06-11T00:00:00Z',
        });
      }),
      http.get('*/v1/finance/settings/user', () =>
        HttpResponse.json({
          reporting_currency_override_code: null,
          currency_display_preference_override: null,
          workspace_reporting_currency_code: null,
          workspace_currency_display_preference: 'symbol',
          effective_reporting_currency_code: null,
          effective_currency_display_preference: 'symbol',
          updated_at: '2026-06-10T00:00:00Z',
        }),
      ),
      http.get('*/v1/spending/categories', () =>
        HttpResponse.json({ items: [], total: 0, limit: 200, offset: 0 }),
      ),
    );

    renderWithQuery(<MasterConfigPage />);

    const picker = await screen.findByTestId('master-default-spending-account');
    fireEvent.click(picker);

    // Eligible, active, non-brokerage account is offered...
    const walletOption = await screen.findByRole('option', { name: /Everyday Wallet/ });
    // ...but the brokerage and inactive accounts are not.
    expect(screen.queryByRole('option', { name: /Brokerage One/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /Closed Wallet/ })).not.toBeInTheDocument();

    fireEvent.click(walletOption);
    fireEvent.click(screen.getByTestId('master-workspace-save'));

    await waitFor(() => {
      expect(capturedPayload).toMatchObject({ default_spending_account_id: 'acc-wallet' });
    });
  });
});
