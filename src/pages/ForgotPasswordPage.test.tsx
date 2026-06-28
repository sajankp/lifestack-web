import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { http, HttpResponse } from 'msw';

import { ForgotPasswordPage } from './ForgotPasswordPage';
import { server } from '../test/setup';

const renderPage = () =>
  render(
    <MemoryRouter>
      <ForgotPasswordPage />
    </MemoryRouter>,
  );

describe('ForgotPasswordPage', () => {
  it('renders the forgot password form', () => {
    renderPage();
    expect(screen.getByText('Reset your password')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Email address')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send Reset Link' })).toBeInTheDocument();
    expect(screen.getByText('Sign In')).toBeInTheDocument();
  });

  it('shows success message and clears email on success', async () => {
    server.use(
      http.post('*/auth/forgot-password', () => HttpResponse.json({ ok: true })),
    );

    renderPage();
    fireEvent.change(screen.getByPlaceholderText('Email address'), {
      target: { value: 'user@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send Reset Link' }));

    expect(
      await screen.findByText(
        'If the email is registered, a password reset link has been sent.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Email address')).toHaveValue('');
  });

  it('shows error message on failure', async () => {
    server.use(
      http.post('*/auth/forgot-password', () => new HttpResponse(null, { status: 500 })),
    );

    renderPage();
    fireEvent.change(screen.getByPlaceholderText('Email address'), {
      target: { value: 'user@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send Reset Link' }));

    expect(
      await screen.findByText('An error occurred. Please try again.'),
    ).toBeInTheDocument();
  });

  it('shows loading state while submitting', async () => {
    let resolveRequest!: () => void;
    server.use(
      http.post('*/auth/forgot-password', () =>
        new Promise<Response>((resolve) => {
          resolveRequest = () => resolve(HttpResponse.json({ ok: true }) as unknown as Response);
        }),
      ),
    );

    renderPage();
    fireEvent.change(screen.getByPlaceholderText('Email address'), {
      target: { value: 'user@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send Reset Link' }));

    expect(await screen.findByRole('button', { name: 'Sending link...' })).toBeDisabled();
    resolveRequest();
  });
});
