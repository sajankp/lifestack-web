import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { http, HttpResponse } from 'msw';

import { RegisterPage } from './RegisterPage';
import { server } from '../test/setup';

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/register']}>
      <Routes>
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/login" element={<div data-testid="login-page">Login</div>} />
      </Routes>
    </MemoryRouter>,
  );

describe('RegisterPage', () => {
  it('renders the registration form', () => {
    renderPage();
    expect(screen.getByText('Create a new account')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Email address')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Username')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create Account' })).toBeInTheDocument();
    expect(screen.getByText('Sign In')).toBeInTheDocument();
  });

  it('shows password strength indicator as user types', () => {
    renderPage();
    const passwordInput = screen.getByPlaceholderText('Password');

    // No password → Required label
    expect(screen.getByText('Required')).toBeInTheDocument();

    // Weak password (short)
    fireEvent.change(passwordInput, { target: { value: 'abc' } });
    expect(screen.getByText('Weak')).toBeInTheDocument();

    // Strong password
    fireEvent.change(passwordInput, { target: { value: 'MyStr0ng!Pass' } });
    expect(screen.getByText('Strong')).toBeInTheDocument();
  });

  it('shows generic error on registration failure', async () => {
    server.use(http.post('*/auth/register', () => new HttpResponse(null, { status: 500 })));

    renderPage();
    fireEvent.change(screen.getByPlaceholderText('Email address'), {
      target: { value: 'user@example.com' },
    });
    fireEvent.change(screen.getByPlaceholderText('Username'), {
      target: { value: 'testuser' },
    });
    fireEvent.change(screen.getByPlaceholderText('Password'), {
      target: { value: 'Password123!' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create Account' }));

    expect(
      await screen.findByText('Registration failed. Please check your details.'),
    ).toBeInTheDocument();
  });

  it('shows normalized error on 409 conflict (prevents enumeration)', async () => {
    server.use(
      http.post('*/auth/register', () =>
        HttpResponse.json({ detail: 'Email already exists' }, { status: 409 }),
      ),
    );

    renderPage();
    fireEvent.change(screen.getByPlaceholderText('Email address'), {
      target: { value: 'existing@example.com' },
    });
    fireEvent.change(screen.getByPlaceholderText('Username'), {
      target: { value: 'existinguser' },
    });
    fireEvent.change(screen.getByPlaceholderText('Password'), {
      target: { value: 'Password123!' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create Account' }));

    expect(
      await screen.findByText('Registration failed. Please check your details and try again.'),
    ).toBeInTheDocument();
  });

  it('shows invalid fields message and highlights all invalid inputs from api errors', async () => {
    server.use(
      http.post('*/auth/register', () =>
        HttpResponse.json(
          {
            errors: [{ msg: 'Password must be at least 8 characters', loc: ['body', 'password'] }],
          },
          { status: 422 },
        ),
      ),
    );

    renderPage();
    const emailInput = screen.getByPlaceholderText('Email address');
    const usernameInput = screen.getByPlaceholderText('Username');
    const passwordInput = screen.getByPlaceholderText('Password');

    fireEvent.change(emailInput, {
      target: { value: 'user@example.com' },
    });
    fireEvent.change(usernameInput, {
      target: { value: 'testuser' },
    });
    fireEvent.change(passwordInput, {
      target: { value: 'Password123!' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create Account' }));

    expect(await screen.findByText('Invalid fields: password.')).toBeInTheDocument();
    expect(passwordInput).toHaveClass('border-red-500');
    expect(emailInput).toHaveClass('border-slate-600');
    expect(usernameInput).toHaveClass('border-slate-600');
  });

  it('shows loading state while submitting', async () => {
    let resolveRegister!: () => void;
    server.use(
      http.post(
        '*/auth/register',
        () =>
          new Promise<Response>((resolve) => {
            resolveRegister = () => resolve(HttpResponse.json({ ok: true }) as unknown as Response);
          }),
      ),
    );

    renderPage();
    fireEvent.change(screen.getByPlaceholderText('Email address'), {
      target: { value: 'user@example.com' },
    });
    fireEvent.change(screen.getByPlaceholderText('Username'), {
      target: { value: 'testuser' },
    });
    fireEvent.change(screen.getByPlaceholderText('Password'), {
      target: { value: 'Password123!' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create Account' }));

    expect(await screen.findByRole('button', { name: 'Creating account...' })).toBeDisabled();
    resolveRegister();
  });

  it('navigates to login with success message on successful registration', async () => {
    server.use(
      http.post('*/auth/register', () =>
        HttpResponse.json({ public_id: 'new-user', email: 'user@example.com' }, { status: 201 }),
      ),
    );

    renderPage();
    fireEvent.change(screen.getByPlaceholderText('Email address'), {
      target: { value: 'new@example.com' },
    });
    fireEvent.change(screen.getByPlaceholderText('Username'), {
      target: { value: 'newuser' },
    });
    fireEvent.change(screen.getByPlaceholderText('Password'), {
      target: { value: 'Password123!' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create Account' }));

    expect(await screen.findByTestId('login-page')).toBeInTheDocument();
  });
});
