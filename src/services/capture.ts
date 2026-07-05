import { z } from 'zod';
import api from './api';

// The capture result is intentionally opaque (CapturePage renders it raw),
// so validation only asserts "a JSON object came back".
const CaptureResultSchema = z.record(z.string(), z.unknown());

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
  }): Promise<Record<string, unknown>> => {
    const res = await api.post('/capture', payload);
    return CaptureResultSchema.parse(res.data);
  },
};
