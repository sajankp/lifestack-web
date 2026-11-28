import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { NAV_LINKS } from './constants';
import { Sidebar } from './Sidebar';
import { MobileNavDrawer } from './MobileNavDrawer';

// spec-113 §2.2: Capture leaves the sidebar and the drawer (the floating mic button stays), and the
// two tools read "Import" and "Export".

describe('navigation links', () => {
  it('no longer has a Capture entry', () => {
    expect(NAV_LINKS.some((link) => link.to === '/capture')).toBe(false);
    expect(NAV_LINKS.some((link) => link.testId === 'nav-capture')).toBe(false);
    expect(NAV_LINKS.some((link) => link.label === 'Capture')).toBe(false);
  });

  it('labels the tools Import and Export, with their routes and test ids unchanged', () => {
    const imports = NAV_LINKS.find((link) => link.to === '/imports');
    const exports_ = NAV_LINKS.find((link) => link.to === '/exports');

    expect(imports).toMatchObject({ label: 'Import', testId: 'nav-imports' });
    expect(exports_).toMatchObject({ label: 'Export', testId: 'nav-exports' });
  });
});

describe('Sidebar', () => {
  it('renders no Capture item and the new tool labels', () => {
    render(
      <MemoryRouter>
        <Sidebar collapsed={false} onToggle={() => {}} />
      </MemoryRouter>,
    );

    expect(screen.queryByTestId('nav-capture')).not.toBeInTheDocument();
    expect(screen.queryByText('Capture')).not.toBeInTheDocument();
    expect(within(screen.getByTestId('nav-imports')).getByText('Import')).toBeInTheDocument();
    expect(within(screen.getByTestId('nav-exports')).getByText('Export')).toBeInTheDocument();
  });
});

describe('MobileNavDrawer', () => {
  it('renders no Capture item either', () => {
    render(
      <MemoryRouter>
        <MobileNavDrawer
          open
          onClose={() => {}}
          username="sajan"
          workspaces={[]}
          onSelectWorkspace={() => {}}
          isSelectingWorkspace={false}
          onLogout={() => {}}
          isLoggingOut={false}
        />
      </MemoryRouter>,
    );

    expect(screen.queryByTestId('nav-capture-mobile')).not.toBeInTheDocument();
    expect(screen.queryByText('Capture')).not.toBeInTheDocument();
    expect(screen.getByTestId('nav-imports-mobile')).toHaveTextContent('Import');
    expect(screen.getByTestId('nav-exports-mobile')).toHaveTextContent('Export');
  });
});
