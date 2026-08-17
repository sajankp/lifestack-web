import { fireEvent, render, screen } from '@testing-library/react';

import { DropdownSelect } from './DropdownSelect';

describe('DropdownSelect', () => {
  it('groups recently used options ahead of the full list', () => {
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
    HTMLElement.prototype.scrollIntoView = vi.fn();

    render(
      <DropdownSelect
        value=""
        options={[
          { value: 'utilities', label: 'Utilities' },
          { value: 'groceries', label: 'Groceries' },
          { value: 'rent', label: 'Rent' },
        ]}
        recentValues={['groceries']}
        onChange={vi.fn()}
        placeholder="Select category"
        showSearch
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Select category' }));

    expect(screen.getByText('Recent')).toBeInTheDocument();
    expect(screen.getByText('All options')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Groceries' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Utilities' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Rent' })).toBeInTheDocument();
  });

  it('keeps the create action available while searching', () => {
    const onCreate = vi.fn();
    render(
      <DropdownSelect
        value=""
        options={[{ value: 'food', label: 'Food' }]}
        onChange={vi.fn()}
        placeholder="Select category"
        showSearch
        onCreateOption={onCreate}
        createOptionLabel="Create category"
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Select category' }));
    fireEvent.change(screen.getByPlaceholderText('Search...'), { target: { value: 'zzz' } });
    fireEvent.click(screen.getByRole('option', { name: /Create category/ }));

    expect(onCreate).toHaveBeenCalledOnce();
  });
});
