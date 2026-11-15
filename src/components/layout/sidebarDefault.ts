const LG_BREAKPOINT_PX = 1024;

/**
 * Whether the desktop sidebar starts collapsed when the user has no saved
 * preference: the icon rail below the `lg` breakpoint (the full 256px sidebar
 * leaves a tablet only ~450px of content), the full sidebar from `lg` up.
 */
export function defaultSidebarCollapsed(viewportWidth?: number): boolean {
  const width = viewportWidth ?? (typeof window === 'undefined' ? undefined : window.innerWidth);
  return width !== undefined && width < LG_BREAKPOINT_PX;
}
