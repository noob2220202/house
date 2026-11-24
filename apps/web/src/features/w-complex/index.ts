/**
 * Page group w-complex — public API.
 *
 * Map page integration (`/map/apt?complex=<id>`, page group w-map): render the slot in the left
 * column; it shows the complex panel when the URL has `?complex=<id>` and `fallback` otherwise.
 *
 *   import { ComplexPanelSlot, useComplexParam } from '@/features/w-complex';
 *
 *   const { complexId, setComplex, hrefFor } = useComplexParam();   // open with setComplex(id)
 *   <aside className={styles.leftPanel}>
 *     <ComplexPanelSlot fallback={<ComplexListPanel onSelect={setComplex} />} />
 *   </aside>
 *
 * The host box needs a definite height: the panel scrolls inside (`scroll="self"`, default — also
 * right for a fixed-height mobile bottom sheet). A host that scrolls itself on phones (map above,
 * panel below) passes `scroll="host"` so the panel grows; `sheet` then adds the design's rounded
 * top + grab handle (do not pass it inside a sheet that already draws one).
 * Panel filters live in `c-…` query params (see `PANEL_FILTERS`) and never clash with map filters.
 */
export { ComplexPanel, type ComplexPanelProps } from './panel/ComplexPanel';
export { ComplexPanelSlot, type ComplexPanelSlotProps } from './panel/ComplexPanelSlot';
export { ComplexMapScreen } from './panel/ComplexMapScreen';
export { FeaturedAgencyCard, type FeaturedAgencyCardProps } from './panel/FeaturedAgencyCard';
export {
  useComplexParam,
  usePanelFilters,
  type ComplexParamState,
  type PanelUrlState,
} from './hooks/usePanelFilters';
export { COMPLEX_PARAM, PANEL_FILTERS, type PanelFilterValues } from './lib/filters';
export { complexMarkers } from './lib/markers';
export { complexMapHref } from './lib/links';
