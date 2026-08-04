import { z } from 'zod';
import api from './api';

export const AuthUserSchema = z.object({
  public_id: z.string(),
  email: z.string(),
  username: z.string(),
  is_active: z.boolean(),
  timezone: z.string().nullable().default(null),
});

export type AuthUser = z.infer<typeof AuthUserSchema>;

export const authService = {
  login: async (email: string, password: string) => {
    const formData = new URLSearchParams();
    formData.append('username', email); // OAuth2PasswordRequestForm expects username
    formData.append('password', password);

    // Uses form-urlencoded for login because FastAPI OAuth2PasswordRequestForm expects it
    const response = await api.post('/auth/login', formData, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });
    return response.data;
  },

  register: async (email: string, password: string, username: string) => {
    const response = await api.post('/auth/register', {
      email,
      password,
      username,
    });
    return response.data;
  },

  checkAuth: async (): Promise<AuthUser> => {
    const response = await api.get('/auth/me');
    return AuthUserSchema.parse(response.data);
  },

  updateTimezone: async (timezone: string | null): Promise<AuthUser> => {
    const response = await api.patch('/auth/me/timezone', { timezone });
    return AuthUserSchema.parse(response.data);
  },

  logout: async () => {
    await api.post('/auth/logout');
  },

  forgotPassword: async (email: string) => {
    const response = await api.post('/auth/forgot-password', { email });
    return response.data;
  },

  resetPassword: async (token: string, newPassword: string) => {
    const response = await api.post('/auth/reset-password', {
      token,
      new_password: newPassword,
    });
    return response.data;
  },
};
