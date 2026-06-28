import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { http, HttpResponse } from 'msw';

import { LoginPage } from './LoginPage';
import { server } from '../test/setup';

const renderPage = (initialEntries: Array<string | { pathname: string; state?: unknown }> = ['/login']) =>
  render(
    <MemoryRouter initialEntries={initialEntries}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<div data-testid="home-page">Home</div>} />
        <Route path="/forgot-password" element={<div>Forgot Password</div>} />
        <Route path="/register" element={<div>Register</div>} />
      </Routes>
    </MemoryRouter>,
  );

describe('LoginPage', () => {
  it('renders the sign-in form', () => {
    renderPage(['/login']);
    expect(screen.getByText('Lifestack')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Email address')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign In' })).toBeInTheDocument();
    expect(screen.getByText('Forgot password?')).toBeInTheDocument();
    expect(screen.getByText('Create one')).toBeInTheDocument();
  });

  it('shows a state message passed via location state', () => {
    renderPage([{ pathname: '/login', state: { message: 'Registration successful. Please log in.' } }]);
    expect(screen.getByText('Registration successful. Please log in.')).toBeInTheDocument();
  });

  it('shows invalid credentials error on 401', async () => {
    server.use(
      http.post('*/auth/login', () => new HttpResponse(null, { status: 401 })),
    );

    renderPage(['/login']);
    fireEvent.change(screen.getByPlaceholderText('Email address'), {
      target: { value: 'bad@example.com' },
    });
    fireEvent.change(screen.getByPlaceholderText('Password'), {
      target: { value: 'wrongpass' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Sign In' }));

    expect(
      await screen.findByText('Invalid credentials. Please check your email and password.'),
    ).toBeInTheDocument();
  });

  it('shows generic error on non-auth failure', async () => {
    server.use(
      http.post('*/auth/login', () => new HttpResponse(null, { status: 500 })),
    );

    renderPage(['/login']);
    fireEvent.change(screen.getByPlaceholderText('Email address'), {
      target: { value: 'user@example.com' },
    });
    fireEvent.change(screen.getByPlaceholderText('Password'), {
      target: { value: 'pass' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Sign In' }));

    expect(await screen.findByText('Sign in failed. Please try again.')).toBeInTheDocument();
  });

  it('shows loading state while submitting', async () => {
    let resolveLogin!: () => void;
    server.use(
      http.post('*/auth/login', () =>
        new Promise<Response>((resolve) => {
          resolveLogin = () => resolve(HttpResponse.json({ access_token: 'tok' }) as unknown as Response);
        }),
      ),
    );

    renderPage(['/login']);
    fireEvent.change(screen.getByPlaceholderText('Email address'), {
      target: { value: 'user@example.com' },
    });
    fireEvent.change(screen.getByPlaceholderText('Password'), {
      target: { value: 'pass' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Sign In' }));

    expect(await screen.findByRole('button', { name: 'Signing in...' })).toBeDisabled();
    resolveLogin();
  });

  it('navigates to home on successful login', async () => {
    server.use(
      http.post('*/auth/login', () => HttpResponse.json({ access_token: 'tok' })),
      http.get('*/auth/me', () =>
        HttpResponse.json({
          public_id: 'user-1',
          email: 'user@example.com',
          username: 'testuser',
          is_active: true,
        }),
      ),
    );

    renderPage(['/login']);
    fireEvent.change(screen.getByPlaceholderText('Email address'), {
      target: { value: 'user@example.com' },
    });
    fireEvent.change(screen.getByPlaceholderText('Password'), {
      target: { value: 'correctpass' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Sign In' }));

    expect(await screen.findByTestId('home-page')).toBeInTheDocument();
  });
});
