import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';

import { NotificationsPage } from './NotificationsPage';
import { server } from '../test/setup';

const renderWithQuery = (ui: React.ReactNode) => {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
};

const NOTIFICATION = {
  public_id: 'notif-001',
  title: 'Budget exceeded',
  body: 'Food budget exceeded by 20%',
  category: 'budget',
  severity: 'warning',
  is_read: false,
  created_at: '2026-06-20T10:00:00Z',
};

const baseHandlers = [
  http.get('*/v1/notifications', () =>
    HttpResponse.json({ items: [], total: 0, limit: 20, offset: 0 }),
  ),
  http.get('*/v1/notifications/preferences', () => HttpResponse.json([])),
];

describe('NotificationsPage', () => {
  it('renders page hero and empty state', async () => {
    server.use(...baseHandlers);
    renderWithQuery(<NotificationsPage />);

    expect(await screen.findByText('Notifications')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'No notifications yet' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mark all read' })).toBeInTheDocument();
  });

  it('shows notification preferences when present', async () => {
    server.use(
      http.get('*/v1/notifications/preferences', () =>
        HttpResponse.json([
          { category: 'budget', channel_in_app: true, is_muted: false },
          { category: 'system', channel_in_app: false, is_muted: true },
        ]),
      ),
      ...baseHandlers,
    );

    renderWithQuery(<NotificationsPage />);

    expect(await screen.findByText('budget')).toBeInTheDocument();
    expect(screen.getByText('In-app: On | Muted: No')).toBeInTheDocument();
    expect(screen.getByText('system')).toBeInTheDocument();
    expect(screen.getByText('In-app: Off | Muted: Yes')).toBeInTheDocument();
  });

  it('shows no preferences message when list is empty', async () => {
    server.use(...baseHandlers);
    renderWithQuery(<NotificationsPage />);

    expect(await screen.findByText('No preferences configured yet.')).toBeInTheDocument();
  });

  it('renders notification items', async () => {
    server.use(
      http.get('*/v1/notifications', () =>
        HttpResponse.json({ items: [NOTIFICATION], total: 1, limit: 20, offset: 0 }),
      ),
      ...baseHandlers,
    );

    renderWithQuery(<NotificationsPage />);

    expect(await screen.findByText('Budget exceeded')).toBeInTheDocument();
    expect(screen.getByText('Food budget exceeded by 20%')).toBeInTheDocument();
    expect(screen.getByText('budget · warning')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mark read' })).toBeInTheDocument();
  });

  it('does not show mark read button for already-read notifications', async () => {
    server.use(
      http.get('*/v1/notifications', () =>
        HttpResponse.json({
          items: [{ ...NOTIFICATION, is_read: true }],
          total: 1,
          limit: 20,
          offset: 0,
        }),
      ),
      ...baseHandlers,
    );

    renderWithQuery(<NotificationsPage />);

    await screen.findByText('Budget exceeded');
    expect(screen.queryByRole('button', { name: 'Mark read' })).not.toBeInTheDocument();
  });

  it('calls mark read API when button clicked', async () => {
    let markReadCalled = false;
    server.use(
      http.get('*/v1/notifications', () =>
        HttpResponse.json({ items: [NOTIFICATION], total: 1, limit: 20, offset: 0 }),
      ),
      http.patch('*/v1/notifications/notif-001/read', () => {
        markReadCalled = true;
        return HttpResponse.json({ ...NOTIFICATION, is_read: true });
      }),
      ...baseHandlers,
    );

    renderWithQuery(<NotificationsPage />);

    fireEvent.click(await screen.findByRole('button', { name: 'Mark read' }));

    await waitFor(() => {
      expect(markReadCalled).toBe(true);
    });
  });

  it('calls mark all read API when button clicked', async () => {
    let markAllCalled = false;
    server.use(
      http.post('*/v1/notifications/mark-all-read', () => {
        markAllCalled = true;
        return HttpResponse.json({ updated: 3 });
      }),
      ...baseHandlers,
    );

    renderWithQuery(<NotificationsPage />);

    await screen.findByText('Notifications');
    fireEvent.click(screen.getByRole('button', { name: 'Mark all read' }));

    await waitFor(() => {
      expect(markAllCalled).toBe(true);
    });
  });

  it('shows error banner when notifications fail to load', async () => {
    server.use(
      http.get('*/v1/notifications', () => new HttpResponse(null, { status: 500 })),
      http.get('*/v1/notifications/preferences', () => HttpResponse.json([])),
    );

    renderWithQuery(<NotificationsPage />);

    expect(
      await screen.findByText('Failed to load notifications. Please try again.'),
    ).toBeInTheDocument();
  });
});
