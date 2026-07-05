import { z } from 'zod';

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

/** Zod schema for the standard paginated list envelope around `item`. */
export const paginatedSchema = <T extends z.ZodTypeAny>(item: T) =>
  z.object({
    items: z.array(item).default([]),
    total: z.number().default(0),
    limit: z.number().default(0),
    offset: z.number().default(0),
  });
