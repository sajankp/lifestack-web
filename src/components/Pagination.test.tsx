import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Pagination } from './Pagination';

describe('Pagination Component', () => {
  it('renders correctly with default navigation controls', () => {
    const onPageChange = vi.fn();
    render(<Pagination total={100} limit={25} offset={0} onPageChange={onPageChange} />);

    expect(screen.getByTestId('pagination-summary')).toHaveTextContent('Showing 1 to 25 of 100 results');
    expect(screen.getByText('Page 1 of 4')).toBeInTheDocument();

    const prevBtn = screen.getByTestId('pagination-prev-btn');
    const nextBtn = screen.getByTestId('pagination-next-btn');

    expect(prevBtn).toBeDisabled();
    expect(nextBtn).toBeEnabled();

    fireEvent.click(nextBtn);
    expect(onPageChange).toHaveBeenCalledWith(25);
  });

  it('renders previous page navigation correctly on later pages', () => {
    const onPageChange = vi.fn();
    render(<Pagination total={100} limit={25} offset={50} onPageChange={onPageChange} />);

    expect(screen.getByTestId('pagination-summary')).toHaveTextContent('Showing 51 to 75 of 100 results');
    expect(screen.getByText('Page 3 of 4')).toBeInTheDocument();

    const prevBtn = screen.getByTestId('pagination-prev-btn');
    fireEvent.click(prevBtn);
    expect(onPageChange).toHaveBeenCalledWith(25);
  });

  it('renders page size selector when onLimitChange is provided', () => {
    const onPageChange = vi.fn();
    const onLimitChange = vi.fn();
    render(
      <Pagination
        total={120}
        limit={50}
        offset={50}
        onPageChange={onPageChange}
        pageSizeOptions={[25, 50, 100, 200]}
        onLimitChange={onLimitChange}
      />,
    );

    const select = screen.getByTestId('pagination-page-size-select') as HTMLSelectElement;
    expect(select).toBeInTheDocument();
    expect(select.value).toBe('50');

    fireEvent.change(select, { target: { value: '100' } });
    expect(onLimitChange).toHaveBeenCalledWith(100);
    expect(onPageChange).toHaveBeenCalledWith(0);
  });

  it('returns null when total is 0', () => {
    const { container } = render(
      <Pagination total={0} limit={25} offset={0} onPageChange={vi.fn()} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('returns null when totalPages <= 1 and no onLimitChange is passed', () => {
    const { container } = render(
      <Pagination total={10} limit={25} offset={0} onPageChange={vi.fn()} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders controls when totalPages <= 1 but onLimitChange is passed', () => {
    render(
      <Pagination
        total={15}
        limit={25}
        offset={0}
        onPageChange={vi.fn()}
        onLimitChange={vi.fn()}
      />,
    );
    expect(screen.getByTestId('pagination-summary')).toHaveTextContent('Showing 1 to 15 of 15 results');
    expect(screen.getByTestId('pagination-page-size-select')).toBeInTheDocument();
  });
});

