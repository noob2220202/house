'use client';
import { Skeleton } from '@house/ui';
import dynamic from 'next/dynamic';
import { useState, type ReactNode } from 'react';
import { env } from '@/config/env';
import type { LatLng, MapMarker, MapViewChange } from '@/lib/map/types';

export interface MapViewProps {
  /** Controlled view (keep it in the URL with `useMapUrlState`). */
  center: LatLng;
  zoom: number;
  markers: readonly MapMarker[];
  selectedId?: string | null;
  onMarkerClick?: (marker: MapMarker) => void;
  /** Fired (debounced) after pan/zoom and once on mount, with the visible bounds → refetch markers. */
  onViewChange?: (change: MapViewChange) => void;
  /** Click on empty map (deselect). */
  onMapClick?: (position: LatLng) => void;
  /** Naver SDK failed (bad key / network). MapView falls back to the static map automatically. */
  onError?: (error: Error) => void;
  /** Debounce of `onViewChange` in ms (default 200–250). */
  debounceMs?: number;
  /** Set false to disable pan/zoom (hero preview, mini maps). */
  interactive?: boolean;
  ariaLabel?: string;
  /** Overlay chrome (breadcrumb, summary, zoom, selected card…) — position absolutely inside. */
  children?: ReactNode;
  className?: string;
  /** Force an implementation (tests, mini maps). Default: Naver when a key is configured, else static. */
  impl?: 'naver' | 'static';
}

const loading = () => <Skeleton width="100%" height="100%" radius={0} style={{ minHeight: 240 }} />;
// Both implementations are heavy (SDK / large SVG) → code-split and client-only.
const NaverMapView = dynamic(() => import('./NaverMapView'), { ssr: false, loading });
const StaticMapView = dynamic(() => import('./StaticMapView'), { ssr: false, loading });

/**
 * The map abstraction. Same props for both implementations:
 * - NaverMapView (Naver Maps JS v3) when NEXT_PUBLIC_NAVER_MAP_KEY_ID is set
 * - StaticMapView (stylized Suncheon SVG) otherwise, and as a runtime fallback if the SDK fails.
 * Give the parent an explicit height; the map fills it.
 */
export function MapView({ impl, onError, ...props }: MapViewProps) {
  const [failed, setFailed] = useState(false);
  const useNaver = (impl ?? (env.naverMapKeyId ? 'naver' : 'static')) === 'naver' && !failed;
  if (useNaver) {
    return (
      <NaverMapView
        {...props}
        onError={(error) => {
          console.warn('[map] falling back to the static map:', error.message);
          setFailed(true);
          onError?.(error);
        }}
      />
    );
  }
  return <StaticMapView {...props} />;
}
