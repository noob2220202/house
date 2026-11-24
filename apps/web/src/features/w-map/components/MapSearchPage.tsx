'use client';
import { DEFAULT_MAP_CENTER, DEFAULT_MAP_ZOOM, MAP_ZOOM } from '@house/shared';
import { Icon, SUNCHEON_MAP_VIEWBOX, Spinner, Switch, cx, useToast } from '@house/ui';
import { usePathname } from 'next/navigation';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { MapSummary, MapToolButton, MapView, MapZoomControl } from '@/components/map';
import { env } from '@/config/env';
import { ComplexPanelSlot, useComplexParam } from '@/features/w-complex';
import type { MapAssetSlug } from '@/config/nav';
import { errorMessage } from '@/lib/api';
import { useSession } from '@/lib/auth';
import {
  MAP_PARAM,
  STATIC_MAP_BOUNDS,
  buildMapHref,
  clampZoom,
  type LatLng,
  type MapBounds,
  type MapMarker,
  type MapViewChange,
  type MapViewState,
} from '@/lib/map';
import { staticViewBounds } from '@/lib/map/geo';
import {
  fetchComplexPosition,
  useFavoriteComplexes,
  useListingList,
  useListingsAt,
  useMapSearch,
  usePopularComplexes,
  useRegions,
} from '../api/queries';
import type { ComplexSummary, MapListingMarker, Region, SuggestItem } from '../api/schemas';
import { ASSETS } from '../config/assets';
import { countActive, dealLabel, toApiFilters } from '../lib/filters';
import {
  bboxParam,
  centerForTarget,
  cropBottom,
  distanceM,
  nearestRegion,
  placePopover,
  projectToViewport,
  pxPerDegree,
  sheetHeightPx,
  type Insets,
} from '../lib/geo';
import { useElementSize, useIsMobile } from '../lib/hooks';
import { useMapMotion, useSearchPick, useSelectionPopover } from '../lib/interaction';
import { groupListingMarkers, pointArea, toMapMarkers, type ListingGroup } from '../lib/markers';
import { useMapPageState } from '../lib/state';
import { pushRecentComplex, readRecentComplexes, type RecentComplex } from '../lib/storage';
import { FilterBar } from './filters/FilterBar';
import {
  DealLegend,
  MapLayers,
  MapLayersButton,
  MapStatus,
  MyLocationDot,
  ScaleBar,
} from './map/MapChrome';
import { MapAd } from './map/MapAdCard';
import { RegionCrumb } from './map/RegionCrumb';
import { SelectedComplexCard, SelectedListingCard } from './map/SelectedCards';
import { MobileSheet, type SheetStop } from './mobile/MobileSheet';
import { MobileFilterSheet, MobileTop } from './mobile/MobileTop';
import { ComplexPanel, type ComplexRowData } from './panel/ComplexPanel';
import { ListingRow } from './panel/ListingItems';
import { ListingList, SortTabs, flattenPages } from './panel/ListingList';
import { ListingPanel } from './panel/ListingPanel';
import { SearchBox, useFavorite } from './shared';
import s from './MapSearchPage.module.css';

/**
 * City view. The stylized static map (no Naver key) is centred on its own artwork so the whole
 * city is visible; the real map opens on the shared default centre (순천시청).
 */
const FALLBACK_VIEW: MapViewState = env.naverMapKeyId
  ? { center: DEFAULT_MAP_CENTER, zoom: DEFAULT_MAP_ZOOM }
  : {
      center: {
        lat: (STATIC_MAP_BOUNDS.swLat + STATIC_MAP_BOUNDS.neLat) / 2,
        lng: (STATIC_MAP_BOUNDS.swLng + STATIC_MAP_BOUNDS.neLng) / 2,
      },
      zoom: DEFAULT_MAP_ZOOM,
    };
/** First zoom level that shows individual markers. */
const MARKER_ZOOM = MAP_ZOOM.GRID_MAX + 1;
/**
 * Up to this zoom the map is a city view and asks for the 읍면동 aggregation (named bubbles, as on
 * the MapApt / OneRoom designs); from the next level on a 동 fills the screen. The API switches to
 * anonymous grid cells above MAP_ZOOM.REGION_MAX (12), one level too early for a single city, so
 * the city view sends `zoom=REGION_MAX`. See docs/frontend-integration/w-map.md.
 */
const CITY_VIEW_MAX_ZOOM = 13;
/** My-location is honoured within this distance of the city centre (the service area). */
const SERVICE_RADIUS_M = 25_000;
/** A searched 동 counts as "still on screen" while the map centre stays this close to it. */
const SEARCH_PICK_RADIUS_M = 1_500;

// Desktop chrome needs room: the full ad card (234px) + layer panel (186px) + zoom / locate
// (140px) + gaps stack to about 630px, and the card (300px) plus the breadcrumb to about 680px.
/** Below this map height the ad is the compact pill (expands on click). */
const AD_CARD_MIN_MAP_H = 700;
/** Below this map width the pill sits under the breadcrumb instead of the right column. */
const AD_COLUMN_MIN_MAP_W = 720;
/** Below this map height the layer panel folds into one button. */
const LAYERS_MIN_MAP_H = 480;
/** Below this panel width two photo cards do not fit side by side: the list shows rows. */
const CARD_GRID_MIN_PANEL_W = 480;
/** Mobile: floating search + chips + ad pill cover about this much of the top of the map. */
const MOBILE_TOP_PX = 170;
/** Mobile pages shorter than this open with the sheet lowered (the half stop would hide the map). */
const SHORT_PAGE_PX = 620;

const samePoint = (a: LatLng, b: LatLng) => a.lat === b.lat && a.lng === b.lng;
type SheetOpenStop = Exclude<SheetStop, 'full'>;
/** What a selected price pill stands for: its point and the box that holds its listings. */
type PickedPill = LatLng & { id: string; area: MapBounds; merged: boolean };

/** Minimal complex card from a "recent" row, so a stored complex can be re-selected. */
function recentToSummary(r: RecentComplex): ComplexSummary {
  return { ...r, assetType: 'APT', pyeongLabels: [] };
}

/**
 * Map search for one asset type (/map/[assetType]): filter bar, left panel (complexes or
 * listings), MapView with clusters → markers, selection popovers, MAP_AD, and the mobile layout
 * with a bottom sheet. All state lives in the URL (see lib/state.ts).
 */
export function MapSearchPage({ slug }: { slug: MapAssetSlug }) {
  const asset = ASSETS[slug];
  const complexMode = asset.listMode === 'complex';
  const state = useMapPageState(asset, FALLBACK_VIEW);
  const { view, filters, ui, setView, select, setFilters, resetFilters, setUi } = state;
  // 아파트·분양권: the complex panel (w-complex) lives in `?complex=<id>`; an open panel is the
  // selection (marker highlight, ad targeting) even when a shared link carries no `sel`.
  const { complexId: complexParam, setComplex } = useComplexParam();
  const openComplexId = complexMode ? complexParam : null;
  const selected = openComplexId ?? state.selected;
  const isMobile = useIsMobile();
  const session = useSession();
  const authed = session.status === 'authenticated';
  const { toast } = useToast();
  const pathname = usePathname();

  const [mapRef, mapSize] = useElementSize<HTMLDivElement>();
  const [panelRef, panelSize] = useElementSize<HTMLElement>();
  const [adRef, adSize] = useElementSize<HTMLDivElement>();
  const [naverView, setNaverView] = useState<{ bounds: MapBounds; zoom: number } | null>(null);
  const [naverFailed, setNaverFailed] = useState(false);
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [locating, setLocating] = useState(false);
  const [myPos, setMyPos] = useState<LatLng | null>(null);

  // ---- mobile sheet ----------------------------------------------------------------------------
  const [sheet, setSheetStop] = useState<SheetStop>('half');
  /** Last stop that left the map visible — what the map shows behind a full-height list. */
  const [openStop, setOpenStop] = useState<SheetOpenStop>('half');
  const sheetTouched = useRef(false);
  const setSheet = useCallback((stop: SheetStop) => {
    sheetTouched.current = true;
    setSheetStop(stop);
    if (stop !== 'full') setOpenStop(stop);
  }, []);
  // Short phones: the half stop would leave a sliver of map, so the page opens with the sheet
  // lowered (unless the visitor arrived with a selection, or already moved the sheet).
  useEffect(() => {
    if (!isMobile || sheetTouched.current || mapSize.height === 0) return;
    sheetTouched.current = true;
    if (mapSize.height < SHORT_PAGE_PX && !selected) {
      setSheetStop('peek');
      setOpenStop('peek');
    }
  }, [isMobile, mapSize.height, selected]);

  // ---- visible bounds --------------------------------------------------------------------------
  // The static map does not report programmatic moves, so its bounds are derived from the URL view
  // (same linear projection it draws with). The Naver map reports its own bounds on every idle.
  const isStatic = !env.naverMapKeyId || naverFailed;
  const bounds = useMemo<MapBounds | null>(() => {
    if (!isStatic) return naverView?.bounds ?? null;
    if (mapSize.width === 0 || mapSize.height === 0) return null;
    return staticViewBounds(view.center, view.zoom, mapSize, SUNCHEON_MAP_VIEWBOX);
  }, [isStatic, naverView, mapSize, view]);
  const queryZoom = isStatic ? view.zoom : (naverView?.zoom ?? view.zoom);
  // Mobile: the map element keeps the full page height and the sheet lies over its lower part, so
  // nothing resizes when the sheet moves. Queries cover only what stays visible above the sheet.
  const coveredPx = isMobile ? sheetHeightPx(openStop, mapSize.height) : 0;
  const bbox = useMemo(
    () => (bounds ? bboxParam(cropBottom(bounds, mapSize.height, coveredPx)) : null),
    [bounds, mapSize.height, coveredPx],
  );
  const scale = useMemo(() => pxPerDegree(bounds, mapSize), [bounds, mapSize]);
  const pxLng = scale?.lng ?? 0;
  const pxLat = scale?.lat ?? 0;

  // ---- desktop chrome that degrades with the map size ------------------------------------------
  const adDock: 'card' | 'pill' | 'inline' =
    mapSize.width > 0 && mapSize.width < AD_COLUMN_MIN_MAP_W
      ? 'inline'
      : mapSize.height > 0 && mapSize.height < AD_CARD_MIN_MAP_H
        ? 'pill'
        : 'card';
  const layersCollapsed = mapSize.height > 0 && mapSize.height < LAYERS_MIN_MAP_H;
  const adCardWidth = !isMobile && adDock === 'card' ? adSize.width : 0;

  /**
   * Centre that shows `target` in the middle of the map area the chrome leaves free at `zoom`:
   * above the sheet on mobile, left of the ad card on desktop (a marker must not land under it).
   */
  const centerOn = useCallback(
    (target: LatLng, zoom: number, stop: SheetOpenStop = 'half'): LatLng => {
      if (pxLng === 0 || pxLat === 0) return target;
      const insets: Insets = isMobile
        ? { top: MOBILE_TOP_PX, right: 0, bottom: sheetHeightPx(stop, mapSize.height), left: 0 }
        : { top: 0, right: adCardWidth > 0 ? adCardWidth + 16 : 0, bottom: 0, left: 0 };
      const k = 2 ** (zoom - queryZoom);
      return centerForTarget(target, insets, { lng: pxLng * k, lat: pxLat * k });
    },
    [pxLng, pxLat, isMobile, mapSize.height, adCardWidth, queryZoom],
  );

  // Mobile landing: the map spans the whole page and the sheet covers its lower part, so the city
  // view (no `c` in the URL) is shifted to sit in the band above the sheet — applied to the first
  // view the mobile map reports (one URL write, see onViewChange). A URL that carries a centre is
  // honoured as is: re-centring it would drift the map on every reload. Read on the first render,
  // before the map's first report writes `c`.
  const [cameWithCenter] = useState(
    () =>
      typeof window !== 'undefined' &&
      new URLSearchParams(window.location.search).has(MAP_PARAM.center),
  );
  const landed = useRef(false);

  // ---- data ------------------------------------------------------------------------------------
  const apiFilters = useMemo(() => toApiFilters(asset, filters), [asset, filters]);
  const activeCount = countActive(asset, filters);
  const apiZoom =
    queryZoom <= CITY_VIEW_MAX_ZOOM ? Math.min(queryZoom, MAP_ZOOM.REGION_MAX) : queryZoom;
  const map = useMapSearch(bbox, apiZoom, apiFilters);
  const regions = useRegions();
  const popular = usePopularComplexes(complexMode);
  const favoriteComplexes = useFavoriteComplexes(complexMode && authed);
  const [recents, setRecents] = useState<RecentComplex[]>([]);
  useEffect(() => {
    if (complexMode) setRecents(readRecentComplexes());
  }, [complexMode]);
  const complexFav = useFavorite('complexes');
  const listingFav = useFavorite('listings');

  const currentRegion = useMemo<Region | null>(() => {
    if (!regions.data || view.zoom <= CITY_VIEW_MAX_ZOOM) return null;
    const nearest = nearestRegion(regions.data, view.center);
    return nearest && distanceM(nearest, view.center) < 2500 ? nearest : null;
  }, [regions.data, view]);

  // ---- selection: complex ----------------------------------------------------------------------
  const foundComplex = useMemo<ComplexSummary | null>(() => {
    if (!complexMode || !selected) return null;
    const marker = map.data?.markers.find((m) => m.type === 'COMPLEX' && m.id === selected);
    if (marker?.type === 'COMPLEX') return marker;
    const row =
      popular.data?.find((c) => c.id === selected) ??
      favoriteComplexes.data?.items.find((c) => c.id === selected);
    if (row) return row;
    const recent = recents.find((r) => r.id === selected);
    return recent ? recentToSummary(recent) : null;
  }, [complexMode, selected, map.data, popular.data, favoriteComplexes.data, recents]);
  // Keep showing the complex while its marker is outside the current response (panning away).
  const [stickyComplex, setStickyComplex] = useState<ComplexSummary | null>(null);
  useEffect(() => {
    if (foundComplex) setStickyComplex(foundComplex);
  }, [foundComplex]);
  const selectedComplex = foundComplex ?? (stickyComplex?.id === selected ? stickyComplex : null);
  const selectedComplexId = selectedComplex?.id;
  useEffect(() => {
    if (selectedComplex) setRecents(pushRecentComplex(selectedComplex));
    // Keyed on the id on purpose: record once per selection, not on every data refresh.
  }, [selectedComplexId]);
  const matchedOfSelected = useMemo(() => {
    const marker = map.data?.markers.find((m) => m.type === 'COMPLEX' && m.id === selected);
    return marker ? marker.count : null;
  }, [map.data, selected]);

  // ---- lists -----------------------------------------------------------------------------------
  const listQuery = useListingList(
    complexMode
      ? { filters: apiFilters, sort: ui.sort, complexId: selected ?? undefined }
      : { filters: apiFilters, sort: ui.sort, bbox },
    // The complex panel fetches its own listings (`GET /complexes/:id/listings`).
    !complexMode && bbox !== null,
  );
  const listItems = useMemo(() => flattenPages(listQuery.data), [listQuery.data]);

  // ---- price pills: neighbours that would overlap on screen are drawn as one ---------------------
  const groups = useMemo<ListingGroup[]>(() => {
    const pills = (map.data?.markers ?? []).filter(
      (m): m is MapListingMarker => m.type === 'LISTING',
    );
    return groupListingMarkers(pills, pxLng > 0 ? { lng: pxLng, lat: pxLat } : null);
  }, [map.data, pxLng, pxLat]);

  // ---- selection: listing (a pill = one building, or a few merged neighbours) --------------------
  const foundPick = useMemo<PickedPill | null>(() => {
    if (complexMode || !selected) return null;
    const of = (g: ListingGroup): PickedPill => ({
      id: selected,
      lat: g.rep.lat,
      lng: g.rep.lng,
      area: g.area,
      merged: g.members.length > 1,
    });
    const group = groups.find((g) => g.members.some((m) => m.id === selected));
    if (group) return of(group);
    // Not a marker id (a shared link to another room of the building): locate it through the list.
    const item = listItems.find((l) => l.id === selected);
    if (item?.lat == null || item.lng == null) return null;
    const point = { lat: item.lat, lng: item.lng };
    const around = groups.find((g) => g.members.some((m) => samePoint(m, point)));
    return around ? of(around) : { id: selected, ...point, area: pointArea(point), merged: false };
  }, [complexMode, selected, groups, listItems]);
  const [stickyPick, setStickyPick] = useState<PickedPill | null>(null);
  useEffect(() => {
    if (foundPick) setStickyPick(foundPick);
  }, [foundPick]);
  const selectedPick = foundPick ?? (stickyPick?.id === selected ? stickyPick : null);
  const atPoint = useListingsAt(selectedPick?.area ?? null, apiFilters, ui.sort);
  const roomsAtPoint = useMemo(() => atPoint.data?.items ?? [], [atPoint.data]);
  const [flip, setFlip] = useState<{ sel: string; index: number } | null>(null);
  const roomIndex =
    flip && flip.sel === selected
      ? Math.min(flip.index, Math.max(0, roomsAtPoint.length - 1))
      : Math.max(
          0,
          roomsAtPoint.findIndex((l) => l.id === selected),
        );
  const highlightedListingId = complexMode ? null : (roomsAtPoint[roomIndex]?.id ?? selected);
  /** Marker to draw as selected: the pill standing on the selected point. */
  const selectedMarkerId = useMemo(() => {
    if (complexMode || !selectedPick) return selected;
    return groups.find((g) => samePoint(g.rep, selectedPick))?.rep.id ?? selected;
  }, [complexMode, selected, selectedPick, groups]);
  /** Mobile: the picked listings head the sheet, so the main list below leaves them out. */
  const pickedIds = useMemo(
    () => new Set(selectedPick ? roomsAtPoint.map((l) => l.id) : []),
    [selectedPick, roomsAtPoint],
  );
  const mScrollRef = useRef<HTMLDivElement>(null);
  const pickKey = selectedPick ? `${selectedPick.lat},${selectedPick.lng}` : null;
  useEffect(() => {
    // A new pick starts at the top of the sheet, where its listings are.
    if (pickKey && mScrollRef.current) mScrollRef.current.scrollTop = 0;
  }, [pickKey]);

  // ---- markers ---------------------------------------------------------------------------------
  const markers = useMemo(
    () =>
      toMapMarkers(map.data, {
        unit: ui.unit,
        compact: isMobile,
        selectedId: selectedMarkerId,
        tradeLayer: ui.tradeLayer,
        localPrefix: currentRegion?.name.replace(/(지구|동|면)$/, '') ?? null,
        groups,
      }),
    [map.data, ui.unit, ui.tradeLayer, isMobile, selectedMarkerId, currentRegion, groups],
  );

  // ---- interaction helpers ---------------------------------------------------------------------
  const { moving, motionProps } = useMapMotion(bounds);
  const { popRef, popSize, rememberOpener, closeSelection } = useSelectionPopover({
    selected,
    select,
    enabled: !isMobile,
  });
  const searchPick = useSearchPick({
    view,
    selected,
    radiusM: SEARCH_PICK_RADIUS_M,
    minZoom: CITY_VIEW_MAX_ZOOM + 1,
  });

  // ---- handlers --------------------------------------------------------------------------------
  const onViewChange = useCallback(
    (change: MapViewChange) => {
      setNaverView({ bounds: change.bounds, zoom: change.zoom });
      let center = change.center;
      if (isMobile && !landed.current) {
        landed.current = true;
        const px = cameWithCenter ? null : pxPerDegree(change.bounds, mapSize);
        if (px) {
          // Same rule as the sheet effect (its state update may not be applied yet).
          const stop = mapSize.height < SHORT_PAGE_PX && !selected ? 'peek' : openStop;
          const bottom = sheetHeightPx(stop, mapSize.height);
          center = centerForTarget(center, { top: MOBILE_TOP_PX, right: 0, bottom, left: 0 }, px);
        }
      }
      setView({ center, zoom: change.zoom });
    },
    [setView, isMobile, mapSize, selected, openStop, cameWithCenter],
  );

  // A map SDK may report a click on a marker to the map as well. The empty-map deselect waits a
  // beat so that a marker click arriving with it wins (otherwise picking a marker would close it).
  const deselectTimer = useRef<number | null>(null);
  const cancelDeselect = () => {
    if (deselectTimer.current === null) return;
    window.clearTimeout(deselectTimer.current);
    deselectTimer.current = null;
  };
  useEffect(() => cancelDeselect, []);
  const onMapClick = () => {
    if (!selected) return;
    cancelDeselect();
    deselectTimer.current = window.setTimeout(() => {
      deselectTimer.current = null;
      select(null);
    }, 60);
  };

  const onMarkerClick = (m: MapMarker) => {
    cancelDeselect();
    if (m.kind === 'cluster') {
      // One click takes any bubble to individual markers (never from a bubble to another bubble).
      const zoom = Math.max(MARKER_ZOOM, Math.floor(view.zoom) + 1);
      setView({ center: centerOn(m.position, zoom, openStop), zoom });
      return;
    }
    if (m.id === selectedMarkerId) {
      select(null);
      return;
    }
    rememberOpener();
    if (isMobile) {
      // Bring the marker into the visible band above the sheet; a complex opens its panel there.
      select(m.id, {
        view: { center: centerOn(m.position, view.zoom), zoom: view.zoom },
        complex: complexMode,
      });
      setSheet('half');
    } else {
      // Desktop: the summary popover first — unless a complex panel is open, which switches over.
      select(m.id, { complex: !!openComplexId });
    }
  };

  /** Moves the map to a place at marker level (or closer); returns the centre it moved to. */
  const flyTo = (target: LatLng, id: string | null): LatLng => {
    const zoom = Math.max(view.zoom, MARKER_ZOOM);
    const next = { center: centerOn(target, zoom), zoom };
    if (id) {
      rememberOpener();
      select(id, { view: next, complex: complexMode && (isMobile || !!openComplexId) });
    } else {
      setView(next);
    }
    if (isMobile) setSheet('half');
    return next.center;
  };

  const onSelectComplex = (c: ComplexRowData) => {
    // The complex record is the authority for its position (list rows may carry a rounded or
    // stale point); fall back to the row's own coordinates when the lookup fails.
    fetchComplexPosition(c.id)
      .then((p) => flyTo({ lat: p.lat, lng: p.lng }, c.id))
      .catch(() => {
        if (c.lat != null && c.lng != null) flyTo({ lat: c.lat, lng: c.lng }, c.id);
        else toast({ message: '지도에서 이 단지의 위치를 찾지 못했어요.', tone: 'error' });
      });
  };

  const onPickSuggestion = (item: SuggestItem) => {
    if (item.lat == null || item.lng == null) return;
    const id = item.type === 'COMPLEX' && complexMode ? item.id : null;
    searchPick.track(flyTo({ lat: item.lat, lng: item.lng }, id), id);
  };

  const locate = () => {
    if (!('geolocation' in navigator)) {
      toast({ message: '이 브라우저에서는 내 위치를 사용할 수 없어요.', tone: 'error' });
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        const me = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        if (distanceM(me, DEFAULT_MAP_CENTER) > SERVICE_RADIUS_M) {
          // Outside the service area: say so and leave the map where it is.
          setMyPos(null);
          toast({ message: '현재 위치가 순천 밖이에요.', tone: 'info' });
          return;
        }
        setMyPos(me);
        const zoom = Math.max(view.zoom, MARKER_ZOOM);
        setView({ center: centerOn(me, zoom, openStop), zoom });
      },
      (error) => {
        setLocating(false);
        toast({
          message:
            error.code === error.PERMISSION_DENIED
              ? '위치 권한이 꺼져 있어요. 브라우저 설정에서 위치 접근을 허용해 주세요.'
              : '내 위치를 확인하지 못했어요. 잠시 후 다시 시도해 주세요.',
          tone: 'error',
        });
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60_000 },
    );
  };

  const categoryHref = useCallback(
    (to: MapAssetSlug) => buildMapHref(`/map/${to}`, { view }),
    [view],
  );
  const filterProps = { asset, filters, unit: ui.unit, onChange: setFilters, categoryHref };
  const returnTo = `${pathname}${typeof window === 'undefined' ? '' : window.location.search}`;

  // ---- derived UI ------------------------------------------------------------------------------
  const summary = map.data?.summary;
  const summaryStats = useMemo(() => {
    const stats: { label: string; value: string; suffix?: string }[] = [];
    if (!map.data) return stats;
    const n = (v: number) => v.toLocaleString('ko-KR');
    if (complexMode && summary?.complexCount != null)
      stats.push({ label: '단지', value: n(summary.complexCount) });
    stats.push({ label: '매물', value: n(summary?.listingCount ?? map.data.total) });
    if (activeCount > 0) stats.push({ label: '조건 일치', value: n(map.data.total) });
    if (asset.slug === 'oneroom' || asset.slug === 'commercial') {
      if (summary?.avgMonthlyRent != null)
        stats.push({ label: '평균 월세', value: `${n(summary.avgMonthlyRent)}만` });
      if (summary?.avgDeposit != null)
        stats.push({ label: '보증금', value: `${n(summary.avgDeposit)}만` });
    } else if (summary?.avgPricePerPyeong != null) {
      stats.push({ label: '평균', value: `${n(summary.avgPricePerPyeong)}만`, suffix: '/평' });
    }
    return stats;
  }, [map.data, summary, complexMode, activeCount, asset.slug]);
  // Narrow maps (tablet, small laptop): the pill drops its title first, then its trailing stats.
  const narrowMap = mapSize.width > 0 && mapSize.width < AD_COLUMN_MIN_MAP_W;
  const shownStats =
    mapSize.width > 0 && mapSize.width < 520 ? summaryStats.slice(0, 2) : summaryStats;

  const popAnchor =
    !isMobile && bounds && mapSize.width > 0
      ? complexMode
        ? selectedComplex?.lat != null && selectedComplex.lng != null
          ? projectToViewport(
              { lat: selectedComplex.lat, lng: selectedComplex.lng },
              bounds,
              mapSize,
            )
          : null
        : selectedPick
          ? projectToViewport(selectedPick, bounds, mapSize)
          : null
      : null;
  const adInColumn = adDock !== 'inline' && adSize.height > 0;
  const placement = popAnchor
    ? placePopover(
        { x: popAnchor.x, y: popAnchor.y - (complexMode ? 26 : 20) },
        {
          width: popSize.width || (complexMode ? 264 : 272),
          height: popSize.height || (complexMode ? 300 : 150),
        },
        mapSize,
        {
          ...(complexMode ? { gap: 92, ratio: 0.34 } : { gap: 62, ratio: 0.5 }),
          // Never cover the ad card or the tool column on the right edge.
          avoid: [
            {
              left: mapSize.width - 16 - (adInColumn ? adSize.width : 0) - 8,
              top: 0,
              right: mapSize.width,
              bottom: adInColumn ? 16 + adSize.height + 8 : 0,
            },
            { left: mapSize.width - 100, top: 0, right: mapSize.width, bottom: mapSize.height },
          ],
        },
      )
    : null;
  const myDot =
    myPos && bounds && mapSize.width > 0 ? projectToViewport(myPos, bounds, mapSize) : null;
  const myDotInView =
    !!myDot &&
    myDot.x >= 0 &&
    myDot.y >= 0 &&
    myDot.x <= mapSize.width &&
    myDot.y <= mapSize.height;

  const dealsLabel = dealLabel(asset, filters);
  const noResults = map.isSuccess && !map.isPlaceholderData && map.data.total === 0;

  // ---- pieces shared by both layouts -----------------------------------------------------------
  const mapStatus = map.isError ? (
    <MapStatus
      tone="error"
      action={
        <button type="button" onClick={() => void map.refetch()}>
          다시 시도
        </button>
      }
    >
      {errorMessage(map.error)}
    </MapStatus>
  ) : map.isPending || (map.isFetching && map.isPlaceholderData) ? (
    <MapStatus tone="loading">매물을 불러오는 중</MapStatus>
  ) : noResults ? (
    <MapStatus
      action={
        activeCount > 0 ? (
          <button type="button" onClick={resetFilters}>
            필터 초기화
          </button>
        ) : undefined
      }
    >
      {activeCount > 0 ? '조건에 맞는 매물이 없어요' : '이 영역에는 매물이 없어요'}
    </MapStatus>
  ) : map.data?.truncated ? (
    <MapStatus>매물이 많아 일부만 표시했어요. 지도를 확대해 보세요.</MapStatus>
  ) : null;

  const complexPanel = (
    <ComplexPanel
      asset={asset}
      tab={ui.tab}
      onTabChange={(tab) => setUi({ tab })}
      popular={popular}
      favorites={favoriteComplexes}
      recents={recents}
      authed={authed}
      sessionLoading={session.status === 'loading'}
      loginReturnTo={returnTo}
      selectedId={selected}
      onSelect={onSelectComplex}
    />
  );

  const adTarget = { regionCode: currentRegion?.code, complexId: complexMode ? selected : null };
  const layerProps = {
    layers: { trade: ui.tradeLayer },
    onToggleTrade: () => setUi({ tradeLayer: !ui.tradeLayer }),
    onUnavailable: (name: string) =>
      toast({ message: `${name} 레이어는 준비 중이에요.`, tone: 'info' }),
  };
  const stopDrag = (e: ReactPointerEvent) => e.stopPropagation();

  const mapView = (
    <MapView
      center={view.center}
      zoom={view.zoom}
      markers={markers}
      selectedId={selectedMarkerId}
      ariaLabel={`순천 ${asset.label} 지도`}
      onMarkerClick={onMarkerClick}
      onViewChange={onViewChange}
      onMapClick={onMapClick}
      onError={() => setNaverFailed(true)}
    >
      {myDot && myDotInView && (
        <div className={s.meLayer} data-moving={moving || undefined}>
          <MyLocationDot x={myDot.x} y={myDot.y} />
        </div>
      )}
      {!isMobile && (
        <div className={s.mapTop} data-ad={adDock} data-map-chrome="" onPointerDown={stopDrag}>
          <RegionCrumb
            regions={regions.data ?? []}
            current={currentRegion}
            onCity={() => setView(FALLBACK_VIEW)}
            onPick={(r) => setView({ center: centerOn(r, MARKER_ZOOM), zoom: MARKER_ZOOM })}
          />
          {adDock === 'inline' && (
            <div className={s.adSlot} data-compact="">
              <MapAd compact {...adTarget} />
            </div>
          )}
          {shownStats.length > 0 && (
            <MapSummary
              className={s.mapSum}
              title={narrowMap ? undefined : (currentRegion?.name ?? '지도 영역')}
              stats={shownStats}
            />
          )}
          {mapStatus}
        </div>
      )}
      {isMobile && mapStatus && <div className={s.statusWrap}>{mapStatus}</div>}
      {!isMobile && (
        <div
          className={s.right}
          data-map-chrome=""
          style={{ '--map-h': `${mapSize.height}px` } as CSSProperties}
          onPointerDown={stopDrag}
        >
          {adDock !== 'inline' && (
            <div ref={adRef} className={s.adSlot} data-compact={adDock === 'pill' ? '' : undefined}>
              <MapAd compact={adDock === 'pill'} {...adTarget} />
            </div>
          )}
          {complexMode &&
            (layersCollapsed ? <MapLayersButton {...layerProps} /> : <MapLayers {...layerProps} />)}
          <div className={s.tools}>
            <MapZoomControl
              onZoomIn={() =>
                setView({ center: view.center, zoom: clampZoom(Math.floor(view.zoom) + 1) })
              }
              onZoomOut={() =>
                setView({ center: view.center, zoom: clampZoom(Math.ceil(view.zoom) - 1) })
              }
              canZoomIn={view.zoom < MAP_ZOOM.MAX}
              canZoomOut={view.zoom > MAP_ZOOM.MIN}
            />
            <MapToolButton label="내 위치로 이동" onClick={locate} className={s.locate}>
              {locating ? <Spinner size={18} /> : <Icon name="locate" size={20} />}
            </MapToolButton>
          </div>
        </div>
      )}
      {!isMobile && (
        <div className={s.bottomLeft}>
          <ScaleBar bounds={bounds} width={mapSize.width} />
          {!complexMode && asset.slug !== 'land' && (
            <DealLegend
              deals={
                asset.slug === 'oneroom' ? ['monthly', 'jeonse'] : ['monthly', 'jeonse', 'sale']
              }
            />
          )}
        </div>
      )}
      {!isMobile && complexMode && selectedComplex && !openComplexId && (
        <div className={s.popLayer} data-moving={moving || undefined} onPointerDown={stopDrag}>
          <SelectedComplexCard
            ref={popRef}
            complex={selectedComplex}
            matched={matchedOfSelected}
            dealsLabel={dealsLabel === '전체' ? null : dealsLabel}
            placement={placement}
            favorite={complexFav.has(selectedComplex.id)}
            onFavorite={() => complexFav.toggle(selectedComplex.id)}
            onOpenList={() => setComplex(selectedComplex.id)}
            onClose={closeSelection}
          />
        </div>
      )}
      {!isMobile && !complexMode && selectedPick && (
        <div className={s.popLayer} data-moving={moving || undefined} onPointerDown={stopDrag}>
          <SelectedListingCard
            ref={popRef}
            listings={roomsAtPoint}
            merged={selectedPick.merged}
            index={roomIndex}
            onIndexChange={(index) => selected && setFlip({ sel: selected, index })}
            loading={atPoint.isPending}
            unit={ui.unit}
            placement={placement}
            favorite={!!highlightedListingId && listingFav.has(highlightedListingId)}
            onFavorite={listingFav.toggle}
            onClose={closeSelection}
          />
        </div>
      )}
    </MapView>
  );

  // ---- mobile layout (MobileMap design) --------------------------------------------------------
  if (isMobile) {
    const total = listQuery.data?.pages[0]?.total;
    return (
      <div className={cx(s.page, s.mobile)} data-sheet={sheet}>
        <h1 className="sr-only">순천 {asset.label} 지도</h1>
        <div ref={mapRef} className={s.mMap} {...motionProps}>
          {mapView}
        </div>
        <MobileTop
          {...filterProps}
          onPick={onPickSuggestion}
          searchResetSignal={searchPick.resetSignal}
          onOpenFilters={() => setFilterSheetOpen(true)}
        />
        <div className={s.mAd}>
          <MapAd
            compact
            {...adTarget}
            // The expanded card needs the room the half-open sheet takes.
            onExpandedChange={(expanded) => {
              if (expanded) setSheet('peek');
            }}
          />
        </div>
        {complexMode && (
          <div className={s.mTools}>
            <MapToolButton
              label="실거래가 레이어"
              pressed={ui.tradeLayer}
              onClick={() => setUi({ tradeLayer: !ui.tradeLayer })}
            >
              <Icon name="layers" size={20} />
            </MapToolButton>
          </div>
        )}
        <div className={s.mFloat}>
          <button
            type="button"
            className={s.mList}
            onClick={() => setSheet(sheet === 'full' ? openStop : 'full')}
          >
            <Icon name={sheet === 'full' ? 'map-pin' : 'list'} size={18} />
            {sheet === 'full' ? '지도' : '목록'}
          </button>
          <MapToolButton label="내 위치로 이동" onClick={locate} className={s.mLocate}>
            {locating ? <Spinner size={18} /> : <Icon name="locate" size={20} />}
          </MapToolButton>
        </div>
        <MobileSheet
          stop={sheet}
          onStopChange={setSheet}
          label={
            complexMode && selectedComplex
              ? `선택한 단지: ${selectedComplex.name}`
              : `${asset.label} 목록`
          }
        >
          {complexMode ? (
            <ComplexPanelSlot fallback={complexPanel} />
          ) : (
            <>
              <div className={s.mHd}>
                <h2 className={s.mTitle}>
                  {asset.noun}{' '}
                  <b className="num" aria-live="polite">
                    {total === undefined ? '–' : total.toLocaleString('ko-KR')}
                  </b>
                  개
                </h2>
                <Switch
                  checked={filters.verifiedOnly}
                  onChange={(e) => setFilters({ verifiedOnly: e.target.checked })}
                >
                  실매물 확인만
                </Switch>
              </div>
              <SortTabs
                className={s.mSort}
                sorts={asset.sorts}
                value={ui.sort}
                onChange={(sort) => setUi({ sort })}
              />
              <div ref={mScrollRef} className={s.mScroll}>
                {selectedPick && roomsAtPoint.length > 0 && (
                  <section className={s.mPicked} aria-label="지도에서 선택한 매물">
                    <div className={s.mPickedHd}>
                      <p>
                        선택한 위치의 매물 <b className="num">{roomsAtPoint.length}</b>
                      </p>
                      <button type="button" onClick={() => select(null)}>
                        선택 해제
                      </button>
                    </div>
                    <ul>
                      {roomsAtPoint.map((l) => (
                        <li key={l.id}>
                          <ListingRow
                            listing={l}
                            unit={ui.unit}
                            favorite={listingFav.has(l.id)}
                            onFavorite={listingFav.toggle}
                            showName
                          />
                        </li>
                      ))}
                    </ul>
                  </section>
                )}
                <ListingList
                  query={listQuery}
                  layout="row"
                  unit={ui.unit}
                  // The picked listings sit in the block above: the list neither repeats them
                  // nor scrolls away from that block to one of them.
                  selectedId={selectedPick ? null : selected}
                  excludeIds={pickedIds}
                  isFavorite={listingFav.has}
                  onFavorite={listingFav.toggle}
                  showName
                  hasActiveFilters={activeCount > 0}
                  onResetFilters={resetFilters}
                  emptyTitle={`이 지역에 조건에 맞는 ${asset.noun} 매물이 없어요`}
                />
              </div>
            </>
          )}
        </MobileSheet>
        <MobileFilterSheet
          open={filterSheetOpen}
          onClose={() => setFilterSheetOpen(false)}
          onApply={setFilters}
          onUnitChange={(unit) => setUi({ unit })}
          asset={asset}
          filters={filters}
          unit={ui.unit}
          categoryHref={categoryHref}
        />
      </div>
    );
  }

  // ---- desktop layout (MapApt / OneRoom designs) -----------------------------------------------
  // A panel too narrow for two photo cards (tablet widths) lists rows instead of one giant card.
  const rowsOnly = panelSize.width > 0 && panelSize.width < CARD_GRID_MIN_PANEL_W;
  const panelSearch = (
    <div className={s.panelSearch}>
      <SearchBox
        label={asset.searchLabel}
        placeholder={asset.searchPlaceholder}
        types={complexMode ? ['REGION', 'COMPLEX'] : ['REGION']}
        onPick={onPickSuggestion}
        resetSignal={searchPick.resetSignal}
      />
    </div>
  );
  return (
    <div className={s.page}>
      <h1 className="sr-only">순천 {asset.label} 지도</h1>
      <FilterBar
        {...filterProps}
        hasActive={activeCount > 0}
        onReset={resetFilters}
        onUnitChange={(unit) => setUi({ unit })}
      />
      <div className={cx(s.body, complexMode ? s.bodyComplex : s.bodyListing)}>
        <aside
          ref={panelRef}
          className={s.panel}
          aria-label={complexMode ? '단지 목록' : `${asset.label} 매물 목록`}
        >
          {complexMode ? (
            <ComplexPanelSlot
              fallback={
                <>
                  {panelSearch}
                  {complexPanel}
                </>
              }
            />
          ) : (
            <>
              {panelSearch}
              <ListingPanel
                asset={asset}
                query={listQuery}
                sort={ui.sort}
                onSortChange={(sort) => setUi({ sort })}
                view={rowsOnly ? 'list' : ui.view}
                onViewChange={rowsOnly ? undefined : (v) => setUi({ view: v })}
                unit={ui.unit}
                verifiedOnly={filters.verifiedOnly}
                onVerifiedOnlyChange={(verifiedOnly) => setFilters({ verifiedOnly })}
                selectedId={highlightedListingId}
                isFavorite={listingFav.has}
                onFavorite={listingFav.toggle}
                hasActiveFilters={activeCount > 0}
                onResetFilters={resetFilters}
              />
            </>
          )}
        </aside>
        <section ref={mapRef} className={s.map} aria-label={`${asset.label} 지도`} {...motionProps}>
          {mapView}
        </section>
      </div>
    </div>
  );
}
