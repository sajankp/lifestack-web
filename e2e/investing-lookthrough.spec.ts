import { expect, test } from '@playwright/test';

test('investing look-through analytics renders exposure and overlap', async ({ page }) => {
  await page.route('**/v1/auth/me', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ id: 1, username: 'e2e-user', sid: 'sid', default_workspace_id: 1 }),
    });
  });

  await page.route('**/v1/investing/holdings**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ items: [], total: 0, limit: 200, offset: 0 }),
    });
  });
  await page.route('**/v1/investing/cash-balances**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ items: [], total: 0, limit: 200, offset: 0 }),
    });
  });
  await page.route('**/v1/investing/summary', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        portfolio_value: '0',
        holdings_count: 0,
        cash_total: '0',
        currency_breakdown: {},
        daily_change: null,
        reporting_currency: 'USD',
        valuation_status: 'single_currency_native',
      }),
    });
  });
  await page.route('**/v1/finance/accounts**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ items: [], total: 0, limit: 200, offset: 0 }),
    });
  });
  await page.route('**/v1/finance/currencies**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        { code: 'USD', name: 'US Dollar', symbol: '$', minor_unit: 2, is_active: true },
        { code: 'GBP', name: 'Pound Sterling', symbol: '£', minor_unit: 2, is_active: true },
      ]),
    });
  });
  await page.route('**/v1/investing/instruments', async (route) => {
    if (route.request().method() === 'POST') {
      const payload = await route.request().postDataJSON();
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          public_id: '44444444-4444-4444-4444-444444444444',
          company_id: null,
          is_active: true,
          created_at: '2026-05-24T00:00:00Z',
          updated_at: '2026-05-24T00:00:00Z',
          ...payload,
        }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          public_id: '44444444-4444-4444-4444-444444444444',
          symbol: 'VTI',
          name: 'Vanguard Total Market ETF',
          instrument_type: 'etf',
          company_id: null,
          is_active: true,
          created_at: '2026-05-24T00:00:00Z',
          updated_at: '2026-05-24T00:00:00Z',
        },
      ]),
    });
  });
  await page.route('**/v1/investing/instruments/*/constituents', async (route) => {
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          company_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
          company_name: 'Apple Inc',
          company_ticker: 'AAPL',
          weight: '0.60000000',
          as_of_date: '2026-05-24',
          source: 'manual-ui',
        },
      ]),
    });
  });
  await page.route('**/v1/investing/analytics/exposure**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        as_of_date: '2026-05-24',
        analysis_status: 'complete',
        snapshot_coverage: '1',
        staleness_days: 30,
        warnings: [],
        exposure: [
          {
            company_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
            company_name: 'Apple Inc',
            company_ticker: 'AAPL',
            direct_exposure: '300.00',
            lookthrough_exposure: '900.00',
          },
        ],
        total_direct_exposure: '300.00',
        total_lookthrough_exposure: '1000.00',
      }),
    });
  });
  await page.route('**/v1/investing/analytics/overlap**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        as_of_date: '2026-05-24',
        analysis_status: 'complete',
        snapshot_coverage: '1',
        warnings: [],
        top_5_concentration_pct: '0.90',
        top_10_concentration_pct: '1.00',
        duplicate_exposure_index: '0.70',
        overlaps: [
          {
            company_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
            company_name: 'Apple Inc',
            company_ticker: 'AAPL',
            overlap_exposure: '900.00',
            portfolio_share: '0.90',
          },
        ],
      }),
    });
  });

  await page.goto('/investing');
  await expect(page.getByRole('heading', { name: 'Investing' })).toBeVisible();
  await page.getByRole('button', { name: 'Look-through Analytics' }).click();
  await expect(page.getByText('Exposure (Look-through)')).toBeVisible();
  await expect(page.getByText('Overlap')).toBeVisible();
  await expect(page.getByRole('cell', { name: 'AAPL' })).toBeVisible();

  await page.getByPlaceholder('Symbol (e.g. VTI)').fill('QQQ');
  await page.getByPlaceholder('Name').fill('Nasdaq ETF');
  await page.getByRole('button', { name: 'Create instrument' }).click();
});
