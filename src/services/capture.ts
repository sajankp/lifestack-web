import api from './api';

export const captureService = {
  capture: async (payload: {
    text: string;
    module?: 'todo' | 'spending' | null;
    hints?: {
      amount?: string | null;
      category?: string | null;
      due_date?: string | null;
      priority?: string | null;
      type?: string | null;
    };
  }) => {
    const res = await api.post('/capture', payload);
    return res.data;
  },
};
