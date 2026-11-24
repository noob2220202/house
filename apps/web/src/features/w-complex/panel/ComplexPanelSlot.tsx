'use client';
import { useComplexParam, usePanelFilters } from '../hooks/usePanelFilters';
import { ComplexPanel, type ComplexPanelProps } from './ComplexPanel';

export interface ComplexPanelSlotProps {
  /** Rendered when the URL has no `?complex=` (the map's normal left panel). */
  fallback?: React.ReactNode;
  sheet?: boolean;
  /** Who scrolls the panel on phones — see ComplexPanelProps.scroll (default 'self'). */
  scroll?: ComplexPanelProps['scroll'];
  className?: string;
}

/**
 * Drop-in for the map page's left column: shows the complex panel when the URL has
 * `?complex=<id>` and `fallback` otherwise. All state (selected complex, panel filters) is read from
 * and written to the query string, so links are shareable and Back closes the panel.
 *
 *   <ComplexPanelSlot fallback={<ComplexListPanel … />} />
 */
export function ComplexPanelSlot({
  fallback = null,
  sheet,
  scroll,
  className,
}: ComplexPanelSlotProps) {
  const { complexId, hrefFor } = useComplexParam();
  const { filters, setFilters } = usePanelFilters();
  if (!complexId) return <>{fallback}</>;
  return (
    <ComplexPanel
      // Remount per complex so local state (open row, picked 평형) never leaks across complexes.
      key={complexId}
      complexId={complexId}
      backHref={hrefFor(null)}
      complexHref={(id) => hrefFor(id)}
      filters={filters}
      onFiltersChange={setFilters}
      sheet={sheet}
      scroll={scroll}
      className={className}
    />
  );
}
