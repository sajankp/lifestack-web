import { beforeEach, describe, expect, it, vi } from 'vitest';

import api from './api';
import { importsService } from './imports';

vi.mock('./api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
  },
}));

describe('importsService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls template/list/detail endpoints', async () => {
    (api.get as unknown as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ data: 'csv,template' })
      .mockResolvedValueOnce({ data: { items: [], total: 0, limit: 20, offset: 0 } })
      .mockResolvedValueOnce({ data: { import_batch: {}, errors: [] } });

    await importsService.downloadTemplate('spending-transactions');
    await importsService.listImports(20, 0);
    await importsService.getImportDetail('imp_1');

    expect(api.get).toHaveBeenNthCalledWith(1, '/imports/templates/spending-transactions', {
      responseType: 'text',
    });
    expect(api.get).toHaveBeenNthCalledWith(2, '/imports', { params: { limit: 20, offset: 0 } });
    expect(api.get).toHaveBeenNthCalledWith(3, '/imports/imp_1');
  });

  it('calls upload, commit, and delete endpoints', async () => {
    (api.post as unknown as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ data: { import_batch: {}, errors: [] } })
      .mockResolvedValueOnce({ data: { import_batch: {}, inserted_rows: 0 } });
    (api.delete as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({});

    const file = new File(['a,b\n1,2'], 'sample.csv', { type: 'text/csv' });
    await importsService.uploadAndValidate('spending-budgets', file);
    await importsService.commitImport('imp_2');
    await importsService.deleteImport('imp_2');

    expect(api.post).toHaveBeenNthCalledWith(
      1,
      '/imports',
      expect.any(FormData)
    );
    expect(api.post).toHaveBeenNthCalledWith(2, '/imports/imp_2/commit');
    expect(api.delete).toHaveBeenCalledWith('/imports/imp_2');
  });
});
