import { describe, expect, it } from 'vitest';
import { defaultSidebarCollapsed } from './sidebarDefault';

describe('defaultSidebarCollapsed', () => {
  it('collapses to the icon rail on tablet widths', () => {
    expect(defaultSidebarCollapsed(768)).toBe(true);
    expect(defaultSidebarCollapsed(1023)).toBe(true);
  });

  it('keeps the full sidebar from the lg breakpoint up', () => {
    expect(defaultSidebarCollapsed(1024)).toBe(false);
    expect(defaultSidebarCollapsed(1440)).toBe(false);
  });

  it('reads the live window width when none is given', () => {
    expect(defaultSidebarCollapsed()).toBe(window.innerWidth < 1024);
  });
});
