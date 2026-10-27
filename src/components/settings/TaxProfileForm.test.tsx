import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TaxProfileForm } from './TaxProfileForm';
import { investingService } from '../../services/investing';
import { ToastProvider } from '../../components/ui/toast';

vi.mock('../../services/investing', () => ({
  investingService: {
    getTaxProfile: vi.fn(),
    updateTaxProfile: vi.fn(),
  },
}));

const mockedInvesting = vi.mocked(investingService);

const DEFAULT_PROFILE = {
  public_id: 'profile-1',
  resident_status: 'resident',
  tax_regime: 'new',
  other_income: '0',
  slab_override_pct: null,
  surcharge_override_pct: null,
  cess_pct: '4',
  explicit_regime: null,
  apply_carry_forward: true,
  fx_overrides: {},
  notes: null,
};

const renderWithQuery = (ui: React.ReactNode) => {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        {ui}
      </ToastProvider>
    </QueryClientProvider>,
  );
};

beforeAll(() => {
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  Element.prototype.scrollIntoView = vi.fn();
});

describe('TaxProfileForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedInvesting.getTaxProfile.mockResolvedValue(DEFAULT_PROFILE);
    mockedInvesting.updateTaxProfile.mockResolvedValue(DEFAULT_PROFILE);
  });

  it('renders with loaded profile data', async () => {
    renderWithQuery(<TaxProfileForm />);

    await waitFor(() => {
      expect(screen.getByTestId('tax-form-resident-status')).toHaveTextContent('Resident');
      expect(screen.getByTestId('tax-form-tax-regime')).toHaveTextContent('New (Sec 115BAC)');
      expect(screen.getByTestId('tax-form-other-income')).toHaveValue(0);
      expect(screen.getByTestId('tax-form-explicit-regime')).toHaveTextContent('— (auto-classify from security master)');
    });
  });

  it('updates other_income and submits', async () => {
    let submittedData: any = null;
    mockedInvesting.updateTaxProfile.mockImplementation(async (data) => {
      submittedData = data;
      return { ...DEFAULT_PROFILE, ...data };
    });

    renderWithQuery(<TaxProfileForm />);

    await waitFor(() => expect(screen.getByTestId('tax-form-other-income')).toBeInTheDocument());

    fireEvent.change(screen.getByTestId('tax-form-other-income'), {
      target: { value: '1500000' },
    });

    fireEvent.click(screen.getByTestId('tax-form-submit'));

    await waitFor(() => {
      expect(mockedInvesting.updateTaxProfile).toHaveBeenCalledTimes(1);
      expect(submittedData).toEqual({ other_income: '1500000' });
    });
  });

  it('changes tax_regime via Select and submits', async () => {
    let submittedData: any = null;
    mockedInvesting.updateTaxProfile.mockImplementation(async (data) => {
      submittedData = data;
      return { ...DEFAULT_PROFILE, ...data };
    });

    renderWithQuery(<TaxProfileForm />);

    await waitFor(() => expect(screen.getByTestId('tax-form-tax-regime')).toBeInTheDocument());

    // Click the select trigger to open, then click the option
    fireEvent.click(screen.getByTestId('tax-form-tax-regime'));
    await waitFor(() => {
      const oldOption = screen.getByRole('option', { name: /old/i });
      fireEvent.click(oldOption);
    });

    fireEvent.click(screen.getByTestId('tax-form-submit'));

    await waitFor(() => {
      expect(submittedData).toEqual({ tax_regime: 'old' });
    });
  });

  it('rejects negative other_income', async () => {
    renderWithQuery(<TaxProfileForm />);

    await waitFor(() => expect(screen.getByTestId('tax-form-other-income')).toBeInTheDocument());

    fireEvent.change(screen.getByTestId('tax-form-other-income'), {
      target: { value: '-1000' },
    });

    fireEvent.click(screen.getByTestId('tax-form-submit'));

    await waitFor(() => {
      expect(mockedInvesting.updateTaxProfile).not.toHaveBeenCalled();
    });
  });

  it('rejects rate > 100', async () => {
    renderWithQuery(<TaxProfileForm />);

    await waitFor(() => expect(screen.getByTestId('tax-form-other-income')).toBeInTheDocument());

    // Open FX section first
    fireEvent.click(screen.getByTestId('tax-fx-toggle'));
    await waitFor(() => expect(screen.getByTestId('tax-fx-add-row')).toBeInTheDocument());

    fireEvent.click(screen.getByTestId('tax-fx-add-row'));
    await waitFor(() => expect(screen.getByTestId('fx-override-rate-0')).toBeInTheDocument());

    fireEvent.change(screen.getByTestId('fx-override-month-0'), {
      target: { value: '2026-04' },
    });
    fireEvent.change(screen.getByTestId('fx-override-rate-0'), {
      target: { value: '150' },
    });

    fireEvent.click(screen.getByTestId('tax-form-submit'));

    await waitFor(() => {
      expect(mockedInvesting.updateTaxProfile).not.toHaveBeenCalled();
    });
  });

  it('rejects invalid month format', async () => {
    renderWithQuery(<TaxProfileForm />);

    await waitFor(() => expect(screen.getByTestId('tax-form-other-income')).toBeInTheDocument());

    // Open FX section first
    fireEvent.click(screen.getByTestId('tax-fx-toggle'));
    await waitFor(() => expect(screen.getByTestId('tax-fx-add-row')).toBeInTheDocument());

    fireEvent.click(screen.getByTestId('tax-fx-add-row'));
    await waitFor(() => expect(screen.getByTestId('fx-override-month-0')).toBeInTheDocument());

    fireEvent.change(screen.getByTestId('fx-override-month-0'), {
      target: { value: '2026/04' },
    });
    fireEvent.change(screen.getByTestId('fx-override-rate-0'), {
      target: { value: '83.5' },
    });

    fireEvent.click(screen.getByTestId('tax-form-submit'));

    await waitFor(() => {
      expect(mockedInvesting.updateTaxProfile).not.toHaveBeenCalled();
    });
  });

  it('toggles advanced overrides section', async () => {
    renderWithQuery(<TaxProfileForm />);

    // Wait for component to fully render (query loaded)
    await waitFor(() => expect(screen.getByTestId('tax-form-other-income')).toBeInTheDocument());

    expect(screen.queryByTestId('tax-form-slab-override')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('tax-form-advanced-toggle'));
    await waitFor(() => {
      expect(screen.getByTestId('tax-form-slab-override')).toBeInTheDocument();
    });
  });

  it('toggles FX overrides section', async () => {
    renderWithQuery(<TaxProfileForm />);

    // Wait for component to fully render (query loaded)
    await waitFor(() => expect(screen.getByTestId('tax-form-other-income')).toBeInTheDocument());

    expect(screen.queryByTestId('tax-fx-add-row')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('tax-fx-toggle'));
    await waitFor(() => {
      expect(screen.getByTestId('tax-fx-add-row')).toBeInTheDocument();
    });
  });

  it('does not call API when no changes', async () => {
    renderWithQuery(<TaxProfileForm />);

    await waitFor(() => expect(screen.getByTestId('tax-form-other-income')).toBeInTheDocument());

    fireEvent.click(screen.getByTestId('tax-form-submit'));

    await waitFor(() => {
      expect(mockedInvesting.updateTaxProfile).not.toHaveBeenCalled();
    });
  });
});