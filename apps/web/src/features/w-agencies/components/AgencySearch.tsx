'use client';
import { DEFAULT_MAP_CENTER, DEFAULT_MAP_ZOOM } from '@house/shared';
import {
  Button,
  EmptyState,
  ErrorState,
  Icon,
  LoadingRegion,
  Popover,
  Skeleton,
  cx,
  useToast,
} from '@house/ui';
import { keepPreviousData, useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { MapSummary, MapToolButton, MapView, MapZoomControl } from '@/components/map';
import { env } from '@/config/env';
import { ApiError } from '@/lib/api';
import {
  STATIC_MAP_BOUNDS,
  clampZoom,
  roundCoord,
  type LatLng,
  type MapBounds,
  type MapMarker,
  type MapViewChange,
  type MapViewState,
} from '@/lib/map';
import {
  AGENCY_LIST_PAGE_SIZE,
  AGENCY_MAP_PAGE_SIZE,
  agencyKeys,
  fetchAgencies,
  fetchAgency,
  fetchAgencyRegions,
} from '../api/queries';
import {
  AGENCY_SORTS,
  AGENCY_SORT_LABEL,
  type AgencyPage,
  type AgencyRegion,
  type AgencyRegions,
  type AgencySummary,
} from '../api/schemas';
import { agencySortOf, resultCaption, toAgencyQuery, type AgencyFilters } from '../lib/filters';
import {
  boundsToQueryBbox,
  clampCenter,
  currentMapBounds,
  isNearSuncheon,
  panTarget,
  scaleBar,
} from '../lib/geo';
import { buildAgencyMarkers, isClusterId } from '../lib/markers';
import { useAgencyUrlState, type AgencyUrlPatch } from '../lib/useAgencyUrlState';
import { useIsMobile, useIsTablet } from '../lib/useIsMobile';
import { AgencyProfile } from './AgencyProfile';
import { OfficeCard } from './OfficeCard';
import { SearchHead } from './SearchHead';
import styles from './AgencySearch.module.css';
import { formatCount } from '@/lib/format';

/**
 * Initial view. With the Naver map: the city centre. With the stylized fallback map (no key):
 * the 조례·연향 area the Agents design is framed on.
 */
const INITIAL_VIEW: MapViewState = env.naverMapKeyId
  ? { center: DEFAULT_MAP_CENTER, zoom: DEFAULT_MAP_ZOOM }
  : { center: { lat: 34.9475, lng: 127.5454 }, zoom: 13 };

const DRAWER_WIDTH = 400;

const currentUrl = () => `${window.location.pathname}${window.location.search}`;

/**
 * History model: a search (검색어, 이 지역에서 다시 검색, 조건 초기화) and opening a profile add an
 * entry; chips, toggles, sort, 지역 and switching between offices replace the current one, so
 * leaving the page does not need one Back per click.
 */
function historyModeOf(patch: Partial<AgencyFilters>): 'push' | 'replace' {
  return 'q' in patch || patch.area ? 'push' : 'replace';
}

function useElementSize(ref: RefObject<HTMLElement | null>, remountKey: unknown) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const apply = () =>
      setSize((prev) =>
        prev.width === el.clientWidth && prev.height === el.clientHeight
          ? prev
          : { width: el.clientWidth, height: el.clientHeight },
      );
    apply();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref, remountKey]);
  return size;
}

export interface AgencySearchProps {
  /** Server-rendered first page for `initialListKey` (SEO + no loading flash). */
  initialList: AgencyPage | null;
  /** `JSON.stringify` of the list query the server used. */
  initialListKey: string;
  initialRegions: AgencyRegions | null;
  /** "26.11.23" (KST, from the server so both renders agree). */
  asOf: string;
}

/** 중개사무소 찾기: search panel + office list, map with clustered office markers, profile drawer. */
export function AgencySearch({
  initialList,
  initialListKey,
  initialRegions,
  asOf,
}: AgencySearchProps) {
  const { toast } = useToast();
  const isMobile = useIsMobile();
  // 721–1080px: the profile covers the list panel (master → detail) instead of the narrow map.
  const isTablet = useIsTablet();
  const { view, selected, filters, update } = useAgencyUrlState(INITIAL_VIEW);

  // ---- list ------------------------------------------------------------------------------------
  const listQuery = useMemo(
    () => toAgencyQuery(filters, { pageSize: AGENCY_LIST_PAGE_SIZE }),
    [filters],
  );
  const list = useInfiniteQuery({
    queryKey: agencyKeys.list(listQuery),
    queryFn: ({ pageParam, signal }) => fetchAgencies({ ...listQuery, page: pageParam }, signal),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page < last.totalPages ? last.page + 1 : undefined),
    initialData:
      initialList && JSON.stringify(listQuery) === initialListKey
        ? { pages: [initialList], pageParams: [1] }
        : undefined,
  });
  const offices = useMemo(() => list.data?.pages.flatMap((p) => p.items) ?? [], [list.data]);
  const total = list.data?.pages[0]?.total ?? 0;

  const regions = useQuery({
    queryKey: agencyKeys.regions(),
    queryFn: ({ signal }) => fetchAgencyRegions(signal),
    initialData: initialRegions ?? undefined,
    staleTime: 5 * 60_000,
  });

  // ---- map -------------------------------------------------------------------------------------
  const mapRef = useRef<HTMLElement>(null);
  const [mapImpl, setMapImpl] = useState<'naver' | 'static'>(
    env.naverMapKeyId ? 'naver' : 'static',
  );
  const [reportedBounds, setReportedBounds] = useState<MapBounds | null>(null);
  // The map section remounts when the mobile layout switches (DOM order follows the visual order).
  const mapSize = useElementSize(mapRef, isMobile);
  const mapWidth = mapSize.width;
  const bounds = useMemo(
    () => currentMapBounds(mapImpl, view, mapSize, reportedBounds),
    [mapImpl, view, mapSize, reportedBounds],
  );
  const isStatic = mapImpl === 'static';
  const bbox = bounds ? boundsToQueryBbox(bounds) : null;
  const mapQuery = useMemo(
    () =>
      bbox
        ? toAgencyQuery(
            { ...filters, area: null, sort: null },
            { bbox, pageSize: AGENCY_MAP_PAGE_SIZE },
          )
        : null,
    [filters, bbox],
  );
  const map = useQuery({
    queryKey: agencyKeys.map(mapQuery ?? {}),
    queryFn: ({ signal }) => fetchAgencies(mapQuery ?? {}, signal),
    enabled: mapQuery !== null,
    placeholderData: keepPreviousData,
  });

  const viewRef = useRef(view);
  viewRef.current = view;
  const onViewChange = useCallback(
    (change: MapViewChange) => {
      setReportedBounds(change.bounds);
      const current = viewRef.current;
      const moved =
        roundCoord(change.center.lat) !== roundCoord(current.center.lat) ||
        roundCoord(change.center.lng) !== roundCoord(current.center.lng) ||
        change.zoom !== current.zoom;
      // Do not touch the URL for the map's own initial report.
      if (moved) update({ view: { center: change.center, zoom: change.zoom } }, 'replace');
    },
    [update],
  );

  // ---- selection -------------------------------------------------------------------------------
  const detail = useQuery({
    queryKey: agencyKeys.detail(selected ?? ''),
    queryFn: ({ signal }) => fetchAgency(selected ?? '', signal),
    enabled: !!selected,
  });
  const preview = useMemo(
    () =>
      selected
        ? (offices.find((a) => a.id === selected) ?? map.data?.items.find((a) => a.id === selected))
        : undefined,
    [selected, offices, map.data],
  );

  const drawerRef = useRef<HTMLElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const restoreFocusRef = useRef(false);
  const focusDrawerRef = useRef(false);
  /** URL of the history entry this session pushed to open the profile (null: opened by a link). */
  const pushedUrlRef = useRef<string | null>(null);

  // Fraction of the map hidden under the drawer (desktop only — on tablet it covers the list).
  const coveredRight =
    !isMobile && !isTablet && mapWidth > 0 ? Math.min(DRAWER_WIDTH / mapWidth, 0.8) : 0;

  const select = useCallback(
    (id: string, position?: LatLng) => {
      const opening = !selected;
      if (opening)
        returnFocusRef.current =
          document.activeElement instanceof HTMLElement ? document.activeElement : null;
      focusDrawerRef.current = true;
      revealedRef.current = id; // this call pans itself
      let center = position && bounds ? panTarget(position, bounds, coveredRight) : null;
      // The fallback map's art ends at its bbox: do not pan past it.
      if (center && bounds && isStatic)
        center = clampCenter(center, bounds, STATIC_MAP_BOUNDS, coveredRight);
      // Opening adds one history entry (Back closes the panel and restores the map position);
      // switching to another office while it is open replaces it.
      update(
        { selected: id, view: center ? { center, zoom: viewRef.current.zoom } : undefined },
        opening ? 'push' : 'replace',
      );
      if (opening || pushedUrlRef.current !== null) pushedUrlRef.current = currentUrl();
      if (id === selected) drawerRef.current?.focus({ preventScroll: true });
      if (isMobile)
        requestAnimationFrame(() =>
          mapRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
        );
    },
    [bounds, coveredRight, isMobile, isStatic, selected, update],
  );

  const close = useCallback(() => {
    restoreFocusRef.current = true;
    // Nothing changed since this session opened the panel: step back instead of adding an entry,
    // so the browser's Back button never re-opens the profile that was just closed.
    if (pushedUrlRef.current !== null && pushedUrlRef.current === currentUrl()) {
      pushedUrlRef.current = null;
      window.history.back();
      return;
    }
    // The fallback map was allowed to overshoot its east edge under the drawer — bring it back.
    const current = viewRef.current;
    const center =
      bounds && isStatic ? clampCenter(current.center, bounds, STATIC_MAP_BOUNDS) : current.center;
    const moved = center.lat !== current.center.lat || center.lng !== current.center.lng;
    update({ selected: null, view: moved ? { center, zoom: current.zoom } : undefined }, 'replace');
  }, [bounds, isStatic, update]);

  // Panel closed (✕, Escape, map click or the browser's Back): return focus to the card / marker
  // that opened it — after the render, when the list is no longer inert.
  useEffect(() => {
    if (selected) return;
    pushedUrlRef.current = null;
    const back = returnFocusRef.current;
    const restore = restoreFocusRef.current;
    returnFocusRef.current = null;
    restoreFocusRef.current = false;
    if (!back?.isConnected) return;
    const active = document.activeElement;
    if (restore || !active || active === document.body) back.focus({ preventScroll: true });
  }, [selected]);

  // Opened from a shared link (`?sel=`): once the office and the map are known, make sure its
  // marker is not hidden under the drawer or off screen. Runs once per selected office.
  const revealedRef = useRef<string | null>(null);
  const selectedPosition = detail.data ? { lat: detail.data.lat, lng: detail.data.lng } : null;
  const selectedLat = selectedPosition?.lat;
  const selectedLng = selectedPosition?.lng;
  useEffect(() => {
    if (!selected || selectedLat === undefined || selectedLng === undefined || !bounds) return;
    if (detail.data?.id !== selected || revealedRef.current === selected) return;
    revealedRef.current = selected;
    let center = panTarget({ lat: selectedLat, lng: selectedLng }, bounds, coveredRight);
    if (center && isStatic) center = clampCenter(center, bounds, STATIC_MAP_BOUNDS, coveredRight);
    if (center) update({ view: { center, zoom: viewRef.current.zoom } }, 'replace');
    // A pan right after opening is part of the same step.
    if (center && pushedUrlRef.current !== null) pushedUrlRef.current = currentUrl();
  }, [selected, selectedLat, selectedLng, detail.data?.id, bounds, coveredRight, isStatic, update]);

  // Move focus into the profile once it is on screen (only after an explicit selection).
  useEffect(() => {
    if (selected && focusDrawerRef.current) {
      focusDrawerRef.current = false;
      drawerRef.current?.focus({ preventScroll: true });
    }
  }, [selected]);

  const markers = useMemo(() => {
    const items: AgencySummary[] = map.data?.items ?? [];
    const withSelected =
      selected && detail.data && !items.some((a) => a.id === selected)
        ? [...items, detail.data]
        : items;
    return buildAgencyMarkers(withSelected, {
      zoom: view.zoom,
      selectedId: selected,
      maxLabels: isMobile ? 3 : 5,
    });
  }, [map.data, detail.data, selected, view.zoom, isMobile]);

  const onMarkerClick = (marker: MapMarker) => {
    if (isClusterId(marker.id)) {
      update(
        { view: { center: marker.position, zoom: clampZoom(Math.min(view.zoom + 2, 16)) } },
        'replace',
      );
      return;
    }
    select(marker.id, marker.position);
  };

  const zoomBy = (delta: number) =>
    update(
      { view: { center: view.center, zoom: clampZoom(Math.round(view.zoom + delta)) } },
      'replace',
    );

  const locate = () => {
    if (!('geolocation' in navigator)) {
      toast({ message: '이 브라우저에서는 내 위치를 사용할 수 없어요.', tone: 'error' });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const here = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        if (!isNearSuncheon(here)) {
          toast({ message: '지금 계신 곳은 순천 밖이에요. 지도를 직접 움직여 찾아보세요.' });
          return;
        }
        update({ view: { center: here, zoom: Math.max(viewRef.current.zoom, 15) } }, 'replace');
      },
      () =>
        toast({
          message: '위치 권한이 꺼져 있어요. 브라우저 설정에서 위치 사용을 허용해 주세요.',
          tone: 'error',
        }),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60_000 },
    );
  };

  const setFilters = useCallback(
    (patch: Partial<AgencyFilters>) => update({ filters: patch }, historyModeOf(patch)),
    [update],
  );

  /** 지역 filter applied: filter by the 읍면동 and move the map there in the same step. */
  const applyRegion = (region: AgencyRegion | null) => {
    const patch: AgencyUrlPatch = {
      filters: { emd: region?.emdCode ?? null, area: null },
      view:
        region?.lat != null && region.lng != null
          ? { center: { lat: region.lat, lng: region.lng }, zoom: Math.max(view.zoom, 14) }
          : undefined,
    };
    update(patch, 'replace');
  };

  // The Naver map draws its own scale control; the fallback map gets ours.
  const scale = bounds && isStatic ? scaleBar(bounds, mapWidth) : null;
  const sort = agencySortOf(filters.sort);
  const caption = resultCaption(filters);
  const filtered = caption !== '전체';
  const detailError = detail.error instanceof ApiError ? detail.error : null;

  const head = (
    <SearchHead
      filters={filters}
      onChange={setFilters}
      regions={regions.data?.items ?? []}
      totalOffices={regions.data?.total ?? null}
      asOf={asOf}
      onRegionApply={applyRegion}
    />
  );

  const summary = (
    <div className={styles.sum}>
      <p className={styles.count} aria-live="polite">
        {list.isPending ? (
          '중개사무소를 찾는 중…'
        ) : list.isError && offices.length === 0 ? (
          caption
        ) : (
          <>
            {caption} <b className="num">{formatCount(total)}</b>곳
          </>
        )}
      </p>
      <Popover
          placement="bottom-end"
          label="정렬"
          flush
          trigger={(p) => (
            <button type="button" className={styles.sortBtn} {...p}>
              <Icon name="sort" size={16} />
              {AGENCY_SORT_LABEL[sort]}
            </button>
          )}
        >
          {(closeMenu) => (
            <div className={styles.menu} role="radiogroup" aria-label="정렬 기준">
              {AGENCY_SORTS.map((s) => (
                <button
                  key={s}
                  type="button"
                  role="radio"
                  aria-checked={s === sort}
                  onClick={() => {
                    if (s !== sort) setFilters({ sort: s });
                    closeMenu();
                  }}
                >
                  {AGENCY_SORT_LABEL[s]}
                  {s === sort && <Icon name="check" size={16} />}
                </button>
              ))}
            </div>
          )}
        </Popover>
    </div>
  );

  const listNode = (
    <div className={styles.listWrap}>
      {list.isPending ? (
        <LoadingRegion label="중개사무소 목록을 불러오는 중" className={styles.list}>
          {Array.from({ length: 5 }, (_, i) => (
            <OfficeCardSkeleton key={i} />
          ))}
        </LoadingRegion>
      ) : list.isError && offices.length === 0 ? (
        <div className={styles.state}>
          <ErrorState
            compact
            title="목록을 불러오지 못했어요"
            description="네트워크 상태를 확인한 뒤 다시 시도해 주세요."
            onRetry={() => void list.refetch()}
          />
        </div>
      ) : offices.length === 0 ? (
        <div className={styles.state}>
          <EmptyState
            compact
            icon="store"
            title="조건에 맞는 중개사무소가 없어요"
            description={
              filters.q
                ? `'${filters.q}' 검색 결과가 없어요. 상호나 대표 이름, 도로명을 다시 확인해 보세요.`
                : '조건을 줄이거나 지도를 옮겨서 다시 찾아보세요.'
            }
            action={
              filtered ? (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => update({ resetFilters: true })}
                >
                  조건 초기화
                </Button>
              ) : undefined
            }
          />
        </div>
      ) : (
        <>
          <ul className={styles.list} aria-label={`${caption} 중개사무소 ${total}곳`}>
            {offices.map((agency) => (
              <li key={agency.id}>
                <OfficeCard
                  agency={agency}
                  selected={agency.id === selected}
                  onSelect={(a) => select(a.id, { lat: a.lat, lng: a.lng })}
                  headingLevel={2}
                />
              </li>
            ))}
          </ul>
          {list.hasNextPage ? (
            <div className={styles.more}>
              <Button
                variant="secondary"
                block
                loading={list.isFetchingNextPage}
                onClick={() => void list.fetchNextPage()}
              >
                {Math.min(AGENCY_LIST_PAGE_SIZE, total - offices.length)}곳 더 보기
              </Button>
              {list.isFetchNextPageError && (
                <p className={styles.end} role="alert">
                  더 불러오지 못했어요. 다시 눌러 주세요.
                </p>
              )}
            </div>
          ) : (
            offices.length > 5 && <p className={styles.end}>모든 중개사무소를 확인했어요.</p>
          )}
        </>
      )}
    </div>
  );

  const mapNode = (
    <section className={styles.mapv} ref={mapRef} aria-label="중개사무소 지도">
      <MapView
        center={view.center}
        zoom={view.zoom}
        markers={markers}
        selectedId={selected}
        onMarkerClick={onMarkerClick}
        onViewChange={onViewChange}
        onError={() => setMapImpl('static')}
        onMapClick={() => {
          if (selected && !isMobile) close();
        }}
        ariaLabel="중개사무소 지도"
      >
        <div className={styles.mapTop}>
          {map.isError && !map.data ? (
            <p className={styles.mapError} role="alert">
              지도 정보를 불러오지 못했어요
              <Button variant="ghost" size="sm" onClick={() => void map.refetch()}>
                다시 시도
              </Button>
            </p>
          ) : (
            <MapSummary
              className={styles.mapSum}
              title="현재 지도"
              stats={[
                {
                  label: '중개사무소',
                  value: map.data ? formatCount(map.data.total) : '–',
                  suffix: '곳',
                },
              ]}
            />
          )}
          <button
            type="button"
            className={styles.research}
            disabled={!bbox}
            onClick={() => bbox && setFilters({ area: bbox, emd: null })}
          >
            <Icon name="refresh" size={18} />이 지역에서 다시 검색
          </button>
        </div>
        <div className={styles.tools}>
          <MapZoomControl
            className={styles.zoom}
            onZoomIn={() => zoomBy(1)}
            onZoomOut={() => zoomBy(-1)}
          />
          <MapToolButton label="내 위치로 이동" className={styles.locate} onClick={locate}>
            <Icon name="locate" size={20} />
          </MapToolButton>
        </div>
        {scale && (
          <span className={styles.scale} aria-hidden="true">
            <i style={{ width: scale.width }} />
            {scale.label}
          </span>
        )}
      </MapView>
    </section>
  );

  const drawerNode = selected ? (
    <AgencyProfile
      ref={drawerRef}
      className={styles.drawer}
      agency={detail.data}
      preview={preview}
      isPending={detail.isPending}
      isError={detail.isError}
      notFound={detailError?.isNotFound || detailError?.status === 400}
      onRetry={() => void detail.refetch()}
      onClose={close}
    />
  ) : null;

  // DOM order = visual order, so keyboard and screen-reader order match the screen: mobile stacks
  // head → map → profile sheet → list; wider screens put the panel first, then map and drawer.
  return (
    <div className={cx(styles.page, selected && styles.withDrawer)}>
      {isMobile ? (
        <>
          {head}
          {mapNode}
          {drawerNode}
          {summary}
          {listNode}
        </>
      ) : (
        <>
          {/* Tablet: the profile covers the panel, so the list behind it leaves the tab order. */}
          <div className={styles.panel} inert={isTablet && !!selected}>
            {head}
            {summary}
            {listNode}
          </div>
          {mapNode}
          {drawerNode}
        </>
      )}
    </div>
  );
}

function OfficeCardSkeleton() {
  return (
    <div className={styles.skCard}>
      <div className={styles.skTop}>
        <Skeleton width={56} height={56} radius={12} />
        <div className={styles.skLines}>
          <Skeleton width="70%" height={18} />
          <Skeleton width="55%" height={14} />
          <Skeleton width="65%" height={14} />
        </div>
      </div>
      <div className={styles.skFoot}>
        <Skeleton width={150} height={28} radius={6} />
        <Skeleton width={72} height={36} radius={8} />
      </div>
    </div>
  );
}
